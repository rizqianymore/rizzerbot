import { clearHistory, getHistory } from "@/src/services/ai/memory.js";

export default {
  name: "lupa",
  aliases: ["forget", "resetai", "lupain"],
  description: "Hapus riwayat obrolan AI kamu untuk memulai topik baru",
  usage: "",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, senderJid }) => {
    await sendTyping();
    const hadHistory = getHistory(senderJid).length > 0;
    clearHistory(senderJid);
    await reply(
      hadHistory
        ? "Riwayat percakapan AI kamu telah direset. Silakan mulai topik baru!"
        : "Tidak ada riwayat percakapan aktif yang tersimpan."
    );
  },
};
