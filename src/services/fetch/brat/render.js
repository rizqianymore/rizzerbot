import { requireCanvas, getSharp } from "@/src/utils/native.js";
import { isLowMemoryDevice } from "@/src/utils/termux.js";
import { TEXT_STYLE } from "./config.js";
import { ensureFont, loadTemplateImage } from "./assets.js";
import { drawCenteredText, renderLayout, layoutText, getSafeRect } from "./layout.js";

function effectiveSupersample() {
  const base = Math.max(1, TEXT_STYLE.supersample || 1);
  if (isLowMemoryDevice() && base > 1) return 1;
  return base;
}

const SUPERSAMPLE = effectiveSupersample();

function scaleTemplate(template, factor) {
  if (factor === 1) return template;
  const zone = template.safeZone;
  return {
    ...template,
    width: (template.width || 512) * factor,
    height: (template.height || 512) * factor,
    safeZone: {
      a: zone.a * factor,
      b: zone.b * factor,
      c: zone.c * factor,
      d: zone.d * factor,
    },
  };
}

function paintCanvas(image, template, bgColor) {
  const { createCanvas } = requireCanvas();
  const width = template.width || 512;
  const height = template.height || 512;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (template.isClassic) {
    ctx.fillStyle = bgColor || "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
  } else if (image) {
    ctx.drawImage(image, 0, 0, width, height);
  }

  ctx.textBaseline = "top";
  return { canvas, ctx };
}

export async function renderBratCanvas(image, text, template, options = {}) {
  const scaled = scaleTemplate(template, SUPERSAMPLE);
  const { canvas, ctx } = paintCanvas(image, scaled, options.bgColor);

  drawCenteredText(ctx, text, scaled.safeZone, {
    ...options,
    stroke: options.stroke ?? scaled.stroke ?? false,
  });
  return canvas;
}

export async function renderBratFrame(image, template, layout, options = {}) {
  const scaled = scaleTemplate(template, SUPERSAMPLE);
  const { canvas, ctx } = paintCanvas(image, scaled, options.bgColor);

  const rect = getSafeRect(scaled.safeZone);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = options.color || TEXT_STYLE.color;
  renderLayout(ctx, layout, options);
  ctx.restore();

  return canvas;
}

async function downscale(canvas, template) {
  const sharp = getSharp();
  if (!sharp || SUPERSAMPLE === 1) {
    return Buffer.from(await canvas.encode("png"));
  }
  const png = await canvas.encode("png");
  return await sharp(png)
    .resize(template.width || 512, template.height || 512, {
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

export async function createBratImage(text, template, options = {}) {
  await ensureFont();
  const image = await loadTemplateImage(template);
  const canvas = await renderBratCanvas(image, text, template, options);
  return await downscale(canvas, template);
}

export async function renderBratVideoFrames(image, template, layout, frames, options = {}) {
  await ensureFont();
  const buffers = [];

  for (const frame of frames) {
    const canvas = await renderBratFrame(image, template, layout, {
      ...options,
      revealWords: frame.revealedWords,
    });
    buffers.push(await downscale(canvas, template));
  }

  return buffers;
}

export async function prepareBratLayout(text, template) {
  await ensureFont();
  return layoutText(text, scaleTemplate(template, SUPERSAMPLE));
}
