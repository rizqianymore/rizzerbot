import https from "node:https";
import http from "node:http";

/**
 * Follow HTTP redirects up to maxRedirects to find final destination URL
 * (Zero API key needed)
 */
function resolveRedirects(initialUrl, maxRedirects = 10, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let currentUrl = initialUrl;
    let redirectCount = 0;
    const history = [];

    function makeRequest(urlStr) {
      let parsed;
      try {
        parsed = new URL(urlStr);
      } catch (e) {
        return reject(new Error("URL tidak valid."));
      }

      history.push(urlStr);
      const isHttps = parsed.protocol === "https:";
      const client = isHttps ? https : http;

      const req = client.request(
        urlStr,
        {
          method: "HEAD",
          family: 4,
          timeout: timeoutMs,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "*/*",
          },
        },
        (res) => {
          const status = res.statusCode || 200;
          const location = res.headers.location;

          // Periksa apakah status redirect 3xx
          if ([301, 302, 303, 307, 308].includes(status) && location) {
            redirectCount++;
            if (redirectCount > maxRedirects) {
              return resolve({ finalUrl: currentUrl, redirects: history, status });
            }

            // Resolve relative link
            const nextUrl = new URL(location, currentUrl).href;
            currentUrl = nextUrl;
            res.resume(); // consume response stream
            return makeRequest(nextUrl);
          }

          res.resume();
          return resolve({ finalUrl: currentUrl, redirects: history, status });
        }
      );

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Koneksi timeout saat melacak pengalihan URL."));
      });

      req.on("error", (err) => {
        // Jika HEAD ditolak (misal 405 Method Not Allowed), coba GET
        if (req.method === "HEAD") {
          const getReq = client.request(
            urlStr,
            {
              method: "GET",
              family: 4,
              timeout: timeoutMs,
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              },
            },
            (getRes) => {
              const loc = getRes.headers.location;
              if ([301, 302, 303, 307, 308].includes(getRes.statusCode) && loc) {
                const nextUrl = new URL(loc, currentUrl).href;
                currentUrl = nextUrl;
                getRes.resume();
                return makeRequest(nextUrl);
              }
              getRes.resume();
              return resolve({ finalUrl: currentUrl, redirects: history, status: getRes.statusCode });
            }
          );
          getReq.on("error", (getErr) => reject(getErr));
          getReq.end();
          return;
        }
        reject(err);
      });

      req.end();
    }

    makeRequest(currentUrl);
  });
}

export default {
  name: "unshorten",
  aliases: ["unshort", "expandurl", "urlexpand", "lacaklink"],
  description: "Lacak dan buka link pendek (bit.ly, s.id, tinyurl, dll) hingga ke URL tujuan aslinya",
  usage: "<url_pendek>",
  category: "Tools",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const p = prefix || ".";
    const rawUrl = (args[0] || "").trim();

    if (!rawUrl) {
      return reply(
        `*UNSHORTEN / EXPAND URL*\n\n` +
          `Lacak pengalihan link pendek untuk keamanan sebelum membukanya.\n\n` +
          `Format:\n` +
          `• *${p}unshorten <url>*\n\n` +
          `Contoh:\n` +
          `• *${p}unshorten https://bit.ly/3xyz*\n` +
          `• *${p}unshorten https://s.id/contoh*`
      );
    }

    let targetUrl = rawUrl;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    try {
      new URL(targetUrl);
    } catch {
      return reply("Format URL tidak valid.");
    }

    await reply("Melacak rantai pengalihan URL...");

    try {
      const result = await resolveRedirects(targetUrl);
      const isRedirected = result.redirects.length > 1;

      let out = `*HASIL PELACAKAN URL:*\n\n`;
      out += `• *URL Awal:* ${targetUrl}\n`;
      out += `• *URL Akhir:* ${result.finalUrl}\n`;
      out += `• *Status Kode:* HTTP ${result.status}\n`;
      out += `• *Jumlah Pengalihan:* ${result.redirects.length - 1} kali\n`;

      if (isRedirected) {
        out += `\n*Rantai Redirect:*\n`;
        result.redirects.forEach((u, i) => {
          out += `${i + 1}. ${u}\n`;
        });
      } else {
        out += `\n_Catatan: URL ini langsung mengarah ke halaman tujuan tanpa redirect._`;
      }

      return reply(out.trim());
    } catch (err) {
      return reply(`*GAGAL MELACAK URL*\n${err?.message || "Terjadi kesalahan saat memeriksa URL."}`);
    }
  },
};
