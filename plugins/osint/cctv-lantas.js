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

// Database path mappings
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
};

// Cache memory to prevent repetitive fs disk reads
let cachedDatabase = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function loadAllCctvData() {
  const now = Date.now();
  if (cachedDatabase && now - cacheTime < CACHE_TTL) {
    return cachedDatabase;
  }

  const allItems = [];
  const dbDir = path.join(__dirname, "..", "..", "database");

  for (const [sourceKey, meta] of Object.entries(CCTV_SOURCES)) {
    const filePath = path.join(dbDir, meta.file);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed.data)
          ? parsed.data
          : Array.isArray(parsed)
          ? parsed
          : Object.values(parsed);

        list.forEach((item) => {
          allItems.push({
            ...item,
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

/**
 * Extract a high-quality live snapshot (JPEG Buffer) from any CCTV feed
 */
async function captureCctvSnapshot(streamUrl) {
  if (!streamUrl) {
    throw new Error("URL stream kamera tidak tersedia.");
  }

  const headers = getHeadersForUrl(streamUrl);

  // 1. Direct Image Stream (Synergics / Static JPG / PNG / MJPG)
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
      timeout: 8000,
    });
    if (imgRes.status === 200 && imgRes.data && imgRes.data.length > 500) {
      return Buffer.from(imgRes.data);
    }
    throw new Error(`Gagal mengambil gambar dari sumber (Status: ${imgRes.status})`);
  }

  // 2. Flussonic Web Player embed.html -> convert to index.m3u8
  let targetM3u8 = streamUrl;
  if (targetM3u8.includes("embed.html")) {
    targetM3u8 = targetM3u8.replace(/embed\.html(\?token=.*)?$/, "index.m3u8$1");
  }

  // 3. HLS Stream (.m3u8 / Flussonic / Jasa Marga / Sigaplodaya)
  const m3u8Res = await axios.get(targetM3u8, {
    headers,
    httpsAgent,
    timeout: 8000,
  });

  if (!m3u8Res.data || typeof m3u8Res.data !== "string") {
    throw new Error("Response playlist m3u8 tidak valid.");
  }

  let lines = m3u8Res.data
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (lines.length === 0) {
    throw new Error("Playlist m3u8 kosong atau kamera sedang offline di server pusat.");
  }

  let segmentUrl = new URL(lines[lines.length - 1], targetM3u8).href;

  // Handle nested sub-playlists (e.g. tracks-v1/mono.ts.m3u8)
  if (segmentUrl.includes(".m3u8")) {
    const subRes = await axios.get(segmentUrl, { headers, httpsAgent, timeout: 8000 });
    const subLines = subRes.data
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));

    if (subLines.length === 0) {
      throw new Error("Sub-playlist m3u8 kosong.");
    }
    segmentUrl = new URL(subLines[subLines.length - 1], segmentUrl).href;
  }

  // Fetch actual TS video segment
  const tsRes = await axios.get(segmentUrl, {
    headers,
    httpsAgent,
    responseType: "arraybuffer",
    timeout: 10000,
  });

  if (!tsRes.data || tsRes.data.length < 1000) {
    throw new Error("Segment video TS kosong atau rusak.");
  }

  // Temporary file names
  const tmpId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tmpTs = path.join("/tmp", `cctv_snap_${tmpId}.ts`);
  const tmpJpg = path.join("/tmp", `cctv_snap_${tmpId}.jpg`);

  try {
    fs.writeFileSync(tmpTs, tsRes.data);

    // Extract first frame as crisp JPEG via ffmpeg
    await new Promise((resolve, reject) => {
      const cmd = `"${ffmpegPath}" -y -i "${tmpTs}" -vframes 1 -q:v 2 "${tmpJpg}"`;
      exec(cmd, { timeout: 10000 }, (err) => {
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
    throw new Error("Gagal mengonversi frame video menjadi gambar.");
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
  name: "cctv-lantas",
  description:
    "Monitoring, live snapshot & pencarian CCTV Lalu Lintas, Tol, Dishub, Korlantas Polri, & ETLE se-Indonesia.",
  usage: "[snap/info] <keyword | id | source>",
  example: "cctv-lantas snap semanggi",
  aliases: ["cctvlantas", "lantas", "cctv-traffic", "cctvindonesia", "cctvjalan"],
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
        `Total Kamera Terpantau: *${allData.length.toLocaleString("id-ID")} Titik*\n\n` +
        `📊 *Database Terdaftar:*\n`;

      for (const [, s] of Object.entries(stats)) {
        helpText += `• ${s.badge} *${s.name}:* ${s.count} kamera\n`;
      }

      helpText +=
        `\n📌 *Fitur & Perintah:*\n` +
        `│ ${activePrefix}cctv-lantas <nama_jalan / area / km>\n` +
        `│ ${activePrefix}cctv-lantas snap <id / nama_lokasi>\n` +
        `│ ${activePrefix}cctv-lantas info <id>\n` +
        `│ ${activePrefix}cctv-lantas <kategori> <keyword>\n\n` +
        `📁 *Kategori Tersedia:* \`lantas\`, \`korlantas\`, \`dishub\`, \`etle\`, \`tol\`, \`scbd\`\n\n` +
        `💡 *Contoh:*\n` +
        `• \`${activePrefix}cctv-lantas snap semanggi\`\n` +
        `• \`${activePrefix}cctv-lantas snap 10253\`\n` +
        `• \`${activePrefix}cctv-lantas km 58\`\n` +
        `• \`${activePrefix}cctv-lantas etle surabaya\`\n\n` +
        `⚡ _Kyros-MD Traffic Intelligence_`;

      return sock.sendMessage(jid, { text: helpText }, { quoted: msg });
    }

    let isSnapAction = false;
    let isInfoOnly = false;
    let filterSource = null;
    let workingArgs = [...args];

    const firstLower = workingArgs[0].toLowerCase();
    if (firstLower === "snap" || firstLower === "snapshot") {
      isSnapAction = true;
      workingArgs.shift();
    } else if (firstLower === "info" || firstLower === "detail") {
      isInfoOnly = true;
      workingArgs.shift();
    }

    if (workingArgs.length > 0 && CCTV_SOURCES[workingArgs[0].toLowerCase()]) {
      filterSource = workingArgs[0].toLowerCase();
      workingArgs.shift();
    }

    const query = workingArgs.join(" ").trim();

    if (!query) {
      return sock.sendMessage(
        jid,
        {
          text: `⚠️ Harap masukkan nama lokasi atau ID kamera!\nContoh: \`${activePrefix}cctv-lantas snap semanggi\` atau \`${activePrefix}cctv-lantas 10253\``,
        },
        { quoted: msg }
      );
    }

    // 1. Direct search by numeric ID
    const isNumericId = /^\d+$/.test(query);
    if (isNumericId) {
      const targetId = parseInt(query, 10);
      const matchedById = allData.find((item) => item.id === targetId);

      if (matchedById) {
        return handleCameraOutput(sock, msg, matchedById, activePrefix, isInfoOnly);
      }
    }

    // 2. Search dataset by keyword
    let dataset = allData;
    if (filterSource) {
      dataset = allData.filter((i) => i.sourceKey === filterSource);
    }

    const queryLower = query.toLowerCase();
    const queryParts = queryLower.split(/\s+/).filter(Boolean);

    const matches = dataset.filter((item) => {
      const nama = (item.nama || item.name || "").toLowerCase();
      const kabkota = (item.kabkota || "").toLowerCase();
      const alamat = (item.alamat || "").toLowerCase();
      const combined = `${nama} ${kabkota} ${alamat}`;

      return queryParts.every((part) => combined.includes(part));
    });

    if (matches.length === 0) {
      return sock.sendMessage(
        jid,
        {
          text: `❌ Tidak ditemukan CCTV dengan kata kunci *"${query}"*${
            filterSource ? ` pada kategori *${CCTV_SOURCES[filterSource].name}*` : ""
          }.\n\n💡 Coba kata kunci lain, seperti: \`tol\`, \`sudirman\`, \`km 10\`, \`monas\`, \`cikampek\`, dsb.`,
        },
        { quoted: msg }
      );
    }

    // If exactly 1 match or snap keyword requested with single best match
    if (matches.length === 1 || isSnapAction) {
      const targetCam = matches[0];
      return handleCameraOutput(sock, msg, targetCam, activePrefix, isInfoOnly);
    }

    // Multiple matches -> render list
    const listLimit = 15;
    const sliced = matches.slice(0, listLimit);

    let listText =
      `🔍 *HASIL PENCARIAN CCTV LANTAS*\n` +
      `Kata Kunci: *"${query}"*\n` +
      `Ditemukan: *${matches.length} Titik Kamera*\n\n`;

    sliced.forEach((item, index) => {
      const nama = item.nama || item.name || "Kamera";
      const kab = item.kabkota ? ` (${item.kabkota})` : "";
      listText += `*${index + 1}.* [ID: \`${item.id}\`] ${item.badge} *${nama}*${kab}\n`;
    });

    if (matches.length > listLimit) {
      listText += `\n_...dan ${matches.length - listLimit} kamera lainnya._\n`;
    }

    listText +=
      `\n💡 *Untuk mengambil snapshot:* Ketik \`${activePrefix}cctv-lantas snap <ID>\`\n` +
      `Contoh: \`${activePrefix}cctv-lantas snap ${sliced[0].id}\``;

    return sock.sendMessage(jid, { text: listText }, { quoted: msg });
  },
};

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

  // Attempt live snapshot extraction
  try {
    const imageBuffer = await captureCctvSnapshot(camera.url);
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
    console.error(`Snapshot failed for camera ${camera.id} (${camera.url}):`, snapErr.message);

    caption += `\n\n⚠️ _Catatan: Snapshot live gagal diambil (${snapErr.message}). Server kamera pusat mungkin sedang offline._`;
  }

  return sock.sendMessage(jid, { text: caption }, { quoted: msg });
}
