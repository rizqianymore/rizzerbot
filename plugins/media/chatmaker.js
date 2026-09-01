import { fetchBuffer } from "@/src/utils/scraping.js";

export default {
  premiumOnly: true,
  name: "chatmaker",
  description: "Membuat gambar bertema menu popup chat iOS/iPhone dengan background percakapan custom.",
  usage: "<teks | waktu (opsional) | background (opsional)>",
  example: "icikwir | 10:30 AM | Pesan 1|sent|text;Pesan 2|received|text",
  aliases: ["cm", "chatmake", "popupchat"],
  category: "Media",
  cooldown: 8000,
  run: async (sock, msg, args, { sendTyping }) => {
    let input = args.join(" ");
    if (!input) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `⚠️ *Format Perintah Chat Maker*\n\n` +
            `• *.chatmaker <teks>*\n` +
            `• *.chatmaker <teks> | <waktu>*\n` +
            `• *.chatmaker <teks> | <waktu> | <bg_chats>*\n\n` +
            `*Contoh:* \`.chatmaker icikwir | 10:30 AM | Pesan 1|sent|text;Pesan 2|received|text\``,
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    // Parse text, time, and background chats
    const parts = input.split("|").map((p) => p.trim());
    let text = parts[0] || "Halo";
    let time = parts[1] || "";
    let bg = parts.slice(2).join("|").trim();

    // Default current local time formatted if not provided
    if (!time) {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      time = `${hours}:${minutes} ${ampm}`;
    }

    let imgBuffer = null;
    let queryParams = `text=${encodeURIComponent(text)}&time=${encodeURIComponent(time)}`;
    if (bg) {
      queryParams += `&bg=${encodeURIComponent(bg)}`;
    }
    queryParams += `&cb=${Date.now()}`;

    const workerUrl = `https://bitter-water-1579.rakarizqi-cv.workers.dev/?${queryParams}`;

    // 1. Try fast Cloud Screenshot API first (targeting #captureScreen element)
    try {
      const microUrl = `https://api.microlink.io?url=${encodeURIComponent(workerUrl)}&screenshot=true&element=%23captureScreen&embed=screenshot.url`;
      imgBuffer = await fetchBuffer(microUrl, { timeout: 15000 });
    } catch (cloudErr) {
      console.warn("Cloud screenshot API error, attempting local puppeteer fallback:", cloudErr.message);
    }

    // 2. Fallback to local Puppeteer if Cloud API fails
    if (!imgBuffer) {
      let browser;
      try {
        const puppeteerModule = await import("puppeteer");
        const puppeteer = puppeteerModule.default || puppeteerModule;

        browser = await puppeteer.launch({
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-gpu",
          ],
          headless: true,
        });

        const page = await browser.newPage();
        await page.setViewport({
          width: 375,
          height: 812,
          deviceScaleFactor: 2,
        });

        await page.goto(workerUrl, {
          waitUntil: "networkidle0",
          timeout: 10000,
        });

        const element = await page.$("#captureScreen");
        if (element) {
          imgBuffer = await element.screenshot({ type: "png" });
        }
      } catch (err) {
        console.warn("Local Puppeteer renderer error:", err.message);
      } finally {
        if (browser) {
          try {
            await browser.close();
          } catch (_) {}
        }
      }
    }

    if (imgBuffer) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          image: imgBuffer,
          caption: `⚡ *iOS Popup Chat Maker*\n💬 *Teks:* ${text}\n⏰ *Waktu:* ${time}`,
        },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ Gagal membuat gambar popup chat. Silakan coba beberapa saat lagi.`,
        },
        { quoted: msg }
      );
    }
  },
};
