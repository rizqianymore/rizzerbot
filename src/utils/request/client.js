import axios from "axios";
import { brightDataRequest, getBrightDataConfig } from "@/src/services/network/brightdata.js";
import { getRandomDevice } from "./devices.js";
import { buildScraperHeaders } from "./headers.js";
import { cookieJar, isCloudflareChallenge } from "./cookies.js";
import { stealthBrowser } from "./browser.js";

export async function smartRequest(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const responseType = options.responseType || "json";
  const timeout = options.timeout || 20000;
  const retries = options.retries !== undefined ? options.retries : 2;
  const bypassCloudflare = options.bypassCloudflare !== undefined ? options.bypassCloudflare : "auto";
  const preferredDevice = options.preferredDevice || "any";

  const device = getRandomDevice(preferredDevice);
  const defaultHeaders = buildScraperHeaders(device);

  const cookiesStr = cookieJar.getCookieString(url);
  const headers = {
    ...defaultHeaders,
    ...(cookiesStr ? { Cookie: cookiesStr } : {}),
    ...(options.headers || {}),
  };

  const hasBrightData = Boolean(getBrightDataConfig().apiKey);

  if (bypassCloudflare === true) {
    if (hasBrightData && responseType !== "buffer") {
      try {
        const bdData = await brightDataRequest(url, {
          format: responseType === "json" ? "json" : "raw",
          timeout,
        });
        return bdData;
      } catch (_bdErr) {
        // Jika Bright Data error, fallback ke stealth browser
      }
    }

    if (responseType === "json") {
      return await stealthBrowser.inPageFetch(url, {
        method,
        headers: options.headers,
        body: options.data,
      });
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
      if (res.status >= 200 && res.status < 300) return Buffer.from(res.data);
      throw new Error(`HTTP ${res.status} saat mengunduh buffer ${url}`);
    }
    const solved = await stealthBrowser.solveChallenge(url, {
      timeoutMs: timeout,
      preferredDevice,
    });
    return solved.content;
  }

  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    attempt++;
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

        // 1. Coba gunakan Bright Data Web Unlocker jika API key tersedia (tanpa makan RAM browser)
        if (hasBrightData) {
          try {
            const bdResult = await brightDataRequest(url, {
              format: responseType === "json" ? "json" : "raw",
              timeout,
            });
            if (responseType === "buffer") {
              return Buffer.from(bdResult);
            }
            return bdResult;
          } catch (_) {
            // Bright Data gagal, fallback ke Puppeteer
          }
        }

        const solved = await stealthBrowser.solveChallenge(url, {
          timeoutMs: timeout,
          preferredDevice,
        });

        if (!solved.cleared) {
          if (hasBrightData) {
            try {
              const bdLast = await brightDataRequest(url, {
                format: responseType === "json" ? "json" : "raw",
                timeout,
              });
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
            return await stealthBrowser.inPageFetch(url, {
              method,
              headers: options.headers,
              body: options.data,
            });
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
      const isTransient =
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNABORTED" ||
        err.message?.includes("timeout");

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
