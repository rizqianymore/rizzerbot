import { createCanvas } from "@napi-rs/canvas";
import { TEXT_STYLE } from "./config.js";

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
      const parts = splitLongWord(ctx, word, maxWidth);
      lines.push(...parts.slice(0, -1));
      current = parts.at(-1) || "";
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines;
}

function wrapText(ctx, text, maxWidth) {
  return text.split("\n").flatMap((paragraph) => {
    const clean = paragraph.trim();
    if (!clean) {
      return [""];
    }
    return wrapParagraph(ctx, clean, maxWidth);
  });
}

function measureFit(ctx, text, rect, size) {
  setFont(ctx, size);
  const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
  const lines = wrapText(ctx, text, rect.w);
  const totalHeight = lines.length * lineHeight;
  return { size, lines, lineHeight, totalHeight, fits: totalHeight <= rect.h };
}

function fitText(ctx, text, rect) {
  let best = null;
  for (let size = TEXT_STYLE.minFontSize; size <= TEXT_STYLE.growMaxFontSize; size += 2) {
    const fit = measureFit(ctx, text, rect, size);
    if (!fit.fits) break;
    best = fit;
  }
  if (best) return best;

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

function drawJustifiedLine(ctx, line, x, y, maxWidth, useStroke, size) {
  const words = line.split(" ").filter(Boolean);
  if (words.length <= 1) {
    if (useStroke) strokeLine(ctx, line, x, y, size);
    ctx.fillText(line, x, y);
    return;
  }
  const widths = words.map((w) => ctx.measureText(w).width);
  const wordsWidth = widths.reduce((a, b) => a + b, 0);
  const gap = (maxWidth - wordsWidth) / (words.length - 1);
  let cx = x;
  for (let i = 0; i < words.length; i++) {
    if (useStroke) strokeLine(ctx, words[i], cx, y, size);
    ctx.fillText(words[i], cx, y);
    cx += widths[i] + gap;
  }
}

function drawBlockFromLayout(ctx, frameText, layout, rect, options = {}) {
  setFont(ctx, layout.size);
  const lines = wrapText(ctx, frameText, rect.w);
  const align = options.align || TEXT_STYLE.align;
  const useStroke = options.stroke ?? layout.stroke ?? false;

  lines.forEach((line, index) => {
    const y = layout.startY + index * layout.lineHeight;
    const isLastLine = index === lines.length - 1;
    if (align === "justify" && !isLastLine) {
      ctx.textAlign = "left";
      drawJustifiedLine(ctx, line, rect.x, y, rect.w, useStroke, layout.size);
      return;
    }
    ctx.textAlign = align === "justify" ? "left" : align;
    const x = align === "justify" ? rect.x : rect.centerX;
    if (useStroke) strokeLine(ctx, line, x, y, layout.size);
    ctx.fillText(line, x, y);
  });
}

export function layoutText(text, template) {
  const canvas = createCanvas(template.width || 512, template.height || 512);
  const ctx = canvas.getContext("2d");
  const rect = getSafeRect(template.safeZone);
  const fitted = fitText(ctx, text, rect);
  return {
    size: fitted.size,
    lines: fitted.lines,
    lineHeight: fitted.lineHeight,
    totalHeight: fitted.totalHeight,
    startY: rect.y + (rect.h - fitted.totalHeight) / 2,
    stroke: template.stroke ?? false,
  };
}

export function drawCenteredText(ctx, text, zone, options = {}) {
  const rect = getSafeRect(zone);
  const fitted = fitText(ctx, text, rect);
  const startY = rect.y + (rect.h - fitted.totalHeight) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  setFont(ctx, fitted.size);
  ctx.fillStyle = options.color || TEXT_STYLE.color;
  ctx.textBaseline = "top";

  const align = options.align || TEXT_STYLE.align;
  const useStroke = options.stroke ?? zone.stroke ?? false;

  fitted.lines.forEach((line, index) => {
    const y = startY + index * fitted.lineHeight;
    const isLastLine = index === fitted.lines.length - 1;
    if (align === "justify" && !isLastLine) {
      ctx.textAlign = "left";
      drawJustifiedLine(ctx, line, rect.x, y, rect.w, useStroke, fitted.size);
      return;
    }
    ctx.textAlign = align === "justify" ? "left" : align;
    if (useStroke) strokeLine(ctx, line, align === "justify" ? rect.x : rect.centerX, y, fitted.size);
    ctx.fillText(line, align === "justify" ? rect.x : rect.centerX, y);
  });

  ctx.restore();
}

export { drawBlockFromLayout, getSafeRect };
