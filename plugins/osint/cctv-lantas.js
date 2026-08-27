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

const SOURCE_ALIASES = {
  publik: "publik",
  public: "publik",
  kawasan: "publik",
  lantas: "lantas",
  traffic: "lantas",
  polda: "lantas",
  polantas: "lantas",
  korlantas: "korlantas",
  polri: "korlantas",
  jasamarga: "korlantas",
  dishub: "dishub",
  dki: "dishub",
  jakarta: "dishub",
  etle: "etle",
  tilang: "etle",
  tol: "tol",
  toll: "tol",
  sigap: "tol",
  scbd: "scbd",
  sudirman: "scbd",
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
  usage: "[snap/check/list/info] [kategori] <keyword | id | url>",
  example: "cctv public dpr",
  aliases: ["cctvlantas", "lantas", "cctv-traffic", "cctvindonesia", "cctvjalan", "cctvlive"],
  category: "OSINT",
  premiumOnly: true,
  ownerOnly: false,

  run: async (sock, msg, args, context) => {
    const { sendTyping, activePrefix } = context;
    const jid = msg.key.remoteJid;
    await sendTyping();

    const allData = loadAllCctvData();

    if (!args || args.length === 0 || args[0]?.toLowerCase() === "help") {
      const stats = {};
      for (const [key, meta] of Object.entries(CCTV_SOURCES)) {
        stats[key] = {
          name: meta.name,
          badge: meta.badge,
          count: allData.filter((i) => i.sourceKey === key).length,
        };
      }

      let helpText =
        `📹 *PANDUAN LENGKAP FITUR CCTV*\n` +
        `Total Kamera Terindeks: *${allData.length.toLocaleString("id-ID")} Titik*\n\n` +
        `📊 *Kategori & Database Terdaftar:*\n`;

      for (const [, s] of Object.entries(stats)) {
        helpText += `• ${s.badge} *${s.name}:* ${s.count} kamera\n`;
      }

      helpText +=
        `\n╭─── . ݁₊ ⊹ *Format Perintah* ⊹ ₊ ݁.\n` +
        `│ ${activePrefix}cctv <nama_lokasi / kota / km>\n` +
        `│ ${activePrefix}cctv <kategori> <nama_lokasi>\n` +
        `│ ${activePrefix}cctv snap <ID / nama_lokasi>\n` +
        `│ ${activePrefix}cctv check <ID / nama_lokasi>\n` +
        `│ ${activePrefix}cctv list [kategori/kota] [halaman]\n` +
        `│ ${activePrefix}cctv info <ID>\n` +
        `╰──────────────\n\n` +
        `📖 *Panduan Penggunaan Singkat:*\n\n` +
        `1️⃣ *Melihat Daftar Kamera:*\n` +
        `• \`${activePrefix}cctv list public 1\` — List CCTV Publik hal. 1\n` +
        `• \`${activePrefix}cctv list tol 2\` — List CCTV Tol hal. 2\n` +
        `• \`${activePrefix}cctv list dishub\` — List CCTV Dishub\n\n` +
        `2️⃣ *Mencari Kamera (Nama / Area):*\n` +
        `• \`${activePrefix}cctv public dpr\` — Cari DPR di kategori Publik\n` +
        `• \`${activePrefix}cctv semanggi\` — Cari Semanggi di semua kategori\n` +
        `• \`${activePrefix}cctv km 58\` — Cari Tol KM 58\n\n` +
        `3️⃣ *Mengambil Gambar / Snapshot:*\n` +
        `• \`${activePrefix}cctv snap 10253\` — Snapshot via ID kamera\n` +
        `• \`${activePrefix}cctv snap monas\` — Snapshot via nama\n\n` +
        `4️⃣ *Cek Status Live & Latency (Timeout 4s):*\n` +
        `• \`${activePrefix}cctv check 10253\`\n` +
        `• \`${activePrefix}cctv check public dpr\`\n\n` +
        `📁 *Kode Kategori:* \`public\`, \`tol\`, \`dishub\`, \`etle\`, \`lantas\`, \`korlantas\`, \`scbd\`\n\n` +
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

    // 1. Extract action flags if present in the first tokens
    for (let i = 0; i < Math.min(3, workingArgs.length); i++) {
      const token = workingArgs[i]?.toLowerCase();
      if (!token) continue;

      if (token === "snap" || token === "snapshot" || token === "live") {
        isSnapAction = true;
        workingArgs.splice(i, 1);
        i--;
      } else if (token === "check" || token === "test" || token === "ping") {
        isCheckAction = true;
        workingArgs.splice(i, 1);
        i--;
      } else if (token === "info" || token === "detail") {
        isInfoOnly = true;
        workingArgs.splice(i, 1);
        i--;
      } else if (token === "list" || token === "daftar") {
        isListAction = true;
        workingArgs.splice(i, 1);
        i--;
      }
    }

    // 2. Extract category filter (support alias e.g. public, publik, tol, dishub, etc.)
    for (let i = 0; i < Math.min(2, workingArgs.length); i++) {
      const token = workingArgs[i]?.toLowerCase();
      if (token && SOURCE_ALIASES[token]) {
        filterSource = SOURCE_ALIASES[token];
        workingArgs.splice(i, 1);
        break;
      }
    }

    // 3. Handle List Action
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
          const nama = (item.nama || item.name || item.alias || "").toLowerCase();
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
        `Total: *${listDataset.length} Titik*${
          filterSource ? ` [Kategori: ${CCTV_SOURCES[filterSource].name}]` : ""
        }\n\n`;

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
      if (filterSource) {
        return sock.sendMessage(
          jid,
          {
            text: `💡 Anda memilih kategori *${CCTV_SOURCES[filterSource].name}*.\n\nKetik:\n• \`${activePrefix}cctv list ${filterSource}\` — Melihat semua kamera\n• \`${activePrefix}cctv ${filterSource} <kata_kunci>\` — Cari kamera di kategori ini`,
          },
          { quoted: msg }
        );
      }
      return sock.sendMessage(
        jid,
        {
          text: `⚠️ Harap masukkan nama lokasi, ID kamera, atau kata kunci!\nContoh: \`${activePrefix}cctv public dpr\` atau \`${activePrefix}cctv snap semanggi\``,
        },
        { quoted: msg }
      );
    }

    // Direct Stream Target
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

    // Direct search by ID
    const matchedById = allData.find(
      (item) => String(item.id).toLowerCase() === query.toLowerCase()
    );
    if (matchedById) {
      if (isCheckAction) {
        return handleCheckCamera(sock, msg, matchedById);
      }
      return handleCameraOutput(sock, msg, matchedById, activePrefix, isInfoOnly);
    }

    // Search dataset with fuzzy ranking
    let dataset = allData;
    if (filterSource) {
      dataset = allData.filter((i) => i.sourceKey === filterSource);
    }

    const queryLower = query.toLowerCase();
    const queryParts = queryLower.split(/\s+/).filter(Boolean);

    const scoredMatches = dataset.map((item) => {
      const nama = (item.nama || item.name || item.alias || "").toLowerCase();
      const kabkota = (item.kabkota || item.kota || item.wilayah || "").toLowerCase();
      const alamat = (item.alamat || item.lokasi || "").toLowerCase();
      const combined = `${nama} ${kabkota} ${alamat}`;

      let matchCount = 0;
      for (const part of queryParts) {
        if (combined.includes(part)) {
          matchCount++;
        }
      }

      let score = matchCount;
      if (combined.includes(queryLower)) {
        score += 10;
      }
      if (nama.includes(queryLower)) {
        score += 20;
      }

      return { item, score, matchCount };
    }).filter((res) => res.matchCount > 0);

    scoredMatches.sort((a, b) => b.score - a.score);
    const matches = scoredMatches.map((res) => res.item);

    if (matches.length === 0) {
      return sock.sendMessage(
        jid,
        {
          text: `❌ Tidak ditemukan CCTV dengan kata kunci *"${query}"*${
            filterSource ? ` pada kategori *${CCTV_SOURCES[filterSource].name}*` : ""
          }.\n\n💡 Coba kata kunci lain atau ketik \`${activePrefix}cctv list ${filterSource || ""}\` untuk melihat daftar semua kamera.`,
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
      `Kata Kunci: *"${query}"*${
        filterSource ? ` [Kategori: ${CCTV_SOURCES[filterSource].name}]` : ""
      }\n` +
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
  const nama = camera.nama || camera.name || camera.alias || "CCTV Kamera";
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
  const nama = camera.nama || camera.name || camera.alias || "CCTV Kamera";
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
