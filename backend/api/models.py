from django.db import models
from django.utils import timezone


# Models for Agricultural Market Transparency and Analytics
# - Market: represents a physical market or trading center
# - Crop: represents a crop/product and its category
# - PriceRecord: price observation for a crop at a market with timestamp


class Market(models.Model):
	# Human-readable name for the market (unique)
	name = models.CharField(
		max_length=200,
		unique=True,
		verbose_name="Market Name",
		help_text="Unique market or trading center name (e.g. Kampala Market)",
	)

	# Region or administrative area where the market is located
	region_location = models.CharField(
		max_length=100,
		verbose_name="Region / Location",
		help_text="Region or town where the market is located (e.g. Kampala, Gulu)",
	)

	# Optional: small free-text field for village or sub-location
	village = models.CharField(
		max_length=150,
		blank=True,
		verbose_name="Village / Sub-location",
		help_text="Optional village or sub-location within the region",
	)

	class Meta:
		verbose_name = "Market"
		verbose_name_plural = "Markets"
		ordering = ["region_location", "name"]

	def __str__(self):
		# Display as 'Market Name — Region (Village)' when available
		parts = [self.name, f"{self.region_location}"]
		if self.village:
			parts.append(f"({self.village})")
		return " — ".join(parts)


class Crop(models.Model):
	# Crop/product name (unique)
	name = models.CharField(
		max_length=150,
		unique=True,
		verbose_name="Crop Name",
		help_text="Name of the crop or product (e.g. Maize, Cassava)",
	)

	# Category like Grains, Tubers, Vegetables, Fruits
	category = models.CharField(
		max_length=100,
		verbose_name="Category",
		help_text="Category of the crop (e.g. Grains, Tubers, Vegetables)",
	)

	class Meta:
		verbose_name = "Crop"
		verbose_name_plural = "Crops"
		ordering = ["category", "name"]

	def __str__(self):
		return f"{self.name} ({self.category})"


class PriceRecord(models.Model):
	# ForeignKey to the Market where the price was observed
	market = models.ForeignKey(
		Market,
		on_delete=models.CASCADE,
		related_name="price_records",
		verbose_name="Market",
		help_text="Market where this price was observed",
	)

	# ForeignKey to the Crop for which the prices apply
	crop = models.ForeignKey(
		Crop,
		on_delete=models.CASCADE,
		related_name="price_records",
		verbose_name="Crop",
		help_text="Crop or product for this price record",
	)

	# Raw numeric wholesale price (integer stored in smallest currency unit, if applicable)
	wholesale_price = models.IntegerField(
		verbose_name="Wholesale Price",
		help_text="Wholesale price (raw numeric). Store in the smallest currency unit if needed.",
	)

	# Raw numeric retail price
	retail_price = models.IntegerField(
		verbose_name="Retail Price",
		help_text="Retail price (raw numeric). Store in the smallest currency unit if needed.",
	)

	# Timestamp when this price record was recorded or scraped
	timestamp = models.DateTimeField(
		default=timezone.now,
		verbose_name="Recorded At",
		help_text="When the price was observed or scraped",
	)

	class Meta:
		verbose_name = "Price Record"
		verbose_name_plural = "Price Records"
		ordering = ["-timestamp"]
		indexes = [
			models.Index(fields=["market", "crop", "timestamp"]),
		]

	def __str__(self):
		ts = self.timestamp.strftime("%Y-%m-%d %H:%M") if self.timestamp else "(no time)"
		return f"{self.crop.name} @ {self.market.name}: W={self.wholesale_price} R={self.retail_price} on {ts}"

