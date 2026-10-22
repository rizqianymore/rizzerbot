/**
 * Bright Data Web Unlocker via NATIVE PROXY (bukan REST API).
 *
 * Implementasi inti dipindah ke `src/services/network/unlocker-proxy.js`
 * supaya bisa dipakai bersama oleh modul Telkom Schools maupun plugin
 * downloader (rantai anti-protection). File ini hanya menjaga API lama.
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
 */

import { nativeProxyConfig, proxyRequest } from "@/src/services/network/unlocker-proxy.js";

export { nativeProxyConfig, proxyRequest };

/** Native proxy aktif? (dapat dimatikan khusus modul Telkom). */
export function nativeProxyEnabled() {
  if (String(process.env.TELKOM_VIA_BRIGHTDATA_PROXY || "1").trim() === "0") return false;
  return Boolean(nativeProxyConfig());
}

export default {
  nativeProxyConfig,
  nativeProxyEnabled,
  proxyRequest,
};
