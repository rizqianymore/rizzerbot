import { USERHUNT_PLATFORMS, checkUsernameOn, isValidUsername } from "@/src/services/osint/userhunt.js";

const platform = USERHUNT_PLATFORMS.find((p) => p.key === "chess");

export default {
  name: "stalkchess",
  aliases: ["cekchess", "chessstalk", "chesscheck"],
  description: "Cek keberadaan username di Chess.com",
  usage: "<username, cth: hikaru>",
  category: "Stalker",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const username = (args[0] || "").trim().replace(/^@/, "");

    if (!username) {
      return reply(
        `❌ Masukkan username yang ingin dicek!\n` +
        `Contoh: \`${currentPrefix}stalkchess hikaru\``
      );
    }
    if (!isValidUsername(username)) {
      return reply("❌ Format username tidak valid (hanya huruf, angka, dot, strip, underscore, 3-30 karakter).");
    }

    await sendTyping();
    const result = await checkUsernameOn(platform, username);

    if (result.exists) {
      return reply(`✅ Username *${username}* ditemukan di *${result.name}*!\n🔗 ${result.url}\n🎯 Akurasi: ${result.confidence}`);
    }
    return reply(`❌ Username *${username}* tidak ditemukan di *${result.name}*.`);
  },
};
