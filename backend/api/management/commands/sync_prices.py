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
    help = "Fetch WFP Food Prices for Uganda filtered for the past 5 years (2021-2026) and store in PostgreSQL"

    def handle(self, *args, **options):
        self.stdout.write("Connecting to HDX for WFP Uganda Food Prices...")
        
        # 1. Fetch metadata for the WFP transaction dataset
        hdx_url = "https://data.humdata.org/api/3/action/package_show?id=wfp-food-prices-for-uganda"
        try:
            response = requests.get(hdx_url, timeout=15).json()
            if not response.get("success"):
                self.stderr.write(self.style.ERROR("Failed to fetch WFP dataset metadata."))
                return
            
            # 2. Extract the primary CSV URL
            resources = response["result"]["resources"]
            csv_url = None
            for resource in resources:
                if resource.get("format", "").lower() == "csv":
                    csv_url = resource.get("url")
                    break
            
            if not csv_url:
                self.stderr.write(self.style.ERROR("Could not locate the WFP CSV resource."))
                return

            # 3. Stream and parse data
            self.stdout.write("Streaming live data from WFP... Trimming to past 5 years...")
            csv_response = requests.get(csv_url, timeout=30)
            csv_response.raise_for_status()
            
            csv_data = csv_response.content.decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(csv_data))
            
            count = 0
            skipped_old = 0
            skipped_malformed = 0
            
            # 4. Ingest filtered rows inside an atomic transaction block
            with transaction.atomic():
                for row in csv_reader:
                    date_str = row.get('date')
                    market_name = row.get('market')
                    region = row.get('admin1') or 'Uganda'
                    village_loc = row.get('admin2') or ''
                    commodity_name = row.get('commodity')
                    category_name = row.get('category') or 'Staples'
                    price_val = row.get('price')
                    price_type = (row.get('pricetype') or 'retail').lower()

                    # Guard Rail: Ignore the text metadata description row
                    if not date_str or "#" in date_str or "date" in date_str.lower():
                        skipped_malformed += 1
                        continue
                        
                    if not (market_name and commodity_name and price_val):
                        skipped_malformed += 1
                        continue

                    try:
                        # Parse date string first to execute the 5-year timeline trim
                        parsed_date = datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
                        
                        # CRITICAL TIME CUTOFF: Only accept records from 2021 through 2026
                        if parsed_date.year < 2021:
                            skipped_old += 1
                            continue

                        # Clean numbers and format strings safely
                        clean_price = str(price_val).replace(',', '').strip()
                        float_price = float(clean_price)
                        if float_price <= 0:
                            continue
                        numeric_price = int(float_price) 
                        
                        # Format into database timezone-aware structure
                        naive_datetime = datetime.combine(parsed_date, time.min)
                        timestamp_aware = timezone.make_aware(naive_datetime, timezone.get_current_timezone())
                        
                        # Populate Foreign Key records
                        market_obj, _ = Market.objects.get_or_create(
                            name=market_name.strip(),
                            defaults={
                                'region_location': region.strip(),
                                'village': village_loc.strip()
                            }
                        )
                        
                        crop_obj, _ = Crop.objects.get_or_create(
                            name=commodity_name.strip().title(),
                            defaults={'category': category_name.strip().title()}
                        )
                        
                        # Separate wholesale and retail metrics
                        w_price = 0
                        r_price = 0
                        if 'wholesale' in price_type:
                            w_price = numeric_price
                        else:
                            r_price = numeric_price

                        # Upsert check: Combine records on matching days
                        existing_record = PriceRecord.objects.filter(
                            market=market_obj,
                            crop=crop_obj,
                            timestamp__date=parsed_date
                        ).first()

                        if existing_record:
                            if w_price > 0:
                                existing_record.wholesale_price = w_price
                            if r_price > 0:
                                existing_record.retail_price = r_price
                            existing_record.save()
                        else:
                            PriceRecord.objects.create(
                                market=market_obj,
                                crop=crop_obj,
                                wholesale_price=w_price,
                                retail_price=r_price,
                                timestamp=timestamp_aware
                            )
                        count += 1
                        
                        if count % 2000 == 0:
                            self.stdout.write(f"Imported {count} recent data entries...")
                            
                    except (ValueError, TypeError):
                        skipped_malformed += 1
                        continue

            self.stdout.write(self.style.SUCCESS(
                f"Successfully updated! Ingested {count} recent price metrics into PostgreSQL.\n"
                f"Filtered out and skipped {skipped_old} legacy historical records pre-2021."
            ))

        except requests.exceptions.RequestException as e:
            self.stderr.write(self.style.ERROR(f"Network error: {str(e)}"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"System failure: {str(e)}"))