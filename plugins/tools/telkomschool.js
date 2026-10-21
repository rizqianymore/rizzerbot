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
    const sub = String(args[0] || "").toLowerCase();

    if (sub === "link" || sub === "presensi") {
      return reply(
        `*PRESENSI TELKOM SCHOOLS*\n\n` +
          `Buka halaman resmi berikut untuk absen (QR + lokasi asli dari perangkatmu):\n` +
          `${PRESENSI_URL}\n\n` +
          `_Bot tidak mengirim presensi palsu / spoof lokasi._`
      );
    }

    const isLogin = sub === "login" || sub === "cek" || sub === "auth";
    const isStatus = sub === "status" || sub === "profil" || sub === "profile";

    const nisArg = isLogin || isStatus ? args[1] : args[0];
    const passArg = isLogin || isStatus ? args[2] : args[1];
    const nis = normalizeNis(nisArg);

    if (!nis) {
      return reply(
        `*TELKOM SCHOOLS (DigitS)*\n\n` +
          `Login dengan NIS. Password otomatis \`dummy@<NIS>\`.\n\n` +
          `*Perintah:*\n` +
          `• \`${currentPrefix}telkom status 539241249\` — cek status presensi (read-only)\n` +
          `• \`${currentPrefix}telkom login 539241249\` — verifikasi login\n` +
          `• \`${currentPrefix}telkom link\` — link presensi resmi\n` +
          `• \`${currentPrefix}telkom 539241249 passwordKhusus\` — password custom\n\n` +
          `_Bot hanya membaca data. Absen tetap lewat aplikasi resmi (QR + GPS asli)._`
      );
    }

    if (nis.length < 5) {
      return reply("NIS tidak valid. Minimal 5 digit angka. Contoh: `.telkom status 539241249`");
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

      if (isLogin) {
        return reply(lines.join("\n"));
      }

      const statusPath = getStatusPath();
      if (!statusPath) {
        lines.push(
          "",
          `⚠️ *Path status presensi belum diset.*`,
          `Capture request **GET** saat membuka halaman presensi (DevTools → Network),`,
          `lalu isi di \`.env\`:`,
          `• \`TELKOM_STATUS_PATH=/telkomschool/student/...\``,
          "",
          `Link presensi resmi: ${PRESENSI_URL}`
        );
        return reply(lines.join("\n"));
      }

      const status = await getAttendanceStatus(auth.token, auth.cookie);
      lines.push("", `*STATUS PRESENSI (Read-only)*`, `\`\`\`${prettyJson(status)}\`\`\``);
      lines.push("", `_Absen tetap dilakukan di aplikasi resmi: ${PRESENSI_URL}_`);
      return reply(lines.join("\n"));
    } catch (err) {
      logger?.warn?.(`[telkomschool] ${err?.message || err}`);
      return reply(`❌ Gagal: ${err?.message || err}`);
    }
  },
};
