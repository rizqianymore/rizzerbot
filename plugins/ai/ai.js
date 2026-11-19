import { runChat, renderHelp, renderModelList, renderStatus, formatReply, normalizeSource } from "./_shared.js";
import { splitChunks } from "@/src/services/ai/util.js";
import { memoryStats } from "@/src/services/ai/memory.js";
import { queueStats } from "@/src/services/ai/queue.js";
import { cacheStats } from "@/src/services/ai/cache.js";

const TRIVIAL = new Set(["models", "model", "status", "-m", "stats", "engine", "help", "?"]);

export default {
  name: "ai",
  aliases: ["tanya", "chatai", "ask"],
  description: "Gateway AI multi-model dengan fallback otomatis (cache + antrean)",
  usage: "[model] <pertanyaan> | models | status | stats",
  premiumOnly: true,
  category: "AI",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    const p = prefix || ".";
    if (!args || args.length === 0) return reply(renderHelp(p));

    const firstWord = String(args[0] || "").toLowerCase().replace(/^--/, "");
    if (TRIVIAL.has(firstWord)) {
      if (firstWord === "stats") {
        const m = memoryStats();
        const q = queueStats();
        const c = cacheStats();
        return reply(
          `*STATS AI RUNTIME*\n\n` +
            `• Memori: ${m.buckets} bucket, ${m.turns} turn (TTL ${m.ttlHours}j)\n` +
            `• Antrean: ${q.active} aktif / ${q.queued} menunggu (maks ${q.maxConcurrent})\n` +
            `• Cache: ${c.live} entri hidup / ${c.size} tersimpan`
        );
      }
      if (firstWord === "models" || firstWord === "model" || firstWord === "-m") return reply(renderModelList());
      if (firstWord === "help" || firstWord === "?") return reply(renderHelp(p));
      return reply(renderStatus());
    }

    await sendTyping();

    let prefer = null;
    const queryArgs = [...args];
    const matched = normalizeSource(firstWord);
    if (matched && args.length > 1) {
      prefer = matched;
      queryArgs.shift();
    }

    const promptText = queryArgs.join(" ").trim();
    if (!promptText) {
      return reply(`Tulis pertanyaan setelah model. Contoh:\n*${p}ai ${prefer || "pollinations"} Halo apa kabar?*`);
    }

    try {
      const result = await runChat(promptText, { prefer, senderJid });
      const chunks = splitChunks(formatReply(result), 3500);
      for (const chunk of chunks) await reply(chunk);
    } catch (err) {
      await reply(`*AI GAGAL*\n${err?.message || "Terjadi kesalahan saat memproses jawaban."}`);
    }
  },
};
