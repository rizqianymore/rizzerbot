import { exec } from "child_process";

export default {
  name: "exec",
  aliases: ["$", "sh", "shell"],
  description: "Eksekusi perintah terminal shell / bash di server (Super Owner Only)",
  usage: "<perintah>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, context) => {
    const { reply, senderJid, logger, isPrimarySuperOwner } = context;

    if (!isPrimarySuperOwner && !context.isOwner) {
      return reply("❌ Perintah ini hanya dapat dieksekusi oleh Super Owner.");
    }

    const command = args.join(" ").trim();
    if (!command) {
      return reply("Masukkan perintah shell! Contoh: `$ uname -a` atau `$ ls -la`");
    }

    logger?.warn?.(`[OwnerCmd] exec shell dieksekusi oleh ${senderJid}: ${command}`);

    exec(command, { timeout: 30000 }, (err, stdout, stderr) => {
      const out = (stdout || "").trim();
      const errOut = (stderr || "").trim();

      if (err) {
        return reply(`*EXEC ERROR:*\n\`\`\`bash\n${err.message}\n${errOut}\`\`\``);
      }

      const resultText = out || errOut || "Done (tanpa output).";
      const trimmed = resultText.length > 2000 ? `${resultText.slice(0, 2000)}\n... (output dipotong)` : resultText;

      reply(`*TERMINAL OUTPUT:*\n\`\`\`bash\n${trimmed}\n\`\`\``);
    });
  },
};
