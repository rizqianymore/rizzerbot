import axios from "axios";

export default {
  premiumOnly: true,
  name: "chatmaker",
  description: "Membuat gambar bertema menu popup chat iOS/iPhone via API Cloudflare Worker POST.",
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
      // API endpoint for your Cloudflare Worker
      const apiUrl = "https://bitter-water-1579.rakarizqi-cv.workers.dev/";

      // Send POST request with JSON payload
      const response = await axios.post(apiUrl, {
        text: text,
        time: time
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 40000 // 40 seconds timeout for Cloudflare Browser Rendering launch
      });

      if (!response.data || !response.data.image) {
        throw new Error("Invalid response structure or missing image data");
      }

      // Decode base64 image back to Buffer
      const imgBuffer = Buffer.from(response.data.image, "base64");

      await sock.sendMessage(
        msg.key.remoteJid,
        { image: imgBuffer, caption: `⚡ *iOS Popup Chat Maker*\n💬 Teks: ${text}\n⏰ Waktu: ${time}` },
        { quoted: msg },
      );
    } catch (err) {
      console.error("Chatmaker API Error:", err.message);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Gagal membuat gambar popup chat.\nDetail: ${err.message}` },
        { quoted: msg },
      );
    }
  },
};
