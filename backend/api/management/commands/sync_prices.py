# api/management/commands/sync_prices.py
import requests
import io
import csv
from datetime import datetime, time
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from api.models import Market, Crop, PriceRecord  

class Command(BaseCommand):
    help = "Fetch, Pivot, and Sync Matrix Food Prices for Uganda from HDX to PostgreSQL"

    def handle(self, *args, **options):
        # Explicit target list matching the exact column names printed in your diagnostics
        TARGET_CROPS = [
            'beans', 'bananas', 'cassava', 'cassava_flour', 'groundnuts', 
            'maize', 'maize_flour', 'maize_meal', 'meat_beef', 'meat_goat', 
            'milk', 'millet', 'onions', 'oranges', 'potatoes', 'rice', 
            'sorghum', 'sugar', 'tomatoes'
        ]

        csv_url = "https://data.humdata.org/dataset/9fab0a16-4026-49fe-8731-b6503379bc28/resource/f571d255-2edb-4977-8c41-8de32cf24778/download/real-time-food-prices-for-uganda.csv"

        try:
            self.stdout.write("Downloading matrix data from HDX...")
            csv_response = requests.get(csv_url, timeout=30)
            csv_response.raise_for_status()
            
            csv_data = csv_response.content.decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(csv_data))
            
            records_saved = 0
            skipped_rows = 0

            with transaction.atomic():
                for row in csv_reader:
                    market_name = row.get('mkt_name')
                    date_str = row.get('DATES')
                    region = row.get('adm1_name') or 'Uganda'
                    village_loc = row.get('adm2_name') or ''

                    # Skip row if crucial identifiers are absent or contains metadata headers
                    if not market_name or not date_str or "#" in date_str or "dates" in date_str.lower():
                        skipped_rows += 1
                        continue

                    # Parse Date string formatted as "Jan 2007" or "Feb 2026"
                    try:
                        parsed_date = datetime.strptime(date_str.strip(), "%b %Y").date()
                    except ValueError:
                        # Fallback for standard YYYY-MM-DD variations if structural updates happen
                        try:
                            parsed_date = datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
                        except ValueError:
                            skipped_rows += 1
                            continue

                    # Format clean timezone-aware timestamp matching your model field constraints
                    naive_datetime = datetime.combine(parsed_date, time.min)
                    timestamp_aware = timezone.make_aware(naive_datetime, timezone.get_current_timezone())

                    # Save/get current Market reference context
                    market_obj, _ = Market.objects.get_or_create(
                        name=market_name.strip(),
                        defaults={
                            'region_location': region.strip(),
                            'village': village_loc.strip()
                        }
                    )

                    # Pivot Strategy: Iterate through potential crop columns in this row
                    for crop_key in TARGET_CROPS:
                        price_raw = row.get(crop_key)
                        
                        # Validate if column contains data for this entry
                        if not price_raw or price_raw.strip() == "":
                            continue

                        try:
                            # Safely isolate floats into model integer equivalents 
                            float_price = float(str(price_raw).replace(',', '').strip())
                            if float_price <= 0:
                                continue
                            numeric_price = int(float_price)

                            # Establish Crop record matching column key context
                            crop_clean_name = crop_key.replace('_', ' ').title() # E.g. 'maize_flour' -> 'Maize Flour'
                            crop_obj, _ = Crop.objects.get_or_create(
                                name=crop_clean_name,
                                defaults={'category': 'Staples & Agricultural Produce'}
                            )

                            # Look for an entry on the same calendar day to perform clean upserts
                            PriceRecord.objects.update_or_create(
                                market=market_obj,
                                crop=crop_obj,
                                timestamp__date=parsed_date,
                                defaults={
                                    'retail_price': numeric_price,
                                    'wholesale_price': 0, # Matrix defaults single metric profiles to retail track
                                    'timestamp': timestamp_aware
                                }
                            )
                            records_saved += 1

                        except (ValueError, TypeError):
                            continue

                    if records_saved > 0 and records_saved % 2000 == 0:
                        self.stdout.write(f"Ingested {records_saved} individual crop price historical observations...")

            self.stdout.write(self.style.SUCCESS(
                f"Successfully parsed matrix! Ingested {records_saved} individual price metrics into PostgreSQL database."
            ))

        except requests.exceptions.RequestException as e:
            self.stderr.write(self.style.ERROR(f"Network transport fault: {str(e)}"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Pipeline failure error: {str(e)}"))