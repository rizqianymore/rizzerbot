import crypto from "node:crypto";

const BASE_URL = "https://chatbotchatapp.com";
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36";

function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

function genNonce() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (e) {
    const t = (16 * Math.random()) | 0;
    return ("x" === e ? t : (3 & t) | 8).toString(16);
  });
}

/**
 * Inisialisasi sesi & ekstrak CSRF token serta YPP dari chatbotchatapp.com
 */
async function initSession() {
  const headers = {
    "User-Agent": USER_AGENT,
    "sec-ch-ua": '"Chromium";v="152", "Not?A_Brand";v="24", "Brave";v="152"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "accept-language": "en-US,en;q=0.6",
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  };

  const res = await fetch(`${BASE_URL}/`, { headers });
  const html = await res.text();

  const rawCookies = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie") || ""];

  const cookieMap = {};
  for (const c of rawCookies.filter(Boolean)) {
    const parts = c.split(";")[0].split("=");
    if (parts.length >= 2) {
      cookieMap[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  }

  const csrfMatch = html.match(
    /<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i
  );
  const csrfToken = csrfMatch
    ? csrfMatch[1]
    : cookieMap["XSRF-TOKEN"]
    ? decodeURIComponent(cookieMap["XSRF-TOKEN"])
    : "";

  const yppMatch = html.match(/const\s+ypp\s*=\s*["']([^"']+)["']/i);
  const ypp = yppMatch ? yppMatch[1] : "0331d17f86c5302f8853f76d4475f3b8";

  return { csrfToken, ypp, cookieMap };
}

/**
 * Mengambil timestamp & sinkronisasi cookie
 */
async function getTimestamp(csrfToken, ypp, cookieMap) {
  const cookieString = Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const res = await fetch(`${BASE_URL}/api/get-timestamp`, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-csrf-token": csrfToken,
      "x-requested-with": "XMLHttpRequest",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      Cookie: cookieString,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "sec-gpc": "1",
    },
    body: `href=${encodeURIComponent(BASE_URL + "/")}&ypp=${ypp}`,
  });

  const rawCookies = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie") || ""];
  for (const c of rawCookies.filter(Boolean)) {
    const parts = c.split(";")[0].split("=");
    if (parts.length >= 2) {
      cookieMap[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  }

  if (!res.ok) {
    throw new Error(`get-timestamp failed (${res.status}): ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Menghasilkan hash ID sesuai algoritma genKey chatbotchatapp
 */
function generateHashId(timestamp, nonce, content) {
  const s = {
    timestamp,
    nonce,
    messages: content,
  };

  let str = "";
  for (const [k, v] of Object.entries(s)) {
    str += k + v;
  }
  str += "keyTokenXXXXXXYYYvv1";

  return md5(str);
}

/**
 * Melakukan interaksi tanya-jawab dengan ChatbotChatApp
 * @param {string} prompt
 * @param {object} [options]
 */
export async function askChatbotChatApp(prompt, options = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt/pertanyaan tidak boleh kosong.");
  }

  const cleanPrompt = prompt.trim();
  const { csrfToken, ypp, cookieMap } = await initSession();
  const tsData = await getTimestamp(csrfToken, ypp, cookieMap);

  const timestamp = tsData.timestamp || Math.floor(Date.now() / 1000);
  const nonce = genNonce();
  const id = generateHashId(timestamp, nonce, cleanPrompt);

  let cookieString = Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const countryCode = tsData.ipInfo?.country_code2 || "ID";
  cookieString += `; ipInfoOfCookie={"country_code2":"${countryCode}"}`;

  const payload = {
    id,
    timestamp,
    nonce,
    messages: [
      ...(options.history || []),
      {
        role: "user",
        content: cleanPrompt,
        thoughts: "",
        attachments: "",
        toolNameHints: [],
        functionCall: "",
        dataAdd: "",
        timestamp: Date.now(),
        model: null,
      },
    ],
    url: `${BASE_URL}/`,
    modal: null,
  };

  const response = await fetch(`${BASE_URL}/api`, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/event-stream",
      "x-csrf-token": csrfToken,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      Cookie: cookieString,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "sec-gpc": "1",
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || contentType.includes("text/html")) {
    const rawText = await response.text().catch(() => "");
    if (rawText.includes("1002") || rawText.includes("1006")) {
      throw new Error(
        "ChatbotChatApp mengembalikan kode proteksi/limit sesi (1002/1006). Server membatasi akses tanpa verifikasi browser aktif."
      );
    }
    throw new Error(
      `ChatbotChatApp Error (${response.status}): ${rawText.slice(0, 150)}`
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Tidak dapat membaca stream data dari ChatbotChatApp.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let conversationId = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;

      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;

      try {
        const json = JSON.parse(dataStr);
        if (json.conversationId) conversationId = json.conversationId;

        const parts =
          json.choices?.[0]?.content?.parts ||
          json.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (part && typeof part.text === "string") {
              answer += part.text;
            }
          }
        }
      } catch (_) {}
    }
  }

  const finalAnswer = answer.trim();
  if (!finalAnswer) {
    throw new Error("Respon kosong diterima dari ChatbotChatApp.");
  }

  return {
    status: true,
    answer: finalAnswer,
    conversationId,
  };
}
