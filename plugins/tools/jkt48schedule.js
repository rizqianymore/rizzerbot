import { getJkt48Schedules, getJkt48ScheduleDetail } from "@/src/services/hiburan/jkt48.js";

import { formatDate, formatPrice } from "@/src/services/hiburan/jkt48/format.js";
import { parseUserQuery } from "@/src/services/hiburan/jkt48/query.js";

const JKT48_BASE = "https://jkt48.com";

export default {
  name: "jkt48schedule",
  aliases: ["jktschedule", "jadwaljkt48", "jktjadwal", "jkt48show"],
  description: "Jadwal dan rincian show theater resmi JKT48 dengan pemilihan tanggal spesifik",
  usage: "[tanggal/kode show]",
  premiumOnly: true,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();

    const parsed = parseUserQuery(args);

    if (parsed.type === "code") {
      await reply(`Mencari rincian pertunjukan "${parsed.code}"...`);

      try {
        const detail = await getJkt48ScheduleDetail(parsed.code);
        const _team = detail.jkt48_member_type ? `oleh *Tim ${detail.jkt48_member_type}*` : "oleh JKT48";
        const price = formatPrice(detail.default_price);
        const showDate = formatDate(detail.date);
        const showTime =
          detail.start_time && detail.end_time
            ? `*${detail.start_time.slice(0, 5)} hingga ${detail.end_time.slice(0, 5)} WIB*`
            : "waktu belum ditentukan";
        const openGate = detail.reception_start_time
          ? `dengan waktu open gate mulai *${detail.reception_start_time.slice(0, 5)} WIB*`
          : "";

        const _memberNames =
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

        lines.push(``, `${JKT48_BASE}/schedule/${detail.link || parsed.code}`);

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
        return reply(`Tidak ditemukan data jadwal pertunjukan JKT48 untuk periode ${parsed.month}/${parsed.year}.`);
      }

      const exactShows = schedules.filter((s) => s.date === targetDateStr);

      if (exactShows.length > 0) {
        let text = `*JADWAL TEATER JKT48 (${formattedTargetDate})*\n\n`;

        exactShows.forEach((s, idx) => {
          const team = s.jkt48_member_type ? `[Tim ${s.jkt48_member_type}]` : "";
          const time =
            s.start_time && s.end_time
              ? `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)} WIB`
              : "Waktu menyesuaikan";
          const code = s.reference_code || s.link;
          text += `*${idx + 1}. ${s.title}* ${team}\n`;
          text += `   _Waktu: ${time}_\n`;
          text += `   Kode Show: *${code}*\n`;
          text += `   Link: ${JKT48_BASE}/schedule/${s.link}\n\n`;
        });

        text += `*Ketik:* \`${prefix}jktschedule <kode show>\` untuk melihat line-up member penampil.`;

        return await reply(text.trim());
      }

      const targetTime = new Date(targetDateStr).getTime();
      const sortedAlternatives = [...schedules].sort((a, b) => {
        const diffA = Math.abs(new Date(a.date).getTime() - targetTime);
        const diffB = Math.abs(new Date(b.date).getTime() - targetTime);
        return diffA - diffB;
      });

      const topAlternatives = sortedAlternatives.slice(0, 5);

      let text = `Tidak ada show pada tanggal *${formattedTargetDate}*.\n\n`;
      text += `*5 PILIHAN SHOW TERDEKAT:*\n\n`;

      topAlternatives.forEach((s, idx) => {
        const tgl = formatDate(s.date);
        const team = s.jkt48_member_type ? `[Tim ${s.jkt48_member_type}]` : "";
        const time = s.start_time ? `${s.start_time.slice(0, 5)} WIB` : "";
        const code = s.reference_code || s.link;
        text += `*${idx + 1}. ${s.title}* ${team}\n`;
        text += `   _Tanggal: ${tgl} ${time}_\n`;
        text += `   Kode Show: *${code}*\n`;
        text += `   Link: ${JKT48_BASE}/schedule/${s.link}\n\n`;
      });

      text += `*Ketik:* \`${prefix}jktschedule <kode show>\` untuk memilih dan melihat rincian member.`;

      await reply(text.trim());
    } catch (err) {
      console.error("[JKT48 Schedule Error]", err.message);
      await reply(`Gagal memuat jadwal pertunjukan JKT48: ${err.message}`);
    }
  },
};
