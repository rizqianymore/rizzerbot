import { getNxCameras, getNxSnapshot, getNxVideo } from "@/src/services/network/nxClient.js";
import { ensureVideoCompatible } from "@/src/services/fetch/downloaderCompat.js";

// Cache daftar kamera selama 5 menit agar interaksi nomor urut responsif
let cachedCameras = null;
let cachedCamerasTime = 0;
const CAM_CACHE_TTL = 5 * 60 * 1000;

async function fetchOrGetCachedCameras() {
  const now = Date.now();
  if (cachedCameras && now - cachedCamerasTime < CAM_CACHE_TTL) {
    return cachedCameras;
  }
  const cams = await getNxCameras();
  cachedCameras = cams;
  cachedCamerasTime = now;
  return cams;
}

function resolveCamera(cameras, target) {
  if (!target || !cameras?.length) return null;
  const q = String(target).trim().toLowerCase();

  // 1. Cek nomor urut index (misal: 1, 2, 3)
  const idx = parseInt(q, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= cameras.length) {
    return cameras[idx - 1];
  }

  // 2. Cek kecocokan persis ID
  const exactId = cameras.find((c) => c.id.toLowerCase() === q);
  if (exactId) return exactId;

  // 3. Cek pencarian nama (substring / fuzzy)
  const exactName = cameras.find((c) => c.name.toLowerCase() === q);
  if (exactName) return exactName;

  const partialName = cameras.find((c) => c.name.toLowerCase().includes(q));
  if (partialName) return partialName;

  return null;
}

