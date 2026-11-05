import { stealthBrowser } from "@/src/utils/request.js";

function cleanUrl(input) {
  let url = String(input || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

export default {
  name: "ssweb",
  aliases: ["screenshot", "ss", "captureweb"],
  description: "Ambil tangkapan layar website secara headless via Puppeteer lokal",
  usage: "<url> atau .ssweb mobile <url>",
  category: "Tools & Media",
  cooldownMs: 8000,
  run: async (sock, msg, args, context) => {
    let isMobile = false;
    let rawUrl = "";

    const firstArg = (args[0] || "").toLowerCase();
    if (firstArg === "mobile" || firstArg === "hp" || firstArg === "phone") {
      isMobile = true;
      rawUrl = args.slice(1).join(" ").trim();
    } else {
      rawUrl = args.join(" ").trim();
    }

    if (!rawUrl) {
      return context.reply(
        `Gunakan format:\n` +
        `• ${context.prefix || "."}ssweb <url> (Desktop view)\n` +
        `• ${context.prefix || "."}ssweb mobile <url> (Mobile view)\n\n` +
        `Contoh:\n` +
        `${context.prefix || "."}ssweb google.com`
      );
    }

    const targetUrl = cleanUrl(rawUrl);

    // Validasi URL dasar
    try {
      const parsed = new URL(targetUrl);
      if (!parsed.hostname || parsed.hostname.length < 3) {
        return context.reply("Alamat URL tidak valid.");
      }
    } catch {
      return context.reply("Format URL tidak valid. Masukkan domain seperti `example.com` atau `https://...`");
    }

    await context.sendTyping();

    let page = null;
    try {
      page = await stealthBrowser.newPage();

      if (isMobile) {
        await page.setViewport({
          width: 375,
          height: 812,
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 2,
        });
        await page.setUserAgent(
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        );
      } else {
        await page.setViewport({
          width: 1366,
          height: 768,
          deviceScaleFactor: 1,
        });
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        );
      }

      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });

      // Tunggu sebentar untuk render font & CSS dinamis
      await new Promise((r) => setTimeout(r, 1500));

      const screenshotBuf = await page.screenshot({
        type: "jpeg",
        quality: 85,
        fullPage: false,
      });

      const title = (await page.title()) || targetUrl;

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          image: screenshotBuf,
          caption:
            `*WEB SCREENSHOT CAPTURE*\n` +
            `Title : ${title}\n` +
            `Mode  : ${isMobile ? "Mobile (iPhone)" : "Desktop (1366x768)"}\n` +
            `URL   : ${targetUrl}`,
        },
        { quoted: msg }
      );
    } catch (err) {
      return context.reply(`Gagal mengambil tangkapan layar web: ${err.message || err}`);
    } finally {
      if (page) {
        await stealthBrowser.closePage(page).catch(() => {});
      }
    }
  },
};
