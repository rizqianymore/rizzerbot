import { fetchBuffer } from "@/lib/scraping.js";

export default {
  premiumOnly: true,
  name: "chatmaker",
  description: "Membuat gambar bertema menu popup chat iOS/iPhone.",
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

    try {
      // Worker endpoint provided by the user
      const workerUrl = `https://bitter-water-1579.rakarizqi-cv.workers.dev/?text=${encodeURIComponent(text)}&time=${encodeURIComponent(time)}`;
      
      // Call Microlink API to screenshot only the .phone-screen selector
      const screenshotApiUrl = `https://api.microlink.io?url=${encodeURIComponent(workerUrl)}&screenshot=true&embed=screenshot.url&element=.phone-screen&waitForTimeout=2000`;
      
      const imgBuffer = await fetchBuffer(screenshotApiUrl, { timeout: 30000 });
      
      await sock.sendMessage(
        msg.key.remoteJid,
        { image: imgBuffer, caption: `⚡ *iOS Popup Chat Maker*\n💬 Teks: ${text}\n⏰ Waktu: ${time}` },
        { quoted: msg },
      );
    } catch (err) {
      console.error("Chatmaker Plugin Error:", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "❌ Gagal membuat gambar popup chat. Coba lagi beberapa saat." },
        { quoted: msg },
      );
    }
  },
};
