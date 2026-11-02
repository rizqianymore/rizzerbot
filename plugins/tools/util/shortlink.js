import { request } from "@/src/utils/request.js";

export default {
  name: "shortlink",
  aliases: ["short", "shorturl", "tinyurl", "pendek"],
  description: "Perpendek URL panjang jadi shortlink (is.gd / tinyurl)",
  usage: "<url>, cth: shortlink https://example.com/very/long/url",
  category: "Tools",
  cooldownMs: 4000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const cur = prefix || ".";
    const raw = (args[0] || "").trim();
    if (!raw) {
      return reply(`Kirim URL!\nContoh: \`${cur}shortlink https://example.com/panjang\``);
    }
    let url = raw;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      new URL(url);
    } catch {
      return reply("URL tidak valid.");
    }
    await sendTyping();

    try {
      const txt = await request.text(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, {
        timeout: 12000,
      });
      if (txt && txt.startsWith("http")) {
        return reply(`*SHORTLINK:*\n• Asli: ${url}\n• Pendek: ${txt.trim()}`);
      }
    } catch (_) {}
    try {
      const data = await request.json(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`, {
        timeout: 12000,
      });
      if (data?.shorturl) {
        return reply(`*SHORTLINK:*\n• Asli: ${url}\n• Pendek: ${data.shorturl}`);
      }
      if (data?.errormessage) throw new Error(data.errormessage);
    } catch (_) {}

    try {
      const data = await request.json(`https://ulvis.net/api.php?url=${encodeURIComponent(url)}`, {
        timeout: 12000,
      });
      if (data?.data) {
        return reply(`*SHORTLINK:*\n• Asli: ${url}\n• Pendek: ${data.data}`);
      }
    } catch (err) {
      return reply(`Gagal perpendek: ${err?.message || err}`);
    }
    return reply("Gagal perpendek URL. Coba lagi nanti.");
  },
};
