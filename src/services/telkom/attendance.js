/**
 * Utilitas waktu (WIB), jendela absen, parsing status presensi, dan format ringkasan.
 *
 * Bentuk payload resmi (GET {presensiRead}/{hash}/{studentId}):
 *   { "status": true,
 *     "data": [ { "type": "QR Datang",  "name": "...", "status": true,  "time": "07:15" },
 *               { "type": "QR Pulang",  "name": "...", "status": false, "time": "00:00" },
 *               { "type": "QR Kelas",   "subject": "Matematika", "teacher_name": "Bu Ani",
 *                 "date": "2026-10-22", "time": "08:00", "status": true } ] }
 */

import { describeDistance } from "./school.js";

const WIB = "Asia/Jakarta";

export const ATTENDANCE_KINDS = ["datang", "pulang"];

const DEFAULT_WINDOWS = {
  datang: "05:30-08:00",
  pulang: "14:30-16:30",
};

const KIND_LABEL = {
  datang: "Datang",
  pulang: "Pulang",
};

const QR_KIND_MAP = {
  "qr datang": "datang",
  "qr pulang": "pulang",
  "qr kelas": "kelas",
  "qr aktivitas": "aktivitas",
  "qr event": "event",
  datang: "datang",
  pulang: "pulang",
  masuk: "datang",
  keluar: "pulang",
};

const PRESENT_WORDS = new Set([
  "true",
  "1",
  "yes",
  "y",
  "hadir",
  "h",
  "tepat waktu",
  "present",
  "sukses",
  "success",
  "ok",
  "tercatat",
]);

const ABSENT_WORDS = new Set(["false", "0", "no", "n", "alpa", "tidak hadir", "belum", "tidak"]);

/** Pecah waktu menjadi bagian WIB (tanggal, jam, menit absolut). */
export function wibParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: WIB,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute) || 0;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    minutes: hour * 60 + minute,
    weekday: parts.weekday,
  };
}

/** Tanggal hari ini versi WIB (YYYY-MM-DD). */
export function wibDate(date = new Date()) {
  return wibParts(date).date;
}

/** Parse "HH:MM-HH:MM" menjadi menit absolut. */
export function parseWindow(raw) {
  const value = String(raw || "").trim();
  const match = value.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const startHour = Number(match[1]);
  const startMin = Number(match[2]);
  const endHour = Number(match[3]);
  const endMin = Number(match[4]);
  if (startHour > 23 || endHour > 23 || startMin > 59 || endMin > 59) return null;
  const start = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;
  if (end <= start) return null;
  return {
    start,
    end,
    label: value,
    startLabel: `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`,
    endLabel: `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`,
  };
}

/** Jendela absen resmi (WIB). Bisa dioverride lewat env bila kebijakan sekolah berubah. */
export function attendanceWindows() {
  const datang = parseWindow(process.env.TELKOM_WINDOW_DATANG || DEFAULT_WINDOWS.datang);
  const pulang = parseWindow(process.env.TELKOM_WINDOW_PULANG || DEFAULT_WINDOWS.pulang);
  return { datang, pulang };
}

/**
 * Cek apakah sekarang berada di dalam jendela absen resmi.
 * @returns {{type:string, allowed:boolean, window:string|null, currentTime:string, reason:string|null}}
 */
export function checkWindow(type, date = new Date()) {
  const kind = String(type || "").toLowerCase();
  const window = attendanceWindows()[kind] || null;
  const { time, minutes } = wibParts(date);

  if (!window) {
    return { type: kind, allowed: false, window: null, currentTime: time, reason: "no_window" };
  }

  const allowed = minutes >= window.start && minutes <= window.end;
  return {
    type: kind,
    allowed,
    window: window.label,
    currentTime: time,
    reason: allowed ? null : "outside_window",
  };
}

/** Normalisasi status(absen) dari server (bool / string / angka). */
export function isPresentValue(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === "number") return value > 0;
  const text = String(value).trim().toLowerCase();
  if (!text) return false;
  if (PRESENT_WORDS.has(text)) return true;
  if (ABSENT_WORDS.has(text)) return false;
  return false;
}

