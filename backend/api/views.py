from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from api.models import PriceRecord, Crop
from api.serializers import PriceRecordSerializer, CropSerializer

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
    queryset = PriceRecord.objects.all().order_by('-timestamp')
    serializer_class = PriceRecordSerializer
    
    # Enable both strict field filtering and fuzzy text searching
    filter_backends = [DjangoFilterBackend, SearchFilter]
    
    # 1. Exact matching lookups
    filterset_fields = {
        'crop__name': ['iexact', 'icontains'],
        'crop__category': ['iexact'],
    }
    
    # 2. Text search fields (this hooks up directly to your React search bar)
    search_fields = ['market__name', 'market__region_location']