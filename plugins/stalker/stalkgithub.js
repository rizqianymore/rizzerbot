import { USERHUNT_PLATFORMS, checkUsernameOn, isValidUsername } from "@/src/services/userhunt.js";

const platform = USERHUNT_PLATFORMS.find((p) => p.key === "github");

export default {
  name: "stalkgithub",
  aliases: ["cekgh", "githubcheck", "ghcheck"],
  description: "Cek keberadaan username di GitHub",
  usage: "<username, cth: torvalds>",
  category: "Stalker",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const username = (args[0] || "").trim().replace(/^@/, "");

    if (!username) {
      return reply(
        `❌ Masukkan username yang ingin dicek!\n` +
        `Contoh: \`${currentPrefix}stalkgithub torvalds\``
      );
    }
    if (!isValidUsername(username)) {
      return reply("❌ Format username tidak valid (hanya huruf, angka, dot, strip, underscore, 3-30 karakter).");
    }

    await sendTyping();
    const result = await checkUsernameOn(platform, username);

    if (result.exists) {
      return reply(`✅ Username *${username}* ditemukan di *${result.name}*!\n🔗 ${result.url}`);
    }
    return reply(`❌ Username *${username}* tidak ditemukan di *${result.name}*.`);
  },
};
