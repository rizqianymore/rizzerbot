import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import axios from "axios";
import https from "https";

let ffmpegPath = "ffmpeg";
try {
  const ffmpegStatic = await import("ffmpeg-static");
  ffmpegPath = ffmpegStatic.default || "ffmpeg";
} catch (_) {
  ffmpegPath = "ffmpeg";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CCTV_SOURCES = {
  lantas: {
    name: "Lalu Lintas / Polda Metro",
    file: "cctv-lantas.json",
    badge: "🚦 LANTAS",
  },
  korlantas: {
    name: "Korlantas Polri / Jasa Marga Tol",
    file: "cctv-korlantas.json",
    badge: "🛣️ KORLANTAS",
  },
  dishub: {
    name: "Dishub DKI Jakarta",
    file: "cctv-dishub.json",
    badge: "🚌 DISHUB",
  },
  etle: {
    name: "Titik Kamera ETLE (Tilang Elektronik)",
    file: "cctv-etle.json",
    badge: "📸 ETLE",
  },
  tol: {
    name: "CCTV Tol / Sigaplodaya",
    file: "cctv-tol.json",
    badge: "🚗 TOL",
  },
  scbd: {
    name: "Kawasan SCBD Sudirman",
    file: "cctv-scbd.json",
    badge: "🏢 SCBD",
  },
  publik: {
    name: "CCTV Publik / Kawasan",
    file: "cctv.json",
    badge: "🌐 PUBLIK",
  },
};

let cachedDatabase = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

function loadAllCctvData() {
  const now = Date.now();
  if (cachedDatabase && now - cacheTime < CACHE_TTL) {
    return cachedDatabase;
  }

  const allItems = [];
  const dbDir = path.join(__dirname, "..", "..", "database");

  let nextAutoId = 1;
  for (const [sourceKey, meta] of Object.entries(CCTV_SOURCES)) {
    const filePath = path.join(dbDir, meta.file);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        let list = [];

        if (Array.isArray(parsed.data)) {
          list = parsed.data;
        } else if (Array.isArray(parsed)) {
          list = parsed;
        } else if (typeof parsed === "object" && parsed !== null) {
          list = Object.entries(parsed).map(([k, v]) => ({
            id: v.id || k,
            ...v,
          }));
        }

        list.forEach((item) => {
          allItems.push({
            ...item,
            id: item.id !== undefined ? String(item.id) : String(nextAutoId++),
            sourceKey,
            sourceName: meta.name,
            badge: meta.badge,
          });
        });
      } catch (err) {
        console.error(`Error loading CCTV source ${sourceKey}:`, err.message);
      }
    }
  }

  cachedDatabase = allItems;
  cacheTime = now;
  return allItems;
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

function getHeadersForUrl(url) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "*/*",
  };

  if (url.includes("jasamarga.com")) {
    headers.Referer = "https://travoy.co.id/";
    headers.Origin = "https://travoy.co.id";
  } else if (url.includes("balitower.co.id")) {
    headers.Referer = "https://cctv-diskominfotik.balitower.co.id/";
  } else if (url.includes("bekasikota.go.id")) {
    headers.Referer = "https://eofficev2.bekasikota.go.id/";
  } else if (url.includes("sigaplodaya.id")) {
    headers.Referer = "https://sigaplodaya.id/";
  }

  return headers;
}

async function checkCctvStatus(streamUrl, timeoutMs = 4000) {
  if (!streamUrl || streamUrl === "-") {
    return { online: false, latency: 0, reason: "Stream URL tidak tersedia" };
  }

  const startTime = Date.now();
  const headers = getHeadersForUrl(streamUrl);

  try {
    let targetM3u8 = streamUrl;
    if (targetM3u8.includes("embed.html")) {
      targetM3u8 = targetM3u8.replace(/embed\.html(\?token=.*)?$/, "index.m3u8$1");
    }

    const res = await axios.get(targetM3u8, {
      headers,
      httpsAgent,
      timeout: timeoutMs,
    });

    const latency = Date.now() - startTime;

    if (res.status >= 200 && res.status < 400) {
      if (typeof res.data === "string" && targetM3u8.includes(".m3u8")) {
        const hasSegments = res.data.includes("#EXTINF") || res.data.includes(".ts") || res.data.includes(".m3u8");
        if (!hasSegments) {
          return { online: false, latency, reason: "Playlist m3u8 kosong (Stream idle)" };
        }
      }
      return { online: true, latency, reason: "OK (Live)" };
    }

    return { online: false, latency, reason: `HTTP Status ${res.status}` };
  } catch (err) {
    const latency = Date.now() - startTime;
    let reason = err.message || "Connection failed";
    if (err.code === "ECONNABORTED" || latency >= timeoutMs) {
      reason = `Timeout (${timeoutMs / 1000}s)`;
    }
    return { online: false, latency, reason };
  }
}

