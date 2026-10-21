import { gatewayBase } from "./auth.js";

const ORIGIN = "https://digits.telkomschools.sch.id";
const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36";

function buildQuery(params) {
  if (!params || typeof params !== "object") return "";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

/**
 * Request read-only ke gateway Telkom Schools memakai token hasil issueauth.
 * Tidak dipakai untuk mengubah/mengirim data presensi.
 */
export async function telkomRequest(path, { token, cookie, method = "GET", query, timeoutMs = 20000 } = {}) {
  const cleanPath = String(path || "").trim();
  if (!cleanPath.startsWith("/")) {
    throw new Error("Path API tidak valid (harus diawali '/').");
  }
  if (!token) {
    throw new Error("Token tidak tersedia. Login terlebih dahulu.");
  }

  const headers = {
    Accept: "application/json, text/plain, */*",
    Authorization: `Bearer ${token}`,
    Origin: ORIGIN,
    Referer: `${ORIGIN}/`,
    "User-Agent": UA,
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    ...(cookie ? { Cookie: cookie } : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${gatewayBase()}${cleanPath}${buildQuery(query)}`, {
      method,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw new Error("Timeout saat menghubungi server Telkom Schools.");
    throw new Error(`Gagal terhubung ke server Telkom Schools: ${err?.message || err}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }

  if (!res.ok) {
    const message =
      (data && typeof data === "object" ? data.message || data.error : null) ||
      (typeof data === "string" ? data.slice(0, 160) : `HTTP ${res.status}`);
    throw new Error(`API ${res.status}: ${message}`);
  }

  return data;
}

/**
 * Path GET untuk membaca status presensi (read-only).
 * Isi TELKOM_STATUS_PATH setelah capture request GET halaman presensi di DevTools.
 */
export function getStatusPath() {
  return String(process.env.TELKOM_STATUS_PATH || process.env.TELKOM_PROFILE_PATH || "").trim() || null;
}

export async function getAttendanceStatus(token, cookie) {
  const path = getStatusPath();
  if (!path) return null;
  return telkomRequest(path, { token, cookie });
}
