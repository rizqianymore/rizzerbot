// plugins/osint/httpprobe.js — Recon HTTP/HTTPS headers, server info, WAF & security posture.
import { cleanDomain } from "@/src/services/network.js";

export default {
  name: "httpprobe",
  aliases: ["httpheaders", "headers", "reconhttp", "webscan"],
  description: "Recon web server, latency, SSL, WAF detection, dan security headers",
  usage: "<domain atau URL, cth: kemkes.go.id>",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const raw = (args[0] || "").trim();

    if (!raw) {
      return reply(
        `❌ Masukkan target domain/URL!\n` +
        `Contoh: \`${currentPrefix}httpprobe kemkes.go.id\``
      );
    }

    const domain = cleanDomain(raw);
    const targetUrl = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${domain}`;

    await sendTyping();
    await reply(`🔍 Melakukan HTTP Recon untuk *${targetUrl}*...`);

    const start = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);

    try {
      const res = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "*/*",
        },
        redirect: "follow",
        signal: ctrl.signal,
      });

      const latency = Date.now() - start;
      const headers = Object.fromEntries(res.headers.entries());

      // Deteksi Web Server & WAF / CDN
      let server = headers["server"] || "-";
      let wafCdn = [];
      if (headers["cf-ray"] || /cloudflare/i.test(server)) wafCdn.push("Cloudflare");
      if (headers["x-akamai-transformed"] || /akamai/i.test(server)) wafCdn.push("Akamai");
      if (headers["x-amz-cf-id"] || /cloudfront/i.test(server)) wafCdn.push("AWS CloudFront");
      if (headers["x-sucuri-id"]) wafCdn.push("Sucuri WAF");
      if (headers["x-fastly-request-id"]) wafCdn.push("Fastly");
      if (headers["x-github-request-id"]) wafCdn.push("GitHub Pages");
      if (headers["x-vercel-id"]) wafCdn.push("Vercel");

      // Deteksi Security Headers
      const hsts = Boolean(headers["strict-transport-security"]);
      const csp = Boolean(headers["content-security-policy"]);
      const xfo = headers["x-frame-options"] || "-";
      const xcto = headers["x-content-type-options"] || "-";
      const referrer = headers["referrer-policy"] || "-";

      const lines = [
        `🌐 *HTTP/WEB RECONNAISSANCE*`,
        ``,
        `• *Target URL:* ${res.url}`,
        `• *Status Code:* \`${res.status} ${res.statusText}\``,
        `• *Latency / RTT:* \`${latency} ms\``,
        `• *Web Server:* \`${server}\``,
        `• *WAF / CDN:* ${wafCdn.length > 0 ? wafCdn.join(", ") : "Tidak terdeteksi / Direct"}`,
        `• *Content-Type:* \`${headers["content-type"] || "-"}\``,
        ``,
        `🛡️ *Security Headers:*`,
        `  - HSTS: ${hsts ? "✅ Enabled" : "❌ Disabled / Missing"}`,
        `  - CSP: ${csp ? "✅ Enabled" : "❌ Disabled / Missing"}`,
        `  - X-Frame-Options: \`${xfo}\``,
        `  - X-Content-Type-Options: \`${xcto}\``,
        `  - Referrer-Policy: \`${referrer}\``,
      ];

      return reply(lines.join("\n"));
    } catch (err) {
      if (err.name === "AbortError") {
        return reply("❌ Request timeout (12 detik). Host target tidak merespons.");
      }
      return reply(`❌ Gagal melakukan HTTP probe: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  },
};
