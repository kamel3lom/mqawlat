#!/usr/bin/env python3
"""Generate classified conceptual 2D plans and 3D render-style SVG assets."""

from __future__ import annotations

import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "design-templates.json"
ASSET_ROOT = ROOT / "assets" / "designs"

STYLES = [
    {
        "id": "shami",
        "nameAr": "شامي",
        "descriptionAr": "فناء داخلي، أقواس، توزيع اجتماعي حول القلب.",
        "palette": {"ink": "#263238", "paper": "#f5efe3", "wall": "#f0dfc2", "soft": "#d9b27c", "accent": "#7b3f2a", "glass": "#8fd4dc", "roof": "#8b4a2f"},
        "motif": "arches",
    },
    {
        "id": "najdi",
        "nameAr": "نجدي",
        "descriptionAr": "كتل هادئة، مجلس أمامي، فناء أو ردهة، وفتحات منتظمة.",
        "palette": {"ink": "#2f2518", "paper": "#f5edd8", "wall": "#d6bc87", "soft": "#e7d2a8", "accent": "#b8874f", "glass": "#88bfc4", "roof": "#7a5b31"},
        "motif": "triangles",
    },
    {
        "id": "egyptian",
        "nameAr": "مصري",
        "descriptionAr": "توزيع عملي، شرفة، ومناطق معيشة واضحة.",
        "palette": {"ink": "#2f2b26", "paper": "#f7efe5", "wall": "#efe1cf", "soft": "#e6d8c6", "accent": "#c08a4d", "glass": "#7fb7bd", "roof": "#9b6b3c"},
        "motif": "balcony",
    },
    {
        "id": "andalusian",
        "nameAr": "أندلسي",
        "descriptionAr": "قوس مركزي، فناء مائي، وتدرج بين الضيافة والمعيشة.",
        "palette": {"ink": "#19333b", "paper": "#f7f0dd", "wall": "#f4ead3", "soft": "#efe4c8", "accent": "#214d5d", "glass": "#83d0c7", "roof": "#b75536"},
        "motif": "water",
    },
    {
        "id": "classic",
        "nameAr": "كلاسيكي",
        "descriptionAr": "تناظر محوري، استقبال واضح، وغرف منظمة.",
        "palette": {"ink": "#28313c", "paper": "#f5f7fb", "wall": "#e6edf5", "soft": "#d9e3ee", "accent": "#5c6470", "glass": "#95c8da", "roof": "#6b7280"},
        "motif": "columns",
    },
    {
        "id": "modern",
        "nameAr": "مودرن",
        "descriptionAr": "مساحات مفتوحة، واجهات زجاجية، وخطوط مستقيمة.",
        "palette": {"ink": "#102033", "paper": "#f7fafc", "wall": "#eef3f8", "soft": "#d9e3ee", "accent": "#e26f24", "glass": "#7dd3fc", "roof": "#26364a"},
        "motif": "glass",
    },
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
            "mega": ["جناح نوم", "معيشة كبيرة", "مكتب", "مطبخ", "حمامين", "تراس", "مخزن"],
        },
    },
    "apartment": {
        "nameAr": "شقة",
        "projectTypes": ["apartment", "small_building"],
        "profiles": {
            "compact": ["معيشة", "غرفة نوم", "مطبخ", "حمام", "غسيل"],
            "standard": ["معيشة", "غرفتا نوم", "مطبخ", "حمامان", "مدخل"],
            "large": ["معيشة", "ثلاث غرف نوم", "مطبخ", "حمامان", "مجلس", "شرفة"],
            "estate": ["معيشة", "أربع غرف نوم", "مجلس", "مطبخ", "ثلاثة حمامات", "غسيل", "شرفة"],
            "mega": ["معيشة كبيرة", "خمس غرف نوم", "مجلس", "طعام", "مطبخ", "ثلاثة حمامات", "خدمات"],
        },
    },
    "villa": {
        "nameAr": "فيلا",
        "projectTypes": ["villa", "house", "rest_house"],
        "profiles": {
            "compact": ["مجلس", "معيشة", "غرفتا نوم", "مطبخ", "حمامان", "فناء"],
            "standard": ["مجلس", "صالة عائلية", "ثلاث غرف نوم", "طعام", "مطبخ", "ثلاثة حمامات", "فناء"],
            "large": ["مجلس", "صالتان", "أربع غرف نوم", "جناح رئيسي", "طعام", "مطبخ", "خدمات", "فناء"],
            "estate": ["مجلس", "صالة استقبال", "صالة عائلية", "خمس غرف نوم", "جناحان", "طعام", "مطبخ", "خدمات", "فناء"],
            "mega": ["مجلس كبير", "استقبال", "صالتان", "ست غرف نوم", "جناحان", "طعام", "مطبخان", "خدمات", "فناء", "تراس"],
        },
    },
    "townhouse": {
        "nameAr": "تاون هاوس",
        "projectTypes": ["townhouse"],
        "profiles": {
            "compact": ["معيشة", "مطبخ", "حمام ضيوف", "غرفتا نوم", "تراس"],
            "standard": ["معيشة", "طعام", "مطبخ", "ثلاث غرف نوم", "حمامان", "تراس"],
            "large": ["معيشة", "مجلس", "مطبخ", "ثلاث غرف نوم", "جناح", "ثلاثة حمامات", "تراس"],
            "estate": ["معيشة", "مجلس", "طعام", "مطبخ", "أربع غرف نوم", "جناح", "خدمات", "تراس"],
            "mega": ["معيشة كبيرة", "مجلس", "طعام", "مطبخ", "خمس غرف نوم", "جناحان", "خدمات", "تراس"],
        },
    },
    "simple_commercial": {
        "nameAr": "تجاري بسيط",
        "projectTypes": ["simple_commercial"],
        "profiles": {
            "compact": ["معرض", "مكتب", "حمام", "مخزن"],
            "standard": ["معرض", "مكتب", "استقبال", "حمامان", "مخزن"],
            "large": ["معرض", "مكاتب", "استقبال", "خدمات", "مخزن", "غرفة كهرباء"],
            "estate": ["معرض كبير", "مكاتب", "استقبال", "خدمات", "مخازن", "غرفة كهرباء"],
            "mega": ["معرض رئيسي", "مكاتب متعددة", "استقبال", "خدمات", "مخازن", "غرفة كهرباء", "غرفة ميكانيكا"],
        },
    },
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


