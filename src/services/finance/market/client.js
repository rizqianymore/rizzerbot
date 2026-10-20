import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";
import { YAHOO_BASE, SYMBOL_ALIASES, OVERVIEW_SYMBOLS, getRange, RANGE_WINDOW_DAYS } from "./constants.js";

const quoteCache = createTtlCache({ ttlMs: 60 * 1000, max: 300 });
const searchCache = createTtlCache({ ttlMs: 30 * 60 * 1000, max: 200 });
const overviewCache = createTtlCache({ ttlMs: 60 * 1000, max: 8 });

const HEADERS = {
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
};

const MIN_GAP_MS = 350;
const RATE_LIMIT_COOLDOWN_MS = 4000;
let lastRequestAt = 0;
let cooldownUntil = 0;
let queue = Promise.resolve();

function schedule(task) {
  const run = queue.then(async () => {
    const gap = Math.max(0, MIN_GAP_MS - (Date.now() - lastRequestAt));
    const cooldown = Math.max(0, cooldownUntil - Date.now());
    const wait = Math.max(gap, cooldown);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => {});
  return run;
}

function applyCooldown() {
  cooldownUntil = Math.max(cooldownUntil, Date.now() + RATE_LIMIT_COOLDOWN_MS);
}

const ALLOWED_TYPES = new Set(["EQUITY", "ETF", "CRYPTOCURRENCY", "CURRENCY", "INDEX", "FUTURE", "MUTUALFUND"]);

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeSymbolInput(input) {
  return String(input || "")
    .trim()
    .replace(/\s+/g, " ");
}

async function yahooJson(path, { timeout = 20000 } = {}) {
  const hosts = [YAHOO_BASE, "https://query2.finance.yahoo.com"];
  let lastError = null;

  for (const host of hosts) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await schedule(() => request.json(`${host}${path}`, { headers: HEADERS, timeout, retries: 0 }));
      } catch (err) {
        lastError = err;
        const is429 = /HTTP 429/.test(String(err?.message || ""));
        if (!is429) break;
        applyCooldown();
        await sleep(700 + attempt * 900);
      }
    }
  }
  throw lastError || new Error("Gagal menghubungi Yahoo Finance.");
}

async function yahooChart(symbol, range, interval, { includePrePost = false } = {}) {
  const path =
    `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}` +
    `&includePrePost=${includePrePost ? "true" : "false"}&events=div%2Csplit`;
  const data = await yahooJson(path);
  const result = data?.chart?.result?.[0];
  if (!result) {
    const desc = data?.chart?.error?.description || "simbol tidak ditemukan";
    throw new Error(desc);
  }
  return result;
}

function parseSeries(result) {
  const stamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const quote = result.indicators?.quote?.[0] || {};
  const adjClose = result.indicators?.adjclose?.[0]?.adjclose;
  const rows = [];

  for (let i = 0; i < stamps.length; i++) {
    const close = toNumber(quote.close?.[i]) ?? toNumber(adjClose?.[i]);
    if (close === null) continue;
    const open = toNumber(quote.open?.[i]) ?? close;
    const high = toNumber(quote.high?.[i]) ?? Math.max(open, close);
    const low = toNumber(quote.low?.[i]) ?? Math.min(open, close);
    const volume = toNumber(quote.volume?.[i]) ?? 0;
    rows.push({ t: stamps[i] * 1000, open, high, low, close, volume });
  }
  return rows;
}

function sliceWindow(candles, range) {
  const days = RANGE_WINDOW_DAYS[range.key];
  if (!days || candles.length <= 2) return candles;
  const cutoff = candles.at(-1).t - days * 24 * 60 * 60 * 1000;
  const windowed = candles.filter((c) => c.t >= cutoff);
  return windowed.length >= 2 ? windowed : candles.slice(-2);
}

