// plugins/tools/jkt48news.js — mandiri: 1 file = 1 perintah (helper digabung langsung).
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
  "name": "jkt48news",
  "aliases": ["jktnews","beritajkt48"],
  "description": "Rangkuman berita dan pengumuman resmi terbaru JKT48",
  "usage": "[jumlah berita]",
  "premiumOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      await reply("📰 Memuat pengumuman terbaru JKT48...");

      const limit = parseInt(args[0], 10) || 5;

      try {
        const newsList = await getJkt48News(limit);
        if (!Array.isArray(newsList) || newsList.length === 0) {
          return reply("❌ Tidak ada pengumuman berita JKT48 saat ini.");
        }

        let text = `📢 *PENGUMUMAN RESMI TERBARU JKT48*\n`;
        text += `─────────────────────────\n`;

        newsList.forEach((item, idx) => {
          const tgl = formatDate(item.valid_date_from);
          const cat = item.category ? `[${item.category}]` : "";
          const url = item.link ? `${JKT48_BASE}/news/${item.link}` : "-";
          text += `*${idx + 1}. ${cat} ${item.title}*\n`;
          text += `   _🕒 Tanggal: ${tgl}_\n`;
          text += `   🔗 Link: ${url}\n\n`;
        });

        text += `─────────────────────────\n`;
        text += `💡 _Ketik \`.jkt48news <jumlah>\` untuk menampilkan lebih banyak berita._`;

        await reply(text.trim());
      } catch (err) {
        console.error("[JKT48 News Error]", err.message);
        await reply(`❌ Gagal mengambil berita JKT48: ${err.message}`);
      }
    },
};
