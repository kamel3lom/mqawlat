import { loadAppData } from "./data-loader.js";
import { calculateEstimate, sanitizeProjectInput } from "./calculations.js";
import { createDesignPlans } from "./design-planner.js";
import { exportReport } from "./report.js";

const STORAGE_KEY = "kamel3lom:last-project";

const state = {
  data: null,
  result: null
};

const $ = (selector) => document.querySelector(selector);

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("ar", {
    maximumFractionDigits: digits
  }).format(Number(value) || 0);
}

function formatCurrency(value, currency) {
  const digits = currency?.decimals ?? 2;
  return `${new Intl.NumberFormat("ar", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(Number(value) || 0)} ${currency?.symbolAr || currency?.code || ""}`;
}

function setStatus(message, type = "info") {
  const status = $("#appStatus");
  status.textContent = message;
  status.dataset.type = type;
}

function option(value, label, selected = false) {
  return `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;
}

function getSelectedCountry() {
  const countryCode = $("#countrySelect").value;
  return state.data.countries.find((country) => country.code === countryCode) || state.data.countries[0];
}

function populateFormOptions() {
  const { countries, factors } = state.data;
  $("#countrySelect").innerHTML = countries.map((country) => option(country.code, country.nameAr)).join("");

  $("#projectType").innerHTML = Object.entries(factors.projectTypeMultipliers)
    .map(([value, item]) => option(value, item.labelAr, value === "villa"))
    .join("");

  $("#finishLevel").innerHTML = Object.entries(factors.finishLevels)
    .map(([value, item]) => option(value, item.labelAr, value === "medium"))
    .join("");

  const styleOptions = state.data.designTemplates.styles
    .map((style) => option(style.id, style.nameAr, style.id === "modern"))
    .join("");
  $("#designStyle2d").innerHTML = styleOptions;
  $("#designStyle3d").innerHTML = styleOptions;

  renderCountryContext();
  toggleFinishLevel();
  toggleDesignOptions();
}

function renderCityOptions(country) {
  $("#cityOptions").innerHTML = country.regions
    .map((region) => `<option value="${region}"></option>`)
    .join("");
}

function renderBuildingCode(code) {
  const container = $("#buildingCodeCard");
  if (!code) {
    container.innerHTML = `<p class="muted">لا توجد بيانات كود بناء مرجعي لهذه الدولة.</p>`;
    return;
  }

  const sourceLink = code.officialSourceUrl
    ? `<a href="${code.officialSourceUrl}" target="_blank" rel="noopener">فتح المصدر المرجعي</a>`
    : `<span class="muted">لا يوجد رابط رسمي مدخل في البيانات.</span>`;

  container.innerHTML = `
    <div class="code-title">
      <span class="icon-badge"><img src="assets/icons/crane.svg" alt=""></span>
      <div>
        <h3>${code.codeNameAr}</h3>
        <p>${code.issuingAuthorityAr}</p>
      </div>
    </div>
    <dl class="details-list">
      <div><dt>سنة الإصدار</dt><dd>${code.issueYear}</dd></div>
      <div><dt>آخر تحديث</dt><dd>${code.lastUpdated}</dd></div>
      <div><dt>النطاق</dt><dd>${code.scope.join("، ")}</dd></div>
      <div><dt>الحالة</dt><dd>${code.statusAr}</dd></div>
    </dl>
    <p class="muted">${code.notesAr}</p>
    <div class="source-link">${sourceLink}</div>
  `;
}

function renderSources(sources) {
  const sourceRows = sources.map(
    (source) => `
      <tr>
        <td>${source.sourceName}</td>
        <td>${source.lastUpdated}</td>
        <td>${source.updateMethod}</td>
        <td>${source.sourceReliability}</td>
        <td>${source.isDemo ? "sample/demo" : "مدخل"}</td>
      </tr>
    `
  );
  $("#sourceRows").innerHTML = sourceRows.join("");
}

function renderOfficialSourceCards(countryCode) {
  const container = $("#officialSourceCards");
  const sources = (state.data.officialPriceSources || []).filter((source) => source.countryCode === countryCode);
  if (!container) return;

  if (!sources.length) {
    container.innerHTML = `<p class="muted">لا توجد مصادر رسمية مسجلة لهذه الدولة بعد.</p>`;
    return;
  }

  container.innerHTML = sources
    .map(
      (source) => `
        <article class="official-source-card">
          <strong>${source.datasetNameAr}</strong>
          <span>${source.authorityAr}</span>
          <span>${source.coverageAr}</span>
          <span>${source.statusAr}</span>
          <a href="${source.officialUrl}" target="_blank" rel="noopener">فتح المصدر الرسمي</a>
        </article>
      `
    )
    .join("");
}

function renderCountryContext() {
  const country = getSelectedCountry();
  renderCityOptions(country);

  $("#currencyBadge").textContent = `${country.currency.code} | ${country.currency.symbolAr}`;
  $("#taxBadge").textContent = country.tax.enabled
    ? `${country.tax.labelAr}: ${formatNumber(country.tax.rate * 100, 0)}%`
    : "لا توجد ضريبة مفعلة في ملف الدولة";

  const priceBook = state.data.priceBooks.find((book) => book.countryCode === country.code);
  const officialCount = state.data.priceRecords.filter(
    (record) => record.countryCode === country.code && record.isDemo === false
  ).length;
  $("#dataNotice").innerHTML = `
    <strong>تنبيه بيانات:</strong>
    ${
      officialCount
        ? `توجد ${officialCount} مواد مرتبطة بمصدر رسمي أو تحويل وحدة من مصدر رسمي، وبقية البنود غير الرسمية تبقى تجريبية.`
        : country.demoPriceNoticeAr
    }
    ${state.data.pricesMetadata.noticeAr}
  `;

  renderBuildingCode(state.data.buildingCodes.find((code) => code.countryCode === country.code));
  renderOfficialSourceCards(country.code);
  if (priceBook) renderSources([priceBook]);
}

function toggleFinishLevel() {
  const constructionType = new FormData($("#projectForm")).get("constructionType");
  const wrapper = $("#finishLevelWrapper");
  const isFull = constructionType === "full";
  wrapper.hidden = !isFull;
  $("#finishLevel").disabled = !isFull;
}

function toggleDesignOptions() {
  $("#designStyle2dWrapper").hidden = !$("#showPlan2d").checked;
  $("#designStyle3dWrapper").hidden = !$("#showPlan3d").checked;
}

function readFormInput() {
  const form = $("#projectForm");
  const formData = new FormData(form);
  return sanitizeProjectInput({
    countryCode: formData.get("countryCode"),
    city: $("#city").value.trim(),
    projectType: formData.get("projectType"),
    landArea: formData.get("landArea"),
    builtArea: formData.get("builtArea"),
    builtAreaMode: formData.get("builtAreaMode"),
    floors: formData.get("floors"),
    basement: $("#basement").checked,
    fence: $("#fence").checked,
    undergroundTank: $("#undergroundTank").checked,
    roofTank: $("#roofTank").checked,
    elevator: $("#elevator").checked,
    constructionType: formData.get("constructionType"),
    finishLevel: formData.get("finishLevel"),
    showPlan2d: $("#showPlan2d").checked,
    designStyle2d: formData.get("designStyle2d"),
    showPlan3d: $("#showPlan3d").checked,
    designStyle3d: formData.get("designStyle3d")
  });
}

function fillForm(input) {
  $("#countrySelect").value = input.countryCode || "SA";
  renderCountryContext();
  $("#city").value = input.city || "";
  $("#projectType").value = input.projectType || "villa";
  $("#landArea").value = input.landArea || 500;
  $("#builtArea").value = input.builtArea || 300;
  $("#builtAreaMode").value = input.builtAreaMode || "total";
  $("#floors").value = input.floors || 1;

  FEATURE_KEYS.forEach((key) => {
    $(`#${key}`).checked = Boolean(input[key]);
  });

  const constructionValue = input.constructionType || "shell";
  document.querySelectorAll('input[name="constructionType"]').forEach((radio) => {
    radio.checked = radio.value === constructionValue;
  });

  $("#finishLevel").value = input.finishLevel || "medium";
  $("#showPlan2d").checked = Boolean(input.showPlan2d);
  $("#designStyle2d").value = input.designStyle2d || "modern";
  $("#showPlan3d").checked = Boolean(input.showPlan3d);
  $("#designStyle3d").value = input.designStyle3d || "modern";
  toggleFinishLevel();
  toggleDesignOptions();
}

