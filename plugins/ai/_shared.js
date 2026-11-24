import { askAI, getAIStatus, listSources, normalizeSource } from "@/src/services/ai/router.js";
import { runQueued } from "@/src/services/ai/queue.js";
import { cacheGet, cacheSet } from "@/src/services/ai/cache.js";
import { getHistory, pushTurn } from "@/src/services/ai/memory.js";
import { splitChunks, estimateTokens, cleanHumanizedText } from "@/src/services/ai/util.js";

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
    `│ *muse* / *spark* (Meta Muse Web)\n` +
    `│ *opencode* / *oc* (coding & reasoning)\n` +
    `│ *gemini* (butuh GEMINI_API_KEY)\n` +
    `│ *groq* (butuh GROQ_API_KEY)\n` +
    `│ *r1* / *deepseek* (butuh DEEPSEEK_API_KEY)\n\n` +
    `Contoh: *${p}ai spark jelaskan algoritma sorting*`
  );
}

export async function runChat(prompt, opts = {}) {
  const clean = String(prompt || "").trim();
  const senderJid = opts.senderJid || "global";
  const scope = { prefer: opts.prefer, history: getHistory(senderJid) };

  const cached = cacheGet(clean, scope);
  if (cached) return { ...cached, source: cached.source || "cache", cached: true };

  const result = await runQueued(() =>
    askAI(clean, { prefer: opts.prefer, model: opts.model, history: scope.history, system: opts.system })
  );

  const humanizedText = cleanHumanizedText(result.text) || result.text;
  const promptTok = result.usage?.prompt_tokens ?? estimateTokens(clean);
  const compTok = result.usage?.completion_tokens ?? estimateTokens(humanizedText);
  const totalTok = result.usage?.total_tokens ?? (promptTok + compTok);

  const finalResult = {
    ...result,
    text: humanizedText,
    usage: {
      prompt_tokens: promptTok,
      completion_tokens: compTok,
      total_tokens: totalTok,
    },
  };

  cacheSet(clean, scope, { text: finalResult.text, model: finalResult.model, source: finalResult.source });
  pushTurn(senderJid, clean, finalResult.text);
  return finalResult;
}

export function formatReply(result) {
  const tag = result.cached ? " (cached)" : "";
  const modelName = result.model || String(result.source || "AI").toUpperCase();
  const header = `*AI (${modelName})*${tag}`;
  let replyText = `${header}\n\n${result.text}`;

  if (result.usage && Number.isFinite(result.usage.total_tokens)) {
    const u = result.usage;
    replyText += `\n\nTokens: ${u.total_tokens} (Prompt: ${u.prompt_tokens || 0} | Output: ${u.completion_tokens || 0})`;
  }

  return replyText;
}

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
