export default {
  name: "iqc2",
  aliases: ["iqc"],
  description: "Maker iPhone quoted chat via siputzx / deline API",
  usage: "<teks>|[chatTime]|[statusBarTime]",
  premiumOnly: true,
  cooldownMs: 5000,
  category: "Sticker",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    const text = args.join(" ").trim();

    if (!text) {
      return reply(
        "Contoh penggunaan:\n\n" + "Otomatis:\n.iqc Halo kawan\n\n" + "Manual:\n.iqc Halo kawan|19:30|19:30"
      );
    }

    const [rawMsg, rawChatTime, rawStatusBarTime] = text.split("|");

    if (!rawMsg?.trim()) {
      return reply("Teks tidak boleh kosong! Contoh: *.iqc Halo kawan*");
    }

    const now = new Date();
    const autoTime = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });

    const chatTime = rawChatTime ? rawChatTime.trim() : autoTime;
    const statusBarTime = rawStatusBarTime ? rawStatusBarTime.trim() : autoTime;

    const siputzxUrl =
      `https://brat.siputzx.my.id/iphone-quoted?text=${encodeURIComponent(rawMsg.trim())}` +
      `&chatTime=${encodeURIComponent(chatTime)}` +
      `&statusBarTime=${encodeURIComponent(statusBarTime)}`;

    const delineUrl =
      `https://api.deline.web.id/maker/iqc?text=${encodeURIComponent(rawMsg.trim())}` +
      `&chatTime=${encodeURIComponent(chatTime)}` +
      `&statusBarTime=${encodeURIComponent(statusBarTime)}`;

    await sendTyping();

    // Coba endpoint siputzx terlebih dahulu, jika gagal fallback ke deline
    try {
      const res = await fetch(siputzxUrl, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 1000) {
          return await sock.sendMessage(msg.key.remoteJid, { image: buf, caption: "" }, { quoted: msg });
        }
      }
      throw new Error(`Endpoint siputzx status: ${res.status}`);
    } catch (_) {
      try {
        await sock.sendMessage(msg.key.remoteJid, { image: { url: delineUrl }, caption: "" }, { quoted: msg });
      } catch (err) {
        return reply(`Gagal membuat iqc: ${err.message}`);
      }
    }
  },
};
