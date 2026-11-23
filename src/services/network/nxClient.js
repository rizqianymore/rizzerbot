import https from "node:https";
import axios from "axios";
import { db } from "@/src/core/database.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  maxSockets: 20,
  maxFreeSockets: 5,
  keepAliveMsecs: 30000,
});

function getNxConfig() {
  const settings = db.getSettings?.() || {};
  const env = settings.env || {};

  const baseUrl = (process.env.CCTV_BASE_URL || env.CCTV_BASE_URL || "").replace(/\/+$/, "");
  const username = process.env.CCTV_USER || env.CCTV_USER || "";
  const password = process.env.CCTV_PASS || env.CCTV_PASS || "";

  if (!baseUrl || !username || !password) {
    throw new Error(
      "Konfigurasi CCTV (CCTV_BASE_URL, CCTV_USER, CCTV_PASS) belum diatur di .env atau database settings."
    );
  }

  return { baseUrl, username, password };
}

let cachedSession = {
  token: null,
  expireAt: 0,
};

let tokenInflightPromise = null;
const SESSION_TTL_MS = 25 * 60 * 1000;

export async function getNxToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSession.token && now < cachedSession.expireAt) {
    return cachedSession.token;
  }

  if (tokenInflightPromise && !forceRefresh) {
    return tokenInflightPromise;
  }

  const { baseUrl, username, password } = getNxConfig();

  tokenInflightPromise = (async () => {
    try {
      const response = await axios.post(
        `${baseUrl}/rest/v2/login/sessions`,
        { username, password },
        {
          httpsAgent,
          timeout: 8000,
          headers: { "Content-Type": "application/json" },
        }
      );

      const token = response.data?.token;
      if (!token) {
        throw new Error("Respon server Nx tidak mengembalikan token sesi.");
      }

      cachedSession = {
        token,
        expireAt: Date.now() + SESSION_TTL_MS,
      };

      return token;
    } finally {
      tokenInflightPromise = null;
    }
  })();

  return tokenInflightPromise;
}

export async function getNxCameras() {
  let token = await getNxToken();
  const { baseUrl } = getNxConfig();

  const fetchDevices = async (authToken) => {
    return await axios.get(`${baseUrl}/rest/v2/devices`, {
      headers: { Authorization: `Bearer ${authToken}` },
      httpsAgent,
      timeout: 10000,
    });
  };

  let response;
  try {
    response = await fetchDevices(token);
  } catch (err) {
    if (err.response?.status === 401) {
      cachedSession = { token: null, expireAt: 0 };
      token = await getNxToken(true);
      response = await fetchDevices(token);
    } else {
      throw new Error(`Gagal mengambil daftar kamera Nx: ${err.response?.data?.errorString || err.message}`);
    }
  }

  if (Array.isArray(response.data)) {
    return response.data
      .filter((d) => {
        const type = String(d.deviceType || "").toLowerCase();
        return type === "camera" || Boolean(d.name);
      })
      .map((d) => ({
        id: d.id,
        name: d.name || "Kamera CCTV",
        status: d.status || (d.statusFlags === "CSF_NoFlags" || !d.statusFlags ? "Online" : "Offline"),
        vendor: d.vendor || "-",
        model: d.model || "-",
        url: `${baseUrl}/rest/v2/devices/${d.id}/image`,
      }));
  }
  return [];
}

export async function getNxSnapshot(cameraId) {
  if (!cameraId) throw new Error("ID kamera tidak boleh kosong.");
  let token = await getNxToken();
  const { baseUrl } = getNxConfig();

  try {
    const response = await axios.get(`${baseUrl}/rest/v2/devices/${cameraId}/image`, {
      headers: { Authorization: `Bearer ${token}` },
      httpsAgent,
      responseType: "arraybuffer",
      timeout: 10000,
    });
    if (response.data && response.data.length > 500) {
      return Buffer.from(response.data);
    }
  } catch (e1) {
    if (e1.response?.status === 401) {
      token = await getNxToken(true);
    }
  }

  try {
    const response = await axios.get(`${baseUrl}/ec2/cameraThumbnail`, {
      params: { cameraId, width: 1280, height: 720 },
      headers: { Authorization: `Bearer ${token}` },
      httpsAgent,
      responseType: "arraybuffer",
      timeout: 10000,
    });
    if (response.data && response.data.length > 500) {
      return Buffer.from(response.data);
    }
  } catch (_) {}

  throw new Error(`Gagal mengambil snapshot live dari kamera ${cameraId}.`);
}

export async function getNxVideo(cameraId, duration = 8) {
  if (!cameraId) throw new Error("ID kamera tidak boleh kosong.");
  let token = await getNxToken();
  const { baseUrl } = getNxConfig();

  const fetchVideo = async (authToken) => {
    return await axios.get(`${baseUrl}/media/${cameraId}.mp4`, {
      params: {
        duration: Math.min(15, Math.max(3, duration)),
        codec: "h264",
      },
      headers: { Authorization: `Bearer ${authToken}` },
      httpsAgent,
      responseType: "arraybuffer",
      timeout: 18000,
    });
  };

  let response;
  try {
    response = await fetchVideo(token);
  } catch (err) {
    if (err.response?.status === 401) {
      cachedSession = { token: null, expireAt: 0 };
      token = await getNxToken(true);
      response = await fetchVideo(token);
    } else {
      throw err;
    }
  }

  if (!response?.data || response.data.length < 1000) {
    throw new Error(`Rekaman video kamera ${cameraId} kosong atau tidak tersedia.`);
  }

  return Buffer.from(response.data);
}
