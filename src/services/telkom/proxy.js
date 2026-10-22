import https from "https";
import * as HttpsProxyAgentModule from "https-proxy-agent";
import FormDataPkg from "form-data";

// v7 mengekspor { HttpsProxyAgent }, v5 mengekspor default.
const HttpsProxyAgent = HttpsProxyAgentModule.HttpsProxyAgent || HttpsProxyAgentModule.default || HttpsProxyAgentModule;

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
 * terjangkau walau api.brightdata.com diblokir.
 */

const DEFAULT_HOST = "brd.superproxy.io";
const DEFAULT_PORT = 44445;

/** Konfigurasi native proxy (null kalau belum dikonfigurasi). */
/**
 * Konfigurasi native proxy (Web Unlocker, port 44445).
 *
 * CATATAN: tiap zone Bright Data punya password sendiri:
 *   - native proxy   : BRIGHTDATA_ZONE (default web_unlocker2) + BRIGHTDATA_PROXY_PASSWORD
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

/** Native proxy aktif? */
export function nativeProxyEnabled() {
  if (String(process.env.TELKOM_VIA_BRIGHTDATA_PROXY || "1").trim() === "0") return false;
  return Boolean(nativeProxyConfig());
}

/** Konversi FormData native -> form-data (dipakai axios). */
function toAxiosForm(form) {
  const fd = new FormDataPkg();
  for (const [key, value] of form.entries()) {
    fd.append(key, typeof value === "string" ? value : String(value));
  }
  return fd;
}

/**
 * Agent proxy yang mengabaikan sertifikat proxy.
 *
 * Bright Data memakai sertifikat sendiri (belum berotorasi publik) —
 * sama seperti perlu flag `-k` pada curl.
 *
 * https-proxy-agent v7 membaca kredensial dari `username`/`password`
 * (v5 memakai `auth`), jadi keduanya kita isi.
 */
function createProxyAgent(proxy) {
  const credentials = {
    host: proxy.host,
    port: proxy.port,
    username: proxy.username,
    password: proxy.password,
  };

  // v7+: constructor(proxy, connectOpts) — opsi TLS masuk connectOpts.
  if (typeof HttpsProxyAgent.prototype.connect === "function") {
    return new HttpsProxyAgent(credentials, { rejectUnauthorized: false });
  }

  // v5: constructor(opts) + callback override.
  const options = {
    host: proxy.host,
    port: proxy.port,
    auth: `${proxy.username}:${proxy.password}`,
    rejectUnauthorized: false,
  };
  class InsecureProxyAgent extends HttpsProxyAgent {
    callback(req, opts) {
      return super.callback(req, { ...opts, rejectUnauthorized: false });
    }
  }
  return new InsecureProxyAgent(options);
}

/**
 * Request lewat native proxy Bright Data (unlocker solving challenge).
 *
 * Pakai https.request langsung (bukan axios) karena axios membuat agent
 * tunnel sendiri dan menimpa opsi TLS (rejectUnauthorized) kita.
 *
 * @returns {Promise<{status:number, data:any, headers:object}>}
 */
export async function proxyRequest(
  url,
  { method = "GET", headers = {}, body = null, timeoutMs = 20000, isForm = false } = {}
) {
  const proxy = nativeProxyConfig();
  if (!proxy) throw new Error("Native proxy Bright Data belum dikonfigurasi.");

  const agent = createProxyAgent(proxy);

  const requestHeaders = { ...headers };
  let payload = null;
  if (isForm && body) {
    const fd = toAxiosForm(body);
    payload = fd.getBuffer();
    Object.assign(requestHeaders, fd.getHeaders());
  } else if (body !== undefined && body !== null) {
    payload = typeof body === "string" ? body : JSON.stringify(body);
    if (!requestHeaders["Content-Type"]) requestHeaders["Content-Type"] = "application/json";
  }
  if (payload) requestHeaders["Content-Length"] = Buffer.byteLength(payload);

  const result = await new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers: requestHeaders, agent, timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({
          status: res.statusCode || 0,
          headers: res.headers || {},
          raw: Buffer.concat(chunks).toString("utf8"),
        })
      );
    });
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
  try {
    data = JSON.parse(result.raw);
  } catch (_) {}

  return { status: result.status, data, headers: result.headers };
}