/** Ambil array entri dari berbagai bentuk payload. */
function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === "object" && Array.isArray(payload.data.data)) {
    return payload.data.data;
  }
  if (Array.isArray(payload.attendance)) return payload.attendance;
  if (Array.isArray(payload.attendances)) return payload.attendances;
  return [];
}

/** Normalisasi payload status presensi menjadi struktur yang enak dibaca. */
export function parseAttendanceStatus(payload) {
  const list = extractList(payload);
  const entries = [];
  let studentName = "";

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    if (!studentName && item.name && !QR_KIND_MAP[String(item.type || "").toLowerCase()]) {
      studentName = String(item.name);
    }

    const rawType = String(item.type || "presensi");
    const kind = QR_KIND_MAP[rawType.toLowerCase()] || rawType.toLowerCase();
    const time = String(item.time || "");

    entries.push({
      rawType,
      type: kind,
      label: String(item.name || ""),
      subject: String(item.subject || item.mapel || item.school_subject_name || ""),
      teacher: String(item.teacher_name || item.teacher || item.lemdik_name || ""),
      date: String(item.date || ""),
      time,
      lessonStart: String(item.lesson_time || item.start_time || ""),
      lessonEnd: String(item.lesson_time_end || item.end_time || ""),
      present: isPresentValue(item.status) && !/^0?0:0?0$/.test(time),
      raw: item,
    });
  }

  const apiOk = payload && typeof payload === "object" && payload.status !== undefined ? Boolean(payload.status) : true;

  return { studentName, entries, ok: apiOk, empty: entries.length === 0 };
}

/** Cari entri presensi berdasarkan jenis (datang/pulang). */
export function findEntry(entries, kind) {
  const target = String(kind || "").toLowerCase();
  if (!Array.isArray(entries)) return null;
  const exact = entries.find((entry) => entry.type === target);
  if (exact) return exact;
  return (
    entries.find((entry) =>
      String(entry.rawType || "")
        .toLowerCase()
        .includes(target)
    ) ||
    entries.find((entry) =>
      String(entry.label || "")
        .toLowerCase()
        .includes(target)
    ) ||
    null
  );
}

/** True bila jenis presensi (datang/pulang) sudah tercatat hari ini. */
export function isRecorded(entries, kind) {
  const entry = findEntry(entries, kind);
  return Boolean(entry && entry.present);
}

/**
 * Ambil payload QR (isi kode yang dipindai) dari entri presensi bila tersedia.
 * Mengembalikan null bila server tidak mengirim kode QR.
 */
export function extractQrPayload(parsed, kind) {
  const entry = findEntry(parsed?.entries || [], kind);
  const source = entry?.raw || null;
  if (!source || typeof source !== "object") return null;

  const qrType = source.type || null;
  const candidates = ["qr", "qrcode", "qr_code", "code", "kode", "token", "kode_qr", "value", "data"];
  const payload = { ...source };
  let found = false;
  for (const key of candidates) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") {
      found = true;
      break;
    }
  }
  if (!found) return null;
  if (qrType) payload.type = qrType;
  return payload;
}

function formatClock(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  const match = text.match(/(\d{1,2}):(\d{2})/);
  return match ? `${String(match[1]).padStart(2, "0")}:${match[2]}` : text;
}

/**
 * Ringkasan presensi untuk chat, contoh:
 * "✅ Presensi hari ini: Datang 06:45, Pulang 15:10. Mapel: Matematika (Bu Ani)."
 */
