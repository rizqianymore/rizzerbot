import { fetchJson } from "@/src/utils/scraping.js";

export default {
  description: "Mencari informasi detail alamat IP menggunakan ipinfo.io.",
  usage: "<IP Address>",
  example: "8.8.8.8",
  name: "iplookup",
  aliases: ["ip", "ipcheck", "ipinfo"],
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, context) => {
    const { sendTyping, activePrefix, senderName } = context;

    await sendTyping();

    const ip = args[0];
    if (!ip) {
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *Format salah!*\n\nGunakan: \`${activePrefix}iplookup <ip_address>\`\nContoh: \`${activePrefix}iplookup 8.8.8.8\``,
        },
        { quoted: msg },
      );
    }

    const ipRegex =
      /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[A-f0-9]{1,4}:){7}[A-f0-9]{1,4}$/i;
    if (!ipRegex.test(ip)) {
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *IP Address tidak valid!*\n\nHarap masukkan format IP Address yang benar.`,
        },
        { quoted: msg },
      );
    }

    try {
      const res = await fetchJson(`https://ipinfo.io/${ip}/json`);
      if (res.status !== 200) {
        throw new Error(`Gagal mengambil data (HTTP ${res.status})`);
      }

      const data = res.data;
      if (!data.ip) {
        throw new Error("Data IP tidak ditemukan");
      }

      let replyText = `🔍 *IP Lookup Info (${data.ip})*\n\n`;
      replyText += `• *IP:* \`${data.ip || "-"}\`\n`;
      replyText += `• *Hostname:* ${data.hostname || "-"}\n`;
      replyText += `• *Kota:* ${data.city || "-"}\n`;
      replyText += `• *Wilayah/Provinsi:* ${data.region || "-"}\n`;
      replyText += `• *Negara:* ${data.country || "-"}\n`;
      replyText += `• *Lokasi (Lat,Long):* \`${data.loc || "-"}\`\n`;
      replyText += `• *ISP/Organisasi:* ${data.org || "-"}\n`;
      replyText += `• *Kode Pos:* ${data.postal || "-"}\n`;
      replyText += `• *Zona Waktu:* ${data.timezone || "-"}\n\n`;
      replyText += `_Dicari oleh: ${senderName}_\n\n⚡ _Via Kyros-MD API_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: replyText },
        { quoted: msg },
      );
    } catch (error) {
      console.error("Error IP lookup:", error);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *Terjadi kesalahan!*\n\n${error.message || "Gagal melakukan lookup IP."}`,
        },
        { quoted: msg },
      );
    }
  },
};
