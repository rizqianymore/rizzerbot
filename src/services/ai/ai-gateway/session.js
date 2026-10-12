import { DEEPSEEK_API_BASE, FAKE_HEADERS, extractUserToken, generateFakeCookie } from "./constants.js";

export class DeepSeekWebSession {
  constructor(config = {}) {
    this.refreshConfig = {
      sessionRefreshInterval: 50 * 60 * 1000,
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
}
