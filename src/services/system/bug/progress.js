import { sleep } from "./helpers.js";

export const BUG_DELAY_MS = 500;

export function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} detik`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m} menit` : `${m} menit ${rest} detik`;
}

export async function preciseSleep(ms, startedAt) {
  const elapsed = Date.now() - startedAt;
  const wait = ms - elapsed;
  if (wait > 0) await sleep(wait);
}

export async function replyProcessing(reply, target, commandName) {
  try {
    await reply(`⏳ *Memproses ${commandName} ke ${target}...*\nMohon tunggu, jangan spam perintah.`);
  } catch (_) {}
}

export async function replyDone(reply, target, commandName, { success = null, failed = null, ms = 0 } = {}) {
  const stat = success === null ? "" : `\nSukses: ${success} | Gagal: ${failed}`;
  try {
    await reply(`✅ *Selesai! ${commandName} ke ${target}*${stat}\nDurasi: ${formatDuration(ms)}`);
  } catch (_) {}
}

export async function replyFailed(reply, target, commandName, err) {
  try {
    await reply(`❌ *Gagal ${commandName} ke ${target}*\nDetail: ${err?.message || err}`);
  } catch (_) {}
}

export function makeProgressLogger(log, tag, total) {
  let lastPct = -1;
  return (done) => {
    const pct = Math.floor((done / total) * 100);
    if (pct >= lastPct + 25 || done === total) {
      lastPct = pct;
      try {
        log?.info?.(`[${tag}] progres ${done}/${total} (${pct}%)`);
      } catch (_) {}
    }
  };
}
