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

  return { type: "code", code: args.join(" ").trim() };
}

export default {
  "name": "jkt48theater",
  "aliases": ["jkttheater","showtheater","jadwalteater"],
  "description": "Jadwal pertunjukan teater mingguan JKT48 beserta link tiket live streaming & teater",
  "usage": "",
  "premiumOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      await reply("Memuat jadwal pertunjukan teater JKT48 minggu ini...");

      try {
        const schedules = await getShowroomSchedules(true);

        if (!Array.isArray(schedules) || schedules.length === 0) {
          return await reply("Tidak ada pertunjukan teater mingguan yang terdaftar saat ini.");
        }

        const lines = [
          `*JADWAL TEATER JKT48 MINGGU INI*`,
          `_Sumber: Live Theater & Showroom API_`,
          ``,
        ];

        for (const item of schedules) {
          const showDateStr = item.showDate ? formatDate(item.showDate.split("T")[0]) : "-";
          const time = item.showTime ? `pukul *${item.showTime} WIB*` : "";
          const setlistName = item.setlist?.name || "Pertunjukan Teater";

          let specialTag = "";
          if (item.isBirthdayShow && item.birthdayMember?.name) {
            specialTag = ` 🎂 *Birthday Show ${item.birthdayMember.name}*`;
          } else if (item.isGraduationShow && item.graduateMember?.name) {
            specialTag = ` 🎓 *Graduation Show ${item.graduateMember.name}*`;
          }

          lines.push(`• *${setlistName}*${specialTag}`);
          lines.push(`  - Tanggal & Waktu: *${showDateStr}* ${time}`.trim());

          if (item.ticketTheater) {
            lines.push(`  - Tiket Teater: ${item.ticketTheater}`);
          }
          if (item.ticketShowroom) {
            lines.push(`  - Live Streaming: ${item.ticketShowroom}`);
          }

          if (Array.isArray(item.memberList) && item.memberList.length > 0) {
            const memberNames = item.memberList.map((m) => m.stage_name || m.name).join(", ");
            lines.push(`  - Member Lineup: ${memberNames}`);
          }
          lines.push(``);
        }

        lines.push(`Ketik \`${prefix}jktschedule\` untuk memeriksa jadwal di kalender resmi situs web JKT48.`);

        const caption = lines.join("\n").trim();
        const firstWithImage = schedules.find((s) => s.setlist?.image);

        if (firstWithImage?.setlist?.image) {
          try {
            const img = await fetchBuffer(firstWithImage.setlist.image, { redirect: "follow" });
            return await sock.sendMessage(
              msg.key.remoteJid,
              { image: img, caption },
              { quoted: msg }
            );
          } catch (_) {}
        }

        await reply(caption);
      } catch (err) {
        console.error("[JKT48 Theater Error]", err.message);
        await reply(`Gagal memuat jadwal teater mingguan: ${err.message}`);
      }
    },
};
