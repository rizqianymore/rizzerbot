import { issueStudentToken, normalizeNis } from "@/src/services/telkom/auth.js";
import { getAttendanceStatus, getStatusPath } from "@/src/services/telkom/client.js";

const PRESENSI_URL = "https://presensi.telkomschools.sch.id/siswa/presensi";

function formatWib(date) {
  try {
    return `${date.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;
  } catch (_) {
    return date.toISOString();
  }
}

function prettyJson(value, max = 1500) {
  try {
    return JSON.stringify(value, null, 2).slice(0, max);
  } catch (_) {
    return String(value).slice(0, max);
  }
}

export default {
  name: "telkomschool",
  cooldownMs: 20000,
  aliases: ["telkom", "tsch", "digits", "abstels"],
  description: "Login & cek status presensi Telkom Schools (DigitS) via NIS. Read-only, tanpa spoof.",
  usage: "<nis> [password] | login <nis> [password] | status <nis> [password] | link",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    const currentPrefix = prefix || ".";
    const firstArg = String(args[0] || "").trim();
    if (firstArg.toLowerCase() === "link" || firstArg.toLowerCase() === "presensi") {
      return reply(
        `*PRESENSI TELKOM SCHOOLS*\n\n` +
          `Buka halaman resmi berikut untuk absen (QR + lokasi asli dari perangkatmu):\n` +
          `${PRESENSI_URL}\n\n` +
          `_Bot tidak mengirim presensi palsu / spoof lokasi._`
      );
    }

    const isExplicitLogin = firstArg.toLowerCase() === "login" || firstArg.toLowerCase() === "auth";
    const isExplicitStatus = firstArg.toLowerCase() === "status";

    const nisArg = isExplicitLogin || isExplicitStatus ? args[1] : args[0];
    const passArg = isExplicitLogin || isExplicitStatus ? args[2] : args[1];
    const nis = normalizeNis(nisArg);

    if (!nis) {
      return reply(
        `*TELKOM SCHOOLS (DigitS)*\n\n` +
          `Cukup ketik:\n` +
          `👉 \`${currentPrefix}telkom <nis>\`\n\n` +
          `*Contoh:* \`${currentPrefix}telkom 539241249\`\n\n` +
          `_Bot akan otomatis login & menampilkan status presensi hari ini._`
      );
    }

    if (nis.length < 5) {
      return reply(`NIS tidak valid (minimal 5 digit). Contoh: \`${currentPrefix}telkom 539241249\``);
    }

    await sendTyping();

    try {
      const auth = await issueStudentToken(nis, passArg);
      const claims = auth.claims || {};

      const lines = [
        `*TELKOM SCHOOLS (DigitS)*`,
        `✅ Login berhasil`,
        `NIS: ${nis}`,
        `Student ID: ${claims.sub || "-"}`,
        `Token berlaku s/d: ${formatWib(auth.expiresAt)}`,
      ];

      if (isExplicitLogin) {
        return reply(lines.join("\n"));
      }

      const status = await getAttendanceStatus(auth.token, auth.cookie, nis);

      if (status?.status && Array.isArray(status?.data) && status.data.length > 0) {
        const studentName = status.data[0]?.name || "Siswa";
        lines.push("", `👤 *Nama:* ${studentName}`);
        lines.push(`📋 *Status Presensi Hari Ini:*`);
        for (const item of status.data) {
          const type = item.type || "Presensi";
          const icon = item.status ? "✅" : "⏳";
          const statusText = item.status ? `Hadir (${item.time || "-"})` : "Belum Absen";
          if (item.subject) {
            lines.push(`• *${type}:* ${item.subject}`);
            lines.push(`  Guru: ${item.teacher_name || "-"}`);
            lines.push(`  Jam: ${item.lesson_time || "-"} - ${item.lesson_time_end || "-"}`);
            lines.push(`  Status: ${icon} ${statusText}`);
          } else {
            lines.push(`• *${type}:* ${icon} ${statusText}`);
          }
        }
      } else {
        lines.push("", `*STATUS PRESENSI (Read-only)*`, `\`\`\`${prettyJson(status)}\`\`\``);
      }

      lines.push("", `_Absen tetap dilakukan di aplikasi resmi: ${PRESENSI_URL}_`);
      return reply(lines.join("\n"));
    } catch (err) {
      logger?.warn?.(`[telkomschool] ${err?.message || err}`);
      return reply(`❌ Gagal: ${err?.message || err}`);
    }
  },
};
