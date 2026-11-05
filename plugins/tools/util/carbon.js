import { request } from "@/src/utils/request.js";

export default {
  name: "carbon",
  aliases: ["car", "code2img"],
  description: "Ubah kode jadi gambar Carbon aesthetic",
  usage: "<kode> | reply kode",
  category: "Tools",
  cooldown: 5000,
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, prefix, quoted, sendTyping }) => {
    const curPrefix = prefix || ".";

    const quotedFromCtx =
      quoted?.conversation ||
      quoted?.extendedTextMessage?.text ||
      quoted?.imageMessage?.caption ||
      quoted?.videoMessage?.caption ||
      quoted?.documentMessage?.caption ||
      "";

    const quotedFromMsg =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage?.caption ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage?.caption ||
      "";

    const text = (args.join(" ") || quotedFromCtx || quotedFromMsg).trim();

    if (!text) {
      return reply(
        `*CARBON CODE TO IMAGE*\n\n` +
          `Ubah kode jadi gambar Carbon aesthetic.\n\n` +
          `*Cara pakai:*\n` +
          `• ${curPrefix}carbon console.log("hello")\n` +
          `• Reply kode lalu ketik ${curPrefix}carbon\n` +
          `• Alias: ${curPrefix}car / ${curPrefix}code2img`
      );
    }

    const remoteJid = msg.key?.remoteJid;
    await sendTyping?.();

    let buffer = null;

    // Primary: carbonara.solopov.dev
    try {
      const res = await fetch("https://carbonara.solopov.dev/api/cook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      // validate is image (png)
      if (buf?.length > 500) buffer = buf;
      else throw new Error("Empty response from carbonara");
    } catch (_) {
      buffer = null;
    }

    // Fallback: siputzx
    if (!buffer) {
      try {
        const url = `https://api.siputzx.my.id/api/maker/carbon?text=${encodeURIComponent(text)}`;
        buffer = await request.buffer(url, { timeout: 20000 });
        if (!buffer?.length || buffer.length < 500) throw new Error("Empty siputzx response");
      } catch (err) {
        return reply(`Gagal generate Carbon: ${err?.message || err}`);
      }
    }

    try {
      await sock.sendMessage(remoteJid, { image: buffer, caption: " Carbon.sh" }, { quoted: msg });
    } catch (err) {
      return reply(`Gagal kirim gambar Carbon: ${err?.message || err}`);
    }
  },
};