def esc(text: str) -> str:
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def room_weight(name: str) -> float:
    if any(token in name for token in ["معيشة", "صالة", "معرض", "مجلس", "استقبال"]):
        return 1.6
    if any(token in name for token in ["نوم", "جناح", "مكتب"]):
        return 1.15
    if any(token in name for token in ["مطبخ", "طعام"]):
        return 0.9
    if any(token in name for token in ["فناء", "تراس", "شرفة"]):
        return 0.75
    if any(token in name for token in ["حمام", "غسيل", "خدمات", "مخزن"]):
        return 0.48
    return 0.72


def rooms_for(design_type: dict, profile: str, area: int, seed: int) -> list[dict]:
    names = list(design_type["profiles"][profile])
    weights = [room_weight(name) + ((seed + index * 19) % 8) / 100 for index, name in enumerate(names)]
    total = sum(weights)
    return [
        {
            "name": name,
            "area": max(4, round(area * weights[index] / total)),
            "wet": any(token in name for token in ["حمام", "مطبخ", "غسيل", "خدمات"]),
        }
        for index, name in enumerate(names)
    ]


def layout_rooms(rooms: list[dict], area: int) -> list[dict]:
    width = 1240
    height = 720
    x0 = 110
    y0 = 150
    rows_count = 2 if len(rooms) <= 5 else 3 if len(rooms) <= 8 else 4
    rows = [[] for _ in range(rows_count)]
    for index, room in enumerate(rooms):
        rows[index % rows_count].append(room)

    placed: list[dict] = []
    row_h = height / rows_count
    for row_index, row in enumerate(rows):
        row_area = sum(room["area"] for room in row)
        x = x0
        y = y0 + row_index * row_h
        for room in row:
            w = max(150, width * (room["area"] / row_area))
            placed.append({**room, "x": x, "y": y, "w": min(w, x0 + width - x), "h": row_h})
            x += w
    return placed


