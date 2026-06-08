from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
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