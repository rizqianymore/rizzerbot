export default {
  name: "resetdb",
  description: "Reset database ke kondisi awal (hapus semua data) — SuperOwner + private chat only",
  usage: "--confirm",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, isPrimarySuperOwner, logger }) => {
    if (!isPrimarySuperOwner) {
      return reply("Perintah resetdb hanya SuperOwner Bot Utama.");
    }
    if (String(msg.key.remoteJid || "").endsWith("@g.us")) {
      return reply("Jalankan .resetdb di private chat SuperOwner, bukan di grup.");
    }
    const confirm = args?.[0];
    if (confirm !== "--confirm") {
      return reply("⚠️ Perintah reset database!\nGunakan: `.resetdb --confirm` untuk menghapus database. Tindakan tidak dapat dibatalkan.");
    }
    logger?.warn?.(`[OwnerCmd] resetdb oleh ${msg.key.participant || msg.key.remoteJid}`);
    const { execSync } = await import("child_process");
    try {
      execSync("node scripts/reset-total.js --force", { stdio: "ignore", timeout: 15000 });
      await reply("✅ Database berhasil direset. Silakan restart bot.");
    } catch (e) {
      await reply(`❌ Gagal reset: ${e?.message || e}`);
    }
  },
};
