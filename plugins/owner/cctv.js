import axios from "axios";
import https from "https";
import { db } from "@/src/core/database.js";

const getEnvVal = (key) => process.env[key] || "";

const createAxiosClient = () => {
  return axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
    timeout: 30000,
  });
};

const getNxToken = async (client) => {
  const baseUrl = getEnvVal("CCTV_BASE_URL");
  const username = getEnvVal("CCTV_USERNAME");
  const password = getEnvVal("CCTV_PASSWORD");

  if (!baseUrl || !username || !password) {
    throw new Error("Konfigurasi CCTV (CCTV_BASE_URL, CCTV_USERNAME, CCTV_PASSWORD) belum diatur di .env!");
  }

  try {
    const response = await client.post(`${baseUrl}/rest/v2/login/sessions`, {
      username: username,
      password: password,
    });
    if (response.data && response.data.token) {
      return response.data.token;
    }
    throw new Error("Respon login tidak mengembalikan token.");
  } catch (error) {
    throw new Error(`Gagal login ke server Nx: ${error.message}`);
  }
};

const getNxCameras = async (client, token) => {
  const baseUrl = getEnvVal("CCTV_BASE_URL");
  try {
    const response = await client.get(`${baseUrl}/rest/v2/devices`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (Array.isArray(response.data)) {
      return response.data.filter((device) => device.deviceType === "camera" || device.flags !== undefined);
    }
    return [];
  } catch (error) {
    throw new Error(`Gagal mengambil daftar kamera: ${error.message}`);
  }
};

const getNxSnapshot = async (client, token, cameraId) => {
  const baseUrl = getEnvVal("CCTV_BASE_URL");
  try {
    const response = await client.get(
      `${baseUrl}/ec2/cameraThumbnail`,
      {
        params: {
          cameraId: cameraId,
          width: 1280,
          height: 720,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "arraybuffer",
      }
    );
    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`Gagal mengambil snapshot kamera ${cameraId}: ${error.message}`);
  }
};

const getNxVideo = async (client, token, cameraId, duration = 10) => {
  const baseUrl = getEnvVal("CCTV_BASE_URL");
  try {
    const response = await client.get(
      `${baseUrl}/media/${cameraId}.mp4`,
      {
        params: {
          duration: 10,
          codec: "h264",
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "arraybuffer",
      }
    );
    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`Gagal mengambil video dari kamera ${cameraId}: ${error.message}`);
  }
};

export default {
  name: "cctv",
  description: "Monitoring CCTV Nx Witness (Network Optix) dengan pemilihan kamera.",
  usage: "[snap/video/list/alias/unalias/info] [args]",
  example: "cctv snap 1",
  aliases: ["monitor", "cam", "nx"],
  category: "Owner",
  limitedOnly: true,
  premiumOnly: true,
  ownerOnly: false,

  run: async (sock, msg, args, context) => {
    const { sendTyping, activePrefix } = context;
    await sendTyping();

    const jid = msg.key.remoteJid;
    const client = createAxiosClient();

    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      "";
    const matchArgs = text.slice(activePrefix.length).trim().match(/[^\s"']+|"([^"]*)"|'([^']*)'/g) || [];
    const parsedArgs = matchArgs.map(arg => {
      if (arg.startsWith('"') && arg.endsWith('"')) return arg.slice(1, -1);
      if (arg.startsWith("'") && arg.endsWith("'")) return arg.slice(1, -1);
      return arg;
    });
    parsedArgs.shift();
    args = parsedArgs;

    let action = "snap";
    let target = null;
    const duration = 10;

    const actionKeywords = ["list", "snap", "video", "vid", "info", "alias", "unalias", "aliases", "help"];

    if (args.length === 0) {
      action = "help";
    } else if (actionKeywords.includes(args[0].toLowerCase())) {
      action = args[0].toLowerCase();
      if (action === "vid") action = "video";

      if (action === "alias") {
        if (args.length < 3) {
          await sock.sendMessage(
            jid,
            { text: `⚠️ Format salah!\nGunakan: \`${activePrefix}cctv alias <nama_alias> <nomor/nama/id>\`` },
            { quoted: msg }
          );
          return;
        }
        target = JSON.stringify({
          aliasName: args[1].toLowerCase(),
          camKeyword: args.slice(2).join(" ")
        });
      } else {
        target = args.slice(1).join(" ").trim();
      }
    } else {
      action = "snap";
      target = args.join(" ").trim();
    }

    try {
      const token = await getNxToken(client);
      const cameras = await getNxCameras(client, token);

      if (cameras.length === 0) {
        await sock.sendMessage(
          jid,
          { text: "❌ Tidak ada kamera yang ditemukan pada server Nx Witness." },
          { quoted: msg }
        );
        return;
      }

      if (!db.data.cctvAliases) {
        db.data.cctvAliases = {};
      }
      const aliasesObj = db.data.cctvAliases;

      let dbChanged = false;
      cameras.forEach((cam) => {
        if (!aliasesObj[cam.id]) {
          const defaultAlias = cam.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
          aliasesObj[cam.id] = {
            name: cam.name,
            alias: defaultAlias
          };
          dbChanged = true;
        } else {
          let updated = false;
          if (aliasesObj[cam.id].name !== cam.name) {
            aliasesObj[cam.id].name = cam.name;
            updated = true;
          }
          if (!aliasesObj[cam.id].alias) {
            aliasesObj[cam.id].alias = cam.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
            updated = true;
          }
          if (updated) dbChanged = true;
        }
      });
      if (dbChanged) {
        db.save();
      }

      if (action === "help") {
        const helpText = 
          `📹 *CCTV NX WITNESS MONITORING*\n\n` +
          `Format penggunaan:\n` +
          `│ ${activePrefix}cctv list\n` +
          `│ ${activePrefix}cctv snap <nomor/nama/alias>\n` +
          `│ ${activePrefix}cctv video <nomor/nama/alias>\n` +
          `│ ${activePrefix}cctv info <nomor/nama/alias>\n` +
          `│ ${activePrefix}cctv alias <nama_alias> <nomor/nama/id>\n` +
          `│ ${activePrefix}cctv unalias <nama_alias>\n` +
          `│ ${activePrefix}cctv aliases\n` +
          `│ ${activePrefix}cctv help\n\n` +
          `*Durasi Video:* 10 detik (tetap/fixed)\n` +
          `*Contoh:* \`${activePrefix}cctv snap 1\` atau \`${activePrefix}cctv video 1\``;
        await sock.sendMessage(jid, { text: helpText }, { quoted: msg });
        return;
      }

      if (action === "list") {
        let menuText = "📹 *Daftar Kamera Nx Witness*\n\n";
        cameras.forEach((cam, index) => {
          const status = cam.status === "Online" || cam.statusFlags === "CSF_NoFlags" || !cam.statusFlags ? "🟢" : "🔴";
          const camData = aliasesObj[cam.id];
          const displayName = camData && camData.alias ? `*${camData.alias.toUpperCase()}*` : `_${cam.name}_`;
          menuText += `${index + 1}. ${status} ${displayName}\n`;
        });
        menuText += `\n💡 Ketik \`${activePrefix}cctv snap <nomor/alias>\` atau \`${activePrefix}cctv video <nomor/alias>\``;
        await sock.sendMessage(jid, { text: menuText }, { quoted: msg });
        return;
      }

      if (action === "alias") {
        let parsed;
        try {
          parsed = JSON.parse(target);
        } catch (_) {}

        if (!parsed || !parsed.aliasName || !parsed.camKeyword) {
          await sock.sendMessage(
            jid,
            { text: `⚠️ Format salah!\nGunakan: \`${activePrefix}cctv alias <nama_alias> <nomor/nama/id>\`` },
            { quoted: msg }
          );
          return;
        }

        const { aliasName, camKeyword } = parsed;

        let targetCamera = null;
        const indexInput = parseInt(camKeyword, 10);
        if (!isNaN(indexInput) && indexInput > 0 && indexInput <= cameras.length) {
          targetCamera = cameras[indexInput - 1];
        } else {
          targetCamera = cameras.find((cam) =>
            cam.name.toLowerCase().includes(camKeyword.toLowerCase()) ||
            cam.id.toLowerCase() === camKeyword.toLowerCase()
          );
        }

        if (!targetCamera) {
          await sock.sendMessage(
            jid,
            { text: `❌ Kamera dengan kata kunci *"${camKeyword}"* tidak ditemukan.` },
            { quoted: msg }
          );
          return;
        }

        db.setCctvAlias(targetCamera.id, targetCamera.name, aliasName);
        await sock.sendMessage(
          jid,
          { text: `✅ Berhasil memetakan alias *"${aliasName}"* ke kamera *"${targetCamera.name}"* (ID: \`${targetCamera.id}\`).` },
          { quoted: msg }
        );
        return;
      }

      if (action === "unalias") {
        if (!target) {
          await sock.sendMessage(
            jid,
            { text: `⚠️ Format salah!\nGunakan: \`${activePrefix}cctv unalias <nama_alias>\`` },
            { quoted: msg }
          );
          return;
        }

        const existing = db.getCctvAlias(target);
        if (!existing) {
          await sock.sendMessage(
            jid,
            { text: `⚠️ Alias *"${target}"* tidak ditemukan.` },
            { quoted: msg }
          );
          return;
        }

        db.deleteCctvAlias(target);
        await sock.sendMessage(
          jid,
          { text: `✅ Berhasil menghapus alias *"${target}"*.` },
          { quoted: msg }
        );
        return;
      }

      if (action === "aliases") {
        let aliasText = "🏷️ *Daftar Pemetaan Alias Kamera*\n\n";
        let count = 0;
        for (const [, data] of Object.entries(aliasesObj)) {
          if (data.alias) {
            aliasText += `• *${data.alias}* -> ${data.name}\n`;
            count++;
          }
        }
        if (count === 0) {
          aliasText += "_Belum ada alias yang disimpan._\n";
        }
        await sock.sendMessage(jid, { text: aliasText }, { quoted: msg });
        return;
      }

      let targetCamera = null;

      if (!target) {
        await sock.sendMessage(
          jid,
          { text: `⚠️ Tentukan kamera yang ingin diakses!\nContoh: \`${activePrefix}cctv snap 1\` atau \`${activePrefix}cctv video 1\`` },
          { quoted: msg }
        );
        return;
      }

      const aliasCamId = db.getCctvAlias(target);
      if (aliasCamId) {
        targetCamera = cameras.find((cam) => cam.id === aliasCamId);
      }

      if (!targetCamera) {
        const indexInput = parseInt(target, 10);
        if (!isNaN(indexInput) && indexInput > 0 && indexInput <= cameras.length) {
          targetCamera = cameras[indexInput - 1];
        }
      }

      if (!targetCamera) {
        targetCamera = cameras.find((cam) =>
          cam.name.toLowerCase().includes(target.toLowerCase()) ||
          cam.id.toLowerCase() === target.toLowerCase()
        );
      }

      if (!targetCamera) {
        await sock.sendMessage(
          jid,
          { text: `❌ Kamera dengan kata kunci atau nomor *"${target}"* tidak ditemukan.\nKetik \`${activePrefix}cctv list\` untuk melihat daftar.` },
          { quoted: msg }
        );
        return;
      }

      if (targetCamera.status && targetCamera.status !== "Online" && targetCamera.statusFlags !== "CSF_NoFlags" && targetCamera.statusFlags) {
        if (action !== "info") {
          await sock.sendMessage(
            jid,
            { text: `⚠️ Kamera *${targetCamera.name}* sedang offline/tidak dapat dihubungi!` },
            { quoted: msg }
          );
          return;
        }
      }

      if (action === "info") {
        const status = targetCamera.status === "Online" || targetCamera.statusFlags === "CSF_NoFlags" || !targetCamera.statusFlags ? "🟢 Online" : "🔴 Offline";
        const camData = aliasesObj[targetCamera.id];
        const currentAlias = camData && camData.alias ? camData.alias.toUpperCase() : "N/A";
        const infoText = 
          `📹 *Informasi Detail Kamera*\n\n` +
          `• *Alias:* *${currentAlias}*\n` +
          `• *Nama Asli:* ${targetCamera.name}\n` +
          `• *Status:* ${status}\n` +
          `• *Vendor:* ${targetCamera.vendor || "Unknown"}\n` +
          `• *Model:* ${targetCamera.model || "Unknown"}\n` +
          `• *ID:* \`${targetCamera.id}\``;
        await sock.sendMessage(jid, { text: infoText }, { quoted: msg });
        return;
      }

      await sock.sendMessage(
        jid,
        { text: `⏳ Mengambil ${action === "video" ? `video clip 10 detik` : "snapshot"} dari kamera *${targetCamera.name}*...` },
        { quoted: msg }
      );

      if (action === "video") {
        let videoBuffer = await getNxVideo(client, token, targetCamera.id, 10);
        try {
          const { transcodeToWhatsappVideo } = await import("@/src/utils/media.js");
          videoBuffer = await transcodeToWhatsappVideo(videoBuffer);
        } catch (transcodeErr) {
          console.error("CCTV Transcoding Failed:", transcodeErr.message);
        }

        const captionText =
          `📹 *CCTV Video Clip (10s)*\n\n` +
          `• *Nama Kamera:* ${targetCamera.name}\n` +
          `• *Vendor:* ${targetCamera.vendor || "Unknown"}\n` +
          `• *ID:* \`${targetCamera.id}\`\n\n` +
          `⚡ _Via Nx Witness REST API_`;

        await sock.sendMessage(
          jid,
          {
            video: videoBuffer,
            caption: captionText,
            mimetype: "video/mp4",
          },
          { quoted: msg }
        );
      } else {
        const imageBuffer = await getNxSnapshot(client, token, targetCamera.id);
        const captionText =
          `📹 *CCTV Snapshot*\n\n` +
          `• *Nama Kamera:* ${targetCamera.name}\n` +
          `• *Vendor:* ${targetCamera.vendor || "Unknown"}\n` +
          `• *ID:* \`${targetCamera.id}\`\n\n` +
          `⚡ _Via Nx Witness REST API_`;

        await sock.sendMessage(
          jid,
          {
            image: imageBuffer,
            caption: captionText,
          },
          { quoted: msg }
        );
      }
    } catch (err) {
      console.error("CCTV Execution Error:", err.message);
      await sock.sendMessage(
        jid,
        { text: `❌ Terjadi kesalahan: ${err.message}` },
        { quoted: msg }
      );
    }
  },
};
