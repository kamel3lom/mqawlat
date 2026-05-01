const DESIGN_TYPE_BY_PROJECT = {
  villa: "villa",
  house: "villa",
  rest_house: "villa",
  apartment: "apartment",
  small_building: "apartment",
  townhouse: "townhouse",
  studio: "studio",
  annex: "studio",
  simple_commercial: "simple_commercial"
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashNumber(value) {
  return String(value)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function selectVariant({ input, result, templates, styleId }) {
  const designType = DESIGN_TYPE_BY_PROJECT[input.projectType] || "villa";
  const area = clamp(Math.round(result.areas.grossBuiltArea || input.builtArea || 100), 100, 5000);
  const floors = input.floors || 1;
  const preferredStyle = styleId || "modern";

  const exact = templates.variants.find(
    (variant) =>
      variant.styleId === preferredStyle &&
      variant.designType === designType &&
      area >= variant.areaMin &&
      area <= variant.areaMax &&
      floors >= variant.floorsMin &&
      floors <= variant.floorsMax
  );

  const fallback =
    exact ||
    templates.variants.find(
      (variant) =>
        variant.styleId === preferredStyle &&
        variant.designType === designType &&
        area >= variant.areaMin &&
        area <= variant.areaMax
    ) ||
    templates.variants.find((variant) => variant.styleId === preferredStyle && variant.designType === designType) ||
    templates.variants[0];

  return {
    variant: fallback,
    style: templates.styles.find((style) => style.id === fallback.styleId) || templates.styles[0],
    designType: templates.designTypes[fallback.designType]
  };
}

function getRooms(template, result) {
  const profileName = template.variant.profile;
  const baseRooms = template.designType.profiles[profileName] || Object.values(template.designType.profiles)[0];
  const area = result.areas.grossBuiltArea;
  const floors = result.input.floors || 1;
  const rooms = [...baseRooms];

  if (result.input.elevator && floors > 1) rooms.push("مصعد");
  if (result.input.basement) rooms.push("قبو");
  if (result.input.undergroundTank) rooms.push("خزان أرضي");
  if (result.input.roofTank) rooms.push("خزان علوي");
  if (result.input.fence) rooms.push("سور/ارتداد");

  const weights = rooms.map((room, index) => {
    const roomWeight =
      /معيشة|صالة|معرض|مجلس|استقبال/.test(room) ? 1.45 :
      /نوم|جناح|مكتب/.test(room) ? 1.1 :
      /مطبخ|طعام/.test(room) ? 0.9 :
      /فناء|تراس|شرفة/.test(room) ? 0.8 :
      /حمام|غسيل|خزان|مصعد|درج/.test(room) ? 0.42 :
      0.7;
    return roomWeight + ((template.variant.seed + index * 17) % 9) / 100;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  return rooms.map((room, index) => ({
    id: `room-${index}`,
    label: room,
    area: Math.max(4, Math.round((area * weights[index]) / totalWeight)),
    floor: floors > 1 && /نوم|جناح|مكتب|تراس|خزان علوي/.test(room) ? 2 : 1,
    weight: weights[index]
  }));
}

function splitRows(rooms) {
  const rowCount = rooms.length > 9 ? 4 : rooms.length > 5 ? 3 : 2;
  const rows = Array.from({ length: rowCount }, () => []);
  rooms.forEach((room, index) => {
    rows[index % rowCount].push(room);
  });
  return rows.filter(Boolean);
}

function render2dSvg({ template, rooms, result }) {
  const { style } = template;
  const width = 1080;
  const height = 680;
  const pad = 44;
  const planWidth = width - pad * 2;
  const planHeight = height - 126;
  const rows = splitRows(rooms);
  const totalArea = rooms.reduce((sum, room) => sum + room.area, 0);
  let y = 88;
  const rowHeight = planHeight / rows.length;
  const seedShift = hashNumber(template.variant.id) % 18;

  const roomRects = rows
    .map((row, rowIndex) => {
      const rowWeight = row.reduce((sum, room) => sum + room.area, 0);
      let x = pad;
      const rects = row
        .map((room, index) => {
          const widthRatio = room.area / rowWeight;
          const roomWidth = Math.max(94, planWidth * widthRatio);
          const hue = (index * 13 + rowIndex * 29 + seedShift) % 44;
          const fill = index % 2 === 0 ? style.palette.wall : style.palette.secondary;
          const rect = `
            <g>
              <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${roomWidth.toFixed(1)}" height="${(rowHeight - 10).toFixed(1)}" rx="6" fill="${fill}" stroke="${style.palette.primary}" stroke-width="3"/>
              <rect x="${(x + 10).toFixed(1)}" y="${(y + 10).toFixed(1)}" width="${Math.max(18, roomWidth * 0.2).toFixed(1)}" height="8" rx="4" fill="${style.palette.accent}" opacity="0.7"/>
              <text x="${(x + roomWidth / 2).toFixed(1)}" y="${(y + rowHeight / 2 - 5).toFixed(1)}" text-anchor="middle" font-size="22" font-weight="700" fill="#102033">${room.label}</text>
              <text x="${(x + roomWidth / 2).toFixed(1)}" y="${(y + rowHeight / 2 + 24).toFixed(1)}" text-anchor="middle" font-size="16" fill="#314155">${room.area} م²</text>
              <circle cx="${(x + roomWidth - 18).toFixed(1)}" cy="${(y + 20 + hue / 10).toFixed(1)}" r="5" fill="${style.palette.accent}"/>
            </g>
          `;
          x += roomWidth;
          return rect;
        })
        .join("");
      y += rowHeight;
      return rects;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="مخطط تو دي تخيلي" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-${template.variant.id}" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#d9e3ee" stroke-width="1" opacity="0.18"/>
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" rx="8" fill="#07111f"/>
      <rect x="${pad}" y="88" width="${planWidth}" height="${planHeight - 16}" fill="url(#grid-${template.variant.id})" stroke="${style.palette.accent}" stroke-width="2" opacity="0.95"/>
      <text x="${width - pad}" y="48" text-anchor="end" font-size="30" font-weight="800" fill="#eef5fb">${template.designType.nameAr} - ${style.nameAr}</text>
      <text x="${pad}" y="48" text-anchor="start" font-size="18" fill="#aab7c5">${Math.round(result.areas.grossBuiltArea)} م² | ${result.input.floors} طابق | ${template.variant.classificationAr}</text>
      ${roomRects}
      <path d="M86 612v-54m0 0-15 24m15-24 15 24" stroke="${style.palette.accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="86" y="638" text-anchor="middle" font-size="18" fill="#d9e3ee">شمال</text>
      <text x="${width - pad}" y="638" text-anchor="end" font-size="18" fill="#f5c96f">مخطط تخيلي غير معتمد هندسيًا - kamel3lom</text>
      <text x="${pad}" y="638" font-size="16" fill="#aab7c5">المساحة الموزعة: ${totalArea} م² تقريبًا</text>
    </svg>
  `;
}

function isoPoint(x, y, z = 0) {
  return {
    x: 520 + (x - y) * 36,
    y: 90 + (x + y) * 20 - z
  };
}

function polygon(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function prism({ x, y, w, d, h, fill, side, roof, label }) {
  const p1 = isoPoint(x, y, h);
  const p2 = isoPoint(x + w, y, h);
  const p3 = isoPoint(x + w, y + d, h);
  const p4 = isoPoint(x, y + d, h);
  const b1 = isoPoint(x, y, 0);
  const b2 = isoPoint(x + w, y, 0);
  const b3 = isoPoint(x + w, y + d, 0);
  const b4 = isoPoint(x, y + d, 0);
  const labelPoint = isoPoint(x + w / 2, y + d / 2, h + 12);

  return `
    <g>
      <polygon points="${polygon([p1, p2, p3, p4])}" fill="${roof}" stroke="#102033" stroke-width="2"/>
      <polygon points="${polygon([p2, b2, b3, p3])}" fill="${side}" stroke="#102033" stroke-width="2"/>
      <polygon points="${polygon([p3, b3, b4, p4])}" fill="${fill}" stroke="#102033" stroke-width="2"/>
      <text x="${labelPoint.x.toFixed(1)}" y="${labelPoint.y.toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#07111f">${label}</text>
    </g>
  `;
}

function render3dSvg({ template, rooms, result }) {
  const { style } = template;
  const width = 1080;
  const height = 680;
  const columns = Math.min(5, Math.ceil(Math.sqrt(rooms.length + 2)));
  const blocks = rooms
    .slice(0, 16)
    .map((room, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const size = clamp(Math.sqrt(room.area) / 3.2, 1.15, 2.6);
      const h = clamp(24 + room.area / 10 + room.floor * 6, 32, 96);
      return prism({
        x: col * 2.25,
        y: row * 2.0,
        w: size,
        d: clamp(size * 0.86, 1.05, 2.4),
        h,
        fill: style.palette.wall,
        side: style.palette.secondary,
        roof: style.palette.accent,
        label: room.label
      });
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="مخطط ثري دي تخيلي" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky-${template.variant.id}" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#07111f"/>
          <stop offset="1" stop-color="#14263a"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="8" fill="url(#sky-${template.variant.id})"/>
      <ellipse cx="540" cy="512" rx="390" ry="92" fill="#020813" opacity="0.55"/>
      <text x="${width - 44}" y="52" text-anchor="end" font-size="30" font-weight="800" fill="#eef5fb">نموذج 3D تخيلي - ${style.nameAr}</text>
      <text x="44" y="52" font-size="18" fill="#aab7c5">${template.designType.nameAr} | ${Math.round(result.areas.grossBuiltArea)} م² | ${result.input.floors} طابق</text>
      <g transform="translate(0 20)">
        ${blocks}
      </g>
      <text x="${width - 44}" y="638" text-anchor="end" font-size="18" fill="#f5c96f">كتل تخيلية وليست نموذج BIM أو مخطط رخصة - kamel3lom</text>
      <text x="44" y="638" font-size="16" fill="#aab7c5">${template.variant.classificationAr}</text>
    </svg>
  `;
}

function summarizePlan(template, rooms, result, mode) {
  return {
    mode,
    styleNameAr: template.style.nameAr,
    designTypeNameAr: template.designType.nameAr,
    variantId: template.variant.id,
    classificationAr: template.variant.classificationAr,
    area: Math.round(result.areas.grossBuiltArea),
    floors: result.input.floors,
    rooms: rooms.map((room) => ({
      label: room.label,
      area: room.area,
      floor: room.floor
    }))
  };
}

export function createDesignPlans(input, result, templates) {
  if (!templates || (!input.showPlan2d && !input.showPlan3d)) {
    return null;
  }

  const output = {
    noticeAr: templates.metadata.noticeAr,
    variantCount: templates.metadata.variantCount,
    twoD: null,
    threeD: null
  };

  if (input.showPlan2d) {
    const template = selectVariant({ input, result, templates, styleId: input.designStyle2d });
    const rooms = getRooms(template, result);
    output.twoD = {
      ...summarizePlan(template, rooms, result, "2D"),
      svg: render2dSvg({ template, rooms, result })
    };
  }

  if (input.showPlan3d) {
    const template = selectVariant({ input, result, templates, styleId: input.designStyle3d });
    const rooms = getRooms(template, result);
    output.threeD = {
      ...summarizePlan(template, rooms, result, "3D"),
      svg: render3dSvg({ template, rooms, result })
    };
  }

  return output;
}
