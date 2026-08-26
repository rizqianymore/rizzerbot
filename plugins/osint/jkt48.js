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
      const slugName = match.name
        ? match.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
        : match.code?.toLowerCase();
      const refererUrl = `https://jkt48.com/member/detail?member=${slugName}-${memberId}&type=`;

      try {
        const offRes = await customRequest(
          `https://jkt48.com/api/v1/members/${memberId}?lang=id`,
          {
            headers: {
              Referer: refererUrl,
              Origin: "https://jkt48.com",
              Accept: "application/json, text/plain, */*",
              "User-Agent": "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
              "Sec-Fetch-Site": "same-origin",
              "Sec-Fetch-Mode": "cors",
              "Sec-Fetch-Dest": "empty",
            },
            timeout: 8000,
          }
        );
        if (offRes?.data?.data) {
          officialDetail = offRes.data.data;
        }
      } catch (_) {}
    }

    // 3. Jika API jkt48.com terblokir Cloudflare di server IP, ambil detail lengkap dari backup mirror
    let backupDetail = null;
    if (!officialDetail) {
      try {
        const mirrorRes = await customRequest(
          "https://api.crstlnz.my.id/api/member?group=jkt48",
          { timeout: 5000 }
        );
        const list = mirrorRes?.data;
        if (Array.isArray(list)) {
          backupDetail = list.find(
            (m) =>
              String(m.jkt48_id) === String(memberId) ||
              m.name?.toLowerCase() === match.name?.toLowerCase() ||
              m.nicknames?.some((n) => n.toLowerCase() === match.nickname?.toLowerCase())
          );
        }
      } catch (_) {}
    }

    // Format profil resmi JKT48
    const name = officialDetail?.name || backupDetail?.name || match.name || "-";
    const nickname = officialDetail?.nickname || backupDetail?.nicknames?.join(", ") || match.nickname || "-";
    const type = officialDetail?.type || backupDetail?.team?.toUpperCase() || match.type || "-";
    const generation = backupDetail?.generation ? backupDetail.generation.replace("-jkt48", "").toUpperCase() : "-";
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
    let instagram = officialDetail?.instagram_account ? `@${officialDetail.instagram_account}` : "-";
    let twitter = officialDetail?.twitter_account ? `@${officialDetail.twitter_account}` : "-";
    let tiktok = officialDetail?.tiktok_account ? `@${officialDetail.tiktok_account}` : "-";
    let idnLive = backupDetail?.idn_username ? `@${backupDetail.idn_username}` : "-";

    if (backupDetail?.socials && Array.isArray(backupDetail.socials)) {
      for (const s of backupDetail.socials) {
        if (s.title?.toLowerCase() === "instagram" && instagram === "-") {
          instagram = s.url.replace(/https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "");
        } else if (s.title?.toLowerCase() === "twitter" && twitter === "-") {
          twitter = s.url.replace(/https?:\/\/(www\.)?(twitter|x)\.com\//, "@").replace(/\/$/, "");
        } else if (s.title?.toLowerCase() === "tiktok" && tiktok === "-") {
          tiktok = s.url.replace(/https?:\/\/(www\.)?tiktok\.com\/@?/, "@").replace(/\/$/, "");
        }
      }
    }

    const captionText =
      `🎤 *PROFIL RESMI MEMBER JKT48*\n\n` +
      `• *Nama Lengkap:* ${name}\n` +
      `• *Panggilan:* ${nickname}\n` +
      `• *Tim / Tipe:* ${type}\n` +
      (generation !== "-" ? `• *Generasi:* ${generation}\n` : "") +
      (birthPlace ? `• *Tempat Lahir:* ${birthPlace}\n` : "") +
      (birthDate !== "-" ? `• *Tanggal Lahir:* ${birthDate}\n` : "") +
      (bloodType !== "-" ? `• *Golongan Darah:* ${bloodType}\n` : "") +
      (height !== "-" ? `• *Tinggi Badan:* ${height}\n` : "") +
      (horoscope !== "-" ? `• *Horoskop:* ${horoscope}\n` : "") +
      `\n📱 *Media Sosial Resmi:*\n` +
      `• *Instagram:* ${instagram}\n` +
      `• *Twitter / X:* ${twitter}\n` +
      `• *TikTok:* ${tiktok}\n` +
      (idnLive !== "-" ? `• *IDN Live:* ${idnLive}\n` : "") +
      `\n*ID Member:* ${memberId}\n\n` +
      `⚡ _Official JKT48 Engine_`;

    const photoUrl =
      officialDetail?.photo_1 ||
      officialDetail?.photo_2 ||
      backupDetail?.img_alt ||
      backupDetail?.img ||
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
