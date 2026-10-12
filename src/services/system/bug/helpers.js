export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parsePhoneTarget(input) {
  if (!input) return null;
  const num = String(input).replace(/[^0-9]/g, "");
  if (!num) return null;
  if (num.startsWith("0")) return null;
  return `${num}@s.whatsapp.net`;
}

export function parseGroupInviteCode(input) {
  if (!input) return null;
  const m = String(input)
    .trim()
    .match(/chat\.whatsapp\.com\/(?:join\/)?([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

export async function resolveGroupTarget(sock, input, { autoJoin = true } = {}) {
  const code = parseGroupInviteCode(input);
  if (!code) throw new Error("Link group tidak valid");
  const info = await sock.groupGetInviteInfo(code);
  let target = info?.id || "";
  if (target && !target.includes("@g.us")) target = `${target}@g.us`;
  if (!target) throw new Error("Gagal resolve ID grup dari link");
  if (autoJoin) {
    try {
      await sock.groupAcceptInvite(code);
      await sleep(2000);
    } catch (_) {

    }
  }
  return target;
}

export async function runGroupSpam(sock, target, fn, { totalLoop = 55, delayMs = 500, logger = null } = {}) {
  let success = 0;
  let failed = 0;
  for (let i = 1; i <= totalLoop; i++) {
    try {
      await fn(target, i);
      await sleep(delayMs);
      success++;
    } catch (e) {
      failed++;
      logger?.warn?.(`[bug/group] iterasi ${i} gagal: ${e?.message || e}`);
      const msg = `${e?.output?.statusCode || e?.data || ""} ${e?.message || ""}`;
      if (/429|rate|conflict|forbidden|logged|connection/i.test(msg)) break;
    }
  }
  return { success, failed };
}
