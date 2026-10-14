import { scanUrl, fileReport, formatVerdict } from "@/src/services/osint/virustotal.js";
import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";

export default {
  name: "virustotal",
  aliases: ["vt", "vtscan", "cekmalware", "scanlink"],
  description: "Cek URL/file dengan 70+ antivirus via VirusTotal (butuh VT_API_KEY gratis)",
  usage: "<url> atau reply file, cth: vt https://contoh.com/x.apk",
  premiumOnly: true,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    await sendTyping();

    if (!String(process.env.VT_API_KEY || "").trim()) {
      return reply(
        `Fitur ini butuh API key gratis VirusTotal.\n\n` +
          `1. Daftar di https://www.virustotal.com/\n` +
          `2. Buka profil → API key\n` +
          `3. Isi \`VT_API_KEY=\` di .env lalu restart bot`
      );
    }

    const targetMsg = findDownloadableTarget(msg);
    if (targetMsg) {
      let buffer = null;
      try {
        buffer = await getMediaBuffer(sock, targetMsg, { maxBytes: 100 * 1024 * 1024 });
      } catch (err) {
        return reply(`${err?.message || "Gagal membaca media."}`);
      }
      if (!buffer) return reply("Gagal membaca file yang di-reply.");
      await reply("File diterima, scan ke VirusTotal (bisa 1-2 menit, limit key gratis 4/menit)...");
      try {
        const fileName =
          targetMsg.message?.documentMessage?.fileName ||
          targetMsg.message?.documentWithCaptionMessage?.message?.documentMessage?.fileName ||
          "file";
        const rep = await fileReport(buffer, fileName);
        return reply(
          formatVerdict(`file ${fileName}`, {
            stats: rep.stats,
            results: rep.results,
            extra: [
              `• SHA256: \`${rep.hash.slice(0, 32)}...\``,
              `• Status: ${rep.known ? "pernah di-scan" : "scan baru"}`,
            ],
          })
        );
      } catch (err) {
        return reply(`Gagal scan file: ${err.message}`);
      }
    }

    const raw = (args[0] || "").trim();
    if (!raw) {
      return reply(
        `Kirim URL atau reply sebuah file!\n` + `Contoh: \`${currentPrefix}virustotal https://contoh.com/app.apk\``
      );
    }
    await reply(`Submit URL ke VirusTotal, tunggu hasil analisis...`);
    try {
      const rep = await scanUrl(raw);
      return reply(formatVerdict(rep.url, { stats: rep.stats, results: rep.results }));
    } catch (err) {
      return reply(`Gagal scan URL: ${err.message}`);
    }
  },
};