def furniture(room: dict, ink: str, accent: str) -> str:
    x, y, w, h = room["x"], room["y"], room["w"], room["h"]
    name = room["name"]
    if "نوم" in name or "جناح" in name:
        return f'<rect x="{x+22:.1f}" y="{y+30:.1f}" width="{min(120,w*.36):.1f}" height="62" rx="8" fill="none" stroke="{ink}" stroke-width="3"/><line x1="{x+22:.1f}" y1="{y+58:.1f}" x2="{x+min(142,w*.36+22):.1f}" y2="{y+58:.1f}" stroke="{ink}" stroke-width="2"/>'
    if "حمام" in name:
        return f'<circle cx="{x+45:.1f}" cy="{y+48:.1f}" r="20" fill="none" stroke="{accent}" stroke-width="4"/><rect x="{x+78:.1f}" y="{y+28:.1f}" width="46" height="38" rx="8" fill="none" stroke="{ink}" stroke-width="3"/>'
    if "مطبخ" in name:
        return f'<rect x="{x+22:.1f}" y="{y+24:.1f}" width="{min(150,w*.5):.1f}" height="24" fill="none" stroke="{ink}" stroke-width="3"/><circle cx="{x+52:.1f}" cy="{y+68:.1f}" r="12" fill="none" stroke="{accent}" stroke-width="3"/><circle cx="{x+88:.1f}" cy="{y+68:.1f}" r="12" fill="none" stroke="{accent}" stroke-width="3"/>'
    if any(token in name for token in ["معيشة", "صالة", "مجلس", "استقبال"]):
        return f'<rect x="{x+22:.1f}" y="{y+30:.1f}" width="{min(160,w*.45):.1f}" height="42" rx="10" fill="none" stroke="{ink}" stroke-width="3"/><rect x="{x+42:.1f}" y="{y+92:.1f}" width="64" height="36" rx="6" fill="none" stroke="{accent}" stroke-width="3"/>'
    if "طعام" in name:
        return f'<ellipse cx="{x+w*.28:.1f}" cy="{y+h*.38:.1f}" rx="54" ry="34" fill="none" stroke="{ink}" stroke-width="3"/><circle cx="{x+w*.28:.1f}" cy="{y+h*.38:.1f}" r="7" fill="{accent}"/>'
    return f'<rect x="{x+24:.1f}" y="{y+28:.1f}" width="{min(96,w*.3):.1f}" height="42" rx="6" fill="none" stroke="{ink}" stroke-width="3"/>'


def render_plan_svg(variant: dict, style: dict, design_type: dict, rooms: list[dict], asset_id: str) -> str:
    p = style["palette"]
    placed = layout_rooms(rooms, variant["areaMin"])
    room_shapes = []
    for index, room in enumerate(placed):
        fill = p["wall"] if index % 2 == 0 else p["paper"]
        if room["wet"]:
            fill = p["soft"]
        x, y, w, h = room["x"], room["y"], room["w"], room["h"]
        door_x = x + min(w - 44, 58 + (index * 23) % max(80, int(w) - 80))
        window_w = max(42, min(130, w * 0.24))
        room_shapes.append(
            f'''
            <g>
              <rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{fill}" stroke="{p["ink"]}" stroke-width="8"/>
              <line x1="{x+22:.1f}" y1="{y+8:.1f}" x2="{x+22+window_w:.1f}" y2="{y+8:.1f}" stroke="{p["glass"]}" stroke-width="8" stroke-linecap="round"/>
              <path d="M {door_x:.1f} {y+h:.1f} v -52 a 52 52 0 0 0 52 52" fill="none" stroke="{p["accent"]}" stroke-width="4"/>
              {furniture(room, p["ink"], p["accent"])}
              <text x="{x+w/2:.1f}" y="{y+h/2-6:.1f}" text-anchor="middle" font-size="30" font-weight="800" fill="{p["ink"]}">{esc(room["name"])}</text>
              <text x="{x+w/2:.1f}" y="{y+h/2+28:.1f}" text-anchor="middle" font-size="20" fill="{p["ink"]}">{room["area"]} م²</text>
            </g>
            '''
        )

    motif = ""
    if style["motif"] == "water":
        motif = f'<rect x="690" y="470" width="145" height="72" rx="36" fill="{p["glass"]}" opacity=".65" stroke="{p["accent"]}" stroke-width="3"/>'
    elif style["motif"] == "triangles":
        motif = "".join(f'<path d="M {118+i*26} 112 l 11 -18 l 11 18 z" fill="{p["accent"]}" opacity=".85"/>' for i in range(10))
    elif style["motif"] == "arches":
        motif = "".join(f'<path d="M {118+i*46} 112 q 18 -34 36 0" fill="none" stroke="{p["accent"]}" stroke-width="4"/>' for i in range(7))
    elif style["motif"] == "columns":
        motif = "".join(f'<rect x="{118+i*38}" y="86" width="14" height="48" fill="{p["accent"]}" opacity=".72"/>' for i in range(8))
    else:
        motif = f'<rect x="118" y="92" width="250" height="24" rx="12" fill="{p["glass"]}" opacity=".72"/>'

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1050" role="img" aria-label="Concept architectural 2D plan">
  <defs>
    <pattern id="grid-{asset_id}" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#94a3b8" stroke-width="1" opacity=".18"/>
    </pattern>
  </defs>
  <rect width="1600" height="1050" fill="{p["paper"]}"/>
  <rect x="70" y="70" width="1460" height="900" fill="url(#grid-{asset_id})" stroke="{p["ink"]}" stroke-width="3"/>
  <text x="1490" y="118" text-anchor="end" font-size="40" font-weight="900" fill="{p["ink"]}">مخطط معماري مبدئي - {esc(design_type["nameAr"])} {esc(style["nameAr"])}</text>
  <text x="1490" y="158" text-anchor="end" font-size="24" fill="{p["ink"]}">الفئة: {variant["areaMin"]}-{variant["areaMax"]} م² | الطوابق: {variant["floorsMin"]}-{variant["floorsMax"]}</text>
  {motif}
  <g>{''.join(room_shapes)}</g>
  <line x1="110" y1="910" x2="1350" y2="910" stroke="{p["ink"]}" stroke-width="3"/>
  <path d="M110 895v30M1350 895v30" stroke="{p["ink"]}" stroke-width="3"/>
  <text x="730" y="948" text-anchor="middle" font-size="24" fill="{p["ink"]}">أبعاد ومساحات تقريبية للتصور فقط</text>
  <path d="M1450 890 v-92 m0 0 -22 35 m22-35 22 35" stroke="{p["accent"]}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="1450" y="936" text-anchor="middle" font-size="24" fill="{p["ink"]}">شمال</text>
  <rect x="70" y="980" width="1460" height="46" fill="{p["ink"]}"/>
  <text x="1490" y="1012" text-anchor="end" font-size="20" fill="#ffffff">kamel3lom | مخطط تخيلي غير معتمد هندسيًا</text>
  <text x="110" y="1012" font-size="20" fill="#ffffff">{esc(variant["id"])}</text>
