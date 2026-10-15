import * as Bug from "@/src/services/system/bug/index.js";

export default {
  name: "tesfunct",
  aliases: [],
  description: "Eksekusi fungsi bug dari kode yang di-reply sebanyak N kali",
  usage: "<namaFungsi> <jumlah 1-10> (reply kode fungsi)",
  category: "Bug",
  ownerOnly: true,
  run: async (sock, msg, args, { reply, quoted, prefix, commandName, isPrimarySuperOwner }) => {
    const q = args.join(" ");
    const parts = q.split(" ").filter(Boolean);
    const namaFungsi = parts[0];
    const jumlah = parseInt(parts[1], 10);

    if (!namaFungsi || !jumlah || isNaN(jumlah)) {
      return reply(`*Syntax Error*\nExample: ${prefix + commandName} namafunct 5`);
    }
    if (jumlah < 1 || jumlah > 10) {
      return reply("*Jumlah dibatasi 1-10 per eksekusi.*");
    }

    const quotedText =
      quoted?.conversation ||
      quoted?.extendedTextMessage?.text ||
      quoted?.imageMessage?.caption ||
      quoted?.videoMessage?.caption ||
      quoted?.documentMessage?.caption ||
      "";

    if (!quotedText) {
      return reply("*Error!* Kamu harus me-reply chat yang berisi kode fungsinya.");
    }

    const remoteJid = msg.key.remoteJid;
    if (remoteJid?.endsWith("@g.us")) {
      return reply(
        "Ditolak: jangan jalankan fungsi bug di dalam grup (target = grup ini sendiri). Gunakan chat pribadi untuk pengujian."
      );
    }
    const target = remoteJid;

    const blocked = Bug.getBugTargetBlockReason(sock, target, { isPrimarySuperOwner });
    if (blocked) return reply(blocked);

    await reply(`⏳ *Memproses ${namaFungsi} ke target sebanyak ${jumlah} kali...*`);

    const startedAt = Date.now();
    for (let i = 0; i < jumlah; i++) {
      try {
        await eval(`(async (target) => {\n${quotedText}\nawait ${namaFungsi}(target);\n})`)(target);
        await Bug.sleep(Bug.BUG_DELAY_MS ?? 500);
      } catch (err) {
        return reply(`*Error saat menjalankan!*\n\nDetail: ${err.message}`);
      }
    }

    const secs = Math.round((Date.now() - startedAt) / 1000);
    await reply(`✅ *Selesai! ${namaFungsi} sebanyak ${jumlah} kali*\nDurasi: ${secs} detik`);

    console.log(`\x1b[31m\x1b[1mSuccess mengeksekusi ${namaFungsi}!\x1b[0m`);
  },
};
