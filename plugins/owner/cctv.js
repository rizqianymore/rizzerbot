import axios from "axios";
import https from "https";
import fs from "fs";
import path from "path";
import { db } from "@/src/core/database.js";

const getEnvVal = (key) => {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const lines = envContent.split(/\r?\n/);
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const k = match[1];
          let v = match[2] || "";
          if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
          else if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
          if (k === key) return v.trim();
        }
      }
    }
  } catch (_) {}
  return process.env[key] || null;
};

const createAxiosClient = () => {
  return axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
    timeout: 30000,
  });
};

const loginToNx = async (client) => {
  const baseUrl = getEnvVal("CCTV_BASE_URL");
  const username = getEnvVal("CCTV_USER");
  const password = getEnvVal("CCTV_PASS");

  if (!baseUrl || !username || !password) {
    throw new Error(
      "Kredensial Nx API belum lengkap di environment variable atau file .env (CCTV_BASE_URL, CCTV_USER, CCTV_PASS)."
    );
  }

  try {
    const response = await client.post(`${baseUrl}/rest/v1/login/sessions`, {
      username,
      password,
    });

    if (response.data && response.data.token) {
      return response.data.token;
    }
    throw new Error("Gagal mendapatkan session token dari Nx Witness API.");
  } catch (error) {
    throw new Error(`Login Nx Gagal: ${error.response?.data?.errorString || error.message}`);
  }
};

