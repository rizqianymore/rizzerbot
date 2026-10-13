import { USERHUNT_PLATFORMS, checkUsernameAll, isValidUsername } from "@/src/services/osint/userhunt.js";

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
      return reply(`❌ Masukkan username yang ingin dicari!\n` + `Contoh: \`${currentPrefix}userhunt torvalds\``);
    }

    if (!isValidUsername(username)) {
      return reply("❌ Format username tidak valid (hanya huruf, angka, dot, strip, underscore, 3-30 karakter).");
    }

    await sendTyping();
    await reply(`🔍 Melacak jejak username *${username}* di ${USERHUNT_PLATFORMS.length} platform online...`);

    const found = await checkUsernameAll(username);
    const high = found.filter((i) => i.confidence === "HIGH");

    const badge = (c) => (c === "HIGH" ? "🟢" : c === "MEDIUM" ? "🟡" : "⚪");
    const lines = [
      `🕵️‍♂️ *OSINT USERNAME SCANNER*`,
      `Target: \`${username}\``,
      `Hasil: Ditemukan di *${found.length}* dari *${USERHUNT_PLATFORMS.length}* platform (*${high.length}* terverifikasi 🟢)`,
      ``,
    ];

    if (found.length === 0) {
      lines.push(`_Tidak ditemukan akun publik aktif dengan username tersebut di platform yang dicek._`);
    } else {
      found.forEach((item, idx) => {
        lines.push(`${idx + 1}. ${badge(item.confidence)} *${item.name}* [${item.confidence}]: ${item.url}`);
      });
      lines.push(``);
      lines.push(`_🟢=API resmi, 🟡=penanda kuat, ⚪=heuristik (wajib cek manual)._`);
      lines.push(`_Username sama ≠ orang yang sama — cocokkan foto/bio sebelum menyimpulkan._`);
    }

    return reply(lines.join("\n"));
  },
};
