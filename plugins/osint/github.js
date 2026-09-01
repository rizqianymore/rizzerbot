import { fetchJson } from "@/src/utils/scraping.js";

export default {
  name: "github",
  description: "Mencari detail profil GitHub pengguna.",
  usage: "<username>",
  example: "github octocat",
  aliases: ["gh", "git", "githublookup"],
  category: "OSINT",
  premiumOnly: false,
  ownerOnly: true,
  run: async (sock, msg, args, context) => {
    const { sendTyping, activePrefix, senderName } = context;

    await sendTyping();

    const username = args[0];
    if (!username) {
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *Format salah!*\n\nGunakan: \`${activePrefix}github <username>\`\nContoh: \`${activePrefix}github torvalds\``,
        },
        { quoted: msg },
      );
    }

    try {
      const res = await fetchJson(
        `https://api.github.com/users/${encodeURIComponent(username)}`,
      );
      if (res.status !== 200) {
        throw new Error(`Gagal mengambil data (HTTP ${res.status})`);
      }

      const data = res.data;

      const formatDate = (dateStr) => {
        try {
          if (!dateStr) return "-";
          const d = new Date(dateStr);
          return isNaN(d.getTime())
            ? "-"
            : d.toLocaleDateString("id-ID", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });
        } catch (_) {
          return "-";
        }
      };

      let replyText =
        `🔍 *GitHub Profile OSINT*\n\n` +
        `• *Username:* \`${data.login || "-"}\`\n` +
        `• *Nama:* ${data.name || "-"}\n` +
        `• *Bio:* ${data.bio || "-"}\n` +
        `• *Perusahaan:* ${data.company || "-"}\n` +
        `• *Lokasi:* ${data.location || "-"}\n` +
        `• *Blog/Web:* ${data.blog || "-"}\n` +
        `• *Repo Publik:* ${data.public_repos || 0}\n` +
        `• *Gist Publik:* ${data.public_gists || 0}\n` +
        `• *Followers:* ${data.followers || 0}\n` +
        `• *Following:* ${data.following || 0}\n` +
        `• *Akun Dibuat:* ${formatDate(data.created_at)}\n` +
        `• *Update Terakhir:* ${formatDate(data.updated_at)}\n\n` +
        `_Dicari oleh: ${senderName}_\n\n⚡ _Via Kyros-MD API_`;

      if (data.avatar_url) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: { url: data.avatar_url },
            caption: replyText,
          },
          { quoted: msg },
        );
      } else {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: replyText },
          { quoted: msg },
        );
      }
    } catch (error) {
      console.error("Error GitHub lookup:", error);
      const status = error.response?.status;
      let errMsg = error.message || "Gagal melakukan lookup GitHub.";
      if (status === 404) {
        errMsg = "Username tidak ditemukan di GitHub.";
      } else if (status === 403) {
        errMsg = "Rate limit GitHub API tercapai. Coba lagi nanti.";
      }
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *Terjadi kesalahan!*\n\n${errMsg}`,
        },
        { quoted: msg },
      );
    }
  },
};
