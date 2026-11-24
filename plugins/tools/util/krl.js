import fs from "fs";
import path from "path";
import { request } from "@/src/utils/request.js";

const STATIONS_FILE = path.join(process.cwd(), "src", "utils", "krl-stations.json");
let stationsCache = null;

function getStations() {
  if (stationsCache) return stationsCache;
  try {
    if (fs.existsSync(STATIONS_FILE)) {
      stationsCache = JSON.parse(fs.readFileSync(STATIONS_FILE, "utf-8"));
    }
  } catch (_) {}
  return stationsCache || [];
}

function findStation(query) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return null;
  const stations = getStations();

  const byId = stations.find((s) => s.id.toLowerCase() === q);
  if (byId) return byId;

  const byName = stations.find((s) => s.name.toLowerCase() === q);
  if (byName) return byName;

  const byPartial = stations.find((s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q));
  return byPartial || null;
}

async function fetchKrlSchedule(stationId) {
  try {
    const url = `https://rutekrl.com/api/schedules?stationId=${encodeURIComponent(stationId)}&from=00:00&to=24:00`;
    const json = await request.get(url, {
      responseType: "json",
      timeout: 15000,
      retries: 2,
      headers: {
        Referer: "https://rutekrl.com/jadwal",
      },
    });
    return Array.isArray(json?.data) ? json.data : null;
  } catch {
    return null;
  }
}

