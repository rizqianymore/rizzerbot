export default {
  name: "poll",
  aliases: ["polling", "vote", "buatpoll"],
  description: "Buat voting interaktif / WhatsApp native poll di chat",
  usage: "<pertanyaan> | <opsi 1> | <opsi 2> [| opsi ...] [| -m (opsional: izinkan multi-pilih)]",
  category: "Group",
  cooldownMs: 3000,
  run: async (sock, msg, args, context) => {
    const raw = args.join(" ").trim();
    if (!raw || !raw.includes("|")) {
      return context.reply(
        `Gunakan format:\n` +
        `${context.prefix || "."}poll Pertanyaan | Opsi 1 | Opsi 2 [| Opsi 3...]\n\n` +
        `Contoh Single Choice:\n` +
        `${context.prefix || "."}poll Mabar nanti malam? | Gas | Skip | Nanti kabarin\n\n` +
        `Contoh Multi Choice (bisa pilih lebih dari 1):\n` +
        `${context.prefix || "."}poll Pilih hobi kamu | Futsal | Game | Coding | -m`
      );
    }

    const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) {
      return context.reply("Polling memerlukan minimal 1 pertanyaan dan minimal 2 opsi pilihan.");
    }

    const question = parts[0];
    const options = parts.slice(1);

    // Cek flag multi-select "-m" di akhir
    let selectableCount = 1;
    if (options[options.length - 1] === "-m" || options[options.length - 1] === "--multi") {
      options.pop();
      selectableCount = 0; // 0 di Baileys berarti multi-select (semua opsi bisa dipilih)
    }

    if (options.length < 2) {
      return context.reply("Masukkan minimal 2 opsi pilihan.");
    }

    if (options.length > 12) {
      return context.reply("WhatsApp membatasi maksimal 12 opsi pilihan polling.");
    }

    await context.sendTyping();

    try {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          poll: {
            name: question,
            values: options,
            selectableCount,
          },
        },
        { quoted: msg }
      );
    } catch (err) {
      return context.reply(`Gagal membuat polling: ${err.message}`);
    }
  },
};
