import axios from "axios";
import { findDeepSeekPowNonce } from "@/src/utils/deepseek-pow-hash.js";

export const DEEPSEEK_WEB_BASE = "https://chat.deepseek.com";
const DEEPSEEK_API_BASE = `${DEEPSEEK_WEB_BASE}/api`;
const COMPLETION_URL = `${DEEPSEEK_API_BASE}/v0/chat/completion`;

const FAKE_HEADERS = {
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
  } catch (_) { }
  return trimmed;
}

function generateFakeCookie() {
  const ts = Date.now();
  const hex = (n) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
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

/**
 * DeepSeek Web Executor with Automatic Session & Token Refresh.
 * Derived from OmniRoute v3.8.51 (open-sse/executors/deepseek-web-with-auto-refresh.ts).
 */
export class DeepSeekWebWithAutoRefresh {
  constructor(config = {}) {
    this.refreshConfig = {
      sessionRefreshInterval: 50 * 60 * 1000, // 50 menit
      maxRefreshRetries: 3,
      autoRefresh: true,
      ...config,
    };
    this.tokenCache = new Map();
    this.sessionCache = new Map();
    this.lastRefreshTime = 0;
    this.refreshTimer = null;
    this.sessionValid = false;
    this.currentUserToken = "";
  }

  setCurrentUserToken(userToken) {
    const clean = extractUserToken(userToken);
    if (!clean || this.currentUserToken === clean) return;
    this.currentUserToken = clean;
    this.sessionValid = false;
    if (this.refreshConfig.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  startAutoRefresh() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(async () => {
      if (!this.currentUserToken) return;
      try {
        await this.doRefreshSession();
      } catch (err) {
        console.error("[DeepSeek-Web] Auto-refresh session error:", err.message);
      }
    }, this.refreshConfig.sessionRefreshInterval);

    if (this.refreshTimer && typeof this.refreshTimer.unref === "function") {
      this.refreshTimer.unref();
    }
  }

  async acquireAccessToken(userToken) {
    const cached = this.tokenCache.get(userToken);
    if (cached && cached.expiresAt > Math.floor(Date.now() / 1000)) {
      return cached.accessToken;
    }

    const resp = await fetch(`${DEEPSEEK_API_BASE}/v0/users/current`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        ...FAKE_HEADERS,
      },
    });

    if (resp.status === 401 || resp.status === 403) {
      this.tokenCache.delete(userToken);
      throw new Error("Token DeepSeek tidak valid atau kedaluwarsa. Ambil userToken baru di chat.deepseek.com");
    }
    if (!resp.ok) {
      throw new Error(`Gagal mengambil users/current (HTTP ${resp.status})`);
    }

    const json = await resp.json();
    if (json?.code && json.code !== 0) {
      this.tokenCache.delete(userToken);
      throw new Error(`DeepSeek menolak token: ${json.msg || json?.data?.biz_msg || `code ${json.code}`}`);
    }

    const bizData = json?.data?.biz_data || json?.biz_data;
    if (!bizData?.token) {
      throw new Error("Gagal memperoleh access token dari DeepSeek");
    }

    const accessToken = bizData.token;
    this.tokenCache.set(userToken, {
      accessToken,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    this.sessionValid = true;
    this.lastRefreshTime = Date.now();
    return accessToken;
  }

  async doRefreshSession() {
    if (!this.currentUserToken) {
      this.sessionValid = false;
      throw new Error("userToken tidak tersedia untuk refresh session");
    }
    this.tokenCache.delete(this.currentUserToken);
    const accessToken = await this.acquireAccessToken(this.currentUserToken);
    if (accessToken) {
      this.lastRefreshTime = Date.now();
      this.sessionValid = true;
    }
  }

  async createSession(accessToken) {
    const resp = await fetch(`${DEEPSEEK_API_BASE}/v0/chat_session/create`, {
      method: "POST",
      headers: {
        ...FAKE_HEADERS,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        Cookie: generateFakeCookie(),
      },
      body: JSON.stringify({}),
    });

    if (!resp.ok) throw new Error(`chat_session/create error HTTP ${resp.status}`);
    const json = await resp.json();
    const bizData = json?.data?.biz_data || json?.biz_data;
    const id = bizData?.chat_session?.id;
    if (!id) throw new Error(`Gagal membuat chat session DeepSeek: ${json?.msg || ""}`);
    return id;
  }

  async deleteSession(accessToken, sessionId) {
    try {
      await fetch(`${DEEPSEEK_API_BASE}/v0/chat_session/delete`, {
        method: "POST",
        headers: {
          ...FAKE_HEADERS,
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ chat_session_id: sessionId }),
      });
    } catch (_) { }
  }

  async getPowChallenge(accessToken) {
    const resp = await fetch(`${DEEPSEEK_API_BASE}/v0/chat/create_pow_challenge`, {
      method: "POST",
      headers: {
        ...FAKE_HEADERS,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ target_path: "/api/v0/chat/completion" }),
    });

    if (!resp.ok) throw new Error(`create_pow_challenge HTTP ${resp.status}`);
    const json = await resp.json();
    const bizData = json?.data?.biz_data || json?.biz_data;
    if (!bizData?.challenge?.challenge) {
      throw new Error("Gagal memperoleh challenge PoW dari DeepSeek");
    }
    return bizData.challenge;
  }

  /**
   * Send a chat completion request to DeepSeek Web.
   */
  async chat(prompt, { thinking = false, search = false, userToken = null } = {}) {
    const token = extractUserToken(
      userToken ||
      this.currentUserToken ||
      process.env.DEEPSEEK_COOKIE_TOKEN ||
      process.env.DEEPSEEK_TOKEN ||
      process.env.DEEPSEEK_USER_TOKEN
    );
    if (!token) {
      throw new Error(
        "DEEPSEEK_COOKIE_TOKEN belum diatur. Masukkan userToken dari chat.deepseek.com ke .env (DEEPSEEK_COOKIE_TOKEN)."
      );
    }
    this.setCurrentUserToken(token);

    let accessToken = await this.acquireAccessToken(token);
    const sessionId = await this.createSession(accessToken);

    try {
      const powChallenge = await this.getPowChallenge(accessToken);
      const powAnswer = solvePow(powChallenge);

      const reqHeaders = {
        ...FAKE_HEADERS,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Ds-Pow-Response": powAnswer,
        "X-Client-Timezone-Offset": String(new Date().getTimezoneOffset() * -60),
        Cookie: generateFakeCookie(),
      };

      const requestPayload = {
        chat_session_id: sessionId,
        parent_message_id: null,
        model_type: "deepseek_chat",
        prompt,
        ref_file_ids: [],
        thinking_enabled: Boolean(thinking),
        search_enabled: Boolean(search),
        preempt: false,
      };

      const resp = await fetch(COMPLETION_URL, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify(requestPayload),
      });

      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          this.tokenCache.delete(token);
          throw new Error("Token DeepSeek kedaluwarsa saat request. Silakan perbarui userToken.");
        }
        if (resp.status === 429) {
          throw new Error("DeepSeek sedang terkena rate limit (terlalu banyak request). Coba beberapa saat lagi.");
        }
        throw new Error(`DeepSeek API error (HTTP ${resp.status})`);
      }

      // Read SSE stream
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reasoningContent = "";
      let answerContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:") && !line.startsWith("data: ")) continue;
          const payload = line.replace(/^data:\s*/, "").trim();
          if (payload === "[DONE]") break;

          let data;
          try {
            data = JSON.parse(payload);
          } catch (_) {
            continue;
          }

          const v = data?.v;
          const p = data?.p;

          if (v && typeof v === "object" && v.response) {
            const fragments = v.response.fragments;
            if (Array.isArray(fragments)) {
              for (const frag of fragments) {
                if (frag?.type === "THINK") reasoningContent += frag.content || "";
                else if (frag?.type === "ANSWER" || frag?.type === "RESPONSE") answerContent += frag.content || "";
              }
            }
          }

          if (p === "response/fragments") {
            const fragments = Array.isArray(v) ? v : [v];
            for (const frag of fragments) {
              if (frag?.type === "THINK") reasoningContent += frag?.content || "";
              else if (frag?.type === "ANSWER" || frag?.type === "RESPONSE") answerContent += frag?.content || "";
            }
          }

          if (typeof v === "string") {
            answerContent += v;
          }
        }
      }

      return {
        answer: answerContent.trim(),
        reasoning: reasoningContent.trim() || null,
        thinkingEnabled: Boolean(thinking),
        source: "deepseek-web",
      };
    } finally {
      // Best-effort cleanup session
      this.deleteSession(accessToken, sessionId).catch(() => { });
    }
  }

  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

