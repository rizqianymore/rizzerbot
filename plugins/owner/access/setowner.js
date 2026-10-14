import { db } from "@/src/core/database.js";
import { notifyPrimaryOwner } from "@/src/utils/notify-owner.js";

export default {
  name: "setowner",
  aliases: ["changeowner", "ownertransfer"],
  description: "Pindahkan kepemilikan bot ini ke nomor lain (perlu konfirmasi)",
  usage: "<nomor> confirm",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, getTargetJid, botJid, senderJid, logger, isPrimarySuperOwner }) => {
    const activeBotJid = botJid || db.normalizeJid(sock.user?.id);

    if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
      logger?.warn?.(`[OwnerCmd] setowner DITOLAK untuk ${senderJid} via ${activeBotJid}`);
      return reply("Perintah ini hanya untuk Owner bot ini!");
    }

    const isSub = Boolean(sock.isSubBot) || !db.isMainBotJid(activeBotJid);
    if (!isSub && !isPrimarySuperOwner) {
      logger?.warn?.(`[OwnerCmd] setowner bot utama DITOLAK (bukan superowner): ${senderJid}`);
      return reply("Pemindahan Owner Bot Utama hanya dapat dilakukan oleh SuperOwner (Primary Owner).");
    }

    const jid = getTargetJid(args);
    if (!jid) {
      return reply("Masukkan nomor tujuan! Contoh: *.setowner 628xxxxxxxxx confirm*");
    }
    if (!jid.endsWith("@s.whatsapp.net") || jid.split("@")[0].replace(/\D/g, "").length < 8) {
      return reply("Target harus nomor WhatsApp asli! Ketik manual nomornya.");
    }
    if (db.isAnyBotJid(jid)) {
      return reply("Nomor tersebut adalah nomor bot (sesi bot lain) dan tidak bisa jadi Owner.");
    }

    const current = db.normalizeJid(db.getBotSettings(activeBotJid).ownerNumber);
    if (current === jid) {
      return reply(`*${jid.split("@")[0]}* sudah menjadi Owner tetap bot ini.`);
    }

    const confirmed = args.some((a) => ["confirm", "ya", "yes"].includes(String(a).toLowerCase()));
    if (!confirmed) {
      return reply(
        `*PINDAHKAN OWNER BOT INI*\n\n` +
          `Bot      : +${activeBotJid.split("@")[0]}\n` +
          `Owner    : lama +${(current || "-").split("@")[0]} → baru +${jid.split("@")[0]}\n\n` +
          `Perintah ini akan MEMINDAHKAN seluruh hak owner bot ini dan mencabut hak owner lama.\n` +
          `Lanjut? Ketik *.setowner ${jid.split("@")[0]} confirm*`
      );
    }

    try {
      const check = await sock.onWhatsApp(jid).catch(() => null);
      const exists = Array.isArray(check) && check.some((r) => r && r.exists);
      if (!exists) {
        return reply(`Nomor *${jid.split("@")[0]}* tidak terdaftar di WhatsApp. Pastikan nomornya benar.`);
      }
    } catch (_) {
      return reply("Gagal memverifikasi nomor ke WhatsApp. Coba lagi sebentar.");
    }

    const oldNum = (current || "-").split("@")[0];
    const newNum = jid.split("@")[0];

    try {
      if (isSub) {
        db.updateBotSettings(activeBotJid, { ownerNumber: jid });
        db.setOwner(jid, true, senderJid);
        if (current) db.setOwner(current, false, senderJid);
      } else {
        db.updateSettings({ ownerNumber: jid });
        db.setOwner(jid, true, senderJid);
        if (current) db.setOwner(current, false, senderJid);
      }
    } catch (err) {
      logger?.error?.(`[OwnerCmd] setowner GAGAL: ${err.message}`);
      return reply(`Pemindahan owner gagal: ${err.message}`);
    }

    logger?.warn?.(`[OwnerCmd] setowner ${oldNum} -> ${newNum} oleh ${senderJid} via ${activeBotJid}`);

    const oldStillOwner = current ? db.isBotOwner(activeBotJid, current) : false;
    let text =
      `*OWNER BOT DIPINDAHKAN*\n\n` +
      `Bot   : +${activeBotJid.split("@")[0]}\n` +
      `Lama  : +${oldNum}\n` +
      `Baru  : +${newNum}`;
    if (oldStillOwner) {
      text +=
        `\n\n⚠️ Nomor lama masih punya akses owner karena terdaftar di *config/settings.js*.\n` +
        `Hapus nomornya dari config lalu restart agar hak owner lama benar-benar dicabut.`;
    }

    await notifyPrimaryOwner(sock, {
      actor: senderJid,
      action: "setowner (transfer)",
      target: jid,
      botJid: activeBotJid,
      extra: `Owner lama: +${oldNum}${oldStillOwner ? " (masih owner via config)" : ""}`,
    });

    reply(text);
  },
};
