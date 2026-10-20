import { getCanvas } from "@/src/utils/native.js";
import { COLORS, FONT_STACK, getRange } from "./constants.js";
import {
  currencySymbol,
  decimalsFor,
  formatCompact,
  formatMarketTime,
  formatNumber,
  formatSignedPercent,
} from "./format.js";

const WIDTH = 1080;
const HEIGHT = 860;
const PAD = { left: 46, right: 132 };

const HEADER_BOTTOM = 240;
const STATS_TOP = 790;
const VOLUME_HEIGHT = 84;
const VOLUME_GAP = 54;

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function axisDecimals(span, price) {
  if (span >= 1000) return 0;
  if (span >= 10) return 1;
  if (span >= 1) return 2;
  if (price < 0.01) return 8;
  return 4;
}

function timeLabel(ms, timezone, tick) {
  const date = new Date(ms);
  try {
    if (tick === "time") {
      return date.toLocaleTimeString("id-ID", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
    }
    if (tick === "day") {
      return date.toLocaleDateString("id-ID", { timeZone: timezone, day: "2-digit", month: "short" });
    }
    if (tick === "month") {
      return date.toLocaleDateString("id-ID", { timeZone: timezone, month: "short", year: "2-digit" });
    }
    return date.toLocaleDateString("id-ID", { timeZone: timezone, year: "numeric" });
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

function drawBackground(ctx, up) {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, COLORS.bgFrom);
  gradient.addColorStop(1, COLORS.bgTo);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH * 0.16, 10, 10, WIDTH * 0.16, 10, 620);
  glow.addColorStop(0, up ? "rgba(34, 197, 94, 0.20)" : "rgba(248, 113, 113, 0.20)");
  glow.addColorStop(1, "rgba(7, 11, 18, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawHeader(ctx, quote) {
  const up = Number(quote.changePercent) >= 0;
  const accent = up ? COLORS.up : COLORS.down;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = COLORS.text;
  ctx.font = `700 40px ${FONT_STACK}`;
  const name = String(quote.name || quote.symbol || "-");
  ctx.fillText(name.length > 32 ? `${name.slice(0, 31)}…` : name, PAD.left, 70);

  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 24px ${FONT_STACK}`;
  ctx.fillText(`${quote.symbol} • ${quote.exchange || "-"}`, PAD.left, 106);

  const digits = decimalsFor(quote);
  const priceText = `${currencySymbol(quote.currency)}${formatNumber(quote.price, digits)}`;
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 58px ${FONT_STACK}`;
  ctx.fillText(priceText, PAD.left, 178);

  const badgeText = formatSignedPercent(quote.changePercent);
  ctx.font = `700 26px ${FONT_STACK}`;
  const badgeW = ctx.measureText(badgeText).width + 34;
  const badgeH = 48;
  const badgeX = WIDTH - PAD.left - badgeW;
  const badgeY = 142;

  ctx.fillStyle = up ? "rgba(34, 197, 94, 0.18)" : "rgba(248, 113, 113, 0.18)";
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 14);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.textAlign = "center";
  ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 34);

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 21px ${FONT_STACK}`;
  ctx.fillText(`Rentang ${quote.rangeLabel}`, WIDTH - PAD.left, 68);
  ctx.fillText(formatMarketTime(quote.marketTime, quote.timezone), WIDTH - PAD.left, 100);
  ctx.fillStyle = COLORS.faint;
  ctx.font = `500 18px ${FONT_STACK}`;
  ctx.fillText("Sumber: Yahoo Finance", WIDTH - PAD.left, 130);
  ctx.textAlign = "left";

  const legend = [
    { label: "Harga", color: accent },
    { label: "MA20", color: COLORS.ma20 },
    { label: "MA50", color: COLORS.ma50 },
  ];
  let x = PAD.left;
  const y = 214;
  ctx.font = `600 19px ${FONT_STACK}`;
  for (const item of legend) {
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y - 13, 20, 5);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(item.label, x + 28, y);
    x += 28 + ctx.measureText(item.label).width + 34;
  }
}

function drawGrid(ctx, plot, min, max, decimals, symbol) {
  const steps = 5;
  ctx.font = `500 19px ${FONT_STACK}`;
  ctx.textAlign = "right";

  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const y = plot.top + plot.height * ratio;
    const value = max - (max - min) * ratio;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash(i === steps ? [] : [6, 8]);
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.left + plot.width, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.faint;
    ctx.fillText(`${symbol}${formatNumber(value, decimals)}`, WIDTH - 22, y + 7);
  }
  ctx.textAlign = "left";
}

function drawCandles(ctx, plot, candles, min, max) {
  const span = max - min || 1;
  const yFor = (value) => plot.top + ((max - value) / span) * plot.height;
  const slot = plot.width / candles.length;
  const bodyWidth = Math.max(1.2, Math.min(14, slot * 0.62));

  for (let index = 0; index < candles.length; index++) {
    const c = candles[index];
    const up = c.close >= c.open;
    const color = up ? COLORS.up : COLORS.down;
    const x = plot.left + slot * index + slot / 2;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, Math.min(2, slot * 0.12));

    ctx.beginPath();
    ctx.moveTo(x, yFor(c.high));
    ctx.lineTo(x, yFor(c.low));
    ctx.stroke();

    const top = yFor(Math.max(c.open, c.close));
    const bottom = yFor(Math.min(c.open, c.close));
    ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, Math.max(1.4, bottom - top));
  }
}

function drawLine(ctx, plot, values, count, min, max, color, width = 2.4) {
  const span = max - min || 1;
  const slot = plot.width / count;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  let started = false;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (!Number.isFinite(value)) continue;
    const x = plot.left + slot * i + slot / 2;
    const y = plot.top + ((max - value) / span) * plot.height;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  if (started) ctx.stroke();
}

function drawArea(ctx, plot, candles, min, max, up) {
  const span = max - min || 1;
  const slot = plot.width / candles.length;
  const gradient = ctx.createLinearGradient(0, plot.top, 0, plot.top + plot.height);
  gradient.addColorStop(0, up ? "rgba(34, 197, 94, 0.30)" : "rgba(248, 113, 113, 0.30)");
  gradient.addColorStop(1, "rgba(7, 11, 18, 0)");

  const xAt = (i) => plot.left + slot * i + slot / 2;
  const yAt = (value) => plot.top + ((max - value) / span) * plot.height;

  ctx.beginPath();
  candles.forEach((c, i) => {
    if (i === 0) ctx.moveTo(xAt(i), yAt(c.close));
    else ctx.lineTo(xAt(i), yAt(c.close));
  });
  ctx.lineTo(xAt(candles.length - 1), plot.top + plot.height);
  ctx.lineTo(xAt(0), plot.top + plot.height);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  candles.forEach((c, i) => {
    if (i === 0) ctx.moveTo(xAt(i), yAt(c.close));
    else ctx.lineTo(xAt(i), yAt(c.close));
  });
  ctx.strokeStyle = up ? COLORS.up : COLORS.down;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawVolume(ctx, plot, candles, area) {
  const maxVol = Math.max(...candles.map((c) => c.volume || 0), 1);
  const slot = plot.width / candles.length;
  const bodyWidth = Math.max(1.2, Math.min(14, slot * 0.62));

  candles.forEach((c, i) => {
    const x = plot.left + slot * i + slot / 2;
    const h = ((c.volume || 0) / maxVol) * area.height;
    ctx.fillStyle = c.close >= c.open ? "rgba(34, 197, 94, 0.55)" : "rgba(248, 113, 113, 0.55)";
    ctx.fillRect(x - bodyWidth / 2, area.top + area.height - h, bodyWidth, Math.max(1, h));
  });
}

function drawXAxis(ctx, plot, candles, quote, tick) {
  const count = Math.min(6, candles.length);
  if (count < 2) return;
  ctx.font = `500 19px ${FONT_STACK}`;
  ctx.fillStyle = COLORS.faint;

  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const index = Math.round((i / (count - 1)) * (candles.length - 1));
    const ratio = candles.length > 1 ? index / (candles.length - 1) : 0;
    const x = plot.left + plot.width * ratio;
    const label = timeLabel(candles[index].t, quote.timezone, tick);
    if (seen.has(label)) continue;
    seen.add(label);
    ctx.textAlign = i === 0 ? "left" : i === count - 1 ? "right" : "center";
    ctx.fillText(label, x, plot.top + plot.height + 32);
  }
  ctx.textAlign = "left";
}

function drawStats(ctx, quote) {
  const digits = decimalsFor(quote);
  const items = [
    ["Buka", `${currencySymbol(quote.currency)}${formatNumber(quote.open, digits)}`],
    ["High", `${currencySymbol(quote.currency)}${formatNumber(quote.dayHigh, digits)}`],
    ["Low", `${currencySymbol(quote.currency)}${formatNumber(quote.dayLow, digits)}`],
    ["Vol", formatCompact(quote.volume)],
    ["52w Low", `${currencySymbol(quote.currency)}${formatNumber(quote.low52, digits)}`],
    ["52w High", `${currencySymbol(quote.currency)}${formatNumber(quote.high52, digits)}`],
  ];
  const cellW = (WIDTH - PAD.left - 34) / items.length;

  items.forEach(([label, value], index) => {
    const x = PAD.left + cellW * index;
    ctx.fillStyle = COLORS.faint;
    ctx.font = `500 17px ${FONT_STACK}`;
    ctx.fillText(label.toUpperCase(), x, STATS_TOP);
    ctx.fillStyle = COLORS.text;
    ctx.font = `600 21px ${FONT_STACK}`;
    ctx.fillText(value, x, STATS_TOP + 30);
  });

  ctx.fillStyle = COLORS.faint;
  ctx.font = `500 16px ${FONT_STACK}`;
  ctx.textAlign = "right";
  ctx.fillText("Data: Yahoo Finance", WIDTH - 22, HEIGHT - 16);
  ctx.textAlign = "left";
}

const chartCache = new Map();
const CHART_CACHE_TTL_MS = 60 * 1000;

function chartCacheKey(quote) {
  return `${String(quote?.symbol || "")}|${String(quote?.rangeKey || "")}`;
}

export async function renderMarketChart(quote) {
  const key = chartCacheKey(quote);
  const cached = chartCache.get(key);
  if (cached && Date.now() - cached.at < CHART_CACHE_TTL_MS) {
    return cached.buffer;
  }

  const canvasApi = getCanvas();
  if (!canvasApi) throw new Error("Modul canvas tidak tersedia untuk membuat grafik.");

  const candles = Array.isArray(quote.candles) ? quote.candles.filter((c) => Number.isFinite(c.close)) : [];
  if (candles.length < 2) throw new Error("Data historis tidak cukup untuk menggambar grafik.");

  const { createCanvas } = canvasApi;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  const priceCandles = candles.length > 220 ? candles.slice(-220) : candles;
  const ma20 = (quote.ma20 || []).slice(-priceCandles.length);
  const ma50 = (quote.ma50 || []).slice(-priceCandles.length);

  let min = Math.min(...priceCandles.map((c) => c.low));
  let max = Math.max(...priceCandles.map((c) => c.high));
  for (const series of [ma20, ma50]) {
    series.forEach((v) => {
      if (!Number.isFinite(v)) return;
      if (v < min) min = v;
      if (v > max) max = v;
    });
  }
  const pad = (max - min) * 0.08 || Math.abs(max || 1) * 0.02;
  min -= pad;
  max += pad;

  const plot = {
    left: PAD.left,
    top: HEADER_BOTTOM,
    width: WIDTH - PAD.left - PAD.right,
    height: STATS_TOP - VOLUME_HEIGHT - VOLUME_GAP - 40 - HEADER_BOTTOM,
  };
  const volumeArea = {
    top: plot.top + plot.height + VOLUME_GAP,
    height: VOLUME_HEIGHT,
  };

  drawBackground(ctx, Number(quote.changePercent) >= 0);
  drawHeader(ctx, quote);
  drawGrid(ctx, plot, min, max, axisDecimals(max - min, quote.price), currencySymbol(quote.currency));
  drawArea(ctx, plot, priceCandles, min, max, Number(quote.changePercent) >= 0);
  drawCandles(ctx, plot, priceCandles, min, max);
  drawLine(ctx, plot, ma20, priceCandles.length, min, max, COLORS.ma20, 2.2);
  drawLine(ctx, plot, ma50, priceCandles.length, min, max, COLORS.ma50, 2.2);
  drawVolume(ctx, plot, priceCandles, volumeArea);
  drawXAxis(ctx, plot, priceCandles, quote, getRange(quote.rangeKey, "1mo").tick);
  drawStats(ctx, quote);

  const buffer = Buffer.from(await canvas.encode("png"));
  chartCache.set(key, { buffer, at: Date.now() });
  if (chartCache.size > 50) {
    const oldest = [...chartCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) chartCache.delete(oldest[0]);
  }
  return buffer;
}
