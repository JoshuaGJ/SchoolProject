from rest_framework import serializers
from .models import Market, Crop, PriceRecord


class MarketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Market
        fields = ["id", "name", "region_location", "village"]
        read_only_fields = ["id"]


class CropSerializer(serializers.ModelSerializer):
    class Meta:
        model = Crop
        fields = ["id", "name", "category"]
        read_only_fields = ["id"]


class PriceRecordSerializer(serializers.ModelSerializer):
    market = MarketSerializer(read_only=True)
    market_id = serializers.PrimaryKeyRelatedField(
        queryset=Market.objects.all(), source="market", write_only=True
    )

    crop = CropSerializer(read_only=True)
    crop_id = serializers.PrimaryKeyRelatedField(
        queryset=Crop.objects.all(), source="crop", write_only=True
    )

    class Meta:
        model = PriceRecord
        fields = [
            "id",
            "market",
            "market_id",
            "crop",
            "crop_id",
            "wholesale_price",
            "retail_price",
            "timestamp",
        ]
        read_only_fields = ["id", "timestamp"]
