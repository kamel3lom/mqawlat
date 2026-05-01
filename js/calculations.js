const FEATURE_KEYS = ["basement", "fence", "undergroundTank", "roofTank", "elevator"];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundQuantity(value, step = 0.01) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (step >= 1) return Math.ceil(value / step) * step;
  const rounded = Math.ceil(value / step) * step;
  return Number(rounded.toFixed(3));
}

function roundMoney(value) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

function getById(items, key = "id") {
  return new Map(items.map((item) => [item[key], item]));
}

function estimatePerimeter(landArea, builtArea) {
  const referenceArea = landArea > 0 ? landArea : builtArea;
  if (!referenceArea) return 0;
  return Math.ceil(Math.sqrt(referenceArea) * 4);
}

function calculateCostIndex(totalCost, grossBuiltArea, finishLevel, countryCode, factors) {
  const costPerSqm = grossBuiltArea > 0 ? totalCost / grossBuiltArea : 0;
  const benchmarkLevel = finishLevel || "medium";
  const benchmark = factors.finishLevels[benchmarkLevel]?.costPerSqm?.[countryCode] || 1000;
  const ratio = benchmark > 0 ? costPerSqm / benchmark : 1;

  if (ratio < 0.85) {
    return { labelAr: "منخفض", tone: "success", costPerSqm: roundMoney(costPerSqm) };
  }
  if (ratio < 1.45) {
    return { labelAr: "متوسط", tone: "warning", costPerSqm: roundMoney(costPerSqm) };
  }
  return { labelAr: "مرتفع", tone: "danger", costPerSqm: roundMoney(costPerSqm) };
}

function applyMaterialAdditions({
  addMaterial,
  additions,
  multiplier = 1,
  constructionType,
  materialById
}) {
  Object.entries(additions || {}).forEach(([materialId, amount]) => {
    const material = materialById.get(materialId);
    if (!material || !material.includedFor.includes(constructionType)) return;
    addMaterial(materialId, amount * multiplier);
  });
}

function calculateDuration({
  grossBuiltArea,
  floors,
  constructionType,
  finishLevel,
  projectMultiplier,
  countryMultiplier,
  factors,
  featureDays
}) {
  const construction = factors.constructionTypes[constructionType];
  const finish = finishLevel ? factors.finishLevels[finishLevel] : null;
  const stageRows = factors.durationStages
    .filter((stage) => stage.appliesTo.includes(constructionType))
    .map((stage) => {
      let days =
        stage.baseDays +
        (grossBuiltArea / 100) * stage.per100Sqm +
        Math.max(floors - 1, 0) * stage.perFloor;

      days *= projectMultiplier.duration;
      days *= countryMultiplier.duration;
      days *= construction.durationMultiplier;

      if (finish && ["mep_rough_in", "plaster", "finishes"].includes(stage.id)) {
        days *= finish.durationMultiplier;
      }

      return {
        id: stage.id,
        labelAr: stage.labelAr,
        days: Math.max(1, Math.ceil(days))
      };
    });

  if (featureDays > 0) {
    stageRows.push({
      id: "special_features",
      labelAr: "الأعمال الإضافية",
      days: Math.ceil(featureDays)
    });
  }

  const totalDays = stageRows.reduce((sum, stage) => sum + stage.days, 0);
  return {
    stages: stageRows,
    totalDays,
    totalMonths: Number((totalDays / 30).toFixed(1))
  };
}

function calculateLabor({
  grossBuiltArea,
  durationDays,
  constructionType,
  finishLevel,
  projectMultiplier,
  countryMultiplier,
  factors,
  laborBook,
  hasBasement,
  featureIntensity
}) {
  const finish = finishLevel ? factors.finishLevels[finishLevel] : null;
  const roleRows = Object.entries(factors.laborProductivity.roles).map(([roleId, role]) => {
    if (role.fullOnly && constructionType !== "full") {
      return {
        roleId,
        labelAr: role.labelAr,
        workers: 0,
        activeDays: 0,
        averageDailyRate: 0,
        cost: 0
      };
    }

    let manDays = grossBuiltArea * role.manDaysPerSqm;
    manDays *= projectMultiplier.labor;
    manDays *= countryMultiplier.labor;
    if (hasBasement) manDays *= factors.specialFeatures.basement.laborMultiplier;
    if (finish && role.fullOnly) manDays *= finish.laborMultiplier;
    manDays += featureIntensity * (role.fullOnly ? 0.4 : 0.7);

    const minimumWorkers = role.minimumWorkers || 0;
    const effectiveDuration = Math.max(durationDays * 0.72, 1);
    const workers = Math.max(minimumWorkers, Math.ceil(manDays / effectiveDuration));
    const activeDays = workers > 0 ? Math.max(1, Math.ceil(manDays / workers)) : 0;
    const rate = laborBook?.roles?.[roleId]?.averageDailyRate || 0;
    const cost = workers * activeDays * rate;

    return {
      roleId,
      labelAr: role.labelAr,
      workers,
      activeDays,
      averageDailyRate: rate,
      cost: roundMoney(cost)
    };
  });

  return {
    roles: roleRows,
    totalWorkers: roleRows.reduce((sum, row) => sum + row.workers, 0),
    totalLaborCost: roundMoney(roleRows.reduce((sum, row) => sum + row.cost, 0))
  };
}

