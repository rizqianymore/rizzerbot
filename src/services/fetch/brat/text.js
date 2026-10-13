import { VIDEO_CONFIG } from "./config.js";

export function normalizeText(text) {
  return (
    String(text || "")
      .replace(/\r/g, "")

      .replace(/[\u00A0\u2007\u202F]/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export function tokenizeLine(line) {
  return normalizeText(line)
    .replace(/[,，]/g, " ")
    .split(/\s+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function splitWords(line) {
  return String(line || "")
    .split(" ")
    .filter(Boolean);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function buildRevealFrames(lines, configObj = VIDEO_CONFIG) {

  const wordLines = (Array.isArray(lines) ? lines : [])
    .map((line) => splitWords(line))
    .filter((tokens) => tokens.length > 0);
  const totalWords = wordLines.reduce((sum, tokens) => sum + tokens.length, 0);
  if (!totalWords) return [];

  const maxSteps = Math.max(1, configObj.maxRevealSteps);
  const wordsPerStep = Math.max(1, Math.ceil(totalWords / maxSteps));

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

    if (pending > 0 && revealed < totalWords) {
      steps.push({ revealedWords: revealed, endOfLine: true });
      pending = 0;
    }
  }
  if (pending > 0 || !steps.length || steps.at(-1).revealedWords < totalWords) {
    steps.push({ revealedWords: totalWords, endOfLine: false });
  }

  const lastDuration = Math.max(0.1, configObj.lastFrameDuration);
  const minFrame = Math.max(0.04, configObj.minFrameDuration || 0.04);
  const maxFrame = Math.max(minFrame, configObj.maxFrameDuration || minFrame * 10);
  const pauseFactor = Math.max(1, configObj.linePauseFactor || 1);

  const movingSteps = steps.slice(0, -1);
  const pauseCount = movingSteps.filter((step) => step.endOfLine).length;
  const weightedSteps = Math.max(1, movingSteps.length - pauseCount + pauseCount * pauseFactor);

  const hasTarget = Number.isFinite(configObj.targetDuration) && configObj.targetDuration > lastDuration;
  const target = hasTarget ? configObj.targetDuration : null;

  const budget = target ?? lastDuration + weightedSteps * maxFrame;
  const base = clamp((budget - lastDuration) / weightedSteps, minFrame, maxFrame);

  const frames = steps.map((step, index) => {
    const isLast = index === steps.length - 1;
    let duration = isLast ? lastDuration : base;
    if (!isLast && step.endOfLine) {
      duration = clamp(base * pauseFactor, minFrame, maxFrame * 2);
    }
    return { revealedWords: step.revealedWords, duration, isLast };
  });

  if (target) {
    const total = frames.reduce((sum, frame) => sum + frame.duration, 0);
    if (total > target) {
      const scale = target / total;
      for (const frame of frames) {
        frame.duration = Math.max(minFrame, frame.duration * scale);
      }
    }
  }

  return frames;
}
