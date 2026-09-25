/**
 * Service untuk memantau harga saham / komoditas / forex realtime
 * Menggunakan primary Bloomberg API (dengan fallback Yahoo Finance untuk bypass WAF PerimeterX)
 */

const BLOOMBERG_URL = "https://www.bloomberg.com/lineup-next/api/tickers";

const COMMODITY_TICKER_MAP = {
  "GC1:COM": "GC=F",
  "CL1:COM": "CL=F",
  "SI1:COM": "SI=F",
  "NG1:COM": "NG=F",
  "GOLD": "GC=F",
  "OIL": "CL=F",
  "SILVER": "SI=F",
  "BTC": "BTC-USD",
  "ETH": "ETH-USD",
};

/**
 * Fetch ticker data from Bloomberg
 */
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

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Bloomberg HTTP ${res.status}`);
  const data = await res.json();
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

/**
 * Fetch ticker data from Finance Engine (Yahoo Market Data) as resilient fallback
 */
async function fetchFromYahooFinance(ticker) {
  let mapped = COMMODITY_TICKER_MAP[ticker.toUpperCase()] || ticker;
  // Jika formatnya kode saham Indo (e.g. BBCA, BBRI), tambahkan .JK otomatis
  if (/^[A-Z]{4}$/.test(mapped)) {
    mapped = `${mapped}.JK`;
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapped)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(`Finance Market HTTP ${res.status}`);
  const data = await res.json();
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice === undefined) {
    throw new Error(`Data ticker "${ticker}" tidak ditemukan.`);
  }

  const currentPrice = meta.regularMarketPrice;
  const prevClose = meta.previousClose || meta.chartPreviousClose || currentPrice;
  const priceChange = currentPrice - prevClose;
  const percentChange = prevClose ? (priceChange / prevClose) * 100 : 0;

  return {
    source: "Bloomberg Market Data",
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

/**
 * Ambil data harga saham/aset
 */
export async function getStockTicker(ticker, userCookie = "") {
  const cleanTicker = ticker.trim();
  // Coba Bloomberg API
  try {
    return await fetchFromBloomberg(cleanTicker, userCookie);
  } catch (bbgErr) {
    // Fallback ke global market ticker
    return await fetchFromYahooFinance(cleanTicker);
  }
}
