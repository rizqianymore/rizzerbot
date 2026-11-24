import { runChat, formatReply } from "./_shared.js";
import { MUSE_MODELS, resolveMuseModel } from "@/src/services/ai/muse-web.js";
import { splitChunks } from "@/src/services/ai/util.js";

function renderModelList(prefix = ".") {
  const items = Object.values(MUSE_MODELS).map((m) => {
    const aliasStr = m.aliases.join(", ");
    return (
      `┌── *${m.name}*\n` +
      `│ ID: \`${m.id}\` (alias: ${aliasStr})\n` +
      `│ Deskripsi: ${m.description}\n` +
      `└── Contoh: \`${prefix}muse --${m.aliases[0]} <pertanyaan>\``
    );
  });

  return (
    `*DAFTAR MODEL META MUSE*\n\n` +
    items.join("\n\n") +
    `\n\nTips: Ketik \`${prefix}muse <pertanyaan>\` untuk memakai default (*Muse Spark*).`
  );
}

export default {
  name: "muse",
  aliases: ["museai", "metaai", "metaweb", "musecode"],
  description: "Chat Meta AI / Muse Code dengan pilihan model (Spark, Wonder, Llama 3.3)",
  usage: "[--model] <pertanyaan> | models",
  premiumOnly: true,
  category: "AI",
  cooldownMs: 3000,
  run: async (sock, msg, args, ctx) => {
    const { reply, sendTyping, prefix, senderJid } = ctx;
    const p = prefix || ".";

    if (!args || args.length === 0) {
      return reply(
        `*MUSE CODE / META AI (WEB PROTOCOL)*\n\n` +
          `Format Penggunaan:\n` +
          `│ *${p}muse <pertanyaan>* (default: Spark)\n` +
          `│ *${p}muse --spark <pertanyaan>* (fast reasoning & coding)\n` +
          `│ *${p}muse --wonder <pertanyaan>* (deep analysis mode)\n` +
          `│ *${p}muse --llama <pertanyaan>* (Llama 3.3 70B general)\n` +
          `│ *${p}muse models* (lihat detail model)\n\n` +
          `Didukung autentikasi cookie (*MUSE_COOKIE*) dan auto-fallback.`
      );
    }

    const first = String(args[0] || "").toLowerCase();
    if (first === "models" || first === "model" || first === "-m" || first === "--models") {
      return reply(renderModelList(p));
    }

    let targetModel = null;
    let queryArgs = [...args];

    if (first.startsWith("-")) {
      const candidate = first.replace(/^--?/, "");
      for (const m of Object.values(MUSE_MODELS)) {
        if (m.id === candidate || m.aliases.includes(candidate)) {
          targetModel = m.id;
          queryArgs.shift();
          break;
        }
      }
    } else {
      for (const m of Object.values(MUSE_MODELS)) {
        if (m.id === first || m.aliases.includes(first)) {
          targetModel = m.id;
          queryArgs.shift();
          break;
        }
      }
    }

    const query = queryArgs.join(" ").trim();
    if (!query) {
      const selected = resolveMuseModel(targetModel);
      return reply(
        `*MODEL DIPILIH: ${selected.name}*\n\n` +
          `Silakan masukkan pertanyaan setelah nama model.\n` +
          `Contoh: *${p}muse ${first} buatkan algoritma Dijkstra di JavaScript*`
      );
    }

    await sendTyping();

    try {
      const result = await runChat(query, {
        prefer: "muse",
        model: targetModel,
        senderJid,
      });

      for (const chunk of splitChunks(formatReply(result), 3500)) {
        await reply(chunk);
      }
    } catch (err) {
      await reply(`*MUSE AI GAGAL*\n${err?.message || "Terjadi kesalahan saat memproses permintaan."}`);
    }
  },
};
