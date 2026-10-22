/**
 * Bright Data Scraping Browser (remote browser via WebSocket).
 *
 * Implementasi inti dipindah ke `src/services/network/scraping-browser.js`
 * supaya bisa dipakai bersama oleh modul Telkom Schools maupun plugin
 * downloader (rantai anti-protection). File ini hanya menjaga API lama.
 *
 * Dipakai sebagai jalur utama bypass Cloudflare untuk modul Telkom Schools:
 * browser sungguhan berjalan di datacenter BrightData (IP bersih, tanpa
 * challenge), jadi request API bisa dilakukan dari dalam browser dengan
 * header Authorization milik siswa.
 *
 * Contoh endpoint (dari dashboard BrightData):
 *   wss://brd-customer-<CUSTOMER>-zone-scraping_browser1:<PASSWORD>@brd.superproxy.io:9222
 *
 * Konfigurasi .env (pilih salah satu):
 *   BRIGHTDATA_SCRAPING_BROWSER_WS=wss://...            (langsung)
 *   BRIGHTDATA_CUSTOMER=<CUSTOMER> + BRIGHTDATA_PROXY_PASSWORD=<PASSWORD>
 *     + BRIGHTDATA_SCRAPING_BROWSER_ZONE=scraping_browser1
 */

import {
  connectRemoteBrowser,
  remoteFetchBuffer,
  remoteInPageFetch,
  remoteSolveChallenge,
  scrapingBrowserEndpoint,
} from "@/src/services/network/scraping-browser.js";

export {
  connectRemoteBrowser,
  remoteFetchBuffer,
  remoteInPageFetch,
  remoteSolveChallenge,
  scrapingBrowserEndpoint,
};

/** Remote browser aktif? (dapat dimatikan khusus modul Telkom). */
export function remoteBrowserEnabled() {
  if (String(process.env.TELKOM_VIA_BRIGHTDATA_BROWSER || "1").trim() === "0") return false;
  return Boolean(scrapingBrowserEndpoint());
}

export default {
  connectRemoteBrowser,
  remoteBrowserEnabled,
  remoteInPageFetch,
  remoteFetchBuffer,
  remoteSolveChallenge,
  scrapingBrowserEndpoint,
};
