import { parseOperator, getOperatorInfoText } from "@/src/services/cekoperator.js";

export default {
  name: "cekoperator",
  aliases: ["cekhlr", "hlr", "operator", "cekhp", "opnomor"],
  description: "Cek operator seluler Indonesia dari nomor HP (berbasis prefix, offline)",
  usage: "<nomor HP, cth: 081212345678>",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const input = (args[0] || "").trim();

    if (!input) {
      return reply(
        `📱 *CEK OPERATOR SELULER*\n\n` +
        `Masukkan nomor HP Indonesia (format 08xx / 628xx / +628xx).\n\n` +
        `*Contoh:*\n` +
        `• \`${currentPrefix}cekoperator 081212345678\`\n` +
        `• \`${currentPrefix}cekhlr +6285812345678\``
      );
    }

    await sendTyping();

    const parsed = parseOperator(input);
    if (!parsed.valid) {
      return reply(`❌ ${parsed.reason || "Nomor tidak valid."}`);
    }

    return reply(getOperatorInfoText(input));
  },
};
