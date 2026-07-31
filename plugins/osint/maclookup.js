import { fetchJson } from "@/lib/scraping.js";

export default {
  name: "maclookup",
  description: "Mencari nama manufaktur/vendor perangkat dari Alamat MAC (MAC Address).",
  usage: "<mac_address>",
  example: "maclookup 00:1A:2B:3C:4D:5E",
  aliases: ["mac", "vendorlookup"],
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, context) => {
    const { sendTyping, activePrefix, senderName } = context;
    await sendTyping();

    const mac = args[0];
    if (!mac) {
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *Format salah!*\n\nGunakan: \`${activePrefix}maclookup <mac_address>\`\nContoh: \`${activePrefix}maclookup 00:1A:2B:3C:4D:5E\``,
        },
        { quoted: msg }
      );
    }

    try {
      const res = await fetchJson(`https://api.macvendors.com/${encodeURIComponent(mac)}`);
      if (res.status !== 200 || !res.data) {
        throw new Error("Vendor tidak ditemukan atau format MAC salah.");
      }

      const vendor = typeof res.data === "string" ? res.data : JSON.stringify(res.data);

      let replyText =
        `📟 *MAC Address Vendor OSINT*\n\n` +
        `• *MAC Address:* \`${mac.toUpperCase()}\`\n` +
        `• *Manufaktur / Vendor:* *${vendor}*\n\n` +
        `_Dicari oleh: ${senderName}_\n\n⚡ _Via Kyros-MD OSINT_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: replyText },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ *Gagal mencari vendor MAC:* ${err.message || "Manufaktur tidak terdaftar."}` },
        { quoted: msg }
      );
    }
  },
};
