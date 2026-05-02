const REMOTE_COUNTER_BASE_URL = "https://abacus.jasoncameron.dev";
const COUNTER_NAMESPACE = "al3lomcom-contracting";
const LOCAL_STATS_KEY = "kamel3lom:site-stats";

const DEFAULT_STATS = {
  visits: 0,
  calculations: 0,
  reports: 0
};

const COUNTER_KEYS = {
  visits: "visits",
  calculations: "calculator-uses",
  reports: "pdf-reports"
};

const COUNTER_COUNTED_KEYS = {
  visits: "kamel3lom:visitor-counted",
  calculations: "kamel3lom:calculator-user-counted",
  reports: "kamel3lom:report-downloader-counted"
};

const COUNTER_PENDING_KEYS = {
  visits: "kamel3lom:visitor-pending-sync",
  calculations: "kamel3lom:calculator-user-pending-sync",
  reports: "kamel3lom:report-downloader-pending-sync"
};

const COUNTER_SELECTORS = {
  visits: "#siteVisitCount",
  calculations: "#calculatorUseCount",
  reports: "#reportDownloadCount"
};

function formatNumber(value) {
  return new Intl.NumberFormat("ar", {
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function getStoredValue(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function setStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Counters still render remote values even when local persistence is unavailable.
  }
}

function readLocalStats() {
  const savedStats = getStoredValue(LOCAL_STATS_KEY);
  if (!savedStats) return { ...DEFAULT_STATS };

  try {
    return {
      ...DEFAULT_STATS,
      ...JSON.parse(savedStats)
    };
  } catch (error) {
    return { ...DEFAULT_STATS };
  }
}

function writeLocalStats(stats) {
  setStoredValue(LOCAL_STATS_KEY, JSON.stringify(stats));
}

function renderStats(stats = readLocalStats()) {
  Object.entries(COUNTER_SELECTORS).forEach(([name, selector]) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = formatNumber(stats[name]);
  });
}

function saveCounterValue(name, value) {
  const stats = readLocalStats();
  stats[name] = Math.max(0, Number(value) || 0);
  writeLocalStats(stats);
  renderStats(stats);
}

function incrementLocalCounter(name) {
  const stats = readLocalStats();
  stats[name] = Math.max(0, Number(stats[name]) || 0) + 1;
  writeLocalStats(stats);
  renderStats(stats);
}

function counterUrl(action, name) {
  return `${REMOTE_COUNTER_BASE_URL}/${action}/${COUNTER_NAMESPACE}/${COUNTER_KEYS[name]}`;
}

async function fetchCounter(action, name) {
  const response = await fetch(counterUrl(action, name), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Counter request failed: ${response.status}`);
  }

  const data = await response.json();
  return Number(data.value) || 0;
}

async function refreshCounter(name) {
  try {
    const value = await fetchCounter("get", name);
    saveCounterValue(name, value);
    return true;
  } catch (error) {
    renderStats();
    return false;
  }
}

async function syncCounterHit(name) {
  try {
    const value = await fetchCounter("hit", name);
    saveCounterValue(name, value);
    setStoredValue(COUNTER_PENDING_KEYS[name], "0");
    return true;
  } catch (error) {
    setStoredValue(COUNTER_PENDING_KEYS[name], "1");
    return false;
  }
}

async function countUniqueCounter(name) {
  const wasCounted = getStoredValue(COUNTER_COUNTED_KEYS[name]) === "1";
  const hasPendingSync = getStoredValue(COUNTER_PENDING_KEYS[name]) === "1";

  if (!wasCounted) {
    incrementLocalCounter(name);
    setStoredValue(COUNTER_COUNTED_KEYS[name], "1");
    await syncCounterHit(name);
    return;
  }

  if (hasPendingSync) {
    await syncCounterHit(name);
    return;
  }

  await refreshCounter(name);
}

function syncPendingCounters() {
  ["calculations", "reports"].forEach((name) => {
    if (getStoredValue(COUNTER_PENDING_KEYS[name]) === "1") void countUniqueCounter(name);
  });
}

function hasLocalCounterHistory(name) {
  const stats = readLocalStats();
  return (
    Number(stats[name]) > 0 ||
    getStoredValue(COUNTER_COUNTED_KEYS[name]) === "1" ||
    getStoredValue(COUNTER_PENDING_KEYS[name]) === "1"
  );
}

export function initAnalytics() {
  renderStats();
  void registerSiteVisit();
  syncPendingCounters();
  void refreshCounter("calculations");
  if (hasLocalCounterHistory("reports")) void refreshCounter("reports");
}

export async function registerSiteVisit() {
  await countUniqueCounter("visits");
}

export function registerCalculatorUse() {
  void countUniqueCounter("calculations");
}

export function registerReportDownload() {
  void countUniqueCounter("reports");
}
