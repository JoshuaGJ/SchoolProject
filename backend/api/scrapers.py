"""
Multi-source scraper for the `api` app.

This module implements `scrape_market_prices(source="farmgain", market=None, use_mock=False)`
and includes:
 - logging
 - rate limiting (randomized 2-3s)
 - retry with exponential backoff (using tenacity)
 - user-agent rotation
 - parsing modes: table, div/card, json
 - config validation
 - bulk_create for PriceRecord inserts

Inspect and update `sources_config` selectors before running against a live site.
"""

import json
import logging
import random
import re
import threading
import time
from typing import Any, Dict, List, Optional

import requests
from bs4 import BeautifulSoup
from django.utils import timezone

from tenacity import retry, stop_after_attempt, wait_exponential

from .models import Market, Crop, PriceRecord


logger = logging.getLogger(__name__)


# A simple global lock/last-call tracker to enforce rate limiting across threads
_rate_limit_lock = threading.Lock()
_last_request_time = 0.0


def rate_limited(min_delay: float = 2.0, max_delay: float = 3.0):
    """Decorator to ensure at least `min_delay`-`max_delay` seconds between requests."""

    def decorator(func):
        def wrapper(*args, **kwargs):
            global _last_request_time
            with _rate_limit_lock:
                now = time.time()
                # randomize the required delay in the window
                required = random.uniform(min_delay, max_delay)
                elapsed = now - _last_request_time
                if elapsed < required:
                    to_sleep = required - elapsed
                    logger.debug("Rate limit sleeping for %.2fs", to_sleep)
                    time.sleep(to_sleep)
                _last_request_time = time.time()
            return func(*args, **kwargs)

        return wrapper

    return decorator


# A list of rotating user agents (short sample list, extend as needed)
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Mobile Safari/537.36",
]


def _rotate_user_agent() -> str:
    return random.choice(USER_AGENTS)


def validate_config(sources: Dict[str, Dict[str, Any]]) -> List[str]:
    """Validate source configurations and return a list of error messages (empty if OK)."""
    errors = []
    for name, conf in sources.items():
        if "url" not in conf:
            errors.append(f"{name}: missing 'url'")
        if "selector_type" not in conf:
            errors.append(f"{name}: missing 'selector_type'")
        else:
            st = conf["selector_type"]
            if st == "table":
                if "table_selector" not in conf and "column_mapping" not in conf:
                    errors.append(f"{name}: table selector or column_mapping required for 'table' selector_type")
            elif st == "div":
                if "div_selector" not in conf or "extractors" not in conf:
                    errors.append(f"{name}: div_selector and extractors required for 'div' selector_type")
            elif st == "json":
                if "json_path" not in conf and "items_path" not in conf:
                    errors.append(f"{name}: json_path or items_path required for 'json' selector_type")
            else:
                errors.append(f"{name}: unknown selector_type '{st}'")
    return errors


# --- Editable runtime constants ---
# Change these to tune politeness and retry behavior per target site's policy.
RATE_LIMIT_MIN = 2.0  # minimum seconds between requests
RATE_LIMIT_MAX = 3.0  # maximum randomized seconds between requests

RETRY_ATTEMPTS = 3
RETRY_BACKOFF_MULTIPLIER = 2  # tenacity multiplier for exponential backoff
RETRY_MIN = 2  # minimum backoff seconds
RETRY_MAX = 8  # maximum backoff seconds


