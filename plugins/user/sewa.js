// plugins/user/sewa.js — perintah "sewa" (1 file = 1 perintah).
import { db } from '@/src/core/database.js';
import {
  getMediaBuffer,
  createSticker,
  webpToImage,
  findDownloadableTarget,
} from '@/src/services/media.js';
import {
  fetchLyrics,
  translateText,
} from '@/src/services/scrape.js';


import { getUptimeString } from '@/src/utils/helper.js';



export default {
  "name": "sewa",
  "aliases": ["sewabot","pricelist","harga","daftarharga","premiumprice"],
  "description": "Lihat daftar harga sewa bot dan paket user premium",
  "usage": "",
  "category": "User",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const activeSettings = db.getSettings();
      const ownerNumber = db.normalizeJid(activeSettings.ownerNumber).split("@")[0] || activeSettings.ownerNumber;
      const currentPrefix = prefix || ".";

      const text =
        `🏷️ *Pricelist Sewa Bot & Akun Premium*\n\n` +
        `*Paket Sewa Bot (Masuk Grup):*\n` +
        `• 7 Hari: Rp 5.000\n` +
        `• 15 Hari: Rp 10.000\n` +
        `• 30 Hari: Rp 15.000\n` +
        `• Permanen: Rp 35.000\n\n` +
        `*Paket User Premium (Akses Fitur Khusus):*\n` +
        `• 7 Hari: Rp 3.000\n` +
        `• 30 Hari: Rp 10.000\n` +
        `• Permanen: Rp 25.000\n\n` +
        `*Keuntungan Premium:*\n` +
        `• Bebas limit & tanpa cooldown anti-spam\n` +
        `• Akses fitur HD upscale foto (` + currentPrefix + `hd)\n` +
        `• Akses TTS Suara Google (` + currentPrefix + `tts)\n` +
        `• Akses pencarian anime & web pro\n\n` +
        `*Metode Pembayaran:*\n` +
        `• QRIS All Payment (Dana, Ovo, Gopay, ShopeePay, Bank)\n` +
        `• Transfer Bank / E-Wallet\n\n` +
        `Minat sewa atau upgrade? Hubungi owner:\n` +
        `📞 wa.me/${ownerNumber} _(${activeSettings.ownerName})_`;

      await reply(text);
    },
};