export const deepseekWebExecutor = new DeepSeekWebWithAutoRefresh();

/**
 * Main AI Gateway function for DeepSeek.
 * Automatically tries:
 * 1. DeepSeek Web (with auto-refresh and PoW solver) if DEEPSEEK_COOKIE_TOKEN is available
 * 2. Official DeepSeek API (api.deepseek.com) if DEEPSEEK_API_KEY is available
 * 3. Public AI Gateway fallback (Pollinations AI) if no token is configured
 */
export async function askDeepSeek(prompt, { thinking = false, search = false, userToken = null } = {}) {
  const token = extractUserToken(
    userToken ||
      process.env.DEEPSEEK_COOKIE_TOKEN ||
      process.env.DEEPSEEK_TOKEN ||
      process.env.DEEPSEEK_USER_TOKEN
  );
  const apiKey = process.env.DEEPSEEK_API_KEY;

  // 1. DeepSeek Web via OmniRoute logic
  if (token) {
    try {
      return await deepseekWebExecutor.chat(prompt, { thinking, search, userToken: token });
    } catch (err) {
      console.warn("[AI Gateway] DeepSeek Web failed, falling back:", err.message);
      if (!apiKey) throw err;
    }
  }

  // 2. Official DeepSeek API if API key provided
  if (apiKey) {
    try {
      const model = thinking ? "deepseek-reasoner" : "deepseek-chat";
      const { data } = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model,
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 45000,
        }
      );

      const choice = data?.choices?.[0]?.message;
      return {
        answer: choice?.content?.trim() || "Tidak ada jawaban.",
        reasoning: choice?.reasoning_content?.trim() || null,
        thinkingEnabled: Boolean(thinking),
        source: "deepseek-api",
      };
    } catch (err) {
      console.warn("[AI Gateway] DeepSeek API failed:", err.message);
      throw new Error(`DeepSeek API error: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  // 3. Zero-Config Public AI Gateway Fallback (Pollinations AI)
  try {
    const { data } = await axios.post(
      "https://text.pollinations.ai/openai",
      {
        model: "openai-fast",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 40000,
      }
    );

    const answer = data?.choices?.[0]?.message?.content || (typeof data === "string" ? data : "");
    if (!answer) throw new Error("Gagal menerima jawaban dari gateway publik.");

    return {
      answer: answer.trim(),
      reasoning: null,
      thinkingEnabled: false,
      source: "public-gateway",
      isFallback: true,
    };
  } catch (err) {
    throw new Error(
      "DeepSeek belum dikonfigurasi. Masukkan DEEPSEEK_COOKIE_TOKEN di .env untuk menggunakan DeepSeek Web resmi."
    );
  }
}
