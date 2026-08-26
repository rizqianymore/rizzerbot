import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchJson } from "../../src/utils/scraping.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getLocalJkt48Members() {
  try {
    const dbPath = path.join(__dirname, "..", "..", "database", "jkt48.json");
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.data)) {
        return parsed.data;
      }
    }
  } catch (_) {}
  return [];
}

export default {
  name: "jkt48",
  description: "Menampilkan informasi profil member JKT48.",
  usage: "<nama member>",
  example: "jkt48 oline",
  aliases: ["memberjkt", "jkt"],
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    const query = args.join(" ").trim();
    if (!query) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `⚠️ *Harap masukkan nama member JKT48.*\n\n*Contoh:* \`.jkt48 oline\` atau \`.jkt48 freya\``,
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    const localMembers = getLocalJkt48Members();

    // 1. Coba cari di local database jkt48.json
    let match = localMembers.find(
      (m) =>
        m.name?.toLowerCase() === query.toLowerCase() ||
        m.nickname?.toLowerCase() === query.toLowerCase() ||
        m.code?.toLowerCase() === query.toLowerCase()
    );

    if (!match) {
      match = localMembers.find(
        (m) =>
          m.name?.toLowerCase().includes(query.toLowerCase()) ||
          m.nickname?.toLowerCase().includes(query.toLowerCase()) ||
          m.code?.toLowerCase().includes(query.toLowerCase())
      );
    }

    // 2. Fetch detail info lengkap (via crstlnz API / jkt48 public feed)
    let details = null;
    try {
      const crstlnzListRes = await fetchJson(
        "https://api.crstlnz.my.id/api/member?group=jkt48",
        { timeout: 6000 }
      );
      const list = crstlnzListRes?.data;
      if (Array.isArray(list)) {
        const found = list.find(
          (m) =>
            m.name?.toLowerCase().includes(query.toLowerCase()) ||
            m.nicknames?.some((n) => n.toLowerCase().includes(query.toLowerCase())) ||
            m.url?.toLowerCase().includes(query.toLowerCase())
        );

        if (found) {
          details = found;
          if (!match) {
            match = {
              name: found.name,
              nickname: found.nicknames?.[0] || found.name,
              type: found.team ? found.team.toUpperCase() : (found.generation || "MEMBER"),
              photo: found.img || found.img_alt,
              jkt48_member_id: found.jkt48_id,
            };
          }
        }
      }
    } catch (_) {}

    // Jika sama sekali tidak ditemukan
    if (!match && !details) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ Member dengan kata kunci *"${query}"* tidak ditemukan di database JKT48.`,
        },
        { quoted: msg }
      );
      return;
    }

    // Format profil
    const memberName = details?.name || match.name || "-";
    const nickname = details?.nicknames?.join(", ") || match.nickname || "-";
    const teamType = details?.team ? details.team.toUpperCase() : (match.type || "-");
    const generation = details?.generation ? details.generation.replace("-jkt48", "").toUpperCase() : "-";
    const memberId = match.jkt48_member_id || details?.jkt48_id || "-";
    const isGraduate = details?.is_graduate ? "Sudah Lulus (Graduate)" : "Aktif";

    let socialsText = "";
    if (details?.socials && Array.isArray(details.socials)) {
      details.socials.forEach((s) => {
        if (s.title && s.url) {
          socialsText += `• *${s.title}:* ${s.url}\n`;
        }
      });
    }

    if (!socialsText && details?.idn_username) {
      socialsText += `• *IDN Live:* @${details.idn_username}\n`;
    }

    const captionText =
      `🎤 *PROFIL MEMBER JKT48*\n\n` +
      `• *Nama Lengkap:* ${memberName}\n` +
      `• *Panggilan:* ${nickname}\n` +
      `• *Tim / Tipe:* ${teamType}\n` +
      `• *Generasi:* ${generation}\n` +
      `• *Status:* ${isGraduate}\n` +
      `• *ID Member:* ${memberId}\n` +
      (socialsText ? `\n📱 *Media Sosial:*\n${socialsText}` : "") +
      `\n⚡ _Kyros-MD JKT48 Engine_`;

    const photoUrl = details?.img || details?.img_alt || match.photo;

    if (photoUrl) {
      try {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: { url: photoUrl },
            caption: captionText,
          },
          { quoted: msg }
        );
        return;
      } catch (_) {}
    }

    // Fallback text jika gambar gagal kirim
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: captionText },
      { quoted: msg }
    );
  },
};
