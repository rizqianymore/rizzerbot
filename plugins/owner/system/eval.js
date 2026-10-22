export default {
  name: "eval",
  description: "Evaluate JavaScript code (hanya untuk owner utama)",
  usage: "<kode js>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, { reply, senderJid, logger, isPrimarySuperOwner }) => {
    if (!isPrimarySuperOwner) {
      return reply("❌ Hanya owner utama yang bisa menggunakan perintah ini");
    }
    logger?.warn?.(`[OwnerCmd] eval oleh ${senderJid}`);
    try {
      const result = eval(msg?.text?.replace(`/eval `, "") || "''");
      await reply(`*Hasil:*\n\`\`\`js\n${typeof result === 'object' ? JSON.stringify(result, null, 2) : result}\n\`\`\``);
    } catch (e) {
      await reply(`*Error:* ${e.message}`);
    }
  },
};
