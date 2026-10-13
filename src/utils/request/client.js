import axios from "axios";
import { brightDataRequest, getBrightDataConfig } from "@/src/services/network/brightdata.js";
import { getRandomDevice } from "./devices.js";
import { buildScraperHeaders } from "./headers.js";
import { cookieJar, isCloudflareChallenge } from "./cookies.js";
import { stealthBrowser } from "./browser.js";

function isBrightDataEnabled() {
  if (String(process.env.BRIGHTDATA_ENABLED || "").trim() === "0") return false;
  return Boolean(getBrightDataConfig().apiKey);
}

function brightDataFirstHosts() {
  return String(process.env.BRIGHTDATA_FIRST_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//i, "").split("/")[0])
    .filter(Boolean);
}

function resolveVia(url, viaOpt) {
  if (viaOpt === "direct") return "direct";
  if (viaOpt === "brightdata") return "brightdata";
  try {
    const host = new URL(String(url)).hostname.toLowerCase();
    if (brightDataFirstHosts().some((h) => host === h || host.endsWith(`.${h}`))) return "brightdata";
  } catch (_) {}
  return "auto";
}

function toBrightDataOptions(url, { method, headers, data, params, timeout, responseType, country, state, city }) {
  let fullUrl = String(url);
  if (params && typeof params === "object" && Object.keys(params).length > 0) {
    const u = new URL(fullUrl);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    }
    fullUrl = u.toString();
  }
  const opts = {
    format: responseType === "json" ? "json" : "raw",
    method,
    timeout,
  };
  if (headers && Object.keys(headers).length > 0) opts.headers = { ...headers };
  if (data !== undefined) opts.data = data;
  if (country) opts.country = country;
  if (state) opts.state = state;
  if (city) opts.city = city;
  return { fullUrl, opts };
}

const TRANSIENT_STATUS = new Set([408, 429, 502, 503, 504]);