function movingAverage(candles, period) {
  const out = new Array(candles.length).fill(null);
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function buildQuote(result, rangeKey) {
  const meta = result.meta || {};
  const fullCandles = parseSeries(result);
  const range = getRange(rangeKey, "1mo");
  const candles = sliceWindow(fullCandles, range);
  const last = candles.at(-1) || null;

  const price = toNumber(meta.regularMarketPrice) ?? last?.close ?? null;
  let prevClose = toNumber(meta.previousClose);

  if (prevClose === null && (meta.range === "1d" || candles.length <= 1)) {
    prevClose = toNumber(meta.chartPreviousClose);
  }
  if (prevClose === null && candles.length >= 2) {
    prevClose = candles.at(-2).close;
  }

  let changePercent = toNumber(meta.regularMarketChangePercent);
  if (prevClose === null && changePercent !== null && price !== null && changePercent !== -100) {
    prevClose = price / (1 + changePercent / 100);
  }

  const change = price !== null && prevClose !== null ? price - prevClose : null;
  if (changePercent === null && change !== null && prevClose) {
    changePercent = (change / prevClose) * 100;
  }

  const intraday = range.range === "1d" || range.range === "5d";
  let sessionOpen = intraday ? (candles[0]?.open ?? last?.open ?? null) : (last?.open ?? null);

  if (intraday && candles.length > 1) {
    const tz = meta.exchangeTimezoneName || "Asia/Jakarta";
    const dayKey = (ms) => {
      try {
        return new Date(ms).toLocaleDateString("en-CA", { timeZone: tz });
      } catch (_) {
        return new Date(ms).toISOString().slice(0, 10);
      }
    };
    const lastDay = dayKey(candles.at(-1).t);
    const start = candles.find((c) => dayKey(c.t) === lastDay);
    if (start) sessionOpen = start.open;
  }

  return {
    symbol: meta.symbol || "",
    name: meta.longName || meta.shortName || meta.symbol || "",
    shortName: meta.shortName || "",
    currency: meta.currency || "",
    exchange: meta.fullExchangeName || meta.exchangeName || "",
    exchangeName: meta.exchangeName || "",
    timezone: meta.exchangeTimezoneName || "Asia/Jakarta",
    instrumentType: meta.instrumentType || "",
    price,
    prevClose,
    change,
    changePercent,
    open: sessionOpen,
    dayHigh: toNumber(meta.regularMarketDayHigh) ?? last?.high ?? null,
    dayLow: toNumber(meta.regularMarketDayLow) ?? last?.low ?? null,
    high52: toNumber(meta.fiftyTwoWeekHigh),
    low52: toNumber(meta.fiftyTwoWeekLow),
    volume: toNumber(meta.regularMarketVolume) ?? last?.volume ?? null,
    marketTime: toNumber(meta.regularMarketTime) ? toNumber(meta.regularMarketTime) * 1000 : Date.now(),
    priceHint: toNumber(meta.priceHint) ?? 2,
    rangeKey: range.key,
    rangeLabel: range.label,
    candles,
    ma20: movingAverage(candles, 20),
    ma50: movingAverage(candles, 50),
  };
}

export async function searchSymbols(query, { limit = 8 } = {}) {
  const q = normalizeSymbolInput(query);
  if (!q) return [];

  const cached = searchCache.get(q.toLowerCase());
  if (cached) return cached;

  const path =
    `/v1/finance/search?q=${encodeURIComponent(q)}` +
    `&quotesCount=${limit}&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;
  const data = await yahooJson(path);

  const quotes = (data?.quotes || [])
    .filter((item) => item?.symbol && (!item.quoteType || ALLOWED_TYPES.has(item.quoteType)))
    .map((item) => ({
      symbol: String(item.symbol).toUpperCase(),
      name: item.longname || item.shortname || item.symbol,
      quoteType: item.quoteType || "",
      exchange: item.exchDisp || item.exchange || "",
      exchangeCode: item.exchange || "",
    }));

  searchCache.set(q.toLowerCase(), quotes);
  return quotes;
}

function scoreCandidate(query, item, index) {
  const upper = query.toUpperCase();
  const symbol = item.symbol.toUpperCase();
  let score = 0;

  if (symbol === upper) score += 55;
  if (symbol === `${upper}.JK`) score += 70;
  if (symbol.startsWith(`${upper}.`)) score += 10;

  switch (item.quoteType) {
    case "EQUITY":
      score += 25;
      break;
    case "CRYPTOCURRENCY":
    case "CURRENCY":
    case "INDEX":
      score += 22;
      break;
    case "ETF":
      score += 18;
      break;
    case "FUTURE":
      score += 16;
      break;
    default:
      break;
  }

  if (item.exchangeCode === "JKT" || item.exchange === "Jakarta") score += 12;
  if (index === 0) score += 3;
  return score;
}

function looksLikeTicker(raw) {
  return /^[A-Z0-9^.=-]{1,12}$/.test(raw) && !/\s/.test(raw);
}

function directCandidates(raw) {
  const upper = raw.toUpperCase();
  if (upper.includes(".") || upper.includes("=") || upper.startsWith("^") || upper.includes("-")) {
    return [upper];
  }
  if (/^[A-Z]{4}$/.test(upper)) return [`${upper}.JK`, upper];
  return [upper];
}

export async function resolveSymbol(input) {
  const raw = normalizeSymbolInput(input);
  if (!raw) throw new Error("Simbol/kata kunci kosong.");

  const aliasKey = raw.toUpperCase().replace(/\s+/g, "");
  const alias = SYMBOL_ALIASES[aliasKey];
  if (alias) return { symbol: alias, name: null, quoteType: "", candidates: [alias], source: "alias" };

  if (looksLikeTicker(raw)) {
    const candidates = directCandidates(raw);
    return { symbol: candidates[0], name: null, quoteType: "", candidates, source: "direct" };
  }

  let found = [];
  try {
    found = await searchSymbols(raw);
  } catch (_) {}

  const ranked = found
    .map((item, index) => ({ ...item, score: scoreCandidate(raw, item, index) }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length) {
    return {
      symbol: ranked[0].symbol,
      name: ranked[0].name,
      quoteType: ranked[0].quoteType,
      candidates: [...new Set(ranked.map((item) => item.symbol))],
      source: "search",
    };
  }

  const guesses = directCandidates(raw.replace(/\s+/g, ""));
  return { symbol: guesses[0], name: null, quoteType: "", candidates: guesses, source: "direct" };
}

export async function fetchQuote(symbol, rangeKey = "1mo", { force = false } = {}) {
  const range = getRange(rangeKey, "1mo");
  const key = `${symbol}|${range.key}`;
  if (!force) {
    const cached = quoteCache.get(key);
    if (cached) return cached;
  }

  const result = await yahooChart(symbol, range.fetch || range.range, range.fetchInterval || range.interval);
  const quote = buildQuote(result, range.key);
  quoteCache.set(key, quote);
  return quote;
}

function isSymbolNotFound(err) {
  const message = String(err?.message || "");
  return /Not Found|No data found|delisted|tidak ditemukan|404/i.test(message);
}

export async function getQuote(input, { range = "1mo", force = false } = {}) {
  const resolved = await resolveSymbol(input);
  const candidates = [...new Set([resolved.symbol, ...(resolved.candidates || [])].filter(Boolean))].slice(0, 3);

  let lastError = null;
  for (const symbol of candidates) {
    try {
      const quote = await fetchQuote(symbol, range, { force });
      return { ...quote, query: input, resolvedFrom: resolved.source };
    } catch (err) {
      lastError = err;
      if (!isSymbolNotFound(err)) break;
    }
  }

  throw new Error(`Data untuk "${input}" tidak ditemukan${lastError ? ` (${lastError.message})` : ""}.`);
}

async function fetchOverviewSpark(symbols) {
  const path = `/v8/finance/spark?symbols=${symbols.map(encodeURIComponent).join(",")}&range=1d&interval=1d`;
  const data = await yahooJson(path);
  const out = new Map();

  for (const [symbol, item] of Object.entries(data || {})) {
    const closes = Array.isArray(item?.close) ? item.close.filter((v) => Number.isFinite(Number(v))) : [];
    const price = toNumber(closes.at(-1)) ?? toNumber(item?.fulldayPrice);
    if (price === null) continue;
    const prevClose = toNumber(item?.previousClose) ?? toNumber(item?.chartPreviousClose);
    const change = prevClose !== null ? price - prevClose : null;
    out.set(symbol, {
      symbol,
      price,
      prevClose,
      change,
      changePercent: prevClose ? (change / prevClose) * 100 : null,
    });
  }
  return out;
}

export async function getMarketOverview() {
  const cached = overviewCache.get("overview");
  if (cached) return cached;

  let spark = new Map();
  try {
    spark = await fetchOverviewSpark(OVERVIEW_SYMBOLS.map((item) => item.symbol));
  } catch (_) {}

  const settled = await Promise.allSettled(
    OVERVIEW_SYMBOLS.map(async (item) => {
      const quick = spark.get(item.symbol);
      if (quick) {
        return { ...quick, label: item.label, currency: item.currency, exchange: "" };
      }
      const quote = await fetchQuote(item.symbol, "1d");
      return { ...quote, label: item.label };
    })
  );

  const items = [];
  settled.forEach((res) => {
    if (res.status === "fulfilled") items.push(res.value);
  });

  if (!items.length) throw new Error("Gagal memuat data pasar dari Yahoo Finance.");
  overviewCache.set("overview", items);
  return items;
}
