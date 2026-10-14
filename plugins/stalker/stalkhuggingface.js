import { USERHUNT_PLATFORMS, checkUsernameOn, isValidUsername } from "@/src/services/osint/userhunt.js";

const platform = USERHUNT_PLATFORMS.find((p) => p.key === "huggingface");

export default {
  name: "stalkhuggingface",
  aliases: ["cekhf", "huggingfacecheck", "hfstalk"],
  description: "Cek keberadaan username di Hugging Face",
  usage: "<username, cth: google>",
  category: "Stalker",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const username = (args[0] || "").trim().replace(/^@/, "");

    if (!username) {
      return reply(`Masukkan username yang ingin dicek!\n` + `Contoh: \`${currentPrefix}stalkhuggingface google\``);
    }
    if (!isValidUsername(username)) {
      return reply("Format username tidak valid (hanya huruf, angka, dot, strip, underscore, 3-30 karakter).");
    }

    await sendTyping();
    const result = await checkUsernameOn(platform, username);

    if (result.exists) {
      return reply(
        `Username *${username}* ditemukan di *${result.name}*!\n${result.url}\nAkurasi: ${result.confidence}`
      );
    }
    return reply(`Username *${username}* tidak ditemukan di *${result.name}*.`);
  },
};