export function formatAttendanceSummary({
  studentName = "",
  parsed = {},
  submit = null,
  now = new Date(),
  title = "*PRESENSI HARI INI*",
  school = "",
  schoolUrl = "",
} = {}) {
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const lines = [title];

  if (studentName) lines.push(`👤 Nama: ${studentName}`);

  const datang = findEntry(entries, "datang");
  const pulang = findEntry(entries, "pulang");
  lines.push(
    `🕒 Datang: ${datang?.present ? formatClock(datang.time) : "belum absen"}` +
      (datang?.present && datang.lessonStart ? ` (jadwal ${formatClock(datang.lessonStart)})` : "")
  );
  lines.push(
    `🕓 Pulang: ${pulang?.present ? formatClock(pulang.time) : "belum absen"}` +
      (pulang?.present && pulang.lessonStart ? ` (jadwal ${formatClock(pulang.lessonStart)})` : "")
  );

  const mapel = entries.filter((entry) => entry.subject);
  if (mapel.length > 0) {
    const list = mapel
      .map((entry) => {
        const teacher = entry.teacher ? ` (${entry.teacher})` : "";
        const icon = entry.present ? "✅" : "⏳";
        return `${entry.subject}${teacher} ${icon}`;
      })
      .join(", ");
    lines.push(`📚 Mapel: ${list}`);
  } else {
    const plain = entries.filter((entry) => entry.type === "kelas" || entry.type === "aktivitas");
    if (plain.length > 0) {
      const list = plain
        .map((entry) => {
          const name = entry.subject || entry.label || entry.rawType;
          return `${name}${entry.present ? " ✅" : " ⏳"}`;
        })
        .join(", ");
      lines.push(`📚 Aktivitas: ${list}`);
    }
  }

  lines.push("", describeSubmit(submit, now));

  const distance = describeDistance(submit?.distance);
  if (distance) lines.push(`📍 Kamu ${distance}${school ? ` · ${school}` : ""}`);
  if (schoolUrl) lines.push(`🗺️ ${schoolUrl}`);

  return lines.join("\n");
}

/** Petakan pesan error server ke arahan yang jelas untuk siswa. */
export function explainServerMessage(message) {
  const text = String(message || "").toLowerCase();
  if (!text) return "";
  if (text.includes("jarak") || text.includes("jauh") || text.includes("radius") || text.includes("lokasi")) {
    return "Lokasimu terlalu jauh dari sekolah. Pastikan GPS akurat & kamu ada di area sekolah, lalu share lokasi ulang.";
  }
  if (
    text.includes("qr") &&
    (text.includes("tidak valid") || text.includes("invalid") || text.includes("kedaluwarsa"))
  ) {
    return "QR guru tidak valid/expired. Minta guru generate QR baru (`.absensi datang`), lalu kirim ulang fotonya.";
  }
  if (text.includes("sudah") && (text.includes("absen") || text.includes("absensi"))) {
    return "Presensi ini sudah tercatat hari ini.";
  }
  if (text.includes("jam") || text.includes("waktu")) {
    return "Di luar jadwal absen. Coba lagi saat jam absen dibuka.";
  }
  if (text.includes("unauthorized") || text.includes("token") || text.includes("login")) {
    return "Sesi login habis. Ulangi perintahnya ya.";
  }
  return "";
}

function describeSubmit(submit, now = new Date()) {
  if (!submit || !submit.attempted) {
    if (submit?.reason === "read_only") return "ℹ️ Mode cek status saja (tanpa submit).";
    if (submit?.reason === "auto_submit_disabled") {
      return "ℹ️ Submit otomatis dinonaktifkan oleh admin. Absen lewat aplikasi resmi.";
    }
    if (submit?.reason === "already_recorded") return "✅ Presensi hari ini sudah tercatat, tidak ada submit ulang.";
    if (submit?.reason === "status_unavailable") return "⚠️ Status presensi tidak terbaca, submit dilewati.";
    if (submit?.reason === "nothing_to_submit") return "ℹ️ Tidak ada presensi yang perlu dikirim.";
    return "ℹ️ Tidak ada perubahan presensi.";
  }

  if (submit.success) {
    const label = KIND_LABEL[submit.kind] || submit.kind;
    const extra = submit.message ? ` — ${submit.message}` : "";
    return `✅ ${label} tercatat (${submit.time || wibParts(now).time} WIB)${extra}`;
  }

  const label = KIND_LABEL[submit.kind] || submit.kind;
  const detail = submit.message ? `\n   ↳ server: ${submit.message}` : "";
  let advice = explainServerMessage(submit.message);
  if (!advice && submit.hadQr === false) {
    advice = "Belum ada QR guru. Kirim foto QR guru ke bot (caption `.telkom <nis>`), lalu Share Location.";
  }
  const adviceLine = advice ? `\n   ↳ ${advice}` : "";
  return `⚠️ Gagal kirim absen ${label} (server menolak).${detail}${adviceLine}`;
}
