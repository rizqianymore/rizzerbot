const DEFAULT_GATEWAY = "https://gateway.ypt.or.id";
const ISSUE_AUTH_PATH = "/telkomschool/student/issueauth/web";
const ORIGIN = "https://digits.telkomschools.sch.id";

const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36";

export function normalizeNis(value) {
  return String(value || "").replace(/\D/g, "");
}

export function defaultPassword(nis) {
  return `dummy@${normalizeNis(nis)}`;
}

export function gatewayBase() {
  return (process.env.TELKOM_GATEWAY_BASE || DEFAULT_GATEWAY).replace(/\/+$/, "");
}

export function decodeJwtPayload(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function extractSessionCookie(setCookie) {
  if (!setCookie) return null;
  const first = String(setCookie).split(",")[0].split(";")[0].trim();
  return first || null;
}

/**
 * Login siswa Telkom Schools (DigitS) memakai NIS.
 * Password default: dummy@<NIS>.
 * @returns {Promise<{token: string, expired: number, expiresAt: Date, claims: object|null, cookie: string|null}>}
 */
export async function issueStudentToken(nis, password) {
  const username = normalizeNis(nis);
  if (username.length < 5) {
    throw new Error("NIS tidak valid (minimal 5 digit angka).");
  }

  const pass = String(password || "").trim() || defaultPassword(username);

  const form = new FormData();
  form.append("username", username);
  form.append("password", pass);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  let res;
  try {
    res = await fetch(`${gatewayBase()}${ISSUE_AUTH_PATH}`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        Origin: ORIGIN,
        Referer: `${ORIGIN}/`,
        "User-Agent": UA,
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
      },
      body: form,
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
    data = JSON.parse(text);
  } catch (_) {}

  if (!res.ok || !data?.token) {
    const message = data?.message || data?.error || (text ? text.slice(0, 160) : `HTTP ${res.status}`);
    throw new Error(`Login gagal: ${message}`);
  }

  const expired = Number(data.expired) > 0 ? Number(data.expired) : 86400;

  return {
    token: data.token,
    expired,
    expiresAt: new Date(Date.now() + expired * 1000),
    claims: decodeJwtPayload(data.token),
    cookie: extractSessionCookie(res.headers.get("set-cookie")),
  };
}