# Top-level sources configuration. Edit selectors, headers and mappings here
# instead of inside the function. This makes it easier to add new sources.
SOURCES_CONFIG: Dict[str, Dict[str, Any]] = {
    "farmgain": {
        "url": "https://farmgainafrica.org/uganda/markets/{market}",
        "selector_type": "table",
        "table_selector": "table.price-table",
        "column_mapping": {"crop": 0, "market": 1, "wholesale": 2, "retail": 3},
        "headers": {"Accept-Language": "en-US,en;q=0.9"},
    },
    "abcd": {
        "url": "https://abcd.portal.go.ug/prices",
        # The government portal often publishes tabular data. Use a table selector
        # by default but keep a loose fallback in the scraper itself.
        "selector_type": "table",
        "table_selector": "table",  # fallback to any table if a specific class isn't present
        "column_mapping": {"crop": 0, "market": 1, "wholesale": 2, "retail": 3},
        "headers": {"Referer": "https://abcd.portal.go.ug", "Accept-Language": "en-US,en;q=0.9"},
    },
    "jsonsource": {
        "url": "https://example.com/api/prices?market={market}",
        "selector_type": "json",
        "items_path": "data.items",
        "json_path": {"crop": "product.name", "market": "market.name", "wholesale": "prices.wholesale", "retail": "prices.retail"},
        "headers": {"Accept": "application/json"},
    },
}


# Simple mock HTML used for `--use-mock` testing when a live fetch is not desired.
# These are intentionally small but representative snippets matching the selectors
# in `SOURCES_CONFIG` so the parsing logic can be validated without network.
_MOCK_TABLE_HTML = """
<html><body>
<table class="price-table">
    <tr><th>Crop</th><th>Market</th><th>Wholesale</th><th>Retail</th></tr>
    <tr><td>Bananas</td><td>Nakasero</td><td>UGX 1,200/=</td><td>UGX 1,400/=</td></tr>
    <tr><td>Maize</td><td>Nakasero</td><td>UGX 900/=</td><td>UGX 1,000/=</td></tr>
</table>
</body></html>
"""


_MOCK_DIV_HTML = """
<html><body>
    <div class="price-card">
        <h3 class="product-name">Bananas</h3>
        <div class="location">Nakasero</div>
        <div class="wholesale-price">UGX 1,200/=</div>
        <div class="retail-price">UGX 1,400/=</div>
    </div>
    <div class="price-card">
        <h3 class="product-name">Maize</h3>
        <div class="location">Nakasero</div>
        <div class="wholesale-price">UGX 900/=</div>
        <div class="retail-price">UGX 1,000/=</div>
    </div>
</body></html>
"""


@rate_limited(min_delay=RATE_LIMIT_MIN, max_delay=RATE_LIMIT_MAX)
@retry(stop=stop_after_attempt(RETRY_ATTEMPTS), wait=wait_exponential(multiplier=RETRY_BACKOFF_MULTIPLIER, min=RETRY_MIN, max=RETRY_MAX), reraise=True)
def _fetch(url: str, headers: Optional[Dict[str, str]] = None, timeout: int = 10) -> requests.Response:
    hdrs = headers.copy() if headers else {}
    # rotate/override User-Agent unless explicitly provided
    if "User-Agent" not in hdrs:
        hdrs["User-Agent"] = _rotate_user_agent()
    logger.debug("Fetching URL %s with headers %s", url, {k: v for k, v in hdrs.items() if k != "Cookie"})
    resp = requests.get(url, headers=hdrs, timeout=timeout)
    resp.raise_for_status()
    return resp


def _extract_json_value(obj: Any, path: str):
    """Extract value from nested JSON object using dot-separated path.

    Example: path 'data.items' will return obj['data']['items'] if present.
    """
    parts = path.split(".")
    cur = obj
    try:
        for p in parts:
            if isinstance(cur, list):
                # try integer index
                idx = int(p)
                cur = cur[idx]
            else:
                cur = cur.get(p)
        return cur
    except Exception:
        return None


def _clean_price_enhanced(text: str) -> Optional[int]:
    """Handle a variety of Ugandan price formats and return an int or None.

    Handles examples like:
      - 'UGX 1,200/='
      - '1,200 UGX'
      - '1.200' (period as thousand separator)
      - 'UGX 1,200/= only'
    """
    if text is None:
        return None
    s = str(text).strip()
    # Remove trailing words like '/=' or 'only'
    s = re.sub(r"/=|only", "", s, flags=re.IGNORECASE)
    # Remove currency tokens (UGX, Ush, etc.) anywhere
    s = re.sub(r"\b(UGX|Ugx|ugx|Ush|ush)\b", "", s)
    # Convert periods used as thousand separators to nothing, and commas too
    # But if the number uses decimal fraction (unlikely for prices), drop decimals
    s = s.replace(",", "").replace(".", "")
    # Keep minus sign and digits only
    cleaned = re.sub(r"[^0-9-]", "", s).strip()
    if cleaned == "":
        return None
    try:
        return int(cleaned)
    except ValueError:
        return None


def scrape_market_prices(source: str = "farmgain", market: Optional[str] = None, use_mock: bool = False) -> int:
    """Main scraping entry point keeping the original signature for backwards compatibility.

    Returns the number of created PriceRecord rows.
    """

    # Validate configuration
    val_errors = validate_config(SOURCES_CONFIG)
    if val_errors:
        for e in val_errors:
            logger.error("Source config error: %s", e)
        return 0

    config = SOURCES_CONFIG.get(source)
    if not config:
        logger.error("Unknown source: %s", source)
        return 0

    created_count = 0
    records_to_create = []

    # Decide HTML/JSON to parse
    if use_mock:
        html = _MOCK_TABLE_HTML if config["selector_type"] == "table" else _MOCK_DIV_HTML
        data_json = None
    else:
        # Build URL safely: if the URL template contains '{market}' but market is None,
        # remove the placeholder segment to avoid '.../markets/None'.
        raw_url = config["url"]
        if "{market}" in raw_url:
            if market:
                url = raw_url.format(market=market)
            else:
                # remove '/{market}' or '{market}' occurrences
                url = raw_url.replace("/{market}", "").replace("{market}", "")
        else:
            url = raw_url
        headers = config.get("headers", {})
        headers = headers.copy()
        # Ensure a User-Agent exists; rotation happens in _fetch
        try:
            resp = _fetch(url, headers=headers)
        except Exception as e:
            logger.error("Failed to fetch %s: %s", url, e)
            return 0

        if config["selector_type"] == "json":
            try:
                data_json = resp.json()
            except Exception as e:
                logger.error("Failed to decode JSON from %s: %s", url, e)
                return 0
            html = None
        else:
            html = resp.text
            data_json = None

    # Helper: ensure market and crop objects exist and return them
    def _ensure_refs(market_name: str, crop_name: str):
        market_obj, _ = Market.objects.get_or_create(name=market_name, defaults={"region_location": market_name})
        crop_obj, _ = Crop.objects.get_or_create(name=crop_name, defaults={"category": "Unknown"})
        return market_obj, crop_obj

    if config["selector_type"] == "table" or config["selector_type"] == "div":
        soup = BeautifulSoup(html or "", "html.parser")

        if config["selector_type"] == "table":
            table = soup.select_one(config.get("table_selector", "table"))
            if table is None:
                # Try a relaxed fallback: locate any table on the page that looks
                # like it contains price data (has at least one numeric cell).
                def _looks_like_price_table(t):
                    try:
                        for td in t.select('td')[:10]:
                            txt = td.get_text(strip=True)
                            if re.search(r"\d{2,}", txt):
                                return True
                    except Exception:
                        return False
                    return False

                candidates = [t for t in soup.find_all('table') if _looks_like_price_table(t)]
                if candidates:
                    table = candidates[0]
                    logger.info("Using fallback table for parsing (found candidate table)")
                else:
                    logger.warning("Table not found using selector: %s and no candidate tables detected", config.get("table_selector", "table"))
                    return 0

            rows = table.select("tr")
            mapping = config.get("column_mapping", {})
            for i, row in enumerate(rows):
                if i == 0 and row.find_all("th"):
                    continue
                cols = row.find_all("td")
                if not cols or len(cols) <= max(mapping.values()):
                    continue

                crop_name = cols[mapping["crop"]].get_text().strip()
                market_location = cols[mapping["market"]].get_text().strip()
                wholesale_text = cols[mapping["wholesale"]].get_text()
                retail_text = cols[mapping["retail"]].get_text()

                wholesale_price = _clean_price_enhanced(wholesale_text)
                retail_price = _clean_price_enhanced(retail_text)

                if not crop_name or not market_location or wholesale_price is None or retail_price is None:
                    logger.debug("Skipping incomplete row: crop=%s market=%s wholesale=%s retail=%s", crop_name, market_location, wholesale_price, retail_price)
                    continue

                market_obj, crop_obj = _ensure_refs(market_location, crop_name)

                pr = PriceRecord(
                    market=market_obj,
                    crop=crop_obj,
                    wholesale_price=wholesale_price,
                    retail_price=retail_price,
                    timestamp=timezone.now(),
                )
                records_to_create.append(pr)

        else:  # div
            price_cards = soup.select(config.get("div_selector", "div.price-card"))
            if not price_cards:
                logger.warning("No price cards found with selector: %s", config.get("div_selector"))
                return 0

            extractors = config.get("extractors", {})
            for card in price_cards:
                crop_el = card.select_one(extractors.get("crop"))
                market_el = card.select_one(extractors.get("market"))
                wholesale_el = card.select_one(extractors.get("wholesale"))
                retail_el = card.select_one(extractors.get("retail"))

                if not (crop_el and market_el and wholesale_el and retail_el):
                    continue

                crop_name = crop_el.get_text().strip()
                market_location = market_el.get_text().strip()
                wholesale_price = _clean_price_enhanced(wholesale_el.get_text())
                retail_price = _clean_price_enhanced(retail_el.get_text())

                if not crop_name or not market_location or wholesale_price is None or retail_price is None:
                    logger.debug("Skipping incomplete card: crop=%s market=%s wholesale=%s retail=%s", crop_name, market_location, wholesale_price, retail_price)
                    continue

                market_obj, crop_obj = _ensure_refs(market_location, crop_name)

                pr = PriceRecord(
                    market=market_obj,
                    crop=crop_obj,
                    wholesale_price=wholesale_price,
                    retail_price=retail_price,
                    timestamp=timezone.now(),
                )
                records_to_create.append(pr)

    elif config["selector_type"] == "json":
        # Expect a JSON structure; items_path selects the list of records
        items_path = config.get("items_path")
        items = []
        if items_path:
            items = _extract_json_value(data_json, items_path)
        else:
            # fallback to top-level list
            if isinstance(data_json, list):
                items = data_json
            else:
                items = data_json.get("items") if isinstance(data_json, dict) else []

        if not items:
            logger.warning("No items found in JSON using items_path=%s", items_path)
            return 0

        json_path_map = config.get("json_path", {})
        for item in items:
            crop_name = _extract_json_value(item, json_path_map.get("crop", ""))
            market_location = _extract_json_value(item, json_path_map.get("market", ""))
            wholesale_val = _extract_json_value(item, json_path_map.get("wholesale", ""))
            retail_val = _extract_json_value(item, json_path_map.get("retail", ""))

            # string-coerce
            crop_name = str(crop_name).strip() if crop_name is not None else None
            market_location = str(market_location).strip() if market_location is not None else None
            wholesale_price = _clean_price_enhanced(wholesale_val)
            retail_price = _clean_price_enhanced(retail_val)

            if not crop_name or not market_location or wholesale_price is None or retail_price is None:
                logger.debug("Skipping incomplete json item: %s", item)
                continue

            market_obj, crop_obj = _ensure_refs(market_location, crop_name)
            pr = PriceRecord(
                market=market_obj,
                crop=crop_obj,
                wholesale_price=wholesale_price,
                retail_price=retail_price,
                timestamp=timezone.now(),
            )
            records_to_create.append(pr)

    else:
        logger.error("Unhandled selector_type: %s", config.get("selector_type"))
        return 0

    # Bulk create
    if records_to_create:
        try:
            PriceRecord.objects.bulk_create(records_to_create)
            created_count = len(records_to_create)
            logger.info("Created %d PriceRecord(s) from source '%s'", created_count, source)
        except Exception as e:
            logger.error("Bulk create failed: %s", e)
            # fallback: try individual saves
            created_count = 0
            for pr in records_to_create:
                try:
                    pr.save()
                    created_count += 1
                except Exception:
                    logger.exception("Failed to save PriceRecord for %s @ %s", pr.crop, pr.market)

    return created_count
