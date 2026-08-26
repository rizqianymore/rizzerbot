import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { customRequest } from "../../src/utils/scraping.js";

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
  description: "Menampilkan informasi profil resmi member JKT48.",
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
          text: `⚠️ *Harap masukkan nama member JKT48.*\n\n*Contoh:* \`.jkt48 oline\` atau \`.jkt48 alya\``,
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    const localMembers = getLocalJkt48Members();

    // 1. Cari di local database jkt48.json
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

    // 2. Query data detail resmi langsung ke Official JKT48 API
    let officialDetail = null;
    const memberId = match.jkt48_member_id;

    if (memberId) {
      try {
        const offRes = await customRequest(
          `https://jkt48.com/api/v1/members/${memberId}?lang=id`,
          {
            headers: {
              Referer: `https://jkt48.com/member/detail?member=${match.code?.toLowerCase() || "detail"}&type=`,
              Origin: "https://jkt48.com",
              Accept: "application/json, text/plain, */*",
            },
            timeout: 8000,
          }
        );
        if (offRes?.data?.data) {
          officialDetail = offRes.data.data;
        }
      } catch (_) {}
    }

    // Format profil resmi JKT48
    const name = officialDetail?.name || match.name || "-";
    const nickname = officialDetail?.nickname || match.nickname || "-";
    const type = officialDetail?.type || match.type || "-";
    const bloodType = officialDetail?.blood_type || "-";
    const height = officialDetail?.body_height ? `${officialDetail.body_height} cm` : "-";
    const horoscope = officialDetail?.horoscope || "-";
    const birthPlace = officialDetail?.birth_place || "";

    let birthDate = "-";
    if (officialDetail?.birth_date) {
      try {
        birthDate = new Date(officialDetail.birth_date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      } catch (_) {
        birthDate = officialDetail.birth_date;
      }
    }

    // Media sosial resmi
    const twitter = officialDetail?.twitter_account ? `@${officialDetail.twitter_account}` : "-";
    const instagram = officialDetail?.instagram_account ? `@${officialDetail.instagram_account}` : "-";
    const tiktok = officialDetail?.tiktok_account ? `@${officialDetail.tiktok_account}` : "-";

    const captionText =
      `🎤 *PROFIL RESMI MEMBER JKT48*\n\n` +
      `• *Nama Lengkap:* ${name}\n` +
      `• *Panggilan:* ${nickname}\n` +
      `• *Tim / Tipe:* ${type}\n` +
      (birthPlace ? `• *Tempat Lahir:* ${birthPlace}\n` : "") +
      `• *Tanggal Lahir:* ${birthDate}\n` +
      `• *Golongan Darah:* ${bloodType}\n` +
      `• *Tinggi Badan:* ${height}\n` +
      `• *Horoskop:* ${horoscope}\n\n` +
      `📱 *Media Sosial Resmi:*\n` +
      `• *Instagram:* ${instagram}\n` +
      `• *Twitter / X:* ${twitter}\n` +
      `• *TikTok:* ${tiktok}\n\n` +
      `*ID Member:* ${memberId}\n\n` +
      `⚡ _Official JKT48 Database_`;

    const photoUrl =
      officialDetail?.photo_1 ||
      officialDetail?.photo_2 ||
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
