const DATA_PATHS = {
  countries: "data/countries.json",
  materials: "data/materials.json",
  prices: "data/prices.json",
  officialPriceSources: "data/official-price-sources.json",
  designTemplates: "data/design-templates.json",
  buildingCodes: "data/building-codes.json",
  laborRates: "data/labor-rates.json",
  factors: "data/calculation-factors.json"
};

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`تعذر تحميل ملف البيانات: ${path}`);
  }
  return response.json();
}

function normalizePriceRecords(priceData) {
  return priceData.countryPriceBooks.flatMap((book) =>
    book.items.map((item) => ({
      country: book.country,
      countryCode: book.countryCode,
      currency: book.currency,
      materialId: item.materialId,
      materialName: item.materialName,
      category: item.category,
      unit: item.unit,
      priceMin: item.priceMin,
      priceMax: item.priceMax,
      averagePrice: item.averagePrice,
      officialItemName: item.officialItemName || "",
      sourceName: item.sourceName || book.sourceName,
      sourceUrl: item.sourceUrl || book.sourceUrl,
      lastUpdated: item.lastUpdated || book.lastUpdated,
      updateMethod: item.updateMethod || book.updateMethod,
      sourceReliability: item.sourceReliability || book.sourceReliability,
      isDemo: item.isDemo ?? book.isDemo
    }))
  );
}

export async function loadAppData() {
  const [
    countriesData,
    materialsData,
    pricesData,
    officialSourcesData,
    designTemplatesData,
    codesData,
    laborData,
    factorsData
  ] =
    await Promise.all([
      fetchJson(DATA_PATHS.countries),
      fetchJson(DATA_PATHS.materials),
      fetchJson(DATA_PATHS.prices),
      fetchJson(DATA_PATHS.officialPriceSources),
      fetchJson(DATA_PATHS.designTemplates),
      fetchJson(DATA_PATHS.buildingCodes),
      fetchJson(DATA_PATHS.laborRates),
      fetchJson(DATA_PATHS.factors)
    ]);

  return {
    metadata: countriesData.metadata,
    countries: countriesData.countries,
    materials: materialsData.materials,
    priceBooks: pricesData.countryPriceBooks,
    priceRecords: normalizePriceRecords(pricesData),
    pricesMetadata: pricesData.metadata,
    officialPriceSources: officialSourcesData.sources,
    officialPriceSourcesMetadata: officialSourcesData.metadata,
    designTemplates: designTemplatesData,
    buildingCodes: codesData.buildingCodes,
    buildingCodesMetadata: codesData.metadata,
    laborRates: laborData.laborRates,
    laborMetadata: laborData.metadata,
    factors: factorsData
  };
}
