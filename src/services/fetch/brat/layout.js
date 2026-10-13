import { createCanvas } from "@napi-rs/canvas";
import { TEXT_STYLE } from "./config.js";
import { splitWords } from "./text.js";

function getSafeRect(zone) {
  return {
    x: zone.c,
    y: zone.a,
    w: zone.d - zone.c,
    h: zone.b - zone.a,
    centerX: (zone.c + zone.d) / 2,
    centerY: (zone.a + zone.b) / 2,
  };
}

function setFont(ctx, size) {
  ctx.font = `${size}px ${TEXT_STYLE.fontFamily}`;
}

function splitLongWord(ctx, word, maxWidth) {
  const chars = [...word];
  const parts = [];
  let current = "";

  for (const char of chars) {
    const test = current + char;
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      parts.push(current);
      current = char;
    }
  }

  if (current) {
    parts.push(current);
  }
  return parts;
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  const words = paragraph.split(" ").filter(Boolean);
  const lines = [];
  let current = "";
  let split = false;

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
    } else {
      split = true;
      const parts = splitLongWord(ctx, word, maxWidth);
      lines.push(...parts.slice(0, -1));
      current = parts.at(-1) || "";
    }
  }

  if (current) {
    lines.push(current);
  }
  return { lines, split };
}

function wrapTextInfo(ctx, text, maxWidth) {
  let split = false;
  const lines = text.split("\n").flatMap((paragraph) => {
    const clean = paragraph.trim();
    if (!clean) {
      return [""];
    }
    const wrapped = wrapParagraph(ctx, clean, maxWidth);
    split ||= wrapped.split;
    return wrapped.lines;
  });
  return { lines, split };
}

function wrapText(ctx, text, maxWidth) {
  return wrapTextInfo(ctx, text, maxWidth).lines;
}

function measureFit(ctx, text, rect, size) {
  setFont(ctx, size);
  const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
  const { lines, split } = wrapTextInfo(ctx, text, rect.w);
  const totalHeight = lines.length * lineHeight;
  return { size, lines, lineHeight, totalHeight, split, fits: totalHeight <= rect.h };
}

function fitText(ctx, text, rect) {
  let best = null;
  let bestWithSplit = null;
  for (let size = TEXT_STYLE.minFontSize; size <= TEXT_STYLE.growMaxFontSize; size += 2) {
    const fit = measureFit(ctx, text, rect, size);
    if (!fit.fits) break;
    if (fit.split) {
      bestWithSplit ||= fit;
    } else {
      best = fit;
    }
  }

  if (best) return best;
  if (bestWithSplit) return bestWithSplit;

  const size = TEXT_STYLE.minFontSize;
  setFont(ctx, size);
  const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
  const lines = wrapText(ctx, text, rect.w);
  const maxLines = Math.max(1, Math.floor(rect.h / lineHeight));
  const clipped = lines.slice(0, maxLines);

  if (lines.length > maxLines && clipped.length) {
    let last = clipped[clipped.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}...`).width > rect.w) {
      last = last.slice(0, -1);
    }
    clipped[clipped.length - 1] = `${last}...`;
  }

  return {
    size,
    lines: clipped,
    lineHeight,
    totalHeight: clipped.length * lineHeight,
  };
}

function strokeLine(ctx, line, x, y, size) {
  ctx.save();
  ctx.strokeStyle = TEXT_STYLE.strokeColor;
  ctx.lineWidth = Math.max(2, Math.round(size / 14));
  ctx.lineJoin = "round";
  ctx.strokeText(line, x, y);
  ctx.restore();
}

const MAX_JUSTIFY_GAP_RATIO = 1.6;

/**
 * Hitung posisi final tiap kata per baris.
 * Hasilnya dipakai ulang untuk render statis DAN frame reveal video,
 * sehingga kata selalu muncul di posisi akhirnya (tidak ada pergeseran).
 */
function buildLinePlans(ctx, lines, rect, size, align) {
  setFont(ctx, size);
  const spaceWidth = ctx.measureText(" ").width;
  let globalIndex = 0;

  return lines.map((line, index) => {
    const isLastLine = index === lines.length - 1;
    const words = splitWords(line);
    const widths = words.map((word) => ctx.measureText(word).width);
    const wordsWidth = widths.reduce((a, b) => a + b, 0);

    let startX = rect.x;
    let gap = spaceWidth;

    if (align === "justify" && !isLastLine && words.length > 1) {
      const justifyGap = (rect.w - wordsWidth) / (words.length - 1);
      // Hanya perluas jangan pernah rapat: gap lebih kecil dari spasi = kata menempel.
      // Gap terlalu besar = baris renggang, lebih rapi rata kiri saja.
      if (justifyGap >= spaceWidth && justifyGap <= size * MAX_JUSTIFY_GAP_RATIO) {
        gap = justifyGap;
      }
    } else if (align === "center") {
      startX = rect.centerX - (wordsWidth + spaceWidth * (words.length - 1)) / 2;
    }

    let x = startX;
    const placed = words.map((word, i) => {
      const item = { word, x, globalIndex: globalIndex++ };
      x += widths[i] + gap;
      return item;
    });

    return { placed, isLastLine };
  });
}

function drawLinePlans(ctx, linePlans, startY, lineHeight, size, useStroke, revealWords = Infinity) {
  setFont(ctx, size);
  ctx.textAlign = "left";

  linePlans.forEach((line, lineIndex) => {
    const y = startY + lineIndex * lineHeight;
    for (const item of line.placed) {
      if (item.globalIndex >= revealWords) break;
      if (useStroke) strokeLine(ctx, item.word, item.x, y, size);
      ctx.fillText(item.word, item.x, y);
    }
  });
}

/**
 * Render layout ke canvas: mendukung subset kata (revealWords) untuk video.
 */
export function renderLayout(ctx, layout, options = {}) {
  const revealWords = options.revealWords ?? Infinity;
  const useStroke = options.stroke ?? layout.stroke ?? false;

  drawLinePlans(ctx, layout.linePlans, layout.startY, layout.lineHeight, layout.size, useStroke, revealWords);
}

export function layoutText(text, template) {
  const canvas = createCanvas(template.width || 512, template.height || 512);
  const ctx = canvas.getContext("2d");
  const rect = getSafeRect(template.safeZone);
  const fitted = fitText(ctx, text, rect);
  const align = TEXT_STYLE.align;
  const linePlans = buildLinePlans(ctx, fitted.lines, rect, fitted.size, align);

  return {
    size: fitted.size,
    lines: fitted.lines,
    linePlans,
    lineHeight: fitted.lineHeight,
    totalHeight: fitted.totalHeight,
    startY: rect.y + (rect.h - fitted.totalHeight) / 2,
    stroke: template.stroke ?? false,
  };
}

export function drawCenteredText(ctx, text, zone, options = {}) {
  const rect = getSafeRect(zone);
  const fitted = fitText(ctx, text, rect);
  const align = options.align || TEXT_STYLE.align;
  const linePlans = buildLinePlans(ctx, fitted.lines, rect, fitted.size, align);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  ctx.fillStyle = options.color || TEXT_STYLE.color;
  ctx.textBaseline = "top";
  // Stroke sengaja tidak dibaca dari `zone`: objek safeZone tidak pernah memuat
  // properti stroke (template.stroke ada di objek template), jadi penggunanya
  // wajib meneruskannya lewat options.stroke.
  drawLinePlans(
    ctx,
    linePlans,
    rect.y + (rect.h - fitted.totalHeight) / 2,
    fitted.lineHeight,
    fitted.size,
    options.stroke ?? false
  );

  ctx.restore();
}

export { getSafeRect };
