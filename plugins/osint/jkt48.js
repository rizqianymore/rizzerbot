import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
  description: "Menampilkan informasi profil resmi member JKT48 lengkap.",
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

    // 1. Prioritas pencarian: nama persis, nama panggilan persis, atau code persis
    let match = localMembers.find(
      (m) =>
        m.name?.toLowerCase() === query.toLowerCase() ||
        m.nickname?.toLowerCase() === query.toLowerCase() ||
        m.code?.toLowerCase() === query.toLowerCase()
    );

    // 2. Jika tidak ada persis, cari yang mengandung kata kunci query
    if (!match) {
      match = localMembers.find(
        (m) =>
          m.name?.toLowerCase().includes(query.toLowerCase()) ||
          m.nickname?.toLowerCase().includes(query.toLowerCase()) ||
          m.code?.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (!match) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ Member dengan nama *"${query}"* tidak ditemukan di database resmi JKT48.`,
        },
        { quoted: msg }
      );
      return;
    }

    // Ekstrak data field dari database lokal lengkap
    const name = match.name || "-";
    const nickname = match.nickname || "-";
    const type = match.type || "-";
    const bloodType = match.blood_type || "-";
    const height = match.body_height ? `${match.body_height} cm` : "-";
    const horoscope = match.horoscope || "-";
    const birthPlace = match.birth_place || "";
    
    let birthDate = "-";
    if (match.birth_date) {
      try {
        birthDate = new Date(match.birth_date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      } catch (_) {
        birthDate = match.birth_date;
      }
    }

    // Media sosial resmi
    const instagram = match.instagram_account ? `@${match.instagram_account.replace(/^@/, "")}` : "-";
    const twitter = match.twitter_account ? `@${match.twitter_account.replace(/^@/, "")}` : "-";
    const tiktok = match.tiktok_account ? `@${match.tiktok_account.replace(/^@/, "")}` : "-";

    const captionText =
      `🎤 *PROFIL RESMI MEMBER JKT48*\n\n` +
      `• *Nama Lengkap:* ${name}\n` +
      `• *Panggilan:* ${nickname}\n` +
      `• *Tim / Tipe:* ${type}\n` +
      (birthPlace ? `• *Tempat Lahir:* ${birthPlace}\n` : "") +
      (birthDate !== "-" ? `• *Tanggal Lahir:* ${birthDate}\n` : "") +
      (bloodType !== "-" ? `• *Golongan Darah:* ${bloodType}\n` : "") +
      (height !== "-" ? `• *Tinggi Badan:* ${height}\n` : "") +
      (horoscope !== "-" ? `• *Horoskop:* ${horoscope}\n` : "") +
      `\n📱 *Media Sosial Resmi:*\n` +
      `• *Instagram:* ${instagram}\n` +
      `• *Twitter / X:* ${twitter}\n` +
      `• *TikTok:* ${tiktok}\n\n` +
      `*ID Member:* ${match.jkt48_member_id || "-"}\n\n` +
      `⚡ _Official JKT48 Database_`;

    const photoUrl =
      match.photo_1 ||
      match.photo_2 ||
      match.photo;

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

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: captionText },
      { quoted: msg }
    );
  },
};
