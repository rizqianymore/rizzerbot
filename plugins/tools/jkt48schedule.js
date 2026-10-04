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
  "name": "jkt48schedule",
  "aliases": ["jktschedule","jadwaljkt48","jktjadwal","jkt48show"],
  "description": "Jadwal dan rincian show theater resmi JKT48 dengan pemilihan tanggal spesifik",
  "usage": "[tanggal/kode show]",
  "premiumOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();

      const parsed = parseUserQuery(args);

      if (parsed.type === "code") {
        await reply(`Mencari rincian pertunjukan "${parsed.code}"...`);

        try {
          const detail = await getJkt48ScheduleDetail(parsed.code);
          const team = detail.jkt48_member_type ? `oleh *Tim ${detail.jkt48_member_type}*` : "oleh JKT48";
          const price = formatPrice(detail.default_price);
          const showDate = formatDate(detail.date);
          const showTime =
            detail.start_time && detail.end_time
              ? `*${detail.start_time.slice(0, 5)} hingga ${detail.end_time.slice(0, 5)} WIB*`
              : "waktu belum ditentukan";
          const openGate = detail.reception_start_time
            ? `dengan waktu open gate mulai *${detail.reception_start_time.slice(0, 5)} WIB*`
            : "";

          const memberNames =
            Array.isArray(detail.jkt48_member) && detail.jkt48_member.length > 0
              ? `Pertunjukan ini menampilkan *${detail.jkt48_member.length} member* yaitu ${detail.jkt48_member.map((m) => m.name).join(", ")}.`
              : "Daftar member penampil akan diumumkan kemudian.";

          const salesSummary =
            Array.isArray(detail.sales_period) && detail.sales_period.length > 0
              ? `Penjualan tiket dibuka untuk ` +
              detail.sales_period
                .map(
                  (s) =>
                    `*${s.label}* (${formatDate(s.start_date)} sampai ${formatDate(s.end_date)}, metode ${s.sales_method || "langsung"})`
                )
                .join(", ") +
              "."
              : "";

          const lines = [
            `*${detail.title}* (${detail.code || parsed.code})`,
            ``,
            `• Tim: ${detail.jkt48_member_type ? `Tim ${detail.jkt48_member_type}` : "JKT48"}`,
            `• Tanggal: ${showDate}`,
            `• Waktu: ${showTime} ${openGate}`.trim(),
            `• Harga Tiket: ${price}`,
            ``,
            `• Member (${detail.jkt48_member?.length || 0}): ${detail.jkt48_member?.map((m) => m.name).join(", ") || "Belum diumumkan"}`,
          ];

          if (salesSummary) {
            lines.push(``, `• Penjualan: ${salesSummary}`);
          }

          lines.push(``, `🔗 ${JKT48_BASE}/schedule/${detail.link || parsed.code}`);

          const text = lines.join("\n");

          return await reply(text);
        } catch (err) {
          console.error("[JKT48 Show Detail Error]", err.message);
          return await reply(`Gagal memuat rincian pertunjukan: ${err.message}`);
        }
      }

      const targetDateStr = parsed.dateStr;
      const formattedTargetDate = formatDate(targetDateStr);

      await reply(`Memeriksa jadwal pertunjukan JKT48 untuk tanggal ${formattedTargetDate}...`);

      try {
        const { schedules } = await getJkt48Schedules(parsed.month, parsed.year);

        if (!Array.isArray(schedules) || schedules.length === 0) {
          return reply(
            `Tidak ditemukan data jadwal pertunjukan JKT48 untuk periode ${parsed.month}/${parsed.year}.`
          );
        }

        const exactShows = schedules.filter((s) => s.date === targetDateStr);

        if (exactShows.length > 0) {
          let text = `🎭 *JADWAL TEATER JKT48 (${formattedTargetDate})*\n\n`;

          exactShows.forEach((s, idx) => {
            const team = s.jkt48_member_type ? `[Tim ${s.jkt48_member_type}]` : "";
            const time =
              s.start_time && s.end_time
                ? `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)} WIB`
                : "Waktu menyesuaikan";
            const code = s.reference_code || s.link;
            text += `*${idx + 1}. ${s.title}* ${team}\n`;
            text += `   _🕒 Waktu: ${time}_\n`;
            text += `   🎫 Kode Show: *${code}*\n`;
            text += `   🔗 Link: ${JKT48_BASE}/schedule/${s.link}\n\n`;
          });

          text += `💡 *Ketik:* \`${prefix}jktschedule <kode show>\` untuk melihat line-up member penampil.`;

          return await reply(text.trim());
        }

        const targetTime = new Date(targetDateStr).getTime();
        const sortedAlternatives = [...schedules].sort((a, b) => {
          const diffA = Math.abs(new Date(a.date).getTime() - targetTime);
          const diffB = Math.abs(new Date(b.date).getTime() - targetTime);
          return diffA - diffB;
        });

        const topAlternatives = sortedAlternatives.slice(0, 5);

        let text = `ℹ️ Tidak ada show pada tanggal *${formattedTargetDate}*.\n\n`;
        text += `🎭 *5 PILIHAN SHOW TERDEKAT:*\n\n`;

        topAlternatives.forEach((s, idx) => {
          const tgl = formatDate(s.date);
          const team = s.jkt48_member_type ? `[Tim ${s.jkt48_member_type}]` : "";
          const time = s.start_time ? `${s.start_time.slice(0, 5)} WIB` : "";
          const code = s.reference_code || s.link;
          text += `*${idx + 1}. ${s.title}* ${team}\n`;
          text += `   _📅 Tanggal: ${tgl} ${time}_\n`;
          text += `   🎫 Kode Show: *${code}*\n`;
          text += `   🔗 Link: ${JKT48_BASE}/schedule/${s.link}\n\n`;
        });

        text += `💡 *Ketik:* \`${prefix}jktschedule <kode show>\` untuk memilih dan melihat rincian member.`;

        await reply(text.trim());
      } catch (err) {
        console.error("[JKT48 Schedule Error]", err.message);
        await reply(`Gagal memuat jadwal pertunjukan JKT48: ${err.message}`);
      }
    },
};
