import { getGithubInfoText } from "@/src/services/githubstalk.js";

export default {
  "name": "githubstalk",
  "aliases": ["ghstalk", "gh", "stalkgh"],
  "description": "Intip profil GitHub: bio, repo, followers, email publik, lokasi",
  "usage": "<username, cth: torvalds>",
  "premiumOnly": true,
  "category": "OSINT",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      const currentPrefix = prefix || ".";
      const input = (args || []).join(" ").trim();

      if (!input) {
        return reply(
          `Masukkan username GitHub! Contoh: \`${currentPrefix}githubstalk torvalds\``
        );
      }

      await sendTyping();
      try {
        const result = await getGithubInfoText(input);
        if (result.error) {
          return reply(
            `${result.error}\n\n` +
            `Gunakan: \`${currentPrefix}githubstalk <username>\`\n` +
            `Contoh: \`${currentPrefix}githubstalk torvalds\``
          );
        }
        return reply(result.text);
      } catch (err) {
        return reply(`Gagal memproses: ${err.message}`);
      }
    },
};
