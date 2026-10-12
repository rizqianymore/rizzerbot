import { VIDEO_CONFIG } from "./config.js";

export function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function tokenizeLine(line) {
  return normalizeText(line)
    .replace(/[,，]/g, " ")
    .split(/\s+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function splitIntoLayers(tokens, maxWordPerLayer) {
  if (!Number.isFinite(maxWordPerLayer) || maxWordPerLayer <= 0) {
    return [tokens];
  }
  const layers = [];
  for (let i = 0; i < tokens.length; i += maxWordPerLayer) {
    layers.push(tokens.slice(i, i + maxWordPerLayer));
  }
  return layers;
}

function resolveDurations(frames, lyric) {
  return frames.map((frame) => {
    return frame.isLastInLayer
      ? Math.max(0.05, lyric.lastFrameDuration)
      : Math.max(0.05, lyric.frameDuration);
  });
}

export function buildRevealFrames(text, configObj = VIDEO_CONFIG) {
  const segments = normalizeText(text)
    .split("\n")
    .map((line) => tokenizeLine(line))
    .filter((tokens) => tokens.length > 0);
  if (!segments.length) return [];

  const frames = [];
  let current = "";
  for (const segment of segments) {
    const layers = splitIntoLayers(segment, configObj.lyric.maxWordPerLayer);
    for (const layer of layers) {
      for (let i = 0; i < layer.length; i++) {
        current += (current ? " " : "") + layer[i];
        frames.push({
          text: current,
          isLastInLayer: i === layer.length - 1,
        });
      }
    }
  }

  const durations = resolveDurations(frames, configObj.lyric);
  return frames.map((frame, index) => ({
    ...frame,
    duration: durations[index],
  }));
}
