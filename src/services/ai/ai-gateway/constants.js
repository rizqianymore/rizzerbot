import { findDeepSeekPowNonce } from "@/src/utils/deepseek-pow-hash.js";

export const DEEPSEEK_WEB_BASE = "https://chat.deepseek.com";
export const DEEPSEEK_API_BASE = `${DEEPSEEK_WEB_BASE}/api`;
export const COMPLETION_URL = `${DEEPSEEK_API_BASE}/v0/chat/completion`;

export const FAKE_HEADERS = {
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: DEEPSEEK_WEB_BASE,
  Referer: `${DEEPSEEK_WEB_BASE}/`,
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
  "X-Client-Bundle-Id": "com.deepseek.chat",
  "X-Client-Locale": "en-US",
  "X-Client-Platform": "web",
  "X-Client-Version": "2.0.0",
};

export function extractUserToken(rawToken) {
  if (!rawToken || typeof rawToken !== "string") return null;
  const trimmed = rawToken.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed?.value === "string") return parsed.value;
  } catch (_) {}
  return trimmed;
}

export function generateFakeCookie() {
  const ts = Date.now();
  const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const uid = () =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  return `intercom-HWWAFSESTIME=${ts}; HWWAFSESID=${hex(18)}; Hm_lvt_${uid()}=${Math.floor(ts / 1000)}; _frid=${uid()}`;
}

export function solvePow(challenge) {
  if (!challenge || !challenge.challenge || !challenge.salt) {
    throw new Error("Invalid PoW challenge data received from DeepSeek");
  }
  const prefix = `${challenge.salt}_${challenge.expire_at}_`;
  const answer = findDeepSeekPowNonce(prefix, challenge.challenge, challenge.difficulty);
  if (answer < 0) {
    throw new Error("Gagal menghitung nonce PoW DeepSeek");
  }

  return Buffer.from(
    JSON.stringify({
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      salt: challenge.salt,
      answer,
      signature: challenge.signature,
      target_path: challenge.target_path,
    })
  ).toString("base64");
}
