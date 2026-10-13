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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Susun frame reveal dari baris layout FINAL (hasil wrap).
 * Kata muncul pada posisi tetap sehingga teks tidak "meloncat" antar frame.
 *
 * @param {string[]} lines baris hasil wrap layout
 * @returns {{ revealedWords: number, duration: number, isLast: boolean }[]}
 */
export function buildRevealFrames(lines, configObj = VIDEO_CONFIG) {
  const wordLines = (Array.isArray(lines) ? lines : [])
    .map((line) => tokenizeLine(line))
    .filter((tokens) => tokens.length > 0);
  const totalWords = wordLines.reduce((sum, tokens) => sum + tokens.length, 0);
  if (!totalWords) return [];

  const maxSteps = Math.max(1, configObj.maxRevealSteps);
  const wordsPerStep = Math.max(1, Math.ceil(totalWords / maxSteps));

  // Susun step: reveal bertambah kata per kata, selesai tepat di akhir teks.
  const steps = [];
  let revealed = 0;
  let pending = 0;
  for (const tokens of wordLines) {
    for (const _ of tokens) {
      revealed += 1;
      pending += 1;
      if (pending >= wordsPerStep) {
        steps.push({ revealedWords: revealed, endOfLine: false });
        pending = 0;
      }
    }
    // Beri jeda halus di akhir baris bila masih ada sisa kata.
    if (pending > 0 && revealed < totalWords) {
      steps.push({ revealedWords: revealed, endOfLine: true });
      pending = 0;
    }
  }
  if (pending > 0 || !steps.length || steps.at(-1).revealedWords < totalWords) {
    steps.push({ revealedWords: totalWords, endOfLine: false });
  }

  const lastDuration = Math.max(0.1, configObj.lastFrameDuration);
  const moving = Math.max(1, steps.length - 1);
  const base = clamp(
    (configObj.targetDuration - lastDuration) / moving,
    configObj.minFrameDuration,
    configObj.maxFrameDuration
  );

  return steps.map((step, index) => {
    const isLast = index === steps.length - 1;
    let duration = isLast ? lastDuration : base;
    if (!isLast && step.endOfLine) {
      duration = clamp(base * configObj.linePauseFactor, configObj.minFrameDuration, configObj.maxFrameDuration * 2);
    }
    return { revealedWords: step.revealedWords, duration, isLast };
  });
}
