import https from "https";
import * as HttpsProxyAgentModule from "https-proxy-agent";

const HttpsProxyAgent = HttpsProxyAgentModule.HttpsProxyAgent || HttpsProxyAgentModule.default || HttpsProxyAgentModule;

if (!Object.prototype.hasOwnProperty.call(HttpsProxyAgent.prototype || {}, "connect")) {
  console.warn("[Unlocker] https-proxy-agent versi lama terdeteksi - jalankan: npm install https-proxy-agent@^7");
}

const DEFAULT_HOST = "brd.superproxy.io";
const DEFAULT_PORT = 22225;
const DEFAULT_CUSTOMER = "hl_66a04297";
const DEFAULT_ZONE = "web_unlocker2";
const DEFAULT_PASSWORD = "lahl63zlmvrs";

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

  const customer = String(process.env.BRIGHTDATA_CUSTOMER || DEFAULT_CUSTOMER).trim();
  const password = String(process.env.BRIGHTDATA_PROXY_PASSWORD || process.env.BRIGHTDATA_PASSWORD || DEFAULT_PASSWORD).trim();
  const zone = String(process.env.BRIGHTDATA_PROXY_ZONE || process.env.BRIGHTDATA_ZONE || DEFAULT_ZONE).trim();
  if (!customer || !password) return null;

  return {
    host: String(process.env.BRIGHTDATA_PROXY_HOST || DEFAULT_HOST).trim(),
    port: Number(process.env.BRIGHTDATA_PROXY_PORT) || DEFAULT_PORT,
    username: `brd-customer-${customer}-zone-${zone}`,
    password,
  };
}

export function nativeProxyAvailable() {
  if (String(process.env.BRIGHTDATA_PROXY_ENABLED ?? "1").trim() === "0") return false;
  return Boolean(nativeProxyConfig());
}

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

async function toAxiosForm(form) {
  const { default: FormDataPkg } = await import("form-data");
  const fd = new FormDataPkg();
  for (const [key, value] of form.entries()) {
    fd.append(key, typeof value === "string" ? value : String(value));
  }
  return fd;
}

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
