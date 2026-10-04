import { USERHUNT_PLATFORMS, checkUsernameAll, isValidUsername } from "@/src/services/userhunt.js";

export default {
  name: "userhunt",
  aliases: ["sherlock", "stalkuser", "usercheck", "huntuser"],
  description: "Lacak keberadaan username di berbagai platform sosial media & developer",
  usage: "<username, cth: torvalds>",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const username = (args[0] || "").trim().replace(/^@/, "");

    if (!username) {
      return reply(
        `❌ Masukkan username yang ingin dicari!\n` +
        `Contoh: \`${currentPrefix}userhunt torvalds\``
      );
    }

    if (!isValidUsername(username)) {
      return reply("❌ Format username tidak valid (hanya huruf, angka, dot, strip, underscore, 3-30 karakter).");
    }

    await sendTyping();
    await reply(`🔍 Melacak jejak username *${username}* di ${USERHUNT_PLATFORMS.length} platform online...`);

    const found = await checkUsernameAll(username);

    const lines = [
      `🕵️‍♂️ *OSINT USERNAME SCANNER*`,
      `Target: \`${username}\``,
      `Hasil: Ditemukan di *${found.length}* dari *${USERHUNT_PLATFORMS.length}* platform`,
      ``,
    ];

    if (found.length === 0) {
      lines.push(`_Tidak ditemukan akun publik aktif dengan username tersebut di platform yang dicek._`);
    } else {
      found.forEach((item, idx) => {
        lines.push(`${idx + 1}. *${item.name}*: ${item.url}`);
      });
    }

    return reply(lines.join("\n"));
  },
};
