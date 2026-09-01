import util from "util";
import { db } from "@/src/core/database.js";
import { commands } from "@/src/core/loader.js";
import { settings } from "@/config/settings.js";

export default {
  name: "eval",
  aliases: [">", "=>"],
  description: "Mengeksekusi kode JavaScript langsung di runtime server (Khusus Super Owner).",
  usage: "<kode js>",
  example: "> db.data.settings",
  category: "Owner",
  superOwnerOnly: true,
  ownerOnly: true,
  run: async (sock, msg, args, context) => {
    const { isSuperOwner, sendTyping } = context;

    if (!isSuperOwner) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⛔ Perintah Eval hanya dapat digunakan oleh Super Owner!" },
        { quoted: msg }
      );
      return;
    }

    const code = args.join(" ").trim();
    if (!code) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Masukkan kode JavaScript yang ingin dievaluasi." },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    let result;
    try {
      // Evaluasi kode dengan expose context esensial
      const asyncEval = new Function(
        "sock",
        "msg",
        "args",
        "context",
        "db",
        "commands",
        "settings",
        `return (async () => { return ${code}; })()`
      );

      result = await asyncEval(sock, msg, args, context, db, commands, settings);

      if (typeof result !== "string") {
        result = util.inspect(result, { depth: 2, maxArrayLength: 50 });
      }

      // Potong jika terlalu panjang agar tidak crash WA
      if (result.length > 3000) {
        result = result.slice(0, 3000) + "\n... [Hasil dipotong karena terlalu panjang]";
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `💻 *Eval Execution Output*\n\n\`\`\`javascript\n${result}\n\`\`\`` },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ *Eval Error*\n\n\`\`\`text\n${err.stack || err.message || err}\n\`\`\`` },
        { quoted: msg }
      );
    }
  },
};
