#!/usr/bin/env python3
"""Update material prices from traceable official sources only.

This script is intentionally conservative. It does not invent prices and it does
not mark demo data as official unless a value is extracted from a configured,
traceable source. At the moment the only parser implemented is for the Saudi
GASTAT APGS PDF already referenced by the project data.
"""

from __future__ import annotations

import datetime as _dt
import io
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pdfplumber
import requests

ROOT = Path(__file__).resolve().parents[1]
PRICES_PATH = ROOT / "data" / "prices.json"
SOURCES_PATH = ROOT / "data" / "official-price-sources.json"
STATUS_PATH = ROOT / "data" / "price-update-status.json"


@dataclass(frozen=True)
class SaudiMapping:
    material_id: str
    official_patterns: tuple[str, ...]
    target_unit: str
    source_reliability: str = "رسمي"
    unit_divisor: float = 1.0
    note: str = ""


SAUDI_GASTAT_MAPPINGS: tuple[SaudiMapping, ...] = (
    SaudiMapping("rebar", ("حديد التسليح", "12", "14", "16", "18"), "طن"),
    SaudiMapping("cement", ("إسمنت أسود وطني", "50"), "كيس"),
    SaudiMapping("concrete", ("خرسانة جاهزة",), "م³"),
    SaudiMapping("blocks", ("بلوك أسود", "20"), "قطعة", "رسمي مع تحويل وحدة", 1000.0, "مقسوم على 1000 عند نشر السعر لكل 1000 حبة"),
    SaudiMapping("sand", ("رمل أحمر",), "م³"),
    SaudiMapping("gravel", ("مخلوط رمل وبحص",), "م³"),
    SaudiMapping("tiles", ("بلاط كسر رخام",), "م²"),
)


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def normalize_arabic(text: str) -> str:
    text = text.replace("ـ", "")
    text = re.sub(r"[\u064B-\u065F\u0670]", "", text)
    text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    text = text.replace("ة", "ه").replace("ى", "ي")
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()


def numbers_from_text(text: str) -> list[float]:
    candidates = re.findall(r"(?<!\d)(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?!\d)", text)
    values: list[float] = []
    for candidate in candidates:
        try:
            value = float(candidate.replace(",", ""))
        except ValueError:
            continue
        if value > 0:
            values.append(value)
    return values


def extract_pdf_text(pdf_bytes: bytes) -> str:
    chunks: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            if text:
                chunks.append(text)
    return "\n".join(chunks)


def find_line(text: str, patterns: Iterable[str]) -> str | None:
    normalized_patterns = [normalize_arabic(pattern) for pattern in patterns]
    for line in text.splitlines():
        normalized_line = normalize_arabic(line)
        if all(pattern in normalized_line for pattern in normalized_patterns):
            return line
    return None


def pick_price(values: list[float]) -> float | None:
    # GASTAT tables usually include previous/current prices and change values.
    # For construction materials, the actual unit prices are the large/medium
    # positive values in the row. We choose the last plausible positive price to
    # avoid using item codes or percentage changes.
    plausible = [v for v in values if 0.1 <= v <= 100000]
    if not plausible:
        return None
    return plausible[-1]


def update_saudi_gastat(prices_data: dict, sources_data: dict, status: dict) -> int:
    source = next(
        (
            item
            for item in sources_data.get("sources", [])
            if item.get("countryCode") == "SA" and "APGS" in item.get("datasetNameAr", "")
        ),
        None,
    )
    if not source:
        return 0

    pdf_url = source.get("latestKnownFileUrl")
    if not pdf_url:
        return 0

    response = requests.get(pdf_url, timeout=60)
    response.raise_for_status()
    pdf_text = extract_pdf_text(response.content)

    sa_book = next(
        (book for book in prices_data.get("countryPriceBooks", []) if book.get("countryCode") == "SA"),
        None,
    )
    if not sa_book:
        return 0

    changed = 0
    today = _dt.date.today().isoformat()
    for mapping in SAUDI_GASTAT_MAPPINGS:
        line = find_line(pdf_text, mapping.official_patterns)
        if not line:
            continue
        raw_price = pick_price(numbers_from_text(line))
        if raw_price is None:
            continue
        price = round(raw_price / mapping.unit_divisor, 4)

        item = next((row for row in sa_book.get("items", []) if row.get("materialId") == mapping.material_id), None)
        if not item:
            continue

        old = item.get("averagePrice")
        item.update(
            {
                "priceMin": price,
                "priceMax": price,
                "averagePrice": price,
                "officialItemName": f"{line.strip()}" + (f" - {mapping.note}" if mapping.note else ""),
                "sourceName": source.get("datasetNameAr", "GASTAT APGS"),
                "sourceUrl": pdf_url,
                "lastUpdated": today,
                "updateMethod": "GitHub Actions + official PDF parser",
                "sourceReliability": mapping.source_reliability,
                "isDemo": False,
            }
        )
        if old != price:
            changed += 1

    sa_book["sourceName"] = "Mixed price book - official parser where item source is marked, demo otherwise"
    sa_book["sourceUrl"] = pdf_url
    sa_book["lastUpdated"] = today
    sa_book["updateMethod"] = "GitHub Actions daily official-source check"
    sa_book["sourceReliability"] = "مختلط"
    sa_book["isDemo"] = True

    status.setdefault("countries", {}).setdefault("SA", {})
    status["countries"]["SA"].update(
        {
            "status": "partial-official-parser-active",
            "source": source.get("datasetNameAr", "GASTAT APGS"),
            "latestKnownFileUrl": pdf_url,
            "lastCheckedAt": _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            "updatedItemCount": changed,
            "notesAr": "تم فحص ملف GASTAT الرسمي وتحديث البنود المطابقة فقط. بقية البنود التجريبية لا تزال غير رسمية.",
        }
    )
    return changed


def main() -> None:
    prices_data = load_json(PRICES_PATH)
    sources_data = load_json(SOURCES_PATH)
    status = load_json(STATUS_PATH) if STATUS_PATH.exists() else {}

    now = _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    status["lastRunAt"] = now
    status["mode"] = "official-source-check"
    status["noticeAr"] = "التحديث اليومي يفحص المصادر الرسمية فقط، ولا يخترع أسعارًا ولا يحول البنود التجريبية إلى رسمية دون استخراج قابل للتتبع."

    changed = 0
    try:
        changed += update_saudi_gastat(prices_data, sources_data, status)
        status["lastSuccessfulRunAt"] = now
        status["lastError"] = ""
    except Exception as exc:  # keep the status file honest for debugging
        status["lastError"] = repr(exc)
        raise
    finally:
        prices_data.setdefault("metadata", {})["lastUpdateCheckAt"] = now
        prices_data["metadata"]["dataMode"] = "mixed-official-and-demo"
        prices_data["metadata"]["noticeAr"] = (
            "تعمل GitHub Actions على فحص المصادر الرسمية يوميًا. الأسعار السعودية مفعلة جزئيًا من مصدر رسمي قابل للتتبع، "
            "أما أي بند موسوم isDemo=true أو أي دولة غير مفعلة في price-update-status.json فهي بيانات تجريبية وليست مؤشرًا رسميًا."
        )
        status["changedItemCount"] = changed
        save_json(PRICES_PATH, prices_data)
        save_json(STATUS_PATH, status)


if __name__ == "__main__":
    main()
