function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("ar", { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatCurrency(value, currency) {
  return `${formatNumber(value)} ${escapeHtml(currency.symbolAr || currency.code)}`;
}

function tableRows(rows, cells) {
  return rows
    .map(
      (row) =>
        `<tr>${cells
          .map((cell) => `<td>${typeof cell === "function" ? cell(row) : escapeHtml(row[cell])}</td>`)
          .join("")}</tr>`
    )
    .join("");
}

export function exportReport(result) {
  if (!result) return;
  const reportDate = new Intl.DateTimeFormat("ar", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date());

  const features = result.input.featureLabels.length ? result.input.featureLabels.join("، ") : "لا توجد إضافات";
  const builtAreaModeLabel = result.input.builtAreaMode === "per_floor" ? "مساحة كل طابق" : "إجمالي مساحة البناء";
  const materialRows = tableRows(result.materials, [
    "nameAr",
    (row) => formatNumber(row.quantity),
    "unit",
    (row) => formatCurrency(row.unitPrice, result.currency),
    (row) => formatCurrency(row.cost, result.currency),
    (row) => `${escapeHtml(row.sourceName)}${row.officialItemName ? `<br><small>${escapeHtml(row.officialItemName)}</small>` : ""}`,
    "lastUpdated"
  ]);
  const laborRows = tableRows(result.labor.roles, [
    "labelAr",
    (row) => formatNumber(row.workers),
    (row) => formatNumber(row.activeDays),
    (row) => formatCurrency(row.averageDailyRate, result.currency),
    (row) => formatCurrency(row.cost, result.currency)
  ]);
  const stageRows = tableRows(result.duration.stages, ["labelAr", (row) => `${formatNumber(row.days)} يوم`]);
  const sourceRows = tableRows(result.priceSources, [
    "sourceName",
    "lastUpdated",
    "updateMethod",
    "sourceReliability",
    (row) => (row.isDemo ? "تجريبي" : "مدخل")
  ]);
  const designSection = result.designPlans
    ? `
      <h2>المخططات التخيلية</h2>
      <div class="warning">${escapeHtml(result.designPlans.noticeAr)}</div>
      ${
        result.designPlans.twoD
          ? `<h3>مخطط 2D - ${escapeHtml(result.designPlans.twoD.styleNameAr)}</h3>
             <p>${escapeHtml(result.designPlans.twoD.classificationAr)}</p>
             <div class="box"><img src="${escapeHtml(result.designPlans.twoD.assetPath)}" alt="مخطط 2D" style="width:100%;height:auto;"></div>`
          : ""
      }
      ${
        result.designPlans.threeD
          ? `<h3>مخطط 3D - ${escapeHtml(result.designPlans.threeD.styleNameAr)}</h3>
             <p>${escapeHtml(result.designPlans.threeD.classificationAr)}</p>
             <div class="box"><img src="${escapeHtml(result.designPlans.threeD.assetPath)}" alt="تصور 3D" style="width:100%;height:auto;"></div>`
          : ""
      }
    `
    : "";

  const buildingCode = result.buildingCode
    ? `
      <p><strong>اسم الكود:</strong> ${escapeHtml(result.buildingCode.codeNameAr)}</p>
      <p><strong>الجهة:</strong> ${escapeHtml(result.buildingCode.issuingAuthorityAr)}</p>
      <p><strong>النطاق:</strong> ${escapeHtml(result.buildingCode.scope.join("، "))}</p>
      <p><strong>الحالة:</strong> ${escapeHtml(result.buildingCode.statusAr)}</p>
      <p><strong>الرابط:</strong> ${
        result.buildingCode.officialSourceUrl
          ? `<a href="${escapeHtml(result.buildingCode.officialSourceUrl)}">${escapeHtml(
              result.buildingCode.officialSourceUrl
            )}</a>`
          : "غير مدخل"
      }</p>`
    : "<p>لا توجد بيانات كود بناء مدخلة لهذه الدولة.</p>";

  const reportHtml = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>تقرير علومكم للمقاولات - kamel3lom</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; margin: 32px; color: #17202a; line-height: 1.7; }
    .watermark { position: fixed; inset: 35% 10%; font-size: 72px; color: rgba(18, 41, 66, 0.07); transform: rotate(-18deg); z-index: -1; text-align: center; font-weight: 800; }
    h1, h2 { color: #102033; margin: 0 0 12px; }
    h1 { border-bottom: 3px solid #d7962c; padding-bottom: 10px; }
    h2 { margin-top: 28px; font-size: 20px; }
    .brand { color: #ad7421; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 18px; }
    .box { border: 1px solid #d9e0e8; border-radius: 8px; padding: 12px; margin: 12px 0; background: #fbfcfe; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th, td { border: 1px solid #d7dee8; padding: 7px; text-align: right; vertical-align: top; }
    th { background: #102033; color: white; }
    .warning { border: 1px solid #d7962c; background: #fff8ec; color: #533308; border-radius: 8px; padding: 12px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #d9e0e8; color: #52606d; font-size: 12px; }
    @media print { body { margin: 18mm; } a { color: #17202a; text-decoration: none; } }
  </style>
</head>
<body>
  <div class="watermark">kamel3lom</div>
  <h1>تقرير علومكم للمقاولات</h1>
  <p class="brand">Al3lomcom Contracting | kamel3lom</p>
  <p>تاريخ التقرير: ${escapeHtml(reportDate)}</p>

  <div class="warning">
    ${result.warnings.map((warning) => escapeHtml(warning)).join("<br>")}
  </div>

  <h2>بيانات المشروع</h2>
  <div class="box grid">
    <div><strong>الدولة:</strong> ${escapeHtml(result.country.nameAr)}</div>
    <div><strong>المدينة/المنطقة:</strong> ${escapeHtml(result.input.city || "غير مدخلة")}</div>
    <div><strong>نوع المشروع:</strong> ${escapeHtml(result.projectTypeLabel)}</div>
    <div><strong>نوع البناء:</strong> ${escapeHtml(result.constructionTypeLabel)}</div>
    <div><strong>مستوى التشطيب:</strong> ${escapeHtml(result.finishLevelLabel)}</div>
    <div><strong>الإضافات:</strong> ${escapeHtml(features)}</div>
    <div><strong>مساحة الأرض:</strong> ${formatNumber(result.areas.landArea)} م²</div>
    <div><strong>طريقة المساحة:</strong> ${escapeHtml(builtAreaModeLabel)}</div>
    <div><strong>إجمالي مساحة البناء:</strong> ${formatNumber(result.areas.grossBuiltArea)} م²</div>
  </div>

  <h2>النتائج المالية</h2>
  <div class="box grid">
    <div><strong>التكلفة الإجمالية التقريبية:</strong> ${formatCurrency(result.costs.totalCost, result.currency)}</div>
    <div><strong>تكلفة العظم:</strong> ${formatCurrency(result.costs.shellCost, result.currency)}</div>
    <div><strong>تكلفة التشطيب:</strong> ${formatCurrency(result.costs.finishingCost, result.currency)}</div>
    <div><strong>تكلفة المواد:</strong> ${formatCurrency(result.costs.materialCost, result.currency)}</div>
    <div><strong>تكلفة العمالة:</strong> ${formatCurrency(result.costs.laborCost, result.currency)}</div>
    <div><strong>النقل والمعدات:</strong> ${formatCurrency(result.costs.transportCost + result.costs.equipmentCost, result.currency)}</div>
    <div><strong>الهالك والاحتياطي:</strong> ${formatCurrency(result.costs.wasteCost + result.costs.contingencyCost, result.currency)}</div>
    <div><strong>الضريبة/الرسوم:</strong> ${formatCurrency(result.costs.taxCost, result.currency)}</div>
  </div>

  <h2>المدة والعمالة</h2>
  <div class="box grid">
    <div><strong>مدة التنفيذ:</strong> ${formatNumber(result.duration.totalDays)} يوم تقريبًا</div>
    <div><strong>عدد العمال المطلوبين:</strong> ${formatNumber(result.labor.totalWorkers)} عامل</div>
  </div>
  <table>
    <thead><tr><th>الدور</th><th>العدد</th><th>أيام العمل</th><th>اليومية</th><th>التكلفة</th></tr></thead>
    <tbody>${laborRows}</tbody>
  </table>

  <h2>جدول كميات مواد البناء</h2>
  <table>
    <thead><tr><th>المادة</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>التكلفة</th><th>المصدر</th><th>آخر تحديث</th></tr></thead>
    <tbody>${materialRows}</tbody>
  </table>

  ${designSection}

  <h2>مراحل البناء</h2>
  <table>
    <thead><tr><th>المرحلة</th><th>المدة</th></tr></thead>
    <tbody>${stageRows}</tbody>
  </table>

  <h2>مصادر الأسعار</h2>
  <table>
    <thead><tr><th>المصدر</th><th>آخر تحديث</th><th>طريقة التحديث</th><th>الموثوقية</th><th>نوع البيانات</th></tr></thead>
    <tbody>${sourceRows}</tbody>
  </table>

  <h2>كود البناء المرجعي</h2>
  <div class="box">${buildingCode}</div>

  <div class="footer">
    بصمة التقرير: kamel3lom<br>
    Facebook: Kamel Abu Samra | X: kamelabusamra | Instagram: kamel3lom | TikTok: kamel3lom | YouTube: al3lomcom
  </div>
  <script>window.addEventListener("load", () => window.print());</script>
</body>
</html>`;

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    alert("تعذر فتح نافذة التقرير. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.");
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(reportHtml);
  reportWindow.document.close();
}
