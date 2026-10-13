import { request } from "@/src/utils/request.js";

const BLOOMBERG_URL = "https://www.bloomberg.com/lineup-next/api/tickers";

const COMMODITY_TICKER_MAP = {
  "GC1:COM": "GC=F",
  "CL1:COM": "CL=F",
  "SI1:COM": "SI=F",
  "NG1:COM": "NG=F",
  GOLD: "GC=F",
  OIL: "CL=F",
  SILVER: "SI=F",
  BTC: "BTC-USD",
  ETH: "ETH-USD",
};

async function fetchFromBloomberg(tickerId, cookie = "") {
  const url = `${BLOOMBERG_URL}?ids=${encodeURIComponent(tickerId)}`;
  const headers = {
    Accept: "*/*",
    Origin: "https://www.bloomberg.com",
    Referer: "https://www.bloomberg.com/markets",
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
  };
  if (cookie) headers["Cookie"] = cookie;

  const data = await request.json(url, {
    headers,
    timeout: 20000,
    via: "brightdata",
  });
  if (Array.isArray(data) && data.length > 0) {
    const item = data[0];
    return {
      source: "Bloomberg",
      id: item.id || tickerId,
      name: item.name || tickerId,
      type: item.mediaSecurityType || item.type || "Asset",
      price: item.price,
      priceChange: item.priceChange,
      percentChange: item.percentChange1Day,
      currency: item.issuedCurrency || "USD",
    };
  }
  throw new Error("No data from Bloomberg");
}

async function fetchFromYahooFinance(ticker) {
  const upper = ticker.toUpperCase();
  const candidates = [COMMODITY_TICKER_MAP[upper] || ticker];
  if (!COMMODITY_TICKER_MAP[upper] && /^[A-Z]{4}$/.test(upper)) {
    candidates.push(`${ticker}.JK`);
  }

  const urlFor = (mapped) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapped)}`;
  let lastErr = null;
  for (const mapped of candidates) {
    let data;
    try {
      data = await request.json(urlFor(mapped), {
        headers: { Accept: "application/json" },
        timeout: 20000,
        via: "brightdata",
      });
    } catch (err) {
      lastErr = err;
      continue;
    }
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice === undefined) {
      lastErr = new Error(`Data ticker "${ticker}" tidak ditemukan.`);
      continue;
    }

    const currentPrice = meta.regularMarketPrice;
    const prevClose = meta.previousClose || meta.chartPreviousClose || currentPrice;
    const priceChange = currentPrice - prevClose;
    const percentChange = prevClose ? (priceChange / prevClose) * 100 : 0;

    return {
      source: "Yahoo Finance",
      id: ticker.toUpperCase(),
      symbol: meta.symbol,
      name: meta.shortName || meta.longName || meta.symbol,
      type: meta.instrumentType || "Equity/Commodity",
      price: currentPrice,
      priceChange,
      percentChange,
      currency: meta.currency || "USD",
      exchange: meta.exchangeName || meta.fullExchangeName || "",
      marketState: meta.tradingPeriods ? "Active" : "Normal",
    };
  }
  throw lastErr || new Error(`Data ticker "${ticker}" tidak ditemukan.`);
}

export async function getStockTicker(ticker, userCookie = "") {
  const cleanTicker = ticker.trim();

  try {
    return await fetchFromBloomberg(cleanTicker, userCookie);
  } catch (_bbgErr) {
    return await fetchFromYahooFinance(cleanTicker);
  }
}
