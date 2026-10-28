import util from "util";

export default {
  name: "eval",
  aliases: [">", ">>"],
  description: "Evaluate JavaScript code langsung di runtime bot (Super Owner Only)",
  usage: "<kode js>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, context) => {
    const { reply, senderJid, logger, isPrimarySuperOwner } = context;

    if (!isPrimarySuperOwner && !context.isOwner) {
      return reply("❌ Perintah ini hanya dapat dieksekusi oleh Super Owner.");
    }

    const rawCode = args.join(" ").trim();
    if (!rawCode) {
      return reply("Masukkan kode JavaScript yang ingin dieksekusi! Contoh: `> 2 + 2` atau `> sock.user`");
    }

    logger?.warn?.(`[OwnerCmd] eval dieksekusi oleh ${senderJid}: ${rawCode.slice(0, 80)}`);

    let result;
    try {
      const codeToRun = rawCode.includes("return") || rawCode.includes("await")
        ? `(async () => { ${rawCode} })()`
        : rawCode;

      result = await eval(codeToRun);

      let output = typeof result === "string" ? result : util.inspect(result, { depth: 2, maxArrayLength: 50 });
      if (output.length > 2000) {
        output = `${output.slice(0, 2000)}\n... (output dipotong)`;
      }

      await reply(`*EVAL HASIL:*\n\`\`\`js\n${output}\n\`\`\``);
    } catch (e) {
      await reply(`*EVAL ERROR:*\n\`\`\`bash\n${e?.stack || e?.message || e}\n\`\`\``);
    }
  },
};
