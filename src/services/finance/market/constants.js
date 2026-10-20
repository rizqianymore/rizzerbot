export const YAHOO_BASE = "https://query1.finance.yahoo.com";

export const FONT_STACK = '"DejaVu Sans", "Noto Color Emoji", sans-serif';

export const COLORS = {
  bgFrom: "#0b1220",
  bgTo: "#070b12",
  panel: "#0f172a",
  border: "rgba(148, 163, 184, 0.14)",
  grid: "rgba(148, 163, 184, 0.12)",
  text: "#f8fafc",
  muted: "#94a3b8",
  faint: "#64748b",
  up: "#22c55e",
  down: "#f87171",
  ma20: "#fbbf24",
  ma50: "#60a5fa",
};

export const CURRENCY_SYMBOLS = {
  IDR: "Rp",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  KRW: "₩",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  HKD: "HK$",
  MYR: "RM",
  THB: "฿",
  SAR: "﷼",
};

export const RANGES = {
  "1d": { range: "1d", interval: "5m", label: "1 hari", tick: "time", fetch: "1d", fetchInterval: "5m" },
  "5d": { range: "5d", interval: "30m", label: "5 hari", tick: "day", fetch: "5d", fetchInterval: "30m" },
  "1mo": { range: "1mo", interval: "1d", label: "1 bulan", tick: "day", fetch: "6mo", fetchInterval: "1d" },
  "3mo": { range: "3mo", interval: "1d", label: "3 bulan", tick: "day", fetch: "1y", fetchInterval: "1d" },
  "6mo": { range: "6mo", interval: "1d", label: "6 bulan", tick: "day", fetch: "2y", fetchInterval: "1d" },
  "1y": { range: "1y", interval: "1d", label: "1 tahun", tick: "month", fetch: "2y", fetchInterval: "1d" },
  "5y": { range: "5y", interval: "1wk", label: "5 tahun", tick: "month", fetch: "10y", fetchInterval: "1wk" },
  max: { range: "max", interval: "1mo", label: "semua", tick: "year", fetch: "max", fetchInterval: "1mo" },
};

export const RANGE_WINDOW_DAYS = {
  "1d": 1,
  "5d": 5,
  "1mo": 31,
  "3mo": 92,
  "6mo": 183,
  "1y": 366,
  "5y": 1827,
};

const RANGE_ALIASES = {
  "1d": "1d",
  "1h": "1d",
  hari: "1d",
  harian: "1d",
  today: "1d",
  "5d": "5d",
  "5h": "5d",
  minggu: "5d",
  "1w": "5d",
  "1mo": "1mo",
  "1m": "1mo",
  bulan: "1mo",
  bulanan: "1mo",
  "1bln": "1mo",
  "3mo": "3mo",
  "3m": "3mo",
  "3bln": "3mo",
  "6mo": "6mo",
  "6m": "6mo",
  "6bln": "6mo",
  "1y": "1y",
  "1t": "1y",
  tahun: "1y",
  "1thn": "1y",
  "5y": "5y",
  "5t": "5y",
  "5thn": "5y",
  max: "max",
  all: "max",
  semua: "max",
  ytd: "max",
};

export const SYMBOL_ALIASES = {
  IHSG: "^JKSE",
  IDX: "^JKSE",
  JKSE: "^JKSE",
  INDEKS: "^JKSE",
  LQ45: "^JKSE",
  EMAS: "GC=F",
  GOLD: "GC=F",
  XAU: "GC=F",
  PERAK: "SI=F",
  SILVER: "SI=F",
  MINYAK: "CL=F",
  OIL: "CL=F",
  WTI: "CL=F",
  BRENT: "BZ=F",
  GAS: "NG=F",
  TEMBAGA: "HG=F",
  COPPER: "HG=F",
  BTC: "BTC-USD",
  BITCOIN: "BTC-USD",
  ETH: "ETH-USD",
  ETHEREUM: "ETH-USD",
  SOL: "SOL-USD",
  SOLANA: "SOL-USD",
  BNB: "BNB-USD",
  XRP: "XRP-USD",
  RIPPLE: "XRP-USD",
  DOGE: "DOGE-USD",
  ADA: "ADA-USD",
  USDT: "USDT-USD",
  USD: "IDR=X",
  DOLLAR: "IDR=X",
  IDR: "IDR=X",
  USDIDR: "IDR=X",
  RUPIAH: "IDR=X",
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  SP500: "^GSPC",
  SNP: "^GSPC",
  NASDAQ: "^IXIC",
  DOW: "^DJI",
  DJI: "^DJI",
  NIKKEI: "^N225",
  HSI: "^HSI",
  HANGSENG: "^HSI",
  DAX: "^GDAXI",
  FTSE: "^FTSE",
  VIX: "^VIX",
  "GC1:COM": "GC=F",
  "CL1:COM": "CL=F",
  "SI1:COM": "SI=F",
  "NG1:COM": "NG=F",
  "BTC:USD": "BTC-USD",
  "ETH:USD": "ETH-USD",
};

export const OVERVIEW_SYMBOLS = [
  { symbol: "^JKSE", label: "IHSG", currency: "IDR" },
  { symbol: "IDR=X", label: "USD / IDR", currency: "IDR" },
  { symbol: "GC=F", label: "Emas (Gold)", currency: "USD" },
  { symbol: "CL=F", label: "Minyak WTI", currency: "USD" },
  { symbol: "BTC-USD", label: "Bitcoin", currency: "USD" },
  { symbol: "ETH-USD", label: "Ethereum", currency: "USD" },
];

export function normalizeRangeKey(input, fallback = null) {
  if (!input) return fallback;
  const key = String(input).trim().toLowerCase().replace(/\s+/g, "");
  return RANGE_ALIASES[key] || fallback;
}

export function getRange(input, fallback = "1mo") {
  const key = normalizeRangeKey(input, fallback);
  return { key, ...RANGES[key] };
}
