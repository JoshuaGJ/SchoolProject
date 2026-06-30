from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import OuterRef, Subquery,Q, Max
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from api.models import PriceRecord, Crop, UserPreference, AgentProfile,Market
from api.serializers import PriceRecordSerializer, CropSerializer, UserRegistrationSerializer, UserPreferenceSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

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
        
        return PriceRecord.objects.filter(
            id__in=PriceRecord.objects.values('market')
            .annotate(latest_id=Max('id'))
            .values('latest_id')
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
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "role": role,
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
                pref.pinned_cropa.remove(crop)
                return Response({"status": "unpinned","message": f"Removed{crop.name} from your feed."}, status=status.HTTP_200_OK)
            else:
                pref.pinned_crops.add(crop)
                return Response({"status": "pinned", "message": f"Pinned {crop.name} to your feed."}, status=status.HTTP_200_OK)
        except Crop.DoesNotExist:
            return Response({"error": "Crop record not found"}, status=status.HTTP_404_NOT_FOUND)


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
            
        return Response({"error": "Invalid action profile specification"}, status=status.HTTP_400_BAD_REQUEST)