export default {
  name: "krl",
  aliases: ["jadwalkrl", "rutekrl", "stasiunkrl", "commuterline"],
  description: "Cek jadwal KRL Commuter Line hari ini & daftar stasiun via rutekrl.com",
  usage: "<nama / kode stasiun> [tujuan opsional]",
  category: "Info",
  cooldownMs: 5000,

  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const p = prefix || ".";
    if (!args[0]) {
      return reply(
        `🚆 *JADWAL KRL COMMUTER LINE (rutekrl.com)*\n\n` +
          `Cek jadwal keberangkatan KRL real-time hari ini se-Jabodetabek & sekitarnya.\n\n` +
          `*Cara Penggunaan:*\n` +
          `• \`${p}krl <nama stasiun>\` : Jadwal KRL dari stasiun asal\n` +
          `• \`${p}krl <stasiun asal> <tujuan>\` : Filter jadwal stasiun menuju tujuan spesifik\n` +
          `• \`${p}krl stasiun\` : Lihat beberapa kode & nama stasiun populer\n\n` +
          `*Contoh:*\n` +
          `│ \`${p}krl manggarai\`\n` +
          `│ \`${p}krl bogor jakartakota\`\n` +
          `│ \`${p}krl BOO\`\n` +
          `│ \`${p}krl sudirman bekasi\``
      );
    }

    const sub = args[0].toLowerCase();
    if (sub === "stasiun" || sub === "list" || sub === "daftar") {
      const popular = [
        "MRI: Manggarai",
        "BOO: Bogor",
        "JAKK: Jakarta Kota",
        "BKS: Bekasi",
        "CKR: Cikarang",
        "THB: Tanah Abang",
        "SUD: Sudirman",
        "DP: Depok",
        "DPB: Depok Baru",
        "DRN: Duren Kalibata",
        "PSM: Pasar Minggu",
        "JNG: Jatinegara",
        "PSE: Pasar Senen",
        "KBY: Kebayoran",
        "SRP: Serpong",
        "PRP: Parung Panjang",
        "RK: Rangkasbitung",
        "TNG: Tangerang",
        "DU: Duri",
      ];
      return reply(
        `🚉 *DAFTAR STASIUN KRL COMMUTER LINE POPULER:*\n\n` +
          popular.map((s) => `• \`${s}\``).join("\n") +
          `\n\n_Dan 90+ stasiun lainnya didukung!_`
      );
    }

    await sendTyping();

    let originQuery = args[0];
    let destQuery = "";

    if (args.length >= 2) {

      const testOrigin2 = `${args[0]} ${args[1]}`;
      const foundOrigin2 = findStation(testOrigin2);
      if (foundOrigin2 && args.length >= 3) {
        originQuery = testOrigin2;
        destQuery = args.slice(2).join(" ");
      } else if (foundOrigin2 && args.length === 2) {
        originQuery = testOrigin2;
      } else {
        originQuery = args[0];
        destQuery = args.slice(1).join(" ");
      }
    }

    const station = findStation(originQuery);
    if (!station) {
      return reply(
        `❌ Stasiun *"${originQuery}"* tidak ditemukan.\n\n` +
          `_Ketik \`${p}krl stasiun\` untuk melihat daftar stasiun KRL populer._`
      );
    }

    const schedules = await fetchKrlSchedule(station.id);
    if (!schedules || schedules.length === 0) {
      return reply(
        `❌ Gagal mengambil data jadwal untuk stasiun *${station.name} (${station.id})* atau belum ada jadwal tersedia saat ini.`
      );
    }

    let filtered = schedules;
    let filterNote = "";
    if (destQuery) {
      const dq = destQuery.toLowerCase().replace(/\s+/g, "");
      filtered = schedules.filter((s) => {
        const dest = String(s.destination || "")
          .toLowerCase()
          .replace(/\s+/g, "");
        const route = String(s.routeName || "")
          .toLowerCase()
          .replace(/\s+/g, "");
        return dest.includes(dq) || route.includes(dq);
      });
      filterNote = ` (Tujuan: *${destQuery.toUpperCase()}*)`;
    }

    if (filtered.length === 0) {
      return reply(
        `⚠️ Tidak ditemukan jadwal dari *${station.name}* dengan tujuan *"${destQuery}"* hari ini.\n\n` +
          `_Coba ketik \`${p}krl ${station.name}\` untuk melihat seluruh jadwal keberangkatan._`
      );
    }

    const now = new Date();

    const wibHours = (now.getUTCHours() + 7) % 24;
    const wibMinutes = now.getUTCMinutes();
    const currentMins = wibHours * 60 + wibMinutes;

    const upcoming = [];
    const past = [];

    for (const train of filtered) {
      const parts = String(train.departTime || "").split(":");
      if (parts.length === 2) {
        const trainMins = Number(parts[0]) * 60 + Number(parts[1]);
        if (trainMins >= currentMins) {
          upcoming.push({ ...train, diff: trainMins - currentMins });
        } else {
          past.push(train);
        }
      } else {
        upcoming.push({ ...train, diff: 9999 });
      }
    }

    let displayList = upcoming.slice(0, 5);
    if (displayList.length < 5 && past.length > 0) {
      displayList = [...displayList, ...past.slice(0, 5 - displayList.length)];
    }

    const timeStr = `${String(wibHours).padStart(2, "0")}:${String(wibMinutes).padStart(2, "0")} WIB`;

    let totalText =
      `┌── JADWAL KRL COMMUTER LINE\n` +
      `│ Stasiun Asal : ${station.name} (${station.id})\n` +
      `│ Waktu Acuan  : ${timeStr}\n` +
      (filterNote ? `│ Filter       :${filterNote}\n` : "") +
      `└──\n\n`;

    displayList.forEach((t, i) => {
      const isLast = i === displayList.length - 1;
      const branch = isLast ? "└──" : "├──";
      const subPipe = isLast ? "   " : "│  ";
      const diffStr = Number.isFinite(t.diff) && t.diff >= 0 && t.diff <= 180 ? ` (${t.diff} mnt lagi)` : "";

      totalText += `${branch} [${i + 1}] KA ${t.trainId} ➔ ${t.destination}\n`;
      totalText += `${subPipe} Berangkat : ${t.departTime} WIB${diffStr}\n`;
      totalText += `${subPipe} Rute      : ${t.lineName || t.routeName || "-"}\n`;
      if (!isLast) totalText += `│\n`;
    });

    totalText += `\n_Menampilkan 5 jadwal kereta terdekat. Sumber: rutekrl.com_`;

    return reply(totalText);
  },
};
