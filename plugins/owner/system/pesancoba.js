import { notifyOwnerSafe, resolveOwnerJid } from "@/src/utils/send-safe.js";

export default {
  name: "pesancoba",
  aliases: ["testpesan", "cekkirim", "sendtest"],
  description: "Diagnostik jalur kirim pesan: reply, notifikasi owner, dan kirim ke satu grup",
  usage: "",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, logger }) => {
    const log = logger || console;
    const lines = [];

    lines.push("🧪 *Diagnostik Pengiriman Pesan*");

    const jid = resolveOwnerJid();
    lines.push(`• Owner JID: ${jid ? jid.split("@")[0] : "❌ KOSONG"}`);
    lines.push(`• Sock siap: ${sock?.sendMessage ? "✅" : "❌"}`);

    let replyOk = false;
    try {
      await reply("✅ Test reply — pesan ini datang dari context.reply().");
      replyOk = true;
    } catch (err) {
      lines.push(`• Reply: ❌ ${err?.message || err}`);
    }
    if (replyOk) lines.push("• Reply: ✅");

    if (jid && sock?.sendMessage) {
      try {
        await sock.sendMessage(jid, { text: "✅ Test kirim langsung ke owner dari .pesancoba" });
        lines.push("• Kirim ke owner: ✅");
      } catch (err) {
        lines.push(`• Kirim ke owner: ❌ ${err?.message || err}`);
      }
      const notified = await notifyOwnerSafe("✅ Test notifyOwnerSafe dari .pesancoba", log, "pesancoba");
      lines.push(`• notifyOwnerSafe: ${notified ? "✅" : "❌"}`);
    } else {
      lines.push("• Kirim ke owner: ⏭ dilewati (JID/sock tidak siap)");
    }

    let groups = {};
    try {
      groups = await sock.groupFetchAllParticipating();
    } catch (err) {
      lines.push(`• Daftar grup: ❌ ${err?.message || err}`);
    }
    const ids = Object.keys(groups || {});
    lines.push(`• Grup ditemukan: ${ids.length}`);
    if (ids.length) {
      try {
        await sock.sendMessage(ids[0], { text: "✅ Test broadcast ke 1 grup dari .pesancoba" });
        lines.push(`• Kirim ke grup pertama: ✅ (${ids[0].split("@")[0]})`);
      } catch (err) {
        lines.push(`• Kirim ke grup pertama: ❌ ${err?.message || err}`);
      }
    }

    lines.push("\nSilakan cek WhatsApp untuk melihat pesan test yang berhasil.");
    await reply(lines.join("\n"));
  },
};
