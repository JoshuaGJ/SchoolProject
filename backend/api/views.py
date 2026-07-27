from datetime import timedelta

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import OuterRef, Subquery, Q, Max, Min, Avg, Count, F, FloatField, ExpressionWrapper
from django.db.models.functions import TruncMonth, TruncWeek
from django.utils import timezone
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from api.models import PriceRecord, Crop, UserPreference, AgentProfile,Market
from api.serializers import PriceRecordSerializer, CropSerializer, UserRegistrationSerializer, UserPreferenceSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken


TIMEFRAME_DAYS = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '5Y': 1825,
}

STAPLE_CATEGORY_HINTS = ('grain', 'cereal', 'legume', 'tuber', 'staple')


def _clean_terms(raw_value):
    if not raw_value:
        return []

    return [term.strip() for term in raw_value.split(',') if term.strip()]


def _bucket_expression(timeframe):
    return TruncWeek('timestamp') if timeframe in {'1M', '3M'} else TruncMonth('timestamp')


def _timeframe_cutoff(timeframe):
    days = TIMEFRAME_DAYS.get(timeframe, TIMEFRAME_DAYS['3M'])
    return timezone.now() - timedelta(days=days)


def _apply_filters(queryset, crop_names=None, regions=None, markets=None):
    if crop_names:
        queryset = queryset.filter(crop__name__in=crop_names)

    if regions:
        queryset = queryset.filter(market__region_location__in=regions)

    if markets:
        queryset = queryset.filter(market__name__in=markets)

    return queryset


def _format_currency(value):
    if value is None:
        return None
    return int(round(value))


def _stability_label(ratio):
    if ratio is None:
        return 'No trend data'
    if ratio >= 1.15:
        return 'Approaching peak season'
    if ratio <= 0.9:
        return 'Near seasonal low'
    if ratio >= 1.05:
        return 'Building toward a peak'
    if ratio <= 0.97:
        return 'Cooling toward a low'
    return 'Seasonally stable'


