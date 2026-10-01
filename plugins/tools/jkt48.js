// plugins/tools/jkt48.js — mandiri: 1 file = 1 perintah (helper digabung langsung).
import {
  getJkt48Members,
  getJkt48MemberDetail,
  getJkt48News,
  getJkt48Schedules,
  getJkt48ScheduleDetail,
  getShowroomLeaderboard,
  getShowroomSchedules,
} from "@/src/services/jkt48.js";
import { fetchBuffer } from "@/src/services/scrape.js";

const JKT48_BASE = "https://jkt48.com";

const MONTH_NAMES = {
  januari: 1, jan: 1, january: 1,
  februari: 2, feb: 2, february: 2,
  maret: 3, mar: 3, march: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  agustus: 8, agu: 8, agt: 8, august: 8,
  september: 9, sep: 9,
  oktober: 10, okt: 10, october: 10,
  november: 11, nov: 11,
  desember: 12, des: 12, december: 12,
};

function formatDate(dateStr) {
  if (!dateStr) return "tanggal belum ditentukan";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch (_) {
    return dateStr;
  }
}

function formatPrice(num) {
  if (!num) return "belum ditentukan";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

function parseUserQuery(args, now = new Date()) {
  const raw = args.join(" ").trim().toLowerCase();
  if (!raw) {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  if (raw === "hari ini" || raw === "today") {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  if (raw === "besok" || raw === "tomorrow") {
    const tmrw = new Date(now.getTime() + 86400000);
    const y = tmrw.getFullYear();
    const m = tmrw.getMonth() + 1;
    const d = tmrw.getDate();
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  // Format: YYYY-MM-DD
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  // Format: DD-MM-YYYY atau DD/MM/YYYY
  match = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (match) {
    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const y = parseInt(match[3], 10);
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  // Format: "4 September 2026" atau "4 September"
  match = raw.match(/^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?$/);
  if (match && MONTH_NAMES[match[2]]) {
    const d = parseInt(match[1], 10);
    const m = MONTH_NAMES[match[2]];
    const y = match[3] ? parseInt(match[3], 10) : now.getFullYear();
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  // Format: Angka hari dalam bulan ini (misal "4" atau "15")
  if (/^\d{1,2}$/.test(raw)) {
    const d = parseInt(raw, 10);
    if (d >= 1 && d <= 31) {
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      return {
        type: "date",
        dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        year: y,
        month: m,
        day: d,
      };
    }
  }

  // Jika bukan tanggal, dianggap sebagai kode show atau slug
  return { type: "code", code: args.join(" ").trim() };
}

export default {
  "name": "jkt48",
  "aliases": ["memberjkt","jkt","jktmember"],
  "description": "Informasi profil dan daftar member resmi JKT48",
  "usage": "<nama/id member>",
  "premiumOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const query = args.join(" ").trim();

      if (!query) {
        await reply("📋 Memuat daftar member JKT48...");
        try {
          const members = await getJkt48Members();
          if (!Array.isArray(members) || members.length === 0) {
            return reply("❌ Data member tidak ditemukan.");
          }

          let text = `👥 *DAFTAR MEMBER JKT48 (${members.length} Member)*\n`;
          text += `─────────────────────────\n`;

          members.slice(0, 20).forEach((m, idx) => {
            text += `${idx + 1}. *${m.name}* (ID: ${m.id || "-"})\n`;
          });

          if (members.length > 20) {
            text += `_... dan ${members.length - 20} member lainnya._\n`;
          }

          text += `─────────────────────────\n`;
          text += `💡 *Cara Pilih Member:*\n`;
          text += `Ketik: *${prefix}jkt48 <nama / ID>*\n`;
          text += `_Contoh: *${prefix}jkt48 ${members[0]?.name || "Freya"}*_`;

          await reply(text.trim());
        } catch (err) {
          await reply(`❌ Gagal memuat daftar member: ${err.message}`);
        }
        return;
      }

      await reply(`Mencari data member "${query}" langsung dari web resmi JKT48...`);
      try {
        const info = await getJkt48MemberDetail(query);
        const birthDateStr =
          info.birthDate && !isNaN(new Date(info.birthDate))
            ? new Date(info.birthDate).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
            : null;

        const igHandle = info.instagram
          ? info.instagram.replace(/.*instagram\.com\/?/, "").replace(/\//g, "")
          : null;
        const twHandle = info.twitter
          ? info.twitter.replace(/.*x\.com\/?|.*twitter\.com\/?/, "").replace(/\//g, "")
          : null;
        const ttHandle = info.tiktok
          ? info.tiktok.replace(/.*tiktok\.com\/?@?/, "").replace(/\//g, "")
          : null;

        const socials = [];
        if (igHandle) socials.push(`Instagram @${igHandle}`);
        if (twHandle) socials.push(`Twitter @${twHandle}`);
        if (ttHandle) socials.push(`TikTok @${ttHandle}`);

        let socialJoin = "";
        if (socials.length === 1) socialJoin = socials[0];
        else if (socials.length === 2) socialJoin = `${socials[0]} dan ${socials[1]}`;
        else if (socials.length > 2)
          socialJoin = `${socials.slice(0, -1).join(", ")}, serta ${socials[socials.length - 1]}`;

        const socialText = socialJoin
          ? ` Penggemar dapat mengikuti aktivitas kesehariannya melalui media sosial resminya di ${socialJoin}.`
          : "";

        const fan = info.fandom;
        const realName = fan?.realName || info.name;
        const nickName = info.nickname || info.name;
        const teamDesc = info.type ? `Tim ${info.type}` : "Member Aktif";
        const genText = fan?.generation || "-";
        const hometown = fan?.hometown || info.birthPlace || "-";
        const birthDate = birthDateStr || "-";
        const blood = info.bloodType && info.bloodType !== "-" ? info.bloodType : "-";
        const height = info.height && info.height !== "-" ? info.height : "-";
        const zodiac = info.horoscope && info.horoscope !== "-" ? info.horoscope : "-";
        const catchphrase = fan?.catchphrase ? `"${fan.catchphrase}"` : "-";

        const lines = [
          `*Profil Member JKT48*`,
          ``,
          `• Nama Lengkap: *${realName}*`,
          `• Nama Panggilan: *${nickName}*`,
          `• Tim & Generasi: *${teamDesc}* (${genText})`,
          `• Tempat, Tanggal Lahir: *${hometown}*, *${birthDate}*`,
          `• Golongan Darah: *${blood}*`,
          `• Tinggi Badan: *${height}*`,
          `• Zodiak: *${zodiac}*`,
          `• Jikoshoukai / Catchphrase: ${catchphrase}`,
        ];

        if (fan?.trivia && fan.trivia.length > 0) {
          lines.push(`• Fakta Menarik:`);
          for (const item of fan.trivia) {
            lines.push(`  - ${item.replace(/\.+$/, "")}`);
          }
        }

        if (socials.length > 0) {
          lines.push(`• Media Sosial: *${socials.join(" | ")}*`);
        }

        if (fan?.wikiImageUrl) {
          lines.push(`• Foto Fandom: ${fan.wikiImageUrl}`);
        }

        const caption = lines.join("\n");

        // Gambar embed hanya dari situs resmi JKT48
        let photoUrl = info.photo;
        if (photoUrl && !photoUrl.startsWith("http")) {
          photoUrl = `${JKT48_BASE}${photoUrl.startsWith("/") ? "" : "/"}${photoUrl}`;
        }

        if (photoUrl) {
          try {
            const img = await fetchBuffer(photoUrl, { redirect: "follow" });
            return await sock.sendMessage(
              msg.key.remoteJid,
              { image: img, caption },
              { quoted: msg }
            );
          } catch (_) {}
        }

        await reply(caption);
      } catch (err) {
        await reply(`Gagal memuat profil member: ${err.message}`);
      }
    },
};
