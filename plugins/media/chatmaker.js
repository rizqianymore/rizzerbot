export default {
  premiumOnly: true,
  name: "chatmaker",
  description: "Membuat gambar bertema menu popup chat iOS/iPhone menggunakan local Puppeteer renderer.",
  usage: "<teks | waktu (opsional)>",
  example: "OK | 12:38 PM",
  aliases: ["cm", "chatmake", "popupchat"],
  category: "Media",
  cooldown: 8000,
  run: async (sock, msg, args, { sendTyping }) => {
    let input = args.join(" ");
    if (!input) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Harap tentukan teks gambar. Contoh: *.chatmaker OK* atau *.chatmaker Keren | 10:00 AM*",
        },
        { quoted: msg },
      );
      return;
    }

    await sendTyping();

    // Parse text and optional time separated by "|"
    let text = input.trim();
    let time = "";
    if (input.includes("|")) {
      const parts = input.split("|");
      text = parts[0].trim();
      time = parts[1].trim();
    }

    // Default current local time formatted if not provided
    if (!time) {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      time = `${hours}:${minutes} ${ampm}`;
    }

    let browser;
    try {
      const puppeteerModule = await import("puppeteer");
      const puppeteer = puppeteerModule.default || puppeteerModule;

      // Launch local headless browser
      browser = await puppeteer.launch({
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu"
        ],
        headless: true
      });

      const page = await browser.newPage();
      
      // Set viewport scale to 2x for high quality output
      await page.setViewport({
        width: 320,
        height: 568,
        deviceScaleFactor: 2
      });

      // Construct your deployed Worker URL with a cache buster
      const workerUrl = `https://bitter-water-1579.rakarizqi-cv.workers.dev/?text=${encodeURIComponent(text)}&time=${encodeURIComponent(time)}&cb=${Date.now()}`;

      // Open the page using the local browser
      await page.goto(workerUrl, {
        waitUntil: "networkidle0", // Wait for all icons and resources to load
        timeout: 30000
      });

      // Select the phone screen element
      const element = await page.$("#captureScreen");
      if (!element) {
        throw new Error("Target element #captureScreen not found on the page.");
      }
      
      // Capture screenshot directly as buffer (perfect rectangular output, no external API!)
      const imgBuffer = await element.screenshot({ type: "png" });

      await sock.sendMessage(
        msg.key.remoteJid,
        { image: imgBuffer, caption: `⚡ *iOS Popup Chat Maker*\n💬 Teks: ${text}\n⏰ Waktu: ${time}` },
        { quoted: msg },
      );
    } catch (err) {
      console.error("Chatmaker Local Puppeteer Error:", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Gagal membuat gambar secara lokal.\nDetail: ${err.message}` },
        { quoted: msg },
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  },
};
