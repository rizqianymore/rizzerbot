import { createCanvas } from "@napi-rs/canvas";
import { TEXT_STYLE } from "./config.js";
import { ensureFont, loadTemplateImage } from "./assets.js";
import { drawCenteredText, drawBlockFromLayout, getSafeRect } from "./layout.js";

export async function renderBratCanvas(image, text, template, options = {}) {
  const width = template.width || 512;
  const height = template.height || 512;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (template.isClassic) {
    ctx.fillStyle = options.bgColor || "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
  } else if (image) {
    ctx.drawImage(image, 0, 0, width, height);
  }

  drawCenteredText(ctx, text, template.safeZone, options);
  return canvas;
}

export async function renderBratFrame(image, frameText, template, layout, options = {}) {
  const width = template.width || 512;
  const height = template.height || 512;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (template.isClassic) {
    ctx.fillStyle = options.bgColor || "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
  } else if (image) {
    ctx.drawImage(image, 0, 0, width, height);
  }

  const rect = getSafeRect(template.safeZone);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = options.color || TEXT_STYLE.color;
  ctx.textBaseline = "top";
  drawBlockFromLayout(ctx, frameText, layout, rect, options);
  ctx.restore();
  return canvas;
}

export async function createBratImage(text, template, options = {}) {
  await ensureFont();
  const image = await loadTemplateImage(template);
  const canvas = await renderBratCanvas(image, text, template, options);
  return await canvas.encode("png");
}
