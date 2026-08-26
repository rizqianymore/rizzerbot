import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchJson, customRequest } from "../../src/utils/scraping.js";

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
  description: "Menampilkan informasi profil member JKT48 lengkap.",
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

    let officialDetail = null;
    let crstlnzDetail = null;

    // 2. Jika ada match member ID, coba fetch detail dari official JKT48 API
    const memberId = match?.jkt48_member_id;
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
            timeout: 5000,
          }
        );
        if (offRes?.data?.data) {
          officialDetail = offRes.data.data;
        }
      } catch (_) {}
    }

    // 3. Coba fetch dari CRSTLN API sebagai fallback / pelengkap data
    try {
      const crstlnzListRes = await fetchJson(
        "https://api.crstlnz.my.id/api/member?group=jkt48",
        { timeout: 5000 }
      );
      const list = crstlnzListRes?.data;
      if (Array.isArray(list)) {
        crstlnzDetail = list.find(
          (m) =>
            m.name?.toLowerCase().includes(query.toLowerCase()) ||
            m.nicknames?.some((n) => n.toLowerCase().includes(query.toLowerCase())) ||
            m.url?.toLowerCase().includes(query.toLowerCase())
        );

        if (!match && crstlnzDetail) {
          match = {
            name: crstlnzDetail.name,
            nickname: crstlnzDetail.nicknames?.[0] || crstlnzDetail.name,
            type: crstlnzDetail.team ? crstlnzDetail.team.toUpperCase() : (crstlnzDetail.generation || "MEMBER"),
            photo: crstlnzDetail.img || crstlnzDetail.img_alt,
            jkt48_member_id: crstlnzDetail.jkt48_id,
          };
        }
      }
    } catch (_) {}

    // Jika tidak ditemukan di manapun
    if (!match && !officialDetail && !crstlnzDetail) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ Member dengan kata kunci *"${query}"* tidak ditemukan di database JKT48.`,
        },
        { quoted: msg }
      );
      return;
    }

    // Ekstrak data field gabungan
    const name = officialDetail?.name || crstlnzDetail?.name || match?.name || "-";
    const nickname = officialDetail?.nickname || crstlnzDetail?.nicknames?.join(", ") || match?.nickname || "-";
    const type = officialDetail?.type || crstlnzDetail?.team?.toUpperCase() || match?.type || "-";
    const generation = crstlnzDetail?.generation ? crstlnzDetail.generation.replace("-jkt48", "").toUpperCase() : "-";
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

    // Media sosial
    const twitter = officialDetail?.twitter_account ? `@${officialDetail.twitter_account}` : "-";
    const instagram = officialDetail?.instagram_account ? `@${officialDetail.instagram_account}` : "-";
    const tiktok = officialDetail?.tiktok_account ? `@${officialDetail.tiktok_account}` : "-";
    const idnLive = crstlnzDetail?.idn_username ? `@${crstlnzDetail.idn_username}` : "-";

    const captionText =
      `🎤 *PROFIL MEMBER JKT48*\n\n` +
      `• *Nama Lengkap:* ${name}\n` +
      `• *Panggilan:* ${nickname}\n` +
      `• *Tim / Tipe:* ${type}\n` +
      `• *Generasi:* ${generation}\n` +
      (birthPlace ? `• *Tempat Lahir:* ${birthPlace}\n` : "") +
      `• *Tanggal Lahir:* ${birthDate}\n` +
      `• *Golongan Darah:* ${bloodType}\n` +
      `• *Tinggi Badan:* ${height}\n` +
      `• *Horoskop:* ${horoscope}\n\n` +
      `📱 *Media Sosial:*\n` +
      `• *Instagram:* ${instagram}\n` +
      `• *Twitter / X:* ${twitter}\n` +
      `• *TikTok:* ${tiktok}\n` +
      `• *IDN Live:* ${idnLive}\n\n` +
      `*ID Member:* ${memberId || match?.jkt48_member_id || "-"}\n\n` +
      `⚡ _Kyros-MD JKT48 Engine_`;

    const photoUrl =
      officialDetail?.photo_1 ||
      officialDetail?.photo_2 ||
      crstlnzDetail?.img_alt ||
      crstlnzDetail?.img ||
      match?.photo;

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
