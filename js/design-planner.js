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

function selectVariant({ input, result, templates, styleId }) {
  const designType = DESIGN_TYPE_BY_PROJECT[input.projectType] || "villa";
  const area = clamp(Math.round(result.areas.grossBuiltArea || input.builtArea || 100), 100, 5000);
  const floors = input.floors || 1;
  const preferredStyle = styleId || "modern";

  const matchesTypeAndStyle = (variant) =>
    variant.styleId === preferredStyle &&
    variant.designType === designType &&
    area >= variant.areaMin &&
    area <= variant.areaMax;

  const exact = templates.variants.find(
    (variant) => matchesTypeAndStyle(variant) && floors >= variant.floorsMin && floors <= variant.floorsMax
  );

  const fallback =
    exact ||
    templates.variants.find(matchesTypeAndStyle) ||
    templates.variants.find((variant) => variant.styleId === preferredStyle && variant.designType === designType) ||
    templates.variants[0];

  return {
    variant: fallback,
    style: templates.styles.find((style) => style.id === fallback.styleId) || templates.styles[0],
    designType: templates.designTypes[fallback.designType]
  };
}

function summarizePlan(template, result, mode, assetPath) {
  return {
    mode,
    assetPath,
    styleNameAr: template.style.nameAr,
    designTypeNameAr: template.designType.nameAr,
    variantId: template.variant.id,
    classificationAr: template.variant.classificationAr,
    area: Math.round(result.areas.grossBuiltArea),
    floors: result.input.floors,
    profile: template.variant.profile
  };
}

export function createDesignPlans(input, result, templates) {
  if (!templates || (!input.showPlan2d && !input.showPlan3d)) {
    return null;
  }

  const output = {
    noticeAr: templates.metadata.noticeAr,
    variantCount: templates.metadata.variantCount,
    assetCount: templates.metadata.assetCount,
    twoD: null,
    threeD: null
  };

  if (input.showPlan2d) {
    const template = selectVariant({ input, result, templates, styleId: input.designStyle2d });
    output.twoD = summarizePlan(template, result, "2D", template.variant.assets.plan2d);
  }

  if (input.showPlan3d) {
    const template = selectVariant({ input, result, templates, styleId: input.designStyle3d });
    output.threeD = summarizePlan(template, result, "3D", template.variant.assets.render3d);
  }

  return output;
}