const getNxCameraList = async (client, token) => {
  const baseUrl = getEnvVal("CCTV_BASE_URL");
  try {
    const response = await client.get(`${baseUrl}/ec2/getCamerasList`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data || [];
  } catch (error) {
    throw new Error(`Gagal mengambil daftar kamera Nx: ${error.message}`);
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

const getNxVideo = async (client, token, cameraId, duration = 5) => {
  const baseUrl = getEnvVal("CCTV_BASE_URL");
  try {
    const response = await client.get(
      `${baseUrl}/media/${cameraId}.mp4`,
      {
        params: {
          duration: duration,
          resolution: "480p",
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
  usage: "[command] [args]",
  example: "cctv snap 1",
  aliases: ["monitor", "cam", "nx"],
  category: "Owner",
  premiumOnly: false,
  ownerOnly: true,

  run: async (sock, msg, args, { sendTyping }) => {
    await sendTyping();

    const jid = msg.key.remoteJid;
    const client = createAxiosClient();

    let action = "snap"; // default action
    let target = "";
    let duration = 5;

    if (args.length === 0) {
      action = "help";
    } else {
      const firstArg = args[0].toLowerCase();
      if (firstArg === "list") {
        action = "list";
      } else if (firstArg === "help" || firstArg === "-h" || firstArg === "--help") {
        action = "help";
      } else if (firstArg === "alias") {
        action = "alias";
        const aliasName = args[1];
        const camKeyword = args.slice(2).join(" ").trim();
        target = JSON.stringify({ aliasName, camKeyword });
      } else if (firstArg === "unalias") {
        action = "unalias";
        target = args.slice(1).join(" ").trim();
      } else if (firstArg === "aliases") {
        action = "aliases";
      } else if (firstArg === "snap" || firstArg === "snapshot") {
        action = "snap";
        target = args.slice(1).join(" ").trim();
      } else if (firstArg === "info") {
        action = "info";
        target = args.slice(1).join(" ").trim();
      } else if (firstArg === "video" || firstArg === "v") {
        action = "video";
        // Check if last argument is a number (duration)
        const lastArg = args[args.length - 1];
        const parsedDuration = parseInt(lastArg, 10);
        if (args.length > 2 && !isNaN(parsedDuration) && parsedDuration > 0 && parsedDuration <= 60) {
          duration = parsedDuration;
          target = args.slice(1, -1).join(" ").trim();
        } else {
          target = args.slice(1).join(" ").trim();
        }
      } else {
        // Fallback or legacy syntax: `.cctv 1` or `.cctv 1 video`
        let fullInput = args.join(" ").trim();
        if (/\s+(video|v|vid)$/i.test(fullInput)) {
          action = "video";
          target = fullInput.replace(/\s+(video|v|vid)$/i, "").trim();
          const match = target.match(/(.*)\s+(\d+)$/);
          if (match) {
            target = match[1].trim();
            const dur = parseInt(match[2], 10);
            if (dur > 0 && dur <= 60) duration = dur;
          }
        } else {
          action = "snap";
          target = fullInput;
        }
      }
    }

    try {
      const token = await loginToNx(client);
      const cameras = await getNxCameraList(client, token);

      if (!cameras || cameras.length === 0) {
        await sock.sendMessage(
          jid,
          { text: "⚠️ Tidak ada kamera yang ditemukan di sistem Nx Witness." },
          { quoted: msg }
        );
        return;
      }

      // Sync cameras to database cctvAliases
      const aliasesObj = db.data.cctvAliases || {};
      let dbChanged = false;
      cameras.forEach((cam) => {
        if (!aliasesObj[cam.id]) {
          aliasesObj[cam.id] = {
            name: cam.name,
            alias: ""
          };
          dbChanged = true;
        } else if (aliasesObj[cam.id].name !== cam.name) {
          aliasesObj[cam.id].name = cam.name;
          dbChanged = true;
        }
      });
      if (dbChanged) {
        db.save();
      }

      if (action === "help") {
        const helpText = 
          `📹 *CCTV Nx Witness Help & Usage*\n\n` +
          `Format penggunaan:\n` +
          `│ .cctv list\n` +
          `│ .cctv snap <nomor/nama/alias>\n` +
          `│ .cctv video <nomor/nama/alias> [durasi]\n` +
          `│ .cctv info <nomor/nama/alias>\n` +
          `│ .cctv alias <nama_alias> <nomor/nama/id>\n` +
          `│ .cctv unalias <nama_alias>\n` +
          `│ .cctv aliases\n` +
          `│ .cctv help\n\n` +
          `*Contoh:* \`.cctv alias dpr-depan 1\` lalu \`.cctv snap dpr-depan\`\n\n` +
          `Ketik *.cctv list* untuk melihat daftar kamera.`;
        await sock.sendMessage(jid, { text: helpText }, { quoted: msg });
        return;
      }

      if (action === "list") {
        let menuText = "📹 *Daftar Kamera Nx Witness*\n\n";
        cameras.forEach((cam, index) => {
          const status = cam.status === "Online" || cam.statusFlags === "CSF_NoFlags" || !cam.statusFlags ? "🟢" : "🔴";
          const camData = aliasesObj[cam.id];
          const displayName = camData && camData.alias ? `*${camData.alias.toUpperCase()}*` : `_${cam.name}_ (Belum ada alias)`;
          menuText += `${index + 1}. ${status} ${displayName}\n`;
        });
        menuText += `\n💡 Ketik \`.cctv snap <nomor/nama/alias>\` untuk mengambil gambar.`;
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
            { text: `⚠️ Format salah!\nGunakan: \`.cctv alias <nama_alias> <nomor/nama/id>\`` },
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
            { text: `⚠️ Format salah!\nGunakan: \`.cctv unalias <nama_alias>\`` },
            { quoted: msg }
          );
          return;
        }

        const existing = db.getCctvAlias(target);
        if (!existing) {
          await sock.sendMessage(
            jid,
            { text: `❌ Alias *"${target}"* tidak ditemukan di database.` },
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
        const entries = Object.entries(aliasesObj).filter(([id, data]) => data && data.alias);
        if (entries.length === 0) {
          await sock.sendMessage(
            jid,
            { text: `📹 *Daftar Alias CCTV kosong.*\nGunakan \`.cctv alias <nama_alias> <nomor/nama/id>\` untuk menambahkan.` },
            { quoted: msg }
          );
          return;
        }

        let aliasList = `📹 *Daftar Alias CCTV Terdaftar*\n\n`;
        entries.forEach(([id, data], index) => {
          aliasList += `${index + 1}. *${data.alias}* ➔ *${data.name}* (ID: \`${id}\`)\n`;
        });

        await sock.sendMessage(jid, { text: aliasList }, { quoted: msg });
        return;
      }

      // Find target camera
      let targetCamera = null;

      // Check database alias
      const aliasedId = db.getCctvAlias(target);
      if (aliasedId) {
        targetCamera = cameras.find((cam) => cam.id === aliasedId);
      }

      if (!targetCamera) {
        const indexInput = parseInt(target, 10);
        if (!isNaN(indexInput) && indexInput > 0 && indexInput <= cameras.length) {
          targetCamera = cameras[indexInput - 1];
        } else {
          targetCamera = cameras.find((cam) =>
            cam.name.toLowerCase().includes(target.toLowerCase())
          );
        }
      }

      if (!targetCamera) {
        let errorMsg = `❌ Kamera dengan kata kunci *"${target}"* tidak ditemukan.\n\n*Kamera yang tersedia:* \n`;
        cameras.forEach((cam, index) => {
          const camData = aliasesObj[cam.id];
          const displayName = camData && camData.alias ? `${camData.alias.toUpperCase()} (Asli: ${cam.name})` : cam.name;
          errorMsg += `│ ${index + 1}. ${displayName}\n`;
        });
        await sock.sendMessage(
          jid,
          { text: errorMsg },
          { quoted: msg }
        );
        return;
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
          `• *IP Address:* ${targetCamera.ipAddress || targetCamera.url || "N/A"}\n` +
          `• *Firmware:* ${targetCamera.firmware || "N/A"}\n` +
          `• *MAC Address:* ${targetCamera.mac || "N/A"}\n` +
          `• *ID:* \`${targetCamera.id}\``;
        await sock.sendMessage(jid, { text: infoText }, { quoted: msg });
        return;
      }

      await sock.sendMessage(
        jid,
        { text: `⏳ Mengambil ${action === "video" ? `video clip ${duration} detik` : "snapshot"} dari kamera *${targetCamera.name}*...` },
        { quoted: msg }
      );

      if (action === "video") {
        const videoBuffer = await getNxVideo(client, token, targetCamera.id, duration);
        const captionText =
          `📹 *CCTV Video Clip (${duration}s)*\n\n` +
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
    } catch (error) {
      console.error(error);
      await sock.sendMessage(
        jid,
        {
          text: `❌ *Error CCTV:* ${error.message}\nPastikan konfigurasi CCTV_BASE_URL, CCTV_USER, dan CCTV_PASS di file .env sudah sesuai.`,
        },
        { quoted: msg }
      );
    }
  },
};
