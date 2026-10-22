/**
 * Bright Data Web Unlocker via NATIVE PROXY (bukan REST API).
 *
 * Contoh akses dari dashboard BrightData:
 *   host     : brd.superproxy.io
 *   port     : 44445
 *   username : brd-customer-<CUSTOMER>-zone-<ZONE>
 *   password : <PROXY PASSWORD>
 *
 * Cara pakai:
 *   curl -i --proxy brd.superproxy.io:44445 \
 *        --proxy-user brd-customer-<CUSTOMER>-zone-<ZONE>:<PASSWORD> \
 *        -k "https://target"
 *
 * Keunggulan vs REST API: host-nya beda (brd.superproxy.io) dan sering tetap
 * terjangkau walau api.brightdata.com diblokir. Cocok jadi jalur kedua
 * (setelah REST) pada rantai anti-protection di `scraper/chain.js`.
 */

import https from "https";
import * as HttpsProxyAgentModule from "https-proxy-agent";

// v7 mengekspor { HttpsProxyAgent }, v5 mengekspor default.
const HttpsProxyAgent = HttpsProxyAgentModule.HttpsProxyAgent || HttpsProxyAgentModule.default || HttpsProxyAgentModule;

// https-proxy-agent harus v7+ (v5 bentrok dengan agent-base v6 & opsi TLS-nya beda).
if (!Object.prototype.hasOwnProperty.call(HttpsProxyAgent.prototype || {}, "connect")) {
  console.warn("[Unlocker] https-proxy-agent versi lama terdeteksi - jalankan: npm install https-proxy-agent@^7");
}

const DEFAULT_HOST = "brd.superproxy.io";
const DEFAULT_PORT = 44445;

/**
 * Konfigurasi native proxy (Web Unlocker, port 44445).
 *
 * CATATAN: tiap zone Bright Data punya password sendiri:
 *   - native proxy   : BRIGHTDATA_PROXY_ZONE (default BRIGHTDATA_ZONE / web_unlocker2)
 *                      + BRIGHTDATA_PROXY_PASSWORD
 *   - remote browser : BRIGHTDATA_SCRAPING_BROWSER_ZONE (default scraping_browser1)
 *                      + BRIGHTDATA_SCRAPING_BROWSER_PASSWORD
 * Jangan campur password antar zone.
 */
export function nativeProxyConfig() {
  const direct = String(process.env.BRIGHTDATA_PROXY || "").trim();
  if (direct) {
    try {
      const url = new URL(direct.includes("://") ? direct : `http://${direct}`);
      return {
        host: url.hostname,
        port: Number(url.port) || DEFAULT_PORT,
        username: decodeURIComponent(url.username || ""),
        password: decodeURIComponent(url.password || ""),
      };
    } catch (_) {
      return null;
    }
  }

  const customer = String(process.env.BRIGHTDATA_CUSTOMER || "").trim();
  const password = String(process.env.BRIGHTDATA_PROXY_PASSWORD || process.env.BRIGHTDATA_PASSWORD || "").trim();
  // Zone native proxy (Web Unlocker). PENTING: tiap zone punya password
  // sendiri, jangan pakai password zone lain.
  const zone = String(process.env.BRIGHTDATA_PROXY_ZONE || process.env.BRIGHTDATA_ZONE || "web_unlocker2").trim();
  if (!customer || !password) return null;

  return {
    host: String(process.env.BRIGHTDATA_PROXY_HOST || DEFAULT_HOST).trim(),
    port: Number(process.env.BRIGHTDATA_PROXY_PORT) || DEFAULT_PORT,
    username: `brd-customer-${customer}-zone-${zone}`,
    password,
  };
}

/** Native proxy aktif? (umumnya: kredensial zone Web Unlocker terisi). */
export function nativeProxyAvailable() {
  if (String(process.env.BRIGHTDATA_PROXY_ENABLED ?? "1").trim() === "0") return false;
  return Boolean(nativeProxyConfig());
}

/**
 * Agent proxy yang mengabaikan sertifikat proxy.
 *
 * Bright Data memakai sertifikat sendiri (belum berotorasi publik) —
 * sama seperti perlu flag `-k` pada curl.
 *
 * Deteksi versi (penting!):
 *   - v7  : constructor(proxy, connectOpts)  -> "connect" adalah method milik sendiri
 *   - v5  : constructor(opts) + callback(req, opts)
 * (v5 mewarisi method "connect" dari agent-base, jadi harus dicek own-property)
 */