</svg>'''


def iso(x: float, y: float, z: float = 0) -> tuple[float, float]:
    return (820 + (x - y) * 58, 260 + (x + y) * 30 - z)


def points(*coords: tuple[float, float]) -> str:
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in coords)


def block(x: float, y: float, w: float, d: float, h: float, p: dict, label: str) -> str:
    a = iso(x, y, h)
    b = iso(x + w, y, h)
    c = iso(x + w, y + d, h)
    e = iso(x, y + d, h)
    ab = iso(x, y, 0)
    bb = iso(x + w, y, 0)
    cb = iso(x + w, y + d, 0)
    eb = iso(x, y + d, 0)
    tx, ty = iso(x + w / 2, y + d / 2, h + 18)
    return f'''<g>
      <polygon points="{points(a,b,c,e)}" fill="{p["roof"]}" stroke="#101820" stroke-width="2"/>
      <polygon points="{points(b,bb,cb,c)}" fill="{p["soft"]}" stroke="#101820" stroke-width="2"/>
      <polygon points="{points(c,cb,eb,e)}" fill="{p["wall"]}" stroke="#101820" stroke-width="2"/>
      <rect x="{tx-42:.1f}" y="{ty-18:.1f}" width="84" height="24" rx="12" fill="#ffffff" opacity=".82"/>
      <text x="{tx:.1f}" y="{ty:.1f}" text-anchor="middle" font-size="13" font-weight="800" fill="#102033">{esc(label[:10])}</text>
    </g>'''


def render_3d_svg(variant: dict, style: dict, design_type: dict, rooms: list[dict], asset_id: str) -> str:
    p = style["palette"]
    blocks = []
    columns = min(5, max(3, math.ceil(math.sqrt(len(rooms) + 2))))
    for index, room in enumerate(rooms[:14]):
        row = index // columns
        col = index % columns
        size = max(1.1, min(2.6, math.sqrt(room["area"]) / 4.2))
        height = max(54, min(170, 52 + room["area"] * 1.15))
        blocks.append(block(col * 2.0, row * 1.75, size, size * 0.86, height, p, room["name"]))

    facade = ""
    if style["motif"] in ["arches", "water"]:
        facade = "".join(f'<path d="M {520+i*92} 548 q 32 -70 64 0" fill="none" stroke="{p["accent"]}" stroke-width="10"/>' for i in range(5))
    elif style["motif"] == "glass":
        facade = "".join(f'<rect x="{500+i*86}" y="488" width="54" height="120" rx="4" fill="{p["glass"]}" opacity=".65"/>' for i in range(6))
    elif style["motif"] == "triangles":
        facade = "".join(f'<path d="M {500+i*58} 535 l 24 -40 l 24 40 z" fill="{p["accent"]}" opacity=".72"/>' for i in range(8))
    else:
        facade = "".join(f'<rect x="{510+i*72}" y="495" width="28" height="110" fill="{p["accent"]}" opacity=".58"/>' for i in range(7))

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1050" role="img" aria-label="Concept 3D architectural render">
  <defs>
    <linearGradient id="sky-{asset_id}" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#0c1b2b"/>
      <stop offset="1" stop-color="#d9e3ee"/>
    </linearGradient>
    <filter id="shadow-{asset_id}" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#000" flood-opacity=".28"/>
    </filter>
  </defs>
  <rect width="1600" height="1050" fill="url(#sky-{asset_id})"/>
  <circle cx="1290" cy="180" r="74" fill="#f0b14b" opacity=".74"/>
  <ellipse cx="820" cy="780" rx="620" ry="130" fill="#07111f" opacity=".28"/>
  <g filter="url(#shadow-{asset_id})">{''.join(blocks)}</g>
  {facade}
  <path d="M330 790 C520 690 1090 680 1280 792" fill="none" stroke="{p["accent"]}" stroke-width="8" opacity=".75"/>
  <text x="1490" y="96" text-anchor="end" font-size="44" font-weight="900" fill="#eef5fb">تصور 3D مبدئي - {esc(design_type["nameAr"])} {esc(style["nameAr"])}</text>
  <text x="1490" y="142" text-anchor="end" font-size="25" fill="#d9e3ee">مبني على قالب 2D: {esc(variant["id"])} | {variant["areaMin"]}-{variant["areaMax"]} م²</text>
  <rect x="70" y="960" width="1460" height="52" rx="8" fill="#07111f" opacity=".78"/>
  <text x="1490" y="994" text-anchor="end" font-size="22" fill="#ffffff">kamel3lom | رندر تخيلي غير معتمد هندسيًا أو إنشائيًا</text>
  <text x="110" y="994" font-size="22" fill="#f0b14b">{esc(style["descriptionAr"])}</text>
</svg>'''


