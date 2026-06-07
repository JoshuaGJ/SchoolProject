from django.contrib import admin
from .models import Market, Crop, PriceRecord


@admin.register(Market)
class MarketAdmin(admin.ModelAdmin):
	list_display = ("name", "region_location", "village")
	search_fields = ("name", "region_location", "village")
	list_filter = ("region_location",)


@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
	list_display = ("name", "category")
	search_fields = ("name", "category")
	list_filter = ("category",)


@admin.register(PriceRecord)
class PriceRecordAdmin(admin.ModelAdmin):
	list_display = ("crop", "market", "wholesale_price", "retail_price", "timestamp")
	search_fields = ("crop__name", "market__name")
	list_filter = ("market", "crop")
	date_hierarchy = "timestamp"