const FEATURE_KEYS = ["basement", "fence", "undergroundTank", "roofTank", "elevator"];

function metricCard(label, value, hint, tone = "") {
  return `
    <article class="metric-card ${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </article>
  `;
}

function renderSummary(result) {
  const currency = result.currency;
  $("#summaryCards").innerHTML = [
    metricCard("التكلفة الإجمالية التقريبية", formatCurrency(result.costs.totalCost, currency), "تشمل المواد والعمالة والإضافات", "primary"),
    metricCard("تكلفة العظم", formatCurrency(result.costs.shellCost, currency), "مواد العظم وحصة تنفيذ تقديرية"),
    metricCard("تكلفة التشطيب", formatCurrency(result.costs.finishingCost, currency), result.finishLevelLabel),
    metricCard("تكلفة المواد", formatCurrency(result.costs.materialCost, currency), "حسب جدول الكميات"),
    metricCard("تكلفة العمالة", formatCurrency(result.costs.laborCost, currency), `${result.labor.totalWorkers} عامل تقريبًا`, "success"),
    metricCard("مدة التنفيذ", `${formatNumber(result.duration.totalDays, 0)} يوم`, `${formatNumber(result.duration.totalMonths, 1)} شهر تقريبًا`),
    metricCard("النقل والمعدات", formatCurrency(result.costs.transportCost + result.costs.equipmentCost, currency), "نسبة تقديرية من تكلفة المواد"),
    metricCard("الهالك والاحتياطي", formatCurrency(result.costs.wasteCost + result.costs.contingencyCost, currency), "هالك مواد واحتياطي مخاطر"),
    metricCard("الضريبة أو الرسوم", formatCurrency(result.costs.taxCost, currency), result.costs.taxEnabled ? result.costs.taxLabel : "غير مفعلة"),
    metricCard("مؤشر مستوى التكلفة", result.costIndex.labelAr, `${formatCurrency(result.costIndex.costPerSqm, currency)} / م²`, result.costIndex.tone)
  ].join("");

  $("#topMaterials").innerHTML = result.topMaterials
    .map(
      (row) => `
        <li>
          <span>${row.nameAr}</span>
          <strong>${formatCurrency(row.cost, currency)}</strong>
        </li>
      `
    )
    .join("");

  $("#resultWarnings").innerHTML = result.warnings.map((warning) => `<p>${warning}</p>`).join("");
}

function renderMaterialsTable(result) {
  $("#materialRows").innerHTML = result.materials
    .map(
      (row) => `
        <tr>
          <td>${row.nameAr}</td>
          <td>${formatNumber(row.quantity)}</td>
          <td>${row.unit}</td>
          <td>${formatCurrency(row.unitPrice, result.currency)}</td>
          <td>${formatCurrency(row.cost, result.currency)}</td>
          <td>${row.sourceName}${row.officialItemName ? `<small class="cell-note">${row.officialItemName}</small>` : ""}</td>
          <td>${row.lastUpdated}</td>
        </tr>
      `
    )
    .join("");
}

function renderLaborAndDuration(result) {
  $("#laborRows").innerHTML = result.labor.roles
    .map(
      (row) => `
        <tr>
          <td>${row.labelAr}</td>
          <td>${formatNumber(row.workers, 0)}</td>
          <td>${formatNumber(row.activeDays, 0)} يوم</td>
          <td>${formatCurrency(row.averageDailyRate, result.currency)}</td>
          <td>${formatCurrency(row.cost, result.currency)}</td>
        </tr>
      `
    )
    .join("");

  $("#stageRows").innerHTML = result.duration.stages
    .map(
      (stage) => `
        <tr>
          <td>${stage.labelAr}</td>
          <td>${formatNumber(stage.days, 0)} يوم</td>
        </tr>
      `
    )
    .join("");
}

