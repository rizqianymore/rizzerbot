import { askAI, getAIStatus, listSources, normalizeSource } from "@/src/services/ai/router.js";
import { runQueued } from "@/src/services/ai/queue.js";
import { cacheGet, cacheSet } from "@/src/services/ai/cache.js";
import { getHistory, pushTurn } from "@/src/services/ai/memory.js";
import { splitChunks } from "@/src/services/ai/util.js";

export function renderStatus() {
  const lines = Object.entries(getAIStatus())
    .map(([k, v]) => `│ ${k.toUpperCase()}: ${v}`)
    .join("\n");
  return `*STATUS ENGINE AI*\n\n${lines}`;
}

export function renderModelList() {
  const rows = listSources()
    .sort((a, b) => a.tier - b.tier)
    .map((s) => `${s.ready ? "✓" : "×"} *${s.name}* — ${s.label}`);
  return `*DAFTAR MODEL (${rows.length})*\n\n${rows.join("\n")}\n\n✓ siap · × butuh API key / node down`;
}

export function renderHelp(p) {
  return (
    `*AI ENGINE — MULTI MODEL + FALLBACK*\n\n` +
    `Format:\n` +
    `│ *${p}ai <pertanyaan>*\n` +
    `│ *${p}ai <model> <pertanyaan>*\n` +
    `│ *${p}ai models* — daftar model & kesiapan\n` +
    `│ *${p}ai status* — status engine\n\n` +
    `Model populer:\n` +
    `│ *pollinations* (gratis, default)\n` +
    `│ *opencode* / *oc* (coding)\n` +
    `│ *r1* / *deepseek* (butuh DEEPSEEK_API_KEY)\n` +
    `│ *groq* (butuh GROQ_API_KEY)\n\n` +
    `Contoh: *${p}ai r1 jelaskan black hole*`
  );
}

/**
 * Satu jalur untuk semua plugin AI: cache → antrean → gateway → memori.
 * @param {string} prompt
 * @param {{prefer?: string|null, senderJid?: string, system?: string}} opts
 */
export async function runChat(prompt, opts = {}) {
  const clean = String(prompt || "").trim();
  const senderJid = opts.senderJid || "global";
  const scope = { prefer: opts.prefer, history: getHistory(senderJid) };

  const cached = cacheGet(clean, scope);
  if (cached) return { ...cached, source: cached.source || "cache", cached: true };

  const result = await runQueued(() =>
    askAI(clean, { prefer: opts.prefer, history: scope.history, system: opts.system })
  );

  cacheSet(clean, scope, { text: result.text, model: result.model, source: result.source });
  pushTurn(senderJid, clean, result.text);
  return result;
}

export function formatReply(result) {
  const tag = result.cached ? " ⚡cache" : "";
  const header = `*AI (${result.model || String(result.source).toUpperCase()})*${tag}`;
  return `${header}\n\n${result.text}`;
}

/**
 * Plugin AI ramping yang menembak satu model spesifik.
 * @param {{name: string, aliases?: string[], model: string, description: string, extra?: string, cooldownMs?: number}} cfg
 */
export function makeAICommand(cfg) {
  return {
    name: cfg.name,
    aliases: cfg.aliases || [],
    description: cfg.description,
    usage: "<pertanyaan>",
    premiumOnly: true,
    category: "AI",
    cooldownMs: cfg.cooldownMs || 4000,
    run: async (sock, msg, args, ctx) => {
      const { reply, sendTyping, prefix, senderJid } = ctx;
      const p = prefix || ".";
      const text = (args || []).join(" ").trim();
      if (!text) {
        return reply(
          `*${cfg.name.toUpperCase()}*\n\n` +
            `Format: *${p}${cfg.name} <pertanyaan>*\n` +
            (cfg.extra ? `${cfg.extra}\n` : "") +
            `Reset riwayat: *${p}lupa*`
        );
      }
      await sendTyping();
      try {
        const result = await runChat(text, { prefer: cfg.model, senderJid });
        for (const chunk of splitChunks(formatReply(result), 3500)) {
          await reply(chunk);
        }
      } catch (err) {
        await reply(`*${cfg.name.toUpperCase()} GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
      }
    },
  };
}

export { normalizeSource };
