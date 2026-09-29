import math
import random
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import Market, Crop, PriceRecord


class Command(BaseCommand):
    help = "Clears existing price records and seeds 5 years of weekly market data."

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Clearing existing PriceRecords..."))
        PriceRecord.objects.all().delete()

        # 1. Define and get/create 5 Kampala Markets
        markets_data = [
            {"name": "Usafi Market", "region_location": "Kampala"},
            {"name": "Nakasero Market", "region_location": "Kampala"},
            {"name": "Kalerwe Market", "region_location": "Kampala"},
            {"name": "Owino Market", "region_location": "Kampala"},
            {"name": "Kibuye Market", "region_location": "Kampala"},
        ]

        markets = []
        for mdata in markets_data:
            market, _ = Market.objects.get_or_create(
                name=mdata["name"],
                defaults={"region_location": mdata["region_location"]},
            )
            markets.append(market)

        # 2. Define and get/create 10 Crops with base wholesale price and seasonal peak week
        crops_data = [
            {"name": "Maize Grain", "category": "Grains", "base_wholesale": 1250, "peak_week": 18},
            {"name": "Nambale Beans", "category": "Legumes", "base_wholesale": 3500, "peak_week": 20},
            {"name": "Yellow Beans", "category": "Legumes", "base_wholesale": 3900, "peak_week": 20},
            {"name": "Super Rice", "category": "Grains", "base_wholesale": 4800, "peak_week": 48},
            {"name": "Matooke", "category": "Plantains", "base_wholesale": 15000, "peak_week": 18},
            {"name": "Groundnuts", "category": "Legumes", "base_wholesale": 6000, "peak_week": 22},
            {"name": "Cassava Flour", "category": "Tubers", "base_wholesale": 1800, "peak_week": 18},
            {"name": "Fresh Milk", "category": "Dairy", "base_wholesale": 1400, "peak_week": 6},
            {"name": "Sorghum", "category": "Grains", "base_wholesale": 1600, "peak_week": 20},
            {"name": "Robusta Coffee FAQ", "category": "Cash Crops", "base_wholesale": 7500, "peak_week": 40},
        ]

        crops = []
        for cdata in crops_data:
            crop, _ = Crop.objects.get_or_create(
                name=cdata["name"],
                defaults={"category": cdata["category"]},
            )
            crops.append({
                "model": crop,
                "base_wholesale": cdata["base_wholesale"],
                "peak_week": cdata["peak_week"],
            })

        # 3. Generate 5 years of weekly timestamps (Oct 2021 to Sep 2026)
        start_date = datetime(2021, 10, 4)
        end_date = datetime(2026, 9, 28)
        current_date = start_date

        timestamps = []
        while current_date <= end_date:
            # Make timestamp timezone aware to match Django settings
            aware_dt = timezone.make_aware(current_date, timezone.get_current_timezone())
            timestamps.append(aware_dt)
            current_date += timedelta(weeks=1)

        self.stdout.write(f"Generating price history across {len(timestamps)} weeks for {len(crops)} crops in {len(markets)} markets...")

        # 4. Generate PriceRecords in memory
        price_records_to_create = []

        for dt in timestamps:
            year_offset = dt.year - 2021
            week_num = dt.isocalendar()[1]

            for crop_info in crops:
                crop_obj = crop_info["model"]
                base_wholesale = crop_info["base_wholesale"]
                peak_week = crop_info["peak_week"]

                # Calculate realistic price curves
                annual_drift = 1 + (year_offset * 0.04)  # 4% yearly inflation
                seasonal_factor = 1 + (0.12 * math.sin(2 * math.pi * (week_num - peak_week) / 52.0))

                for market_obj in markets:
                    # Weekly micro fluctuation
                    noise = random.randint(-50, 50)
                    
                    calculated_wholesale = (base_wholesale * annual_drift * seasonal_factor) + noise
                    # Round to nearest 50 USh
                    wholesale_price = max(100, int(round(calculated_wholesale / 50.0) * 50))

                    # Retail margin (18% - 28% above wholesale)
                    margin = random.uniform(1.18, 1.28)
                    calculated_retail = wholesale_price * margin
                    retail_price = max(wholesale_price + 100, int(round(calculated_retail / 50.0) * 50))

                    price_records_to_create.append(
                        PriceRecord(
                            market=market_obj,
                            crop=crop_obj,
                            wholesale_price=wholesale_price,
                            retail_price=retail_price,
                            timestamp=dt,
                        )
                    )

        # 5. Bulk insert in chunks for high performance
        self.stdout.write(f"Bulk inserting {len(price_records_to_create)} records into PostgreSQL...")
        PriceRecord.objects.bulk_create(price_records_to_create, batch_size=2000)

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {len(price_records_to_create)} historical price records!"
            )
        )