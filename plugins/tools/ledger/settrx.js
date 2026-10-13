import { updateTransaction, generateReceiptCard, formatTrxText } from "@/src/services/finance/trx.js";

import { db } from "@/src/core/database.js";

import { forwardTrxToChannel } from "@/src/services/finance/trx.js";

const recentBroadcastTrx = new Set();

export default {
  name: "settrx",
  aliases: ["updatetrx", "statustrx"],
  description: "Update status transaksi (LUNAS, PENDING, PROSES, BATAL)",
  usage: "<id_trx> <status>",
  adminOnly: true,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    if (args.length < 2) {
      return reply(
        `❌ Format salah!\n*Gunakan:* \`.settrx <ID_TRX> <lunas|pending|proses|batal>\`\n*Contoh:* \`.settrx TRX-20260926-XXXX lunas\``
      );
    }

    const id = args[0];
    const newStatus = args.slice(1).join(" ");

    const updated = updateTransaction(id, { status: newStatus });
    if (!updated) {
      return reply(`❌ Transaksi dengan ID *"${id}"* tidak ditemukan.`);
    }

    const caption = `✅ *STATUS TRANSAKSI DIPERBARUI!*\n\n` + formatTrxText(updated);
    const remoteJid = msg.key.remoteJid;

    const activeSettings = db.getSettings();
    let cardBuffer = null;
    try {
      cardBuffer = await generateReceiptCard(updated);
    } catch (_) {}

    try {
      if (cardBuffer) {
        await sock.sendMessage(
          remoteJid,
          {
            image: cardBuffer,
            caption,
            mentions: updated.buyerJid ? [updated.buyerJid] : [],
          },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(
          remoteJid,
          {
            text: caption,
            mentions: updated.buyerJid ? [updated.buyerJid] : [],
          },
          { quoted: msg }
        );
      }
    } catch (_) {
      await reply(caption);
    }

    const channelJid = activeSettings.channelJid || db.getSettings().channelJid || "";
    if (activeSettings.autoForwardTrxToChannel !== false && channelJid && channelJid.includes("@newsletter")) {
      const dedupeKey = `update_${updated.id}_${updated.status}`;
      if (!recentBroadcastTrx.has(dedupeKey)) {
        recentBroadcastTrx.add(dedupeKey);
        if (recentBroadcastTrx.size > 200) {
          const [firstKey] = recentBroadcastTrx;
          recentBroadcastTrx.delete(firstKey);
        }

        const payload = cardBuffer ? { image: cardBuffer, caption } : { text: caption };

        forwardTrxToChannel(sock, channelJid, payload).catch((e) => {
          console.error("[TRX-Channel] Error forward update trx:", e.message);
        });
      }
    }
  },
};