class AnalyticsOverviewView(APIView):
    """
    Returns aggregated analytics data for the Beyi dashboard.
    This endpoint keeps payloads compact by using grouped queries instead of raw row dumps.
    """

    def _base_queryset(self, request, cutoff):
        crop_names = _clean_terms(request.query_params.get('crop') or request.query_params.get('crops'))
        regions = _clean_terms(request.query_params.get('region') or request.query_params.get('regions'))
        markets = _clean_terms(request.query_params.get('market') or request.query_params.get('markets'))

        queryset = PriceRecord.objects.select_related('crop', 'market').filter(timestamp__gte=cutoff)
        return _apply_filters(queryset, crop_names=crop_names, regions=regions, markets=markets)

    def _chart_rows(self, queryset, timeframe, crop_names):
        bucket = _bucket_expression(timeframe)
        chart_queryset = queryset.annotate(period=bucket)

        if crop_names:
            chart_queryset = chart_queryset.filter(crop__name__in=crop_names)

        if not crop_names:
            crop_names = list(
                chart_queryset.values('crop__name')
                .annotate(record_count=Count('id'))
                .order_by('-record_count', 'crop__name')
                .values_list('crop__name', flat=True)[:3]
            )

        rows = chart_queryset.filter(crop__name__in=crop_names).values('period', 'crop__name').annotate(
            wholesale_price=Avg('wholesale_price'),
            retail_price=Avg('retail_price'),
            market_name=Max('market__name'),
            record_count=Count('id'),
        ).order_by('period', 'crop__name')

        return crop_names, list(rows)

    def get(self, request, format=None):
        timeframe = (request.query_params.get('timeframe') or '3M').upper()
        crop_names = _clean_terms(request.query_params.get('compare_crops') or request.query_params.get('crop'))
        selected_crop = request.query_params.get('arbitrage_crop') or (crop_names[0] if crop_names else '')

        cutoff = _timeframe_cutoff(timeframe)
        base_queryset = self._base_queryset(request, cutoff)
        active_count = base_queryset.count()

        chart_crops, chart_rows = self._chart_rows(base_queryset, timeframe, crop_names)
        if not selected_crop and chart_crops:
            selected_crop = chart_crops[0]

        surge_queryset = self._base_queryset(request, timezone.now() - timedelta(days=7))
        surge_candidates = Crop.objects.filter(price_records__in=surge_queryset).distinct().annotate(
            first_price=Subquery(
                surge_queryset.filter(crop=OuterRef('pk')).order_by('timestamp', 'id').values('wholesale_price')[:1]
            ),
            last_price=Subquery(
                surge_queryset.filter(crop=OuterRef('pk')).order_by('-timestamp', '-id').values('wholesale_price')[:1]
            ),
        )

        highest_surge = None
        highest_surge_value = None
        for crop in surge_candidates:
            first_price = crop.first_price
            last_price = crop.last_price
            if not first_price:
                continue

            change = ((last_price - first_price) / first_price) * 100 if last_price is not None else None
            if change is None:
                continue

            if highest_surge_value is None or change > highest_surge_value:
                highest_surge_value = change
                highest_surge = {
                    'crop': crop.name,
                    'category': crop.category,
                    'previous_price': _format_currency(first_price),
                    'latest_price': _format_currency(last_price),
                    'percentage_change': round(change, 2),
                }

        staple_queryset = base_queryset.filter(
            Q(crop__category__icontains=STAPLE_CATEGORY_HINTS[0]) |
            Q(crop__category__icontains=STAPLE_CATEGORY_HINTS[1]) |
            Q(crop__category__icontains=STAPLE_CATEGORY_HINTS[2]) |
            Q(crop__category__icontains=STAPLE_CATEGORY_HINTS[3]) |
            Q(crop__category__icontains=STAPLE_CATEGORY_HINTS[4])
        )
        most_affordable_hub = staple_queryset.values(
            'market_id', 'market__name', 'market__region_location'
        ).annotate(avg_wholesale=Avg('wholesale_price')).order_by('avg_wholesale', 'market__name').first()

        if not most_affordable_hub:
            most_affordable_hub = base_queryset.values(
                'market_id', 'market__name', 'market__region_location'
            ).annotate(avg_wholesale=Avg('wholesale_price')).order_by('avg_wholesale', 'market__name').first()

        stability_queryset = self._base_queryset(request, timezone.now() - timedelta(days=30))
        stability_candidates = Crop.objects.filter(price_records__in=stability_queryset).distinct().annotate(
            min_wholesale=Min('price_records__wholesale_price'),
            max_wholesale=Max('price_records__wholesale_price'),
            avg_wholesale=Avg('price_records__wholesale_price'),
            observation_count=Count('price_records'),
        ).annotate(
            price_range=ExpressionWrapper(
                F('max_wholesale') - F('min_wholesale'),
                output_field=FloatField(),
            )
        ).order_by('price_range', '-observation_count', 'name')
        stability_winner = stability_candidates.first()

        volatility_rows = list(
            base_queryset.values('crop__name', 'crop__category').annotate(
                average_wholesale=Avg('wholesale_price'),
                max_wholesale=Max('wholesale_price'),
                min_wholesale=Min('wholesale_price'),
                observation_count=Count('id'),
            ).annotate(
                price_range=ExpressionWrapper(
                    F('max_wholesale') - F('min_wholesale'),
                    output_field=FloatField(),
                )
            ).order_by('-price_range', '-observation_count', 'crop__name')[:10]
        )

        seasonal_insights = []
        seasonal_targets = chart_crops[:3] if chart_crops else [selected_crop] if selected_crop else []
        for crop_name in seasonal_targets:
            crop_queryset = base_queryset.filter(crop__name=crop_name)
            recent_avg = crop_queryset.filter(timestamp__gte=timezone.now() - timedelta(days=90)).aggregate(
                average=Avg('wholesale_price')
            )['average']
            long_avg = crop_queryset.aggregate(average=Avg('wholesale_price'))['average']
            ratio = (recent_avg / long_avg) if recent_avg and long_avg else None
            seasonal_insights.append({
                'crop': crop_name,
                'recent_average': _format_currency(recent_avg),
                'baseline_average': _format_currency(long_avg),
                'ratio': round(ratio, 3) if ratio is not None else None,
                'status': _stability_label(ratio),
            })

        arbitrage_rows = []
        if selected_crop:
            latest_timestamp = base_queryset.filter(crop__name=selected_crop).aggregate(latest=Max('timestamp'))['latest']
            if latest_timestamp:
                arbitrage_rows = list(
                    base_queryset.filter(
                        crop__name=selected_crop,
                        timestamp__date=latest_timestamp.date(),
                    ).values(
                        'market__name', 'market__region_location', 'market__village'
                    ).annotate(
                        wholesale_price=Avg('wholesale_price'),
                        retail_price=Avg('retail_price'),
                        observation_count=Count('id'),
                    ).order_by('wholesale_price', 'market__name')
                )

        available_crops = list(
            Crop.objects.filter(price_records__in=base_queryset).distinct().order_by('name').values('id', 'name', 'category')
        )
        available_regions = list(
            Market.objects.filter(price_records__in=base_queryset).distinct().order_by('region_location').values_list('region_location', flat=True)
        )
        available_markets = list(
            Market.objects.filter(price_records__in=base_queryset).distinct().order_by('name').values('id', 'name', 'region_location')
        )

        return Response({
            'filters': {
                'timeframe': timeframe,
                'selected_crop': selected_crop,
                'available_crops': available_crops,
                'available_regions': available_regions,
                'available_markets': available_markets,
            },
            'kpis': {
                'highest_price_surge': highest_surge,
                'most_affordable_hub': None if not most_affordable_hub else {
                    'market_id': most_affordable_hub['market_id'],
                    'market_name': most_affordable_hub['market__name'],
                    'region_location': most_affordable_hub['market__region_location'],
                    'average_wholesale': _format_currency(most_affordable_hub['avg_wholesale']),
                },
                'price_stability': None if not stability_winner else {
                    'crop': stability_winner.name,
                    'category': stability_winner.category,
                    'average_wholesale': _format_currency(stability_winner.avg_wholesale),
                    'price_range': _format_currency(stability_winner.price_range),
                    'observation_count': stability_winner.observation_count,
                },
                'total_tracked_entries': active_count,
            },
            'chart': {
                'bucket': 'week' if timeframe in {'1M', '3M'} else 'month',
                'crops': chart_crops,
                'rows': chart_rows,
            },
            'arbitrage': {
                'crop': selected_crop,
                'rows': arbitrage_rows,
            },
            'volatility': volatility_rows,
            'seasonal_insights': seasonal_insights,
        }, status=status.HTTP_200_OK)