export async function smartRequest(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const responseType = options.responseType || "json";
  const timeout = options.timeout || 20000;
  const retries = options.retries !== undefined ? options.retries : 2;
  const bypassCloudflare = options.bypassCloudflare !== undefined ? options.bypassCloudflare : "auto";
  const preferredDevice = options.preferredDevice || "any";
  const onVia = typeof options.onVia === "function" ? options.onVia : null;
  const via = resolveVia(url, options.via);
  const report = (v) => {
    try {
      onVia?.(v);
    } catch (_) {}
  };

  const device = getRandomDevice(preferredDevice);
  const defaultHeaders = buildScraperHeaders(device);

  const cookiesStr = cookieJar.getCookieString(url);
  const headers = {
    ...defaultHeaders,
    ...(cookiesStr ? { Cookie: cookiesStr } : {}),
    ...(options.headers || {}),
  };

  const hasBrightData = isBrightDataEnabled();

  const tryBrightData = async () => {
    const envCountry = String(process.env.BRIGHTDATA_COUNTRY || "").trim() || undefined;
    const { fullUrl, opts } = toBrightDataOptions(url, {
      method,
      headers,
      data: options.data,
      params: options.params,
      timeout,
      responseType,
      country: options.country || envCountry,
      state: options.state,
      city: options.city,
    });
    const bdResult = await brightDataRequest(fullUrl, opts);
    if (responseType === "buffer") return Buffer.from(bdResult);
    return bdResult;
  };

  if (via === "brightdata" && hasBrightData && responseType !== "buffer") {
    try {
      const bdFirst = await tryBrightData();
      report("brightdata");
      return bdFirst;
    } catch (_bdFirstErr) {}
  }

  if (bypassCloudflare === true) {
    if (hasBrightData && responseType !== "buffer") {
      try {
        const bdData = await tryBrightData();
        report("brightdata");
        return bdData;
      } catch (_bdErr) {

      }
    }

    if (responseType === "json") {
      const inPage = await stealthBrowser.inPageFetch(url, {
        method,
        headers: options.headers,
        body: options.data,
      });
      report("browser");
      return inPage;
    }
    if (responseType === "buffer") {
      await stealthBrowser.solveChallenge(url, {
        timeoutMs: timeout,
        preferredDevice,
      });
      const res = await axios({
        url,
        method,
        headers,
        timeout,
        responseType: "arraybuffer",
        validateStatus: () => true,
      });
      if (res.headers?.["set-cookie"]) {
        cookieJar.addCookiesFromHeader(url, res.headers["set-cookie"]);
      }
      if (res.status >= 200 && res.status < 300) {
        report("direct");
        return Buffer.from(res.data);
      }
      throw new Error(`HTTP ${res.status} saat mengunduh buffer ${url}`);
    }
    const solved = await stealthBrowser.solveChallenge(url, {
      timeoutMs: timeout,
      preferredDevice,
    });
    report("browser");
    return solved.content;
  }

  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    attempt++;
    report("direct");
    try {
      const axiosConfig = {
        url,
        method,
        headers,
        params: options.params,
        data: options.data,
        timeout,
        responseType: responseType === "buffer" ? "arraybuffer" : responseType,
        validateStatus: () => true,
      };

      const res = await axios(axiosConfig);

      if (res.headers && res.headers["set-cookie"]) {
        cookieJar.addCookiesFromHeader(url, res.headers["set-cookie"]);
      }

      const isChallenge = isCloudflareChallenge(res.status, res.headers, typeof res.data === "string" ? res.data : "");

      if (isChallenge) {
        if (bypassCloudflare === false) {
          throw new Error(`Protection challenge detected (HTTP ${res.status}) and bypass is disabled.`);
        }

        if (hasBrightData && via !== "direct") {
          try {
            const bdResult = await tryBrightData();
            report("brightdata");
            if (responseType === "buffer") {
              return Buffer.from(bdResult);
            }
            return bdResult;
          } catch (_) {

          }
        }

        const solved = await stealthBrowser.solveChallenge(url, {
          timeoutMs: timeout,
          preferredDevice,
        });

        if (!solved.cleared) {
          if (hasBrightData && via !== "direct") {
            try {
              const bdLast = await tryBrightData();
              report("brightdata");
              if (responseType === "buffer") return Buffer.from(bdLast);
              return bdLast;
            } catch (_) {}
          }
          throw new Error(`Protection challenge not cleared after timeout on ${url}`);
        }

        const refreshedCookies = cookieJar.getCookieString(url);
        headers.Cookie = refreshedCookies;

        if (responseType === "json") {
          try {
            const inPage = await stealthBrowser.inPageFetch(url, {
              method,
              headers: options.headers,
              body: options.data,
            });
            report("browser");
            return inPage;
          } catch (_) {}
        }

        const secondRes = await axios({
          ...axiosConfig,
          headers,
        });

        if (responseType === "buffer") {
          return Buffer.from(secondRes.data);
        }
        return secondRes.data;
      }

      if (res.status >= 400) {
        const errBody = typeof res.data === "object" ? JSON.stringify(res.data) : String(res.data).slice(0, 300);
        throw new Error(`HTTP ${res.status}: ${errBody}`);
      }

      if (responseType === "buffer") {
        return Buffer.from(res.data);
      }
      return res.data;
    } catch (err) {
      lastError = err;
      const statusMatch = String(err?.message || "").match(/HTTP (\d{3})/);
      const statusCode = statusMatch ? Number(statusMatch[1]) : 0;
      const isTransient =
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNABORTED" ||
        err.message?.includes("timeout") ||
        TRANSIENT_STATUS.has(statusCode);

      if (isTransient && attempt <= retries) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      break;
    }
  }

  throw lastError;
}

export const request = smartRequest;
request.get = (url, options = {}) => smartRequest(url, { ...options, method: "GET" });
request.post = (url, data, options = {}) => smartRequest(url, { ...options, method: "POST", data });
request.json = (url, options = {}) => smartRequest(url, { ...options, responseType: "json" });
request.text = (url, options = {}) => smartRequest(url, { ...options, responseType: "text" });
request.buffer = (url, options = {}) => smartRequest(url, { ...options, responseType: "buffer" });
request.browser = (url, options = {}) => smartRequest(url, { ...options, bypassCloudflare: true });
request.clearCookies = (domain) => {
  if (domain) cookieJar.clearDomain(domain);
  else cookieJar.clearAll();
};
request.closeBrowser = () => stealthBrowser.close();

export default request;