def main() -> None:
    for folder in [ASSET_ROOT / "2d", ASSET_ROOT / "3d"]:
        folder.mkdir(parents=True, exist_ok=True)

    variants = []
    for style_index, style in enumerate(STYLES):
        for type_index, (design_type_id, type_data) in enumerate(DESIGN_TYPES.items()):
            for area in range(100, 5001, 100):
                floors_min, floors_max = floor_group(area)
                profile = profile_for_area(area)
                seed = (style_index + 1) * 10000 + (type_index + 1) * 1000 + area
                variant_id = f"{style['id']}-{design_type_id}-{area:04d}"
                variant = {
                    "id": variant_id,
                    "styleId": style["id"],
                    "designType": design_type_id,
                    "areaMin": area,
                    "areaMax": area + 99,
                    "floorsMin": floors_min,
                    "floorsMax": floors_max,
                    "profile": profile,
                    "seed": seed,
                    "classificationAr": f"{style['nameAr']} / {type_data['nameAr']} / {area}-{area + 99} م²",
                    "assets": {
                        "plan2d": f"assets/designs/2d/{variant_id}.svg",
                        "render3d": f"assets/designs/3d/{variant_id}.svg",
                    },
                }
                rooms = rooms_for(type_data, profile, area, seed)
                (ASSET_ROOT / "2d" / f"{variant_id}.svg").write_text(
                    render_plan_svg(variant, style, type_data, rooms, variant_id), encoding="utf-8"
                )
                (ASSET_ROOT / "3d" / f"{variant_id}.svg").write_text(
                    render_3d_svg(variant, style, type_data, rooms, variant_id), encoding="utf-8"
                )
                variants.append(variant)

    payload = {
        "metadata": {
            "dataMode": "conceptual-design-asset-library",
            "noticeAr": "هذه أصول ومخططات تخيلية لتصور أولي وليست مخططات هندسية أو معمارية معتمدة.",
            "areaCoverageAr": "من 100 م² إلى 5000 م² بفئات كل 100 م².",
            "variantCount": len(variants),
            "assetCount": len(variants) * 2,
        },
        "styles": STYLES,
        "designTypes": DESIGN_TYPES,
        "variants": variants,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(variants)} variants and {len(variants) * 2} SVG assets.")


if __name__ == "__main__":
    main()
