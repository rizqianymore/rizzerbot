import { db } from "@/src/core/database.js";

function extractDurationDays(args) {
  for (const arg of args) {
    const raw = String(arg ?? "").trim();
    if (!raw || raw.includes("@")) continue;
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 0 || digits.length > 6) continue;
    const value = parseFloat(raw);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

export default {
  name: "addprem",
  description: "Tambahkan pengguna premium",
  usage: "<nomor> [hari]",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, getTargetJid, senderJid }) => {
    const jid = getTargetJid(args);

    if (!jid) {
      return reply(
        "Balas pesan user atau masukkan nomor! Contoh:\n• *.addprem 628xxx 30* (30 hari)\n• *.addprem 628xxx* (Permanen)"
      );
    }

    if (!jid.endsWith("@s.whatsapp.net") || jid.split("@")[0].replace(/\D/g, "").length < 8) {
      return reply("Target harus nomor WhatsApp asli! Ketik manual nomornya.");
    }

    const durationDays = extractDurationDays(args);

    try {
      const check = await sock.onWhatsApp(jid).catch(() => null);
      if (!(Array.isArray(check) && check.some((r) => r && r.exists))) {
        return reply(`Nomor *${jid.split("@")[0]}* tidak terdaftar di WhatsApp. Pastikan nomornya benar.`);
      }
    } catch (_) {
      return reply("Gagal memverifikasi nomor ke WhatsApp. Coba lagi sebentar.");
    }
    if (db.isOwner(jid)) return reply("Owner otomatis memiliki akses Premium selamanya.");
    if (db.isAdmin(jid)) return reply("Admin Bot otomatis memiliki akses Premium selamanya.");

    db.setPremium(jid, true, durationDays, senderJid);
    reply(
      `Berhasil menambahkan *${jid.split("@")[0]}* ke Premium${durationDays ? ` selama ${durationDays} hari` : " (Permanen)"}.`
    );
  },
};
