import { CURRENCY_SYMBOLS } from "./constants.js";

export function decimalsFor(quote) {
  const price = Math.abs(Number(quote?.price) || 0);
  const hint = Number.isFinite(Number(quote?.priceHint)) ? Number(quote.priceHint) : 2;
  let cap = 2;
  if (price >= 100) cap = 2;
  else if (price >= 1) cap = 4;
  else if (price >= 0.01) cap = 6;
  else cap = 8;
  return Math.min(Math.max(hint, price >= 100 ? 0 : 2), cap);
}

export function formatNumber(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function currencySymbol(code) {
  return CURRENCY_SYMBOLS[String(code || "").toUpperCase()] || (code ? `${code} ` : "");
}

export function formatPrice(value, quote) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const digits = decimalsFor(quote);
  return `${currencySymbol(quote?.currency)}${formatNumber(n, digits)}`;
}

export function formatSignedPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${formatNumber(Math.abs(n), 2)}%`;
}

export function formatSignedChange(value, quote) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${currencySymbol(quote?.currency)}${formatNumber(Math.abs(n), decimalsFor(quote))}`;
}

export function trendIcon(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "➖";
  return n > 0 ? "🟢" : "🔴";
}

export function formatCompact(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "-";
  const abs = Math.abs(n);
  const units = [
    { limit: 1e12, suffix: "T" },
    { limit: 1e9, suffix: "B" },
    { limit: 1e6, suffix: "M" },
    { limit: 1e3, suffix: "K" },
  ];
  for (const unit of units) {
    if (abs >= unit.limit) return `${formatNumber(n / unit.limit, 2)}${unit.suffix}`;
  }
  return formatNumber(n, 0);
}

export function formatMarketTime(ms, timezone = "Asia/Jakarta") {
  const date = new Date(Number(ms) || Date.now());
  try {
    return `${date.toLocaleString("id-ID", {
      timeZone: timezone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })} WIB`;
  } catch (_) {
    return date.toLocaleString("id-ID");
  }
}

export function formatQuoteText(quote) {
  const digits = decimalsFor(quote);
  const changeLine =
    `${trendIcon(quote.changePercent)} ${formatSignedChange(quote.change, quote)} ` +
    `(${formatSignedPercent(quote.changePercent)})`;

  const lines = [
    `*${quote.name || quote.symbol}*`,
    `\`${quote.symbol}\` • ${quote.exchange || "-"}`,
    "",
    `💵 *Harga:* ${formatPrice(quote.price, quote)}`,
    `${changeLine}`,
    "",
    `• Buka   : ${formatPrice(quote.open, quote)}`,
    `• High   : ${formatPrice(quote.dayHigh, quote)}`,
    `• Low    : ${formatPrice(quote.dayLow, quote)}`,
    `• Vol    : ${formatCompact(quote.volume)}`,
    `• 52w    : ${formatPrice(quote.low52, quote)} — ${formatPrice(quote.high52, quote)}`,
    `• Rentang: ${quote.rangeLabel}`,
    `• Update : ${formatMarketTime(quote.marketTime, quote.timezone)}`,
  ];

  if (Number.isFinite(Number(quote.ma20)) || Number.isFinite(Number(quote.ma50))) {
    lines.push("");
    lines.push(`• MA20 : ${formatPrice(quote.ma20, quote)}`);
    lines.push(`• MA50 : ${formatPrice(quote.ma50, quote)}`);
  }

  lines.push("");
  lines.push(`_${digits > 2 ? "Harga desimal tinggi (crypto/valas)." : "Sumber: Yahoo Finance."}_`);

  return lines.join("\n");
}

export function formatOverviewText(items) {
  const lines = ["*📊 RINGKASAN PASAR GLOBAL*", ""];
  for (const item of items) {
    const label = item.label || item.symbol;
    lines.push(`${trendIcon(item.changePercent)} *${label}* — ${formatPrice(item.price, item)}`);
    lines.push(`   ${formatSignedPercent(item.changePercent)} • ${item.symbol}`);
  }
  lines.push("");
  lines.push(`_Update: ${formatMarketTime(Date.now())}_`);
  return lines.join("\n");
}

export function formatSearchResults(query, results) {
  if (!results.length) return `Tidak ada simbol ditemukan untuk *${query}*.`;
  const lines = [`*🔎 HASIL PENCARIAN: ${query}*`, ""];
  results.forEach((item, index) => {
    lines.push(`${index + 1}. \`${item.symbol}\` — ${item.name}`);
    lines.push(`   ${item.quoteType || "-"} • ${item.exchange || "-"}`);
  });
  lines.push("");
  lines.push("_Contoh: .chart BBCA.JK 1mo_");
  return lines.join("\n");
}