function renderDesignPlans(result) {
  const plans = result.designPlans;
  $("#designPlansPanel").hidden = !plans;
  if (!plans) return;

  $("#designTemplateCount").textContent = `${formatNumber(plans.assetCount || plans.variantCount, 0)} ملف مخزن`;
  $("#designNotice").textContent = plans.noticeAr;

  $("#plan2dCard").hidden = !plans.twoD;
  if (plans.twoD) {
    $("#plan2dMeta").textContent = `${plans.twoD.designTypeNameAr} | ${plans.twoD.styleNameAr} | ${plans.twoD.area} م²`;
    $("#plan2dCanvas").innerHTML = `<img src="${plans.twoD.assetPath}" alt="مخطط 2D ${plans.twoD.classificationAr}" loading="lazy">`;
  } else {
    $("#plan2dCanvas").innerHTML = "";
  }

  $("#plan3dCard").hidden = !plans.threeD;
  if (plans.threeD) {
    $("#plan3dMeta").textContent = `${plans.threeD.designTypeNameAr} | ${plans.threeD.styleNameAr} | ${plans.threeD.area} م²`;
    $("#plan3dCanvas").innerHTML = `<img src="${plans.threeD.assetPath}" alt="تصور 3D ${plans.threeD.classificationAr}" loading="lazy">`;
  } else {
    $("#plan3dCanvas").innerHTML = "";
  }
}

function renderResults(result) {
  $("#resultsSection").hidden = false;
  renderSummary(result);
  renderDesignPlans(result);
  renderMaterialsTable(result);
  renderLaborAndDuration(result);
  renderSources(result.priceSources);
  renderBuildingCode(result.buildingCode);
  $("#reportButton").disabled = false;
  $("#resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function calculateAndRender() {
  const input = readFormInput();
  if (input.landArea <= 0 || input.builtArea <= 0 || input.floors <= 0) {
    throw new Error("أدخل مساحة الأرض ومساحة البناء وعدد الطوابق بقيم أكبر من صفر.");
  }

  const result = calculateEstimate(input, state.data);
  result.designPlans = createDesignPlans(input, result, state.data.designTemplates);
  state.result = result;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      input
    })
  );
  renderResults(result);
  setStatus("تم الحساب وحفظ آخر مشروع محليًا على هذا المتصفح.", "success");
}

function restoreLastProject() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    setStatus("لا يوجد مشروع محفوظ في هذا المتصفح.", "warning");
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    fillForm(parsed.input || parsed);
    calculateAndRender();
    setStatus("تم استرجاع آخر مشروع محفوظ.", "success");
  } catch (error) {
    setStatus("تعذر استرجاع المشروع المحفوظ. امسح البيانات وحاول من جديد.", "warning");
  }
}

function clearLocalData() {
  localStorage.removeItem(STORAGE_KEY);
  $("#projectForm").reset();
  fillForm({
    countryCode: "SA",
    city: "",
    projectType: "villa",
    landArea: 500,
    builtArea: 300,
    builtAreaMode: "total",
    floors: 1,
    constructionType: "shell",
    finishLevel: "medium",
    showPlan2d: false,
    designStyle2d: "modern",
    showPlan3d: false,
    designStyle3d: "modern"
  });
  state.result = null;
  $("#resultsSection").hidden = true;
  $("#reportButton").disabled = true;
  setStatus("تم مسح البيانات المحلية وإعادة النموذج للوضع الافتراضي.", "success");
}

function bindEvents() {
  $("#startButton").addEventListener("click", () => {
    $("#calculator").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#countrySelect").addEventListener("change", renderCountryContext);
  document.querySelectorAll('input[name="constructionType"]').forEach((radio) => {
    radio.addEventListener("change", toggleFinishLevel);
  });
  $("#showPlan2d").addEventListener("change", toggleDesignOptions);
  $("#showPlan3d").addEventListener("change", toggleDesignOptions);

  $("#projectForm").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      calculateAndRender();
    } catch (error) {
      setStatus(error.message, "warning");
    }
  });

  $("#restoreButton").addEventListener("click", restoreLastProject);
  $("#clearButton").addEventListener("click", clearLocalData);
  $("#reportButton").addEventListener("click", () => exportReport(state.result));
}

async function init() {
  try {
    state.data = await loadAppData();
    populateFormOptions();
    bindEvents();
    setStatus("البيانات التجريبية جاهزة. أدخل بيانات المشروع ثم اضغط احسب الآن.", "info");
  } catch (error) {
    setStatus(error.message || "تعذر تحميل بيانات التطبيق.", "warning");
  }
}

document.addEventListener("DOMContentLoaded", init);
