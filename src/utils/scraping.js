import axios from "axios";
import https from "https";
import crypto from "crypto";

const createSecureAgent = () => {
  const ciphers = [
    "TLS_AES_256_GCM_SHA384",
    "TLS_CHACHA20_POLY1305_SHA256",
    "TLS_AES_128_GCM_SHA256",
    "ECDHE-ECDSA-AES256-GCM-SHA384",
    "ECDHE-RSA-AES256-GCM-SHA384",
    "ECDHE-ECDSA-CHACHA20-POLY1305",
    "ECDHE-RSA-CHACHA20-POLY1305",
    "ECDHE-ECDSA-AES128-GCM-SHA256",
    "ECDHE-RSA-AES128-GCM-SHA256",
    "AES256-GCM-SHA384",
    "AES128-GCM-SHA256",
  ].join(":");

  return new https.Agent({
    ciphers,
    honorCipherOrder: true,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3",
    rejectUnauthorized: false,
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    scheduling: "lifo",
  });
};

const secureHttpsAgent = createSecureAgent();

const browserProfiles = [
  {
    name: "Windows Chrome 134",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    clientHints: {
      "sec-ch-ua":
        '"Google Chrome";v="134", "Chromium";v="134", "Not.A/Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-ch-ua-full-version": '"134.0.6998.35"',
      "sec-ch-ua-platform-version": '"15.0.0"',
    },
    acceptLanguage: "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  },
  {
    name: "macOS Chrome 134",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    clientHints: {
      "sec-ch-ua":
        '"Google Chrome";v="134", "Chromium";v="134", "Not.A/Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-ch-ua-full-version": '"134.0.6998.35"',
      "sec-ch-ua-platform-version": '"15.3.0"',
    },
    acceptLanguage: "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  },
  {
    name: "Android Chrome 134",
    userAgent:
      "Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36",
    clientHints: {
      "sec-ch-ua":
        '"Google Chrome";v="134", "Chromium";v="134", "Not.A/Brand";v="24"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-ch-ua-full-version": '"134.0.6998.35"',
      "sec-ch-ua-platform-version": '"15"',
    },
    acceptLanguage: "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  },
  {
    name: "iPhone Safari 18.3",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
    clientHints: {},
    acceptLanguage: "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  },
];

function getRandomDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRequestId() {
  return crypto.randomBytes(8).toString("hex");
}

export function getCohesiveHeaders(method = "GET") {
  const profile =
    browserProfiles[Math.floor(Math.random() * browserProfiles.length)];
  const isPost = method.toUpperCase() === "POST";

  const baseHeaders = {
    "User-Agent": profile.userAgent,
    Accept: isPost
      ? "application/json, text/plain, */*"
      : "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": profile.acceptLanguage,
    "Accept-Encoding": "gzip, deflate, br, zstd",
    Connection: "keep-alive",
    ...profile.clientHints,
  };

  if (!isPost) {
    Object.assign(baseHeaders, {
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
    });
  } else {
    Object.assign(baseHeaders, {
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
    });
  }

  return baseHeaders;
}

async function executeWithRetry(requestFn, retries = 3, baseDelay = 1500) {
  const requestId = generateRequestId();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await requestFn();
      return result;
    } catch (err) {
      const status = err.response?.status;
      const errorMessage = err.message || "Unknown error";

      const isTransient =
        !status ||
        status === 429 ||
        (status >= 500 && status <= 504) ||
        status === 302 ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("ETIMEDOUT");

      if (
        !isTransient &&
        status &&
        status >= 400 &&
        status < 500 &&
        status !== 429
      ) {
        throw err;
      }

      if (attempt >= retries) {
        throw err;
      }

      const delay = baseDelay * Math.pow(2, attempt) + getRandomDelay(0, 500);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Deteksi proteksi Cloudflare WAF / Challenge page (ISO/IEC 27001 Application Resilience).
 * @param {object} response - Axios response atau error.response object
 * @returns {boolean}
 */
export function isCloudflareProtected(response) {
  if (!response) return false;

  const status = response.status;
  const headers = response.headers || {};
  const server = String(headers["server"] || "").toLowerCase();
  const cfMitigated = headers["cf-mitigated"];

  // 1. Cek Header WAF Cloudflare
  if (server.includes("cloudflare") && (status === 403 || status === 503 || cfMitigated === "challenge")) {
    return true;
  }

  // 2. Cek Body Signature jika berupa teks HTML
  const data = typeof response.data === "string" ? response.data : "";
  if (
    data.includes("Just a moment...") ||
    data.includes("cf-turnstile-wrapper") ||
    data.includes("challenge-platform") ||
    data.includes("cf-browser-verification")
  ) {
    return true;
  }

  return false;
}

function isPrivateIpOrHost(hostname) {
  if (!hostname) return true;
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    lower === "0.0.0.0" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    return true;
  }

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = lower.match(ipv4Regex);
  if (match) {
    const [, a, b] = match.map(Number);
    if (a === 10) return true; 
    if (a === 172 && b >= 16 && b <= 31) return true; 
    if (a === 192 && b === 168) return true; 
    if (a === 169 && b === 254) return true; 
    if (a === 127) return true; 
    if (a === 0) return true;
  }

  return false;
}

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (isPrivateIpOrHost(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function fetchHtml(url, options = {}) {
  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  return executeWithRetry(
    async () => {
      const res = await axios.get(url, {
        httpsAgent: secureHttpsAgent,
        headers: getCohesiveHeaders("GET"),
        timeout: options.timeout || 15000,
        decompress: true,
        maxRedirects: 5,
        validateStatus: (status) => status < 400 || status === 429,
        ...options,
      });

      return res.data;
    },
    options.retries || 3,
    options.baseDelay || 1500,
  );
}

export async function fetchJson(url, options = {}) {
  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  return executeWithRetry(
    async () => {
      const res = await axios.get(url, {
        httpsAgent: secureHttpsAgent,
        headers: {
          ...getCohesiveHeaders("GET"),
          Accept: "application/json, text/plain, */*",
          ...(options.headers || {}),
        },
        timeout: options.timeout || 15000,
        decompress: true,
        maxRedirects: 5,
        validateStatus: (status) => status < 400 || status === 429,
        responseType: "json",
        ...options,
      });

      return res;
    },
    options.retries || 3,
    options.baseDelay || 1500,
  );
}

export async function fetchBuffer(url, options = {}) {
  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  return executeWithRetry(
    async () => {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        httpsAgent: secureHttpsAgent,
        headers: {
          ...getCohesiveHeaders("GET"),
          Accept: "*/*",
          ...(options.headers || {}),
        },
        timeout: options.timeout || 25000,
        decompress: true,
        maxRedirects: 5,
        validateStatus: (status) => status < 400 || status === 429,
        ...options,
      });

      return Buffer.from(res.data);
    },
    options.retries || 3,
    options.baseDelay || 1500,
  );
}

export async function postForm(url, data, options = {}) {
  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  return executeWithRetry(
    async () => {
      const params = new URLSearchParams(data);
      const res = await axios.post(url, params.toString(), {
        httpsAgent: secureHttpsAgent,
        headers: {
          ...getCohesiveHeaders("POST"),
          "Content-Type": "application/x-www-form-urlencoded",
          ...(options.headers || {}),
        },
        timeout: options.timeout || 15000,
        decompress: true,
        maxRedirects: 5,
        validateStatus: (status) => status < 400 || status === 429,
        ...options,
      });

      return res;
    },
    options.retries || 3,
    options.baseDelay || 1500,
  );
}

export async function postJson(url, data, options = {}) {
  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  return executeWithRetry(
    async () => {
      const res = await axios.post(url, data, {
        httpsAgent: secureHttpsAgent,
        headers: {
          ...getCohesiveHeaders("POST"),
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        timeout: options.timeout || 15000,
        decompress: true,
        maxRedirects: 5,
        validateStatus: (status) => status < 400 || status === 429,
        responseType: "json",
        ...options,
      });

      return res.data;
    },
    options.retries || 3,
    options.baseDelay || 1500,
  );
}

export async function customRequest(url, config = {}) {
  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  const method = (config.method || "GET").toUpperCase();

  return executeWithRetry(
    async () => {
      const res = await axios({
        url,
        httpsAgent: secureHttpsAgent,
        headers: {
          ...getCohesiveHeaders(method),
          ...(config.headers || {}),
        },
        timeout: config.timeout || 15000,
        decompress: true,
        maxRedirects: config.maxRedirects || 5,
        validateStatus:
          config.validateStatus || ((status) => status < 400 || status === 429),
        ...config,
      });

      return res;
    },
    config.retries || 3,
    config.baseDelay || 1500,
  );
}

export default {
  fetchHtml,
  fetchJson,
  fetchBuffer,
  postForm,
  postJson,
  customRequest,
  getCohesiveHeaders,
};