class CropListView(APIView):
    """
    Returns a clean list of all available crops.
    Used to populate selection dropdown menus in the React user interface.
    """
    def get(self, request, format=None):
        crops = Crop.objects.all().order_by('name')
        serializer = CropSerializer(crops, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class HistoricalPriceAnalyticsView(APIView):
    """
    Returns time-series price coordinates filtered by crop name for React trend lines.
    URL Path Example: /api/prices/analytics/?crop=Beans
    """
    def get(self, request, format=None):
        crop_param = request.query_params.get('crop', None)
        
        # Pull chronological records so chart trend lines map correctly left-to-right
        records = PriceRecord.objects.all().order_by('timestamp')
        
        if crop_param:
            records = records.filter(crop__name__iexact=crop_param.strip())
            
        # Limit to the most recent 1,000 historical records to keep network payloads fast
        serializer = PriceRecordSerializer(records[:1000], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

    

class MarketPriceSearchAPIView(ListAPIView):
    """
    Advanced Endpoint for searching markets and filtering crop prices.
    
    Supported URL parameters:
    - Search Market Name:  /api/prices/search/?search=Kampala
    - Filter by Category: /api/prices/search/?crop__category=Grains
    - Combined Query:     /api/prices/search/?search=Gulu&crop__name=Maize
    """
    serializer_class = PriceRecordSerializer
    
    # Enable both strict field filtering and fuzzy text searching
    filter_backends = [DjangoFilterBackend, SearchFilter]
    
    # 1. Exact matching lookups
    filterset_fields = {
        'crop__name': ['iexact', 'icontains'],
        'crop__category': ['iexact'],
        'market__name': ['iexact', 'icontains'],
    }
    
    # 2. Text search fields (crop-centric search for the React search bar)
    search_fields = [
        'crop__name',
        'crop__category',
        'market__name',
        'market__region_location',
        'market__village',
    ]

    def get_queryset(self):
        """
        Return only the latest price record per market.
        Uses distinct() with ordering for better performance.
        
        # Return only the latest price record per market and crop.
        latest_market_crop_record = PriceRecord.objects.filter(
            market=OuterRef('market'),
            crop=OuterRef('crop'),
        ).order_by('-timestamp', '-id')

        return PriceRecord.objects.filter(
            id=Subquery(latest_market_crop_record.values('id')[:1])
        ).select_related('crop', 'market').order_by('-timestamp')
        """
        return PriceRecord.objects.select_related('crop', 'market').order_by('-timestamp')
        

class RegisterUserView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "User account created successfully!"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EmailLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '')

        if not email or not password:
            return Response({"detail": "Email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"detail": "Unable to log in with the provided email and password."}, status=status.HTTP_401_UNAUTHORIZED)

        authenticated_user = authenticate(username=user.username, password=password)
        if not authenticated_user:
            return Response({"detail": "Unable to log in with the provided email and password."}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(authenticated_user)
        role = 'agent' if hasattr(authenticated_user, 'agent_profile') else 'farmer'
        assigned_region = authenticated_user.agent_profile.assigned_region if role == 'agent' else ''
        full_name = f"{authenticated_user.first_name} {authenticated_user.last_name}".strip() or authenticated_user.get_full_name().strip() or authenticated_user.username
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "role": role,
            "assigned_region": assigned_region,
            "full_name": full_name,
        }, status=status.HTTP_200_OK)

class TogglePinCropView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        crop_id = request.data.get('crop_id')
        try:
            crop = Crop.objects.get(id=crop_id)
            #Fetch or create safety boundary for user preferences
            pref, _ = UserPreference.objects.get_or_create(user=request.user)

            if crop in pref.pinned_crops.all():
                pref.pinned_crops.remove(crop)
                return Response({"status": "unpinned","message": f"Removed{crop.name} from your feed."}, status=status.HTTP_200_OK)
            else:
                pref.pinned_crops.add(crop)
                return Response({"status": "pinned", "message": f"Pinned {crop.name} to your feed."}, status=status.HTTP_200_OK)
        except Crop.DoesNotExist:
            return Response({"error": "Crop record not found"}, status=status.HTTP_404_NOT_FOUND)


class UserFavoritesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pref, _ = UserPreference.objects.get_or_create(user=request.user)
        return Response(UserPreferenceSerializer(pref).data, status=status.HTTP_200_OK)


# 3. Agent Execution Actions Endpoint
class AgentMarketActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Strict Role Authorization Boundary Verification Check
        try:
            agent_profile = request.user.agent_profile
        except AgentProfile.DoesNotExist:
            return Response({"error": "Access Denied: Only regional agents can perform data entries."}, status=status.HTTP_403_FORBIDDEN)
        
        # Inside this boundary, the validated Agent can now submit new data configurations
        action_type = request.data.get('action') # e.g., 'create_market' or 'log_price'
        
        if action_type == 'create_market':
            market_name = request.data.get('name')
            if not market_name:
                return Response({"error": "Market name required"}, status=status.HTTP_400_BAD_REQUEST)
                
            market, created = Market.objects.get_or_create(
                name=market_name.strip(),
                defaults={'region_location': agent_profile.assigned_region}
            )
            return Response({"message": f"Market {'created' if created else 'already exists'} in {agent_profile.assigned_region}."}, status=status.HTTP_201_CREATED)

        if action_type == 'log_price':
            market_name = request.data.get('market_name')
            crop_name = request.data.get('crop_name')
            price_value = request.data.get('price')
            unit = request.data.get('unit', 'kg')

            if not market_name or not crop_name or price_value in (None, ''):
                return Response({"error": "Market name, crop name, and price are required."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                normalized_price = int(float(price_value))
            except (TypeError, ValueError):
                return Response({"error": "Price must be a valid number."}, status=status.HTTP_400_BAD_REQUEST)

            market, _ = Market.objects.get_or_create(
                name=market_name.strip(),
                defaults={'region_location': agent_profile.assigned_region}
            )

            crop, _ = Crop.objects.get_or_create(
                name=crop_name.strip().title(),
                defaults={'category': unit.strip().title() if unit else 'Uncategorized'}
            )

            price_record = PriceRecord.objects.create(
                market=market,
                crop=crop,
                wholesale_price=normalized_price,
                retail_price=normalized_price,
            )

            return Response({
                "message": f"Logged price for {crop.name} at {market.name}.",
                "price_record": PriceRecordSerializer(price_record).data,
            }, status=status.HTTP_201_CREATED)
            
        return Response({"error": "Invalid action profile specification"}, status=status.HTTP_400_BAD_REQUEST)
    


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated] # 🌟 Ensures request.user is populated via JWT
 
    def get(self, request):
        user = request.user
        role = 'Agent' if hasattr(user, 'agent_profile') else 'Farmer'
        full_name = f"{user.first_name} {user.last_name}".strip() or user.get_full_name().strip() or user.username
        return Response({
            'id': user.id,
            'email': user.email,
            'full_name': full_name,
            'role': role,
            'date_joined': user.date_joined.isoformat(),
            'assigned_region': getattr(getattr(user, 'agent_profile', None), 'assigned_region', ''),
        })