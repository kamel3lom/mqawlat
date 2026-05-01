#!/usr/bin/env python3
"""
Update Saudi material prices from an official GASTAT APGS PDF.

The script is intentionally conservative:
- It only updates KSA items that can be matched to clear APGS construction goods rows.
- It exits with an error if expected rows are not found.
- It does not invent prices or call non-official sources.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import tempfile
import urllib.request
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: pip install pypdf") from exc


ROOT = Path(__file__).resolve().parents[1]
PRICES_PATH = ROOT / "data" / "prices.json"
SOURCES_PATH = ROOT / "data" / "official-price-sources.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def get_default_pdf_url() -> str:
    sources = load_json(SOURCES_PATH)["sources"]
    source = next(
        item
        for item in sources
        if item["countryCode"] == "SA" and "APGS" in item["datasetNameAr"]
    )
    return source["latestKnownFileUrl"]


def download_pdf(url: str) -> Path:
    temp_dir = Path(tempfile.mkdtemp(prefix="gastat-apgs-"))
    target = temp_dir / "apgs.pdf"
    with urllib.request.urlopen(url, timeout=60) as response:
        target.write_bytes(response.read())
    return target


def extract_text(pdf_path: Path, max_pages: int = 8) -> str:
    reader = PdfReader(str(pdf_path))
    page_count = min(len(reader.pages), max_pages)
    return "\n".join(reader.pages[index].extract_text() or "" for index in range(page_count))


def first_price(text: str, label: str) -> float:
    for line in text.splitlines():
        if label in line:
            numbers = [float(match) for match in re.findall(r"-?[0-9]+\.[0-9]", line)]
            prices = [number for number in numbers if number > 7]
            if prices:
                return prices[0]
    raise ValueError(f"Could not find APGS row: {label}")


def average(values: list[float]) -> float:
    return round(sum(values) / len(values), 2)


def build_updates(text: str, source_url: str, updated_at: str) -> dict[str, dict]:
    rebar_values = [
        first_price(text, "12mm national Reinforcing iron"),
        first_price(text, "14mm national Reinforcing iron"),
        first_price(text, "16mm national Reinforcing iron"),
        first_price(text, "18mm national reinforcing iron"),
    ]
    concrete_values = [
        first_price(text, "250 K Normal Concrete"),
        first_price(text, "350 K Normal Concrete"),
        first_price(text, "250 K Resistant Concrete"),
        first_price(text, "350 K Resistant Concrete"),
    ]
    ablakash_m3 = first_price(text, "Indonesian Ablakash Wood")

    common = {
        "sourceName": "GASTAT Average Prices of Goods and Services",
        "sourceUrl": source_url,
        "lastUpdated": updated_at,
        "updateMethod": "ملف رسمي PDF عبر GitHub Actions",
        "sourceReliability": "رسمي",
        "isDemo": False,
    }

    return {
        "rebar": {
            **common,
            "priceMin": min(rebar_values),
            "priceMax": max(rebar_values),
            "averagePrice": average(rebar_values),
            "officialItemName": "متوسط حديد التسليح الوطني 12/14/16/18 مم",
        },
        "cement": {
            **common,
            "priceMin": first_price(text, "Black National Cement"),
            "priceMax": first_price(text, "Black National Cement"),
            "averagePrice": first_price(text, "Black National Cement"),
            "officialItemName": "إسمنت أسود وطني 50 كجم",
        },
        "concrete": {
            **common,
            "priceMin": min(concrete_values),
            "priceMax": max(concrete_values),
            "averagePrice": average(concrete_values),
            "officialItemName": "متوسط الخرسانة الجاهزة 250/350 ك عادي ومقاوم",
        },
        "blocks": {
            **common,
            "priceMin": round(first_price(text, "15cm black Block") / 1000, 4),
            "priceMax": round(first_price(text, "20cm black Block") / 1000, 4),
            "averagePrice": round(first_price(text, "20cm black Block") / 1000, 4),
            "officialItemName": "بلوك أسود 20 سم لكل 1000 حبة مقسوم على 1000",
            "updateMethod": "ملف رسمي PDF + تحويل وحدة",
            "sourceReliability": "رسمي مع تحويل وحدة",
        },
        "sand": {
            **common,
            "priceMin": first_price(text, "Red Sand"),
            "priceMax": first_price(text, "white soft Sand"),
            "averagePrice": first_price(text, "Red Sand"),
            "officialItemName": "رمل أحمر 1 م³",
        },
        "gravel": {
            **common,
            "priceMin": first_price(text, "Mixed Sand (sand and pebble)"),
            "priceMax": first_price(text, "Mixed Sand (sand and pebble)"),
            "averagePrice": first_price(text, "Mixed Sand (sand and pebble)"),
            "officialItemName": "مخلوط رمل وبحص 1 م³",
        },
        "formwork": {
            **common,
            "priceMin": round(ablakash_m3 * 0.017, 2),
            "priceMax": round(ablakash_m3 * 0.019, 2),
            "averagePrice": round(ablakash_m3 * 0.018, 2),
            "officialItemName": "خشب أبلاكاش إندونيسي 1 م³ محول تقريبياً إلى م² على سماكة 18 مم",
            "updateMethod": "ملف رسمي PDF + تحويل وحدة تقريبي",
            "sourceReliability": "رسمي مع تحويل وحدة",
        },
        "tiles": {
            **common,
            "priceMin": first_price(text, "National Marble tiles"),
            "priceMax": first_price(text, "National Marble tiles"),
            "averagePrice": first_price(text, "National Marble tiles"),
            "officialItemName": "بلاط كسر رخام بلدي 1 م²",
        },
    }


def update_prices(updates: dict[str, dict]) -> None:
    payload = load_json(PRICES_PATH)
    sa_book = next(book for book in payload["countryPriceBooks"] if book["countryCode"] == "SA")
    for item in sa_book["items"]:
        update = updates.get(item["materialId"])
        if update:
            item.update(update)
    write_json(PRICES_PATH, payload)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=get_default_pdf_url(), help="Official GASTAT APGS PDF URL")
    parser.add_argument("--updated-at", default=dt.date.today().isoformat())
    args = parser.parse_args()

    pdf_path = download_pdf(args.url)
    text = extract_text(pdf_path)
    updates = build_updates(text, args.url, args.updated_at)
    update_prices(updates)
    print(f"Updated {len(updates)} Saudi material prices from official GASTAT APGS PDF.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
