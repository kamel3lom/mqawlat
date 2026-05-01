#!/usr/bin/env python3
"""Generate conceptual design template variants for the static app."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "design-templates.json"

STYLES = [
    {
        "id": "shami",
        "nameAr": "شامي",
        "descriptionAr": "فناء داخلي، أقواس، توزيع اجتماعي حول القلب.",
        "palette": {"primary": "#7b3f2a", "secondary": "#d9b27c", "accent": "#2dd4bf", "wall": "#f0dfc2", "roof": "#8b4a2f"},
        "features": ["فناء", "أقواس", "مدخل واضح", "جلسات حول القلب"]
    },
    {
        "id": "najdi",
        "nameAr": "نجدي",
        "descriptionAr": "كتل هادئة، مجلس أمامي، فناء أو ردهة، وفتحات منتظمة.",
        "palette": {"primary": "#b8874f", "secondary": "#e7d2a8", "accent": "#d7962c", "wall": "#d6bc87", "roof": "#7a5b31"},
        "features": ["مجلس أمامي", "فناء", "كتل تراثية", "تظليل عميق"]
    },
    {
        "id": "egyptian",
        "nameAr": "مصري",
        "descriptionAr": "توزيع عملي، بروزات بسيطة، شرفة، ومناطق معيشة واضحة.",
        "palette": {"primary": "#c08a4d", "secondary": "#e6d8c6", "accent": "#3aa3a0", "wall": "#efe1cf", "roof": "#9b6b3c"},
        "features": ["شرفة", "مدخل عملي", "مطبخ قريب", "فصل ضيوف"]
    },
    {
        "id": "andalusian",
        "nameAr": "أندلسي",
        "descriptionAr": "قوس مركزي، فناء مائي، تدرج بين الضيافة والمعيشة.",
        "palette": {"primary": "#214d5d", "secondary": "#efe4c8", "accent": "#2f9c8f", "wall": "#f4ead3", "roof": "#b75536"},
        "features": ["فناء مائي", "أقواس", "تناظر", "جلسات خارجية"]
    },
    {
        "id": "classic",
        "nameAr": "كلاسيكي",
        "descriptionAr": "تناظر محوري، استقبال واضح، غرف منظمة، وواجهات متوازنة.",
        "palette": {"primary": "#364152", "secondary": "#d9e3ee", "accent": "#f0b14b", "wall": "#e6edf5", "roof": "#6b7280"},
        "features": ["تناظر", "مدخل محوري", "غرف منتظمة", "سلم مركزي"]
    },
    {
        "id": "modern",
        "nameAr": "مودرن",
        "descriptionAr": "مساحات مفتوحة، واجهات زجاجية، ومعيشة متصلة.",
        "palette": {"primary": "#14263a", "secondary": "#d9e3ee", "accent": "#e26f24", "wall": "#eef3f8", "roof": "#26364a"},
        "features": ["معيشة مفتوحة", "زجاج", "خطوط مستقيمة", "تراس"]
    }
]

DESIGN_TYPES = {
    "studio": {
        "nameAr": "استوديو",
        "projectTypes": ["studio", "annex"],
        "profiles": {
            "compact": ["نوم ومعيشة", "مطبخ صغير", "حمام", "مدخل"],
            "standard": ["معيشة", "نوم", "مطبخ", "حمام", "غسيل"],
            "large": ["معيشة", "نوم", "مكتب", "مطبخ", "حمام", "تراس"],
            "estate": ["جناح نوم", "معيشة", "مكتب", "مطبخ", "حمامين", "تراس"],
            "mega": ["جناح نوم", "معيشة كبيرة", "مكتب", "مطبخ", "حمامين", "تراس", "مخزن"]
        }
    },
    "apartment": {
        "nameAr": "شقة",
        "projectTypes": ["apartment", "small_building"],
        "profiles": {
            "compact": ["معيشة", "غرفة نوم", "مطبخ", "حمام", "غسيل"],
            "standard": ["معيشة", "غرفتا نوم", "مطبخ", "حمامان", "مدخل"],
            "large": ["معيشة", "ثلاث غرف نوم", "مطبخ", "حمامان", "مجلس", "شرفة"],
            "estate": ["معيشة", "أربع غرف نوم", "مجلس", "مطبخ", "ثلاثة حمامات", "غسيل", "شرفة"],
            "mega": ["معيشة كبيرة", "خمس غرف نوم", "مجلس", "طعام", "مطبخ", "ثلاثة حمامات", "خدمات"]
        }
    },
    "villa": {
        "nameAr": "فيلا",
        "projectTypes": ["villa", "house", "rest_house"],
        "profiles": {
            "compact": ["مجلس", "معيشة", "غرفتا نوم", "مطبخ", "حمامان", "فناء"],
            "standard": ["مجلس", "صالة عائلية", "ثلاث غرف نوم", "طعام", "مطبخ", "ثلاثة حمامات", "فناء"],
            "large": ["مجلس", "صالتان", "أربع غرف نوم", "جناح رئيسي", "طعام", "مطبخ", "خدمات", "فناء"],
            "estate": ["مجلس", "صالة استقبال", "صالة عائلية", "خمس غرف نوم", "جناحان", "طعام", "مطبخ", "خدمات", "فناء"],
            "mega": ["مجلس كبير", "استقبال", "صالتان", "ست غرف نوم", "جناحان", "طعام", "مطبخان", "خدمات", "فناء", "تراس"]
        }
    },
    "townhouse": {
        "nameAr": "تاون هاوس",
        "projectTypes": ["townhouse"],
        "profiles": {
            "compact": ["معيشة", "مطبخ", "حمام ضيوف", "غرفتا نوم", "تراس"],
            "standard": ["معيشة", "طعام", "مطبخ", "ثلاث غرف نوم", "حمامان", "تراس"],
            "large": ["معيشة", "مجلس", "مطبخ", "ثلاث غرف نوم", "جناح", "ثلاثة حمامات", "تراس"],
            "estate": ["معيشة", "مجلس", "طعام", "مطبخ", "أربع غرف نوم", "جناح", "خدمات", "تراس"],
            "mega": ["معيشة كبيرة", "مجلس", "طعام", "مطبخ", "خمس غرف نوم", "جناحان", "خدمات", "تراس"]
        }
    },
    "simple_commercial": {
        "nameAr": "تجاري بسيط",
        "projectTypes": ["simple_commercial"],
        "profiles": {
            "compact": ["معرض", "مكتب", "حمام", "مخزن"],
            "standard": ["معرض", "مكتب", "استقبال", "حمامان", "مخزن"],
            "large": ["معرض", "مكاتب", "استقبال", "خدمات", "مخزن", "غرفة كهرباء"],
            "estate": ["معرض كبير", "مكاتب", "استقبال", "خدمات", "مخازن", "غرفة كهرباء"],
            "mega": ["معرض رئيسي", "مكاتب متعددة", "استقبال", "خدمات", "مخازن", "غرفة كهرباء", "غرفة ميكانيكا"]
        }
    }
}


def profile_for_area(area: int) -> str:
    if area < 180:
        return "compact"
    if area < 360:
        return "standard"
    if area < 850:
        return "large"
    if area < 1800:
        return "estate"
    return "mega"


def floor_group(area: int) -> tuple[int, int]:
    if area < 260:
        return (1, 2)
    if area < 650:
        return (1, 3)
    if area < 1600:
        return (1, 4)
    return (1, 8)


def main() -> None:
    variants = []
    for style_index, style in enumerate(STYLES):
        for type_index, (design_type, type_data) in enumerate(DESIGN_TYPES.items()):
            for area in range(100, 5001, 100):
                floors_min, floors_max = floor_group(area)
                profile = profile_for_area(area)
                variants.append({
                    "id": f"{style['id']}-{design_type}-{area:04d}",
                    "styleId": style["id"],
                    "designType": design_type,
                    "areaMin": area,
                    "areaMax": area + 99,
                    "floorsMin": floors_min,
                    "floorsMax": floors_max,
                    "profile": profile,
                    "seed": (style_index + 1) * 10000 + (type_index + 1) * 1000 + area,
                    "classificationAr": f"{style['nameAr']} / {type_data['nameAr']} / {area}-{area + 99} م²",
                })

    payload = {
        "metadata": {
            "dataMode": "conceptual-design-templates",
            "noticeAr": "هذه قوالب تخطيط تخيلية وليست مخططات هندسية أو معمارية معتمدة.",
            "areaCoverageAr": "من 100 م² إلى 5000 م² بفئات كل 100 م².",
            "variantCount": len(variants),
        },
        "styles": STYLES,
        "designTypes": DESIGN_TYPES,
        "variants": variants,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(variants)} variants to {OUT}")


if __name__ == "__main__":
    main()
