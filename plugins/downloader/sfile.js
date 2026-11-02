import { request } from "@/src/utils/request.js";

export default {
  name: "sfile",
  aliases: ["sfiledl", "sfilemobi"],
  description: "Download file dari sfile.mobi (scrape)",
  usage: "<url sfile>, cth: sfile https://sfile.mobi/xxx",
  category: "Downloader & Media",
  cooldownMs: 15000,
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    const url = (args[0] || "").trim();
    if (!url || !/sfile\.mobi/i.test(url)) {
      return reply("Kirim link sfile.mobi!\nContoh: `.sfile https://sfile.mobi/abc123`");
    }
    await sendTyping();
    try {
      const html = await request.text(url, { timeout: 15000 });

      const m = html.match(/href="(https:\/\/[^"]*sfile\.mobi[^"]*)"/i) || html.match(/id="download"[^>]*href="([^"]+)"/i);
      let dlUrl = m ? m[1] : null;
      if (!dlUrl) {

        const m2 = html.match(/https:\/\/[^\s"']*download[^\s"']*/i);
        dlUrl = m2 ? m2[0] : null;
      }
      if (!dlUrl) throw new Error("Link download tidak ditemukan (halaman berubah).");

      const buffer = await request.buffer(dlUrl, { timeout: 120000, maxBytes: 100 * 1024 * 1024 });
      if (!buffer?.length) throw new Error("Gagal ambil file.");
      const filename = dlUrl.split("/").pop()?.split("?")[0] || `sfile-${Date.now()}`;
      await sock.sendMessage(
        msg.key.remoteJid,
        { document: buffer, mimetype: "application/octet-stream", fileName: decodeURIComponent(filename).slice(0, 80) },
        { quoted: msg }
      );
    } catch (err) {
      logger?.warn?.(`[sfile] ${err?.message || err}`);
      return reply(`Gagal sfile: ${err?.message || err}`);
    }
  },
};
