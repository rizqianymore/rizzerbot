import axios from "axios";
import https from "https";
import fs from "fs";
import path from "path";

const getEnvVal = (key) => {
  if (process.env[key]) return process.env[key];
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
  return null;
};

const createAxiosClient = () => {
  return axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
    timeout: 15000,
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

export default {
  name: "cctv",
  description: "Monitoring CCTV Nx Witness (Network Optix) dengan pemilihan kamera.",
  usage: "[nomor/nama kamera]",
  example: "cctv 1",
  aliases: ["monitor", "cam", "nx"],
  category: "Owner",
  premiumOnly: false,
  ownerOnly: true,

  run: async (sock, msg, args, { sendTyping }) => {
    await sendTyping();

    const jid = msg.key.remoteJid;
    const client = createAxiosClient();
    const input = args.join(" ").trim();

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

      if (!input) {
        let menuText = "📹 *Daftar Kamera Nx Witness*\n\n";
        cameras.forEach((cam, index) => {
          const status = cam.statusFlags === "CSF_NoFlags" || !cam.statusFlags ? "🟢" : "🔴";
          menuText += `${index + 1}. ${status} *${cam.name}* (ID: \`${cam.id}\`)\n`;
        });
        menuText += "\n*Cara penggunaan:* Ketik `.cctv <nomor>` atau `.cctv <nama kamera>` untuk mengambil snapshot.";

        await sock.sendMessage(jid, { text: menuText }, { quoted: msg });
        return;
      }

      let targetCamera = null;
      const indexInput = parseInt(input, 10);

      if (!isNaN(indexInput) && indexInput > 0 && indexInput <= cameras.length) {
        targetCamera = cameras[indexInput - 1];
      } else {
        targetCamera = cameras.find((cam) =>
          cam.name.toLowerCase().includes(input.toLowerCase())
        );
      }

      if (!targetCamera) {
        await sock.sendMessage(
          jid,
          { text: `❌ Kamera dengan kata kunci *"${input}"* tidak ditemukan.` },
          { quoted: msg }
        );
        return;
      }

      await sock.sendMessage(
        jid,
        { text: `⏳ Mengambil snapshot dari kamera *${targetCamera.name}*...` },
        { quoted: msg }
      );

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
