import { clearHistory, getHistory } from "@/src/services/ai/memory.js";

export default {
  name: "lupa",
  aliases: ["forget", "resetai", "lupain"],
  description: "Hapus memory percakapan AI kamu (mulai topik baru)",
  usage: "",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, senderJid }) => {
    await sendTyping();
    const had = getHistory(senderJid).length > 0;
    clearHistory(senderJid);
    await reply(
      had
        ? "Memory percakapan AI kamu sudah dihapus. Silakan mulai topik baru."
        : "Tidak ada memory percakapan yang tersimpan."
    );
  },
};
