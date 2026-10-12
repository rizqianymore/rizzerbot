import { ACCEPT_LANGUAGES, getRandomDevice } from "./devices.js";

export function buildScraperHeaders(device = getRandomDevice(), customHeaders = {}) {
  const lang = ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];
  const headers = {
    "User-Agent": device.userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": lang,
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };

  if (device.secChUa) {
    headers["Sec-Ch-Ua"] = device.secChUa;
    headers["Sec-Ch-Ua-Mobile"] = device.secChUaMobile;
    headers["Sec-Ch-Ua-Platform"] = device.secChUaPlatform;
  }

  return { ...headers, ...customHeaders };
}
