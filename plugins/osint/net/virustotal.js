import { scanUrl, fileReport, scanUrlFree, fileReportFree, formatVerdict, hasVtKey } from "@/src/services/osint/virustotal.js";
import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";

export default {
  name: "virustotal",
  aliases: ["vt", "vtscan", "cekmalware", "scanlink"],
  description: "Cek URL/file dengan antivirus (VirusTotal 70+ engine jika ada VT_API_KEY, atau free scraping URLHaus/urlscan/MalwareBazaar tanpa key)",
  usage: "<url> atau reply file, cth: vt https://contoh.com/x.apk",
  premiumOnly: true,
  cooldownMs: 15000,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    await sendTyping();
    const useFree = !hasVtKey();

    const targetMsg = findDownloadableTarget(msg);
    if (targetMsg) {
      let buffer = null;
      try {
        buffer = await getMediaBuffer(sock, targetMsg, { maxBytes: 100 * 1024 * 1024 });
      } catch (err) {
        return reply(`${err?.message || "Gagal membaca media."}`);
      }
      if (!buffer) return reply("Gagal membaca file yang di-reply.");
      if (useFree) {
        await reply("File diterima, cek free via MalwareBazaar + CIRCL + VT GUI scrap (tanpa API key)...");
        try {
          const fileName =
            targetMsg.message?.documentMessage?.fileName ||
            targetMsg.message?.documentWithCaptionMessage?.message?.documentMessage?.fileName ||
            "file";
          const rep = await fileReportFree(buffer, fileName);
          return reply(
            formatVerdict(`file ${fileName}`, {
              stats: rep.stats,
              results: rep.results,
              extra: [
                `• SHA256: \`${rep.hash.slice(0, 32)}...\``,
                `• Mode: FREE (tanpa VT_API_KEY) — ${rep.known ? "dikenal di DB" : "belum di-scan"}`,
                ...(rep.detections?.length ? [`• Deteksi: ${rep.detections.join("; ")}`] : []),
                `_Tip: isi VT_API_KEY untuk 70+ engine_`,
              ],
            })
          );
        } catch (err) {
          return reply(`Gagal scan file (free): ${err.message}`);
        }
      }
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
        `Kirim URL atau reply sebuah file!\n` + `Contoh: \`${currentPrefix}virustotal https://contoh.com/app.apk\` (free mode aktif jika tanpa VT_API_KEY)`
      );
    }
    if (useFree) {
      await reply(`Cek URL via free scraping (URLHaus + urlscan.io, tanpa API key)...`);
      try {
        const rep = await scanUrlFree(raw);
        return reply(
          formatVerdict(rep.url, {
            stats: rep.stats,
            results: rep.results,
            extra: [
              `• Mode: FREE (tanpa VT_API_KEY)`,
              ...(rep.detections?.length ? [`• Sumber: ${rep.detections.join(", ")}`] : [`• Tidak ada deteksi di free DB`]),
              `_Isi VT_API_KEY untuk hasil 70+ engine lebih akurat_`,
            ],
          })
        );
      } catch (err) {
        return reply(`Gagal scan URL (free): ${err.message}`);
      }
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