async function captureCctvSnapshot(streamUrl, timeoutMs = 6000) {
  if (!streamUrl) {
    throw new Error("URL stream kamera tidak tersedia.");
  }

  const headers = getHeadersForUrl(streamUrl);

  if (
    streamUrl.includes("/img") ||
    streamUrl.endsWith(".jpg") ||
    streamUrl.endsWith(".jpeg") ||
    streamUrl.endsWith(".png")
  ) {
    const imgRes = await axios.get(streamUrl, {
      headers,
      httpsAgent,
      responseType: "arraybuffer",
      timeout: timeoutMs,
    });
    if (imgRes.status === 200 && imgRes.data && imgRes.data.length > 500) {
      return Buffer.from(imgRes.data);
    }
    throw new Error(`Gagal mengambil gambar (Status: ${imgRes.status})`);
  }

  let targetM3u8 = streamUrl;
  if (targetM3u8.includes("embed.html")) {
    targetM3u8 = targetM3u8.replace(/embed\.html(\?token=.*)?$/, "index.m3u8$1");
  }

  const m3u8Res = await axios.get(targetM3u8, {
    headers,
    httpsAgent,
    timeout: timeoutMs,
  });

  if (!m3u8Res.data || typeof m3u8Res.data !== "string") {
    throw new Error("Playlist m3u8 tidak valid.");
  }

  let lines = m3u8Res.data
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (lines.length === 0) {
    throw new Error("Playlist kosong (Kamera offline).");
  }

  let segmentUrl = new URL(lines[lines.length - 1], targetM3u8).href;

  if (segmentUrl.includes(".m3u8")) {
    const subRes = await axios.get(segmentUrl, { headers, httpsAgent, timeout: timeoutMs });
    const subLines = subRes.data
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));

    if (subLines.length === 0) {
      throw new Error("Sub-playlist kosong.");
    }
    segmentUrl = new URL(subLines[subLines.length - 1], segmentUrl).href;
  }

  const tsRes = await axios.get(segmentUrl, {
    headers,
    httpsAgent,
    responseType: "arraybuffer",
    timeout: timeoutMs,
  });

  if (!tsRes.data || tsRes.data.length < 1000) {
    throw new Error("Segment video TS kosong.");
  }

  const tmpId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tmpTs = path.join("/tmp", `cctv_snap_${tmpId}.ts`);
  const tmpJpg = path.join("/tmp", `cctv_snap_${tmpId}.jpg`);

  try {
    fs.writeFileSync(tmpTs, tsRes.data);

    await new Promise((resolve, reject) => {
      const cmd = `"${ffmpegPath}" -y -i "${tmpTs}" -vframes 1 -q:v 2 "${tmpJpg}"`;
      exec(cmd, { timeout: 6000 }, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    if (fs.existsSync(tmpJpg)) {
      const imgBuffer = fs.readFileSync(tmpJpg);
      if (imgBuffer.length > 500) {
        return imgBuffer;
      }
    }
    throw new Error("Gagal mengonversi frame video.");
  } finally {
    try {
      if (fs.existsSync(tmpTs)) fs.unlinkSync(tmpTs);
    } catch (_) {}
    try {
      if (fs.existsSync(tmpJpg)) fs.unlinkSync(tmpJpg);
    } catch (_) {}
  }
}

export default {
  name: "cctv",
  description:
    "Monitoring, live snapshot & pencarian CCTV Lalu Lintas, Tol, Dishub, Korlantas Polri, & ETLE se-Indonesia.",
  usage: "[snap/check/list/info] <keyword | id | url>",
  example: "cctv snap semanggi",
  aliases: ["cctvlantas", "lantas", "cctv-traffic", "cctvindonesia", "cctvjalan", "cctvlive"],
  category: "OSINT",
  premiumOnly: true,
  ownerOnly: false,

  run: async (sock, msg, args, context) => {
    const { sendTyping, activePrefix } = context;
    const jid = msg.key.remoteJid;
    await sendTyping();

    const allData = loadAllCctvData();

    if (!args || args.length === 0) {
      const stats = {};
      for (const [key, meta] of Object.entries(CCTV_SOURCES)) {
        stats[key] = {
          name: meta.name,
          badge: meta.badge,
          count: allData.filter((i) => i.sourceKey === key).length,
        };
      }

      let helpText =
        `📹 *CCTV LALU LINTAS & JALAN RAYA INDONESIA*\n` +
        `Total Kamera Terindeks: *${allData.length.toLocaleString("id-ID")} Titik*\n\n` +
        `📊 *Database Kategori:*\n`;

      for (const [, s] of Object.entries(stats)) {
        helpText += `• ${s.badge} *${s.name}:* ${s.count} titik\n`;
      }

      helpText +=
        `\n📌 *Fitur & Perintah:*\n` +
        `│ ${activePrefix}cctv <nama_lokasi / kota / km>\n` +
        `│ ${activePrefix}cctv snap <ID / nama_lokasi>\n` +
        `│ ${activePrefix}cctv check <ID / nama_lokasi>\n` +
        `│ ${activePrefix}cctv list [kategori/kota] [halaman]\n` +
        `│ ${activePrefix}cctv info <ID>\n\n` +
        `💡 *Contoh:*\n` +
        `• \`${activePrefix}cctv semanggi\`\n` +
        `• \`${activePrefix}cctv snap 10253\`\n` +
        `• \`${activePrefix}cctv check 10253\` (Cek status aktif & latency)\n` +
        `• \`${activePrefix}cctv list tol 1\`\n` +
        `• \`${activePrefix}cctv km 58\`\n\n` +
        `⚡ _Kyros-MD Traffic Intelligence_`;

      return sock.sendMessage(jid, { text: helpText }, { quoted: msg });
    }

    let isSnapAction = false;
    let isInfoOnly = false;
    let isCheckAction = false;
    let isListAction = false;
    let filterSource = null;
    let page = 1;
    let workingArgs = [...args];

    const firstLower = workingArgs[0].toLowerCase();
    if (firstLower === "snap" || firstLower === "snapshot" || firstLower === "live") {
      isSnapAction = true;
      workingArgs.shift();
    } else if (firstLower === "check" || firstLower === "test" || firstLower === "ping") {
      isCheckAction = true;
      workingArgs.shift();
    } else if (firstLower === "info" || firstLower === "detail") {
      isInfoOnly = true;
      workingArgs.shift();
    } else if (firstLower === "list" || firstLower === "daftar") {
      isListAction = true;
      workingArgs.shift();
    }

    if (workingArgs.length > 0 && CCTV_SOURCES[workingArgs[0].toLowerCase()]) {
      filterSource = workingArgs[0].toLowerCase();
      workingArgs.shift();
    }

    if (isListAction) {
      if (workingArgs.length > 0 && !isNaN(workingArgs[workingArgs.length - 1])) {
        page = Math.max(1, parseInt(workingArgs.pop(), 10));
      }

      let listDataset = allData;
      if (filterSource) {
        listDataset = allData.filter((i) => i.sourceKey === filterSource);
      } else if (workingArgs.length > 0) {
        const catQuery = workingArgs.join(" ").toLowerCase();
        listDataset = allData.filter((item) => {
          const nama = (item.nama || item.name || "").toLowerCase();
          const kab = (item.kabkota || item.kota || "").toLowerCase();
          return nama.includes(catQuery) || kab.includes(catQuery);
        });
      }

      if (listDataset.length === 0) {
        return sock.sendMessage(
          jid,
          { text: "❌ Tidak ada daftar kamera yang sesuai kriteria pencarian." },
          { quoted: msg }
        );
      }

      const pageSize = 15;
      const totalPages = Math.ceil(listDataset.length / pageSize);
      const currentPage = Math.min(page, totalPages);
      const startIdx = (currentPage - 1) * pageSize;
      const sliced = listDataset.slice(startIdx, startIdx + pageSize);

      let listText =
        `📋 *DAFTAR KAMERA CCTV (Hal ${currentPage}/${totalPages})*\n` +
        `Total: *${listDataset.length} Titik*\n\n`;

      sliced.forEach((item, index) => {
        const idx = startIdx + index + 1;
        const nama = item.nama || item.name || item.alias || "Kamera";
        const kab = item.kabkota ? ` (${item.kabkota})` : "";
        listText += `*${idx}.* [ID: \`${item.id}\`] ${item.badge} *${nama}*${kab}\n`;
      });

      listText +=
        `\n💡 *Untuk snapshot:* \`${activePrefix}cctv snap <ID>\`\n` +
        `💡 *Halaman lain:* \`${activePrefix}cctv list ${filterSource || ""} ${currentPage + 1}\``;

      return sock.sendMessage(jid, { text: listText.trim() }, { quoted: msg });
    }

    const query = workingArgs.join(" ").trim();

    if (!query) {
      return sock.sendMessage(
        jid,
        {
          text: `⚠️ Harap masukkan nama lokasi, ID kamera, atau kata kunci!\nContoh: \`${activePrefix}cctv snap semanggi\` atau \`${activePrefix}cctv check 10253\``,
        },
        { quoted: msg }
      );
    }

    if (query.startsWith("http://") || query.startsWith("https://") || query.startsWith("rtsp://")) {
      const customCam = {
        id: "CUSTOM_URL",
        nama: "Direct Stream Target",
        url: query,
        sourceName: "Custom URL Stream",
        badge: "📡 STREAM",
      };
      if (isCheckAction) {
        return handleCheckCamera(sock, msg, customCam);
      }
      return handleCameraOutput(sock, msg, customCam, activePrefix, isInfoOnly);
    }

    const matchedById = allData.find(
      (item) => String(item.id).toLowerCase() === query.toLowerCase()
    );
    if (matchedById) {
      if (isCheckAction) {
        return handleCheckCamera(sock, msg, matchedById);
      }
      return handleCameraOutput(sock, msg, matchedById, activePrefix, isInfoOnly);
    }

    let dataset = allData;
    if (filterSource) {
      dataset = allData.filter((i) => i.sourceKey === filterSource);
    }

    const queryLower = query.toLowerCase();
    const queryParts = queryLower.split(/\s+/).filter(Boolean);

    const matches = dataset.filter((item) => {
      const nama = (item.nama || item.name || item.alias || "").toLowerCase();
      const kabkota = (item.kabkota || item.kota || item.wilayah || "").toLowerCase();
      const alamat = (item.alamat || item.lokasi || "").toLowerCase();
      const combined = `${nama} ${kabkota} ${alamat}`;

      return queryParts.every((part) => combined.includes(part));
    });

    if (matches.length === 0) {
      return sock.sendMessage(
        jid,
        {
          text: `❌ Tidak ditemukan CCTV dengan kata kunci *"${query}"*${
            filterSource ? ` pada kategori *${CCTV_SOURCES[filterSource].name}*` : ""
          }.\n\n💡 Coba kata kunci seperti: \`tol\`, \`semanggi\`, \`km 58\`, \`monas\`, \`cikampek\`, dsb.`,
        },
        { quoted: msg }
      );
    }

    if (matches.length === 1 || isSnapAction || isCheckAction) {
      const targetCam = matches[0];
      if (isCheckAction) {
        return handleCheckCamera(sock, msg, targetCam);
      }
      return handleCameraOutput(sock, msg, targetCam, activePrefix, isInfoOnly);
    }

    const listLimit = 15;
    const sliced = matches.slice(0, listLimit);

    let listText =
      `🔍 *HASIL PENCARIAN CCTV*\n` +
      `Kata Kunci: *"${query}"*\n` +
      `Ditemukan: *${matches.length} Titik Kamera*\n\n`;

    sliced.forEach((item, index) => {
      const nama = item.nama || item.name || item.alias || "Kamera";
      const kab = item.kabkota ? ` (${item.kabkota})` : "";
      listText += `*${index + 1}.* [ID: \`${item.id}\`] ${item.badge} *${nama}*${kab}\n`;
    });

    if (matches.length > listLimit) {
      listText += `\n_...dan ${matches.length - listLimit} kamera lainnya._\n`;
    }

    listText +=
      `\n💡 *Snapshot:* \`${activePrefix}cctv snap <ID>\`\n` +
      `💡 *Cek Aktif:* \`${activePrefix}cctv check <ID>\``;

    return sock.sendMessage(jid, { text: listText.trim() }, { quoted: msg });
  },
};

async function handleCheckCamera(sock, msg, camera) {
  const jid = msg.key.remoteJid;
  const nama = camera.nama || camera.name || "CCTV Kamera";
  const badge = camera.badge || "📹 CCTV";
  const streamUrl = camera.url || "-";

  const pingMsg = await sock.sendMessage(
    jid,
    { text: `⏳ Sedang memeriksa konektivitas & status aktif kamera *${nama}* (Timeout: 4s)...` },
    { quoted: msg }
  );

  const status = await checkCctvStatus(streamUrl, 4000);

  const statusIcon = status.online ? "🟢 *LIVE (AKTIF)*" : "🔴 *OFFLINE / GAGAL*";
  const reportText =
    `📡 *LAPORAN STATUS KONEKTIVITAS CCTV*\n\n` +
    `• *ID:* \`${camera.id}\`\n` +
    `• *Nama:* ${nama}\n` +
    `• *Kategori:* ${badge} ${camera.sourceName || "Lantas"}\n` +
    `• *Status:* ${statusIcon}\n` +
    `• *Latency:* ${status.latency} ms\n` +
    `• *Keterangan:* ${status.reason}\n` +
    (streamUrl !== "-" ? `• *URL:* ${streamUrl}\n` : "") +
    `\n⚡ _Kyros-MD Traffic Intelligence_`;

  return sock.sendMessage(
    jid,
    { text: reportText, edit: pingMsg.key },
    { quoted: msg }
  );
}

async function handleCameraOutput(sock, msg, camera, activePrefix, isInfoOnly = false) {
  const jid = msg.key.remoteJid;
  const nama = camera.nama || camera.name || "CCTV Kamera";
  const kabkota = camera.kabkota || "Wilayah Terdaftar";
  const alamat = camera.alamat ? `\n• *Alamat:* ${camera.alamat}` : "";
  const source = camera.sourceName || "Lalu Lintas";
  const badge = camera.badge || "📹 CCTV";
  const lat = camera.lat;
  const lng = camera.lng;

  const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;
  const mapsText = mapsUrl ? `\n• *Koordinat & Peta:* [Buka Google Maps](${mapsUrl})` : "";

  const streamUrl = camera.url || "-";

  let caption =
    `📹 *DETAIL KAMERA CCTV*\n\n` +
    `• *ID:* \`${camera.id}\`\n` +
    `• *Nama Lokasi:* ${nama}\n` +
    `• *Sumber / Jaringan:* ${badge} ${source}\n` +
    `• *Wilayah / Kota:* ${kabkota}` +
    `${alamat}` +
    `${mapsText}\n` +
    `• *Status:* ${camera.isActive !== false ? "🟢 Terdaftar (Live)" : "🔴 Nonaktif"}\n\n`;

  if (streamUrl !== "-") {
    caption += `🔗 *Stream URL:* ${streamUrl}\n\n`;
  }

  caption += `⚡ _Kyros-MD Traffic Intelligence_`;

  if (isInfoOnly || !camera.url) {
    return sock.sendMessage(jid, { text: caption }, { quoted: msg });
  }

  try {
    const imageBuffer = await captureCctvSnapshot(camera.url, 6000);
    if (imageBuffer && imageBuffer.length > 0) {
      return sock.sendMessage(
        jid,
        {
          image: imageBuffer,
          caption,
        },
        { quoted: msg }
      );
    }
  } catch (snapErr) {
    caption += `\n\n⚠️ _Catatan: Snapshot live tidak tersedia (${snapErr.message}). Kamera mungkin sedang offline di server pusat._`;
  }

  return sock.sendMessage(jid, { text: caption }, { quoted: msg });
}