export default {
  name: "cctvnx",
  aliases: ["nx", "cctv", "camnx"],
  description: "Monitoring CCTV Nx Witness (Network Optix VMS) live snapshot, video, dan daftar kamera.",
  usage: "[list / snap / vid / info] [nomor/nama/ID]",
  category: "Owner",
  ownerOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    sendTyping();
    const p = prefix || ".";
    const action = (args[0] || "list").toLowerCase();
    const targetQuery = args.slice(1).join(" ").trim();
    const remoteJid = msg.key.remoteJid;

    try {
      if (action === "list" || action === "daftar") {
        const cameras = await fetchOrGetCachedCameras();
        if (!cameras.length) {
          return reply("Tidak ada kamera CCTV yang terdeteksi di server Nx Witness.");
        }

        const page = parseInt(targetQuery, 10) || 1;
        const perPage = 15;
        const totalPages = Math.ceil(cameras.length / perPage);
        const curPage = Math.max(1, Math.min(totalPages, page));
        const startIndex = (curPage - 1) * perPage;
        const pageCams = cameras.slice(startIndex, startIndex + perPage);

        let text = `*DAFTAR KAMERA CCTV (Nx Witness)*\n`;
        text += `Total: ${cameras.length} Kamera | Halaman: ${curPage}/${totalPages}\n\n`;

        pageCams.forEach((cam, i) => {
          const num = startIndex + i + 1;
          const statusIcon = cam.status === "Online" ? "[LIVE]" : "[OFF]";
          text += `[${num}] ${cam.name} ${statusIcon}\n`;
        });

        text += `\n*Petunjuk Penggunaan:*\n`;
        text += `Ambil snapshot: \`${p}nx snap <nomor/nama>\`\n`;
        text += `Ambil video: \`${p}nx vid <nomor/nama>\`\n`;
        text += `Detail info: \`${p}nx info <nomor/nama>\`\n`;
        if (totalPages > 1) {
          text += `Halaman lain: \`${p}nx list ${curPage < totalPages ? curPage + 1 : 1}\`\n`;
        }

        return reply(text.trim());
      }

      if (action === "snap" || action === "snapshot" || action === "capture") {
        if (!targetQuery) {
          return reply(`Masukkan nomor kamera atau nama lokasi.\nContoh: \`${p}nx snap 1\` atau \`${p}nx snap harmoni\``);
        }

        const cameras = await fetchOrGetCachedCameras();
        const cam = resolveCamera(cameras, targetQuery);
        if (!cam) {
          return reply(`Kamera "${targetQuery}" tidak ditemukan. Ketik \`${p}nx list\` untuk melihat nomor urut.`);
        }

        const imgBuf = await getNxSnapshot(cam.id);
        const caption =
          `*CCTV Live Snapshot*\n\n` +
          `• *Lokasi:* ${cam.name}\n` +
          `• *Status:* ${cam.status}\n` +
          `• *Waktu:* ${new Date().toLocaleTimeString("id-ID")} WIB`;

        return await sock.sendMessage(remoteJid, { image: imgBuf, caption }, { quoted: msg });
      }

      if (action === "vid" || action === "video" || action === "clip") {
        if (!targetQuery) {
          return reply(`Masukkan nomor kamera atau nama lokasi.\nContoh: \`${p}nx vid 1\``);
        }

        const cameras = await fetchOrGetCachedCameras();
        const cam = resolveCamera(cameras, targetQuery);
        if (!cam) {
          return reply(`Kamera "${targetQuery}" tidak ditemukan. Ketik \`${p}nx list\` untuk melihat nomor urut.`);
        }

        const [rawVidBuf, snapBuf] = await Promise.all([
          getNxVideo(cam.id, 8),
          getNxSnapshot(cam.id).catch(() => null),
        ]);

        const vidBuf = await ensureVideoCompatible(rawVidBuf);
        const caption =
          `*Rekaman CCTV (8 Detik)*\n\n` +
          `• *Lokasi:* ${cam.name}\n` +
          `• *Status:* ${cam.status}\n` +
          `• *Waktu:* ${new Date().toLocaleTimeString("id-ID")} WIB`;

        return await sock.sendMessage(
          remoteJid,
          {
            video: vidBuf,
            mimetype: "video/mp4",
            caption,
            gifPlayback: false,
            jpegThumbnail: snapBuf && snapBuf.length <= 32 * 1024 ? snapBuf : undefined,
          },
          { quoted: msg }
        );
      }

      if (action === "info") {
        if (!targetQuery) {
          return reply(`Masukkan nomor kamera atau nama lokasi.\nContoh: \`${p}nx info 1\``);
        }

        const cameras = await fetchOrGetCachedCameras();
        const cam = resolveCamera(cameras, targetQuery);
        if (!cam) {
          return reply(`Kamera "${targetQuery}" tidak ditemukan.`);
        }

        const text =
          `*DETAIL KAMERA CCTV*\n\n` +
          `Nama: ${cam.name}\n` +
          `ID: ${cam.id}\n` +
          `Status: ${cam.status}\n` +
          `Vendor: ${cam.vendor}\n` +
          `Model: ${cam.model}\n` +
          `Stream URL: ${cam.url}`;

        return reply(text);
      }

      // Default jika query langsung berupa nomor/nama (shorthand: .nx 1 -> snap 1)
      const cameras = await fetchOrGetCachedCameras();
      const maybeCam = resolveCamera(cameras, action);
      if (maybeCam) {
        await reply(`Mengambil snapshot kamera *${maybeCam.name}*...`);
        const imgBuf = await getNxSnapshot(maybeCam.id);
        const caption = `*CCTV LIVE SNAPSHOT*\nNama: ${maybeCam.name}\nStatus: ${maybeCam.status}`;
        return await sock.sendMessage(remoteJid, { image: imgBuf, caption }, { quoted: msg });
      }

      return reply(
        `Perintah tidak dikenal.\n\n` +
        `Gunakan:\n` +
        `${p}nx list - Daftar semua kamera\n` +
        `${p}nx snap <nomor/nama> - Ambil foto snapshot\n` +
        `${p}nx vid <nomor/nama> - Rekam video pendek\n` +
        `${p}nx info <nomor/nama> - Cek info kamera`
      );
    } catch (err) {
      logger?.error?.(`[cctvnx] ${err.message}`);
      return reply(`Gagal mengakses server CCTV Nx: ${err.message}`);
    }
  },
};
