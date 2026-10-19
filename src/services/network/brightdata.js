import axios from "axios";

const BRIGHTDATA_API_URL = "https://api.brightdata.com/request";
const DEFAULT_TEST_URL = "https://geo.brdtest.com/welcome.txt?product=unlocker&method=api";

export function getBrightDataConfig() {
  const apiKey = (process.env.BRIGHTDATA_API_KEY || "").trim();
  const zone = (process.env.BRIGHTDATA_ZONE || "web_unlocker2").trim() || "web_unlocker2";
  return { apiKey, zone };
}

export function getBrightDataProxy() {
  const direct = (process.env.BRIGHTDATA_PROXY || "").trim();
  if (direct) return direct;
  const customer = (process.env.BRIGHTDATA_CUSTOMER || "").trim();
  const password = (process.env.BRIGHTDATA_PROXY_PASSWORD || process.env.BRIGHTDATA_PASSWORD || "").trim();
  const { zone } = getBrightDataConfig();
  if (customer && password && zone) {
    return `http://brd-customer-${customer}-zone-${zone}:${password}@brd.superproxy.io:44445`;
  }
  return "";
}

export function isBrightDataEnabled() {
  if (String(process.env.BRIGHTDATA_ENABLED || "").trim() === "0") return false;
  return Boolean(getBrightDataConfig().apiKey);
}

export async function brightDataRequest(targetUrl, options = {}) {
  const { apiKey, zone: defaultZone } = getBrightDataConfig();
  if (!apiKey) {
    throw new Error("BRIGHTDATA_API_KEY belum diisi di .env");
  }
  if (!targetUrl || !/^https?:\/\//i.test(String(targetUrl))) {
    throw new Error("URL target tidak valid (harus http/https)");
  }

  const {
    zone = defaultZone,
    format = "raw",
    binary = false,
    method = "GET",
    headers: reqHeaders,
    data: reqData,
    country,
    state,
    city,
    zip,
    asn,
    ip,
    timeout = 60000,
    ...extra
  } = options;

  const body = {
    zone,
    url: String(targetUrl),
    format,
    method: method.toUpperCase(),
    ...extra,
  };
  if (reqHeaders) body.headers = reqHeaders;
  if (reqData) body.body = typeof reqData === "object" ? JSON.stringify(reqData) : String(reqData);
  if (country) body.country = country;
  if (state) body.state = state;
  if (city) body.city = city;
  if (zip) body.zip = zip;
  if (asn) body.asn = asn;
  if (ip) body.ip = ip;

  const { data, status } = await axios.post(BRIGHTDATA_API_URL, body, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    timeout,
    responseType: binary ? "arraybuffer" : format === "raw" ? "text" : "json",
    validateStatus: () => true,
  });

  if (binary) {
    if (status >= 400) {
      const detail = Buffer.from(data || [])
        .toString("utf8")
        .slice(0, 300);
      throw new Error(`Bright Data error (HTTP ${status})${detail ? `: ${detail}` : ""}`);
    }
    return Buffer.from(data || []);
  }

  if (data && typeof data === "object" && (data.error || data.statusCode >= 400)) {
    throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data).slice(0, 500));
  }

  return data;
}

export const fetchViaUnlocker = brightDataRequest;

export async function testBrightDataConnection(options = {}) {
  return brightDataRequest(DEFAULT_TEST_URL, { format: "raw", ...options });
}

export default {
  brightDataRequest,
  fetchViaUnlocker,
  testBrightDataConnection,
  getBrightDataConfig,
  getBrightDataProxy,
  isBrightDataEnabled,
};