export function createProxyAgent(proxy) {
  const isV7 = Object.prototype.hasOwnProperty.call(HttpsProxyAgent.prototype, "connect");

  if (isV7) {
    return new HttpsProxyAgent(
      {
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
      },
      { rejectUnauthorized: false }
    );
  }

  // v5: opsi TLS diambil dari request options -> override callback.
  class InsecureProxyAgent extends HttpsProxyAgent {
    callback(req, opts) {
      return super.callback(req, { ...opts, rejectUnauthorized: false });
    }
  }
  return new InsecureProxyAgent({
    host: proxy.host,
    port: proxy.port,
    auth: `${proxy.username}:${proxy.password}`,
    rejectUnauthorized: false,
  });
}

/** Konversi FormData native -> form-data (dipakai saat body berupa multipart). */
async function toAxiosForm(form) {
  const { default: FormDataPkg } = await import("form-data");
  const fd = new FormDataPkg();
  for (const [key, value] of form.entries()) {
    fd.append(key, typeof value === "string" ? value : String(value));
  }
  return fd;
}

/**
 * Request lewat native proxy Bright Data (unlocker solving challenge).
 *
 * Pakai https.request langsung (bukan axios) karena axios membuat agent
 * tunnel sendiri dan menimpa opsi TLS (rejectUnauthorized) kita.
 *
 * @param {string} url target http/https
 * @param {object} options
 * @param {string} [options.method="GET"]
 * @param {object} [options.headers]
 * @param {*} [options.body] objek/string body
 * @param {number} [options.timeoutMs=20000]
 * @param {boolean} [options.isForm=false] body dikirim sebagai multipart/form-data
 * @param {boolean} [options.raw=false] hasil dikembalikan sebagai Buffer
 * @returns {Promise<{status:number, data:any, headers:object}>}
 */
export async function proxyRequest(
  url,
  { method = "GET", headers = {}, body = null, timeoutMs = 20000, isForm = false, raw = false } = {}
) {
  const proxy = nativeProxyConfig();
  if (!proxy) throw new Error("Native proxy Bright Data belum dikonfigurasi.");

  const agent = createProxyAgent(proxy);

  const requestHeaders = { ...headers };
  let payload = null;
  if (isForm && body) {
    const fd = await toAxiosForm(body);
    payload = fd.getBuffer();
    Object.assign(requestHeaders, fd.getHeaders());
  } else if (body !== undefined && body !== null) {
    payload = typeof body === "string" ? body : JSON.stringify(body);
    if (!requestHeaders["Content-Type"]) requestHeaders["Content-Type"] = "application/json";
  }
  if (payload) requestHeaders["Content-Length"] = Buffer.byteLength(payload);

  const result = await new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method,
        headers: requestHeaders,
        agent,
        timeout: timeoutMs,
        // Bright Data-proxy_forwarded-connection MITM TLS dengan sertifikat
        // internal mereka (tidak berotorasi publik) - sama seperti -k di curl.
        // Verifikasi sertifikat target dimatikan khusus jalur proxy ini.
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode || 0,
            headers: res.headers || {},
            raw: Buffer.concat(chunks),
          })
        );
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error(`Timeout ${timeoutMs}ms lewat proxy`)));
    if (payload) req.write(payload);
    req.end();
  });

  // Error dari sisi proxy Bright Data (mis. IP ke-denylist, kuota habis).
  const proxyError = result.headers["x-brd-err-msg"] || result.headers["x-brd-error"];
  if (proxyError) {
    const err = new Error(`Bright Data proxy: ${proxyError}`);
    err.code = "brightdata_proxy_error";
    err.status = result.status;
    err.headers = result.headers;
    throw err;
  }

  let data = result.raw;
  if (!raw) {
    const text = result.raw.toString("utf8");
    data = text;
    try {
      data = JSON.parse(text);
    } catch (_) {}
  }

  return { status: result.status, data, headers: result.headers };
}

/** Unduh file (binary) lewat native proxy Bright Data. */
export async function proxyFetchBuffer(url, options = {}) {
  const res = await proxyRequest(url, { ...options, raw: true });
  if (res.status >= 400) {
    throw new Error(`Bright Data proxy HTTP ${res.status} untuk ${url}`);
  }
  return Buffer.from(res.data || []);
}

export default {
  nativeProxyConfig,
  nativeProxyAvailable,
  createProxyAgent,
  proxyRequest,
  proxyFetchBuffer,
};