export function calculateEstimate(rawInput, data) {
  const countryCode = rawInput.countryCode;
  const country = data.countries.find((item) => item.code === countryCode);
  if (!country) throw new Error("اختر دولة صحيحة قبل الحساب.");

  const landArea = Math.max(0, toNumber(rawInput.landArea));
  const builtArea = Math.max(1, toNumber(rawInput.builtArea));
  const floors = Math.max(1, Math.round(toNumber(rawInput.floors, 1)));
  const builtAreaMode = rawInput.builtAreaMode === "per_floor" ? "per_floor" : "total";
  const constructionType = rawInput.constructionType || "shell";
  const finishLevel = constructionType === "full" ? rawInput.finishLevel || "medium" : null;

  const factors = data.factors;
  const projectMultiplier = factors.projectTypeMultipliers[rawInput.projectType] || factors.projectTypeMultipliers.house;
  const countryMultiplier = factors.countryCostMultipliers[countryCode] || { materials: 1, labor: 1, duration: 1 };
  const finish = finishLevel ? factors.finishLevels[finishLevel] : null;

  const baseBuiltArea = builtAreaMode === "per_floor" ? builtArea * floors : builtArea;
  const typicalFloorArea = Math.max(1, baseBuiltArea / floors);
  const basementArea = rawInput.basement ? typicalFloorArea * factors.specialFeatures.basement.builtAreaMultiplier : 0;
  const grossBuiltArea = baseBuiltArea + basementArea;
  const perimeterMeters = estimatePerimeter(landArea, typicalFloorArea);

  const materialById = getById(data.materials);
  const quantityFactorById = getById(factors.materialQuantityFactors, "materialId");
  const priceMap = new Map(
    data.priceRecords
      .filter((record) => record.countryCode === countryCode)
      .map((record) => [record.materialId, record])
  );
  const quantities = new Map();
  const addMaterial = (materialId, amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    quantities.set(materialId, (quantities.get(materialId) || 0) + amount);
  };

  factors.materialQuantityFactors.forEach((factor) => {
    const material = materialById.get(factor.materialId);
    if (!material || !factor.appliesTo.includes(constructionType)) return;

    let amount = grossBuiltArea * factor.basePerSqm;
    amount *= projectMultiplier.materials;
    amount *= countryMultiplier.materials;

    if (["rebar", "concrete", "formwork"].includes(factor.materialId)) {
      amount *= 1 + Math.min(Math.max(floors - 1, 0) * 0.035, 0.18);
    }

    if (finish && material.includedFor.length === 1 && material.includedFor[0] === "full") {
      amount *= finish.materialMultiplier;
    }

    addMaterial(factor.materialId, amount);
  });

  let featureDays = 0;
  let featureIntensity = 0;
  const featureLabels = [];

  if (rawInput.basement) {
    const feature = factors.specialFeatures.basement;
    featureDays += feature.durationDays;
    featureIntensity += typicalFloorArea * 0.04;
    featureLabels.push(feature.labelAr);
    applyMaterialAdditions({
      addMaterial,
      additions: feature.materials,
      multiplier: typicalFloorArea,
      constructionType,
      materialById
    });
  }

  if (rawInput.fence) {
    const feature = factors.specialFeatures.fence;
    featureDays += perimeterMeters * feature.durationDaysPerMeter;
    featureIntensity += perimeterMeters * 0.03;
    featureLabels.push(feature.labelAr);
    applyMaterialAdditions({
      addMaterial,
      additions: feature.materialsPerMeter,
      multiplier: perimeterMeters,
      constructionType,
      materialById
    });
  }

  if (rawInput.undergroundTank) {
    const feature = factors.specialFeatures.undergroundTank;
    featureDays += feature.durationDays;
    featureIntensity += 4;
    featureLabels.push(feature.labelAr);
    applyMaterialAdditions({ addMaterial, additions: feature.materials, constructionType, materialById });
  }

  if (rawInput.roofTank) {
    const feature = factors.specialFeatures.roofTank;
    featureDays += feature.durationDays;
    featureIntensity += 2;
    featureLabels.push(feature.labelAr);
    applyMaterialAdditions({ addMaterial, additions: feature.materials, constructionType, materialById });
  }

  if (rawInput.elevator) {
    const feature = factors.specialFeatures.elevator;
    featureDays += feature.durationDays;
    featureIntensity += 8;
    featureLabels.push(feature.labelAr);
    applyMaterialAdditions({ addMaterial, additions: feature.materials, constructionType, materialById });
  }

  const materialRows = Array.from(quantities.entries())
    .map(([materialId, rawQuantity]) => {
      const material = materialById.get(materialId);
      const quantityFactor = quantityFactorById.get(materialId);
      const priceRecord = priceMap.get(materialId);
      const quantity = roundQuantity(rawQuantity, quantityFactor?.roundTo || 0.01);
      const unitPrice = priceRecord?.averagePrice || 0;
      const cost = quantity * unitPrice;

      return {
        materialId,
        nameAr: material?.nameAr || priceRecord?.materialName || materialId,
        category: material?.category || priceRecord?.category || "غير مصنف",
        unit: material?.unitAr || priceRecord?.unit || "",
        quantity,
        unitPrice,
        priceMin: priceRecord?.priceMin || 0,
        priceMax: priceRecord?.priceMax || 0,
        cost: roundMoney(cost),
        sourceName: priceRecord?.sourceName || "غير مدخل",
        sourceUrl: priceRecord?.sourceUrl || "",
        officialItemName: priceRecord?.officialItemName || "",
        lastUpdated: priceRecord?.lastUpdated || "غير محدد",
        sourceReliability: priceRecord?.sourceReliability || "غير محدد",
        isDemo: priceRecord?.isDemo ?? true,
        tablePriority: material?.tablePriority || 999
      };
    })
    .filter((row) => row.quantity > 0)
    .sort((a, b) => a.tablePriority - b.tablePriority);

  const materialCost = roundMoney(materialRows.reduce((sum, row) => sum + row.cost, 0));
  const shellMaterialCost = roundMoney(
    materialRows
      .filter((row) => !["التشطيب", "الأعمال الكهروميكانيكية"].includes(row.category))
      .reduce((sum, row) => sum + row.cost, 0)
  );
  const finishingMaterialCost = roundMoney(materialCost - shellMaterialCost);
  const finishAllowance =
    constructionType === "full" && finish
      ? roundMoney(grossBuiltArea * finish.costPerSqm[countryCode] * projectMultiplier.materials)
      : 0;

  const duration = calculateDuration({
    grossBuiltArea,
    floors,
    constructionType,
    finishLevel,
    projectMultiplier,
    countryMultiplier,
    factors,
    featureDays
  });

  const laborBook = data.laborRates.find((book) => book.countryCode === countryCode);
  const labor = calculateLabor({
    grossBuiltArea,
    durationDays: duration.totalDays,
    constructionType,
    finishLevel,
    projectMultiplier,
    countryMultiplier,
    factors,
    laborBook,
    hasBasement: Boolean(rawInput.basement),
    featureIntensity
  });

  const transportCost = roundMoney(materialCost * factors.overheads.transportRate);
  const equipmentCost = roundMoney(materialCost * factors.overheads.equipmentRate);
  const wasteCost = roundMoney(materialCost * factors.overheads.wasteRate);
  const subtotalBeforeContingency =
    materialCost + labor.totalLaborCost + finishAllowance + transportCost + equipmentCost + wasteCost;
  const contingencyCost = roundMoney(subtotalBeforeContingency * factors.overheads.contingencyRate);
  const taxableSubtotal = subtotalBeforeContingency + contingencyCost;
  const taxCost = country.tax.enabled ? roundMoney(taxableSubtotal * country.tax.rate) : 0;
  const totalCost = roundMoney(taxableSubtotal + taxCost);

  const shellCost = roundMoney(shellMaterialCost + labor.totalLaborCost * 0.58 + transportCost * 0.7 + equipmentCost * 0.8);
  const finishingCost = roundMoney(
    constructionType === "full" ? finishAllowance + finishingMaterialCost + labor.totalLaborCost * 0.42 : 0
  );

  const priceSources = Array.from(
    new Map(
      materialRows.map((row) => [
        `${row.sourceName}-${row.lastUpdated}`,
        {
          country: country.nameAr,
          sourceName: row.sourceName,
          sourceUrl: row.sourceUrl,
          lastUpdated: row.lastUpdated,
          updateMethod:
            data.priceRecords.find(
              (record) => record.countryCode === countryCode && record.materialId === row.materialId
            )?.updateMethod || "يدوي",
          sourceReliability: row.sourceReliability,
          isDemo: row.isDemo
        }
      ])
    ).values()
  );

  const buildingCode = data.buildingCodes.find((code) => code.countryCode === countryCode) || null;
  const topMaterials = [...materialRows].sort((a, b) => b.cost - a.cost).slice(0, 5);
  const demoMaterialCount = materialRows.filter((row) => row.isDemo).length;
  const officialMaterialCount = materialRows.length - demoMaterialCount;
  const priceWarning =
    demoMaterialCount > 0
      ? `يحتوي التقرير على ${demoMaterialCount} بند أسعار تجريبي و${officialMaterialCount} بند غير تجريبي. يجب استبدال البنود التجريبية أو توثيقها قبل الاعتماد.`
      : "كل بنود الأسعار المستخدمة في هذا التقرير موسومة كمصادر غير تجريبية داخل قاعدة البيانات، مع بقاء الكميات تقديرية وتحتاج مراجعة هندسية.";

  return {
    generatedAt: new Date().toISOString(),
    input: {
      ...rawInput,
      landArea,
      builtArea,
      builtAreaMode,
      floors,
      constructionType,
      finishLevel,
      featureLabels
    },
    country,
    currency: country.currency,
    projectTypeLabel: projectMultiplier.labelAr,
    constructionTypeLabel: factors.constructionTypes[constructionType].labelAr,
    finishLevelLabel: finish?.labelAr || "غير مطبق",
    areas: {
      landArea,
      enteredBuiltArea: builtArea,
      builtAreaMode,
      typicalFloorArea,
      baseBuiltArea,
      basementArea,
      grossBuiltArea,
      perimeterMeters
    },
    materials: materialRows,
    topMaterials,
    labor,
    duration,
    buildingCode,
    priceSources,
    costIndex: calculateCostIndex(totalCost, grossBuiltArea, finishLevel, countryCode, factors),
    costs: {
      totalCost,
      shellCost,
      finishingCost,
      finishAllowance,
      materialCost,
      shellMaterialCost,
      finishingMaterialCost,
      laborCost: labor.totalLaborCost,
      transportCost,
      equipmentCost,
      wasteCost,
      contingencyCost,
      taxCost,
      taxLabel: country.tax.labelAr,
      taxRate: country.tax.rate,
      taxEnabled: country.tax.enabled
    },
    warnings: [
      "النتائج تقديرية وليست بديلًا عن مهندس أو مكتب هندسي أو حصر كميات معتمد.",
      priceWarning,
      "لا تستخدم الأداة كعرض سعر تعاقدي أو مستند ترخيص."
    ]
  };
}

export function sanitizeProjectInput(input) {
  return {
    countryCode: input.countryCode || "SA",
    city: input.city || "",
    projectType: input.projectType || "villa",
    landArea: toNumber(input.landArea, 500),
    builtArea: toNumber(input.builtArea, 300),
    builtAreaMode: input.builtAreaMode === "per_floor" ? "per_floor" : "total",
    floors: Math.max(1, Math.round(toNumber(input.floors, 1))),
    basement: Boolean(input.basement),
    fence: Boolean(input.fence),
    undergroundTank: Boolean(input.undergroundTank),
    roofTank: Boolean(input.roofTank),
    elevator: Boolean(input.elevator),
    constructionType: input.constructionType || "shell",
    finishLevel: input.finishLevel || "medium",
    showPlan2d: Boolean(input.showPlan2d),
    designStyle2d: input.designStyle2d || "modern",
    showPlan3d: Boolean(input.showPlan3d),
    designStyle3d: input.designStyle3d || "modern"
  };
}
