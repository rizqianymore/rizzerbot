import { translateText } from "@/src/services/network/scrape.js";

export default {
  name: "translate",
  aliases: ["tr"],
  description: "Translate text (default: id)",
  usage: "[kode_bahasa] <teks>",
  premiumOnly: true,
  category: "User",
  run: async (sock, msg, args, { reply, sendTyping, quotedText }) => {
    await sendTyping();
    let lang = "id";
    let text = args.join(" ").trim();

    if (args.length >= 1 && /^[a-z]{2}([-_][A-Za-z]{2})?$/.test(args[0])) {
      lang = args[0].toLowerCase().replace("_", "-");
      text = args.slice(1).join(" ").trim();
    }

    if (!text && quotedText) {
      text = quotedText;
    }

    if (!text) {
      return reply("Masukkan teks atau reply pesan yang ingin diterjemahkan!\nContoh: *.translate hello world* atau reply teks lalu ketik *.tr en*");
    }
    try {
      const result = await translateText(text, lang);
      await reply(`*TERJEMAHAN:*\n\n${result.translated}`);
    } catch (err) {
      await reply(`Terjemahan gagal: ${err.message}`);
    }
  },
};
