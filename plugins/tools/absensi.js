import QRCode from "qrcode";
import { buildQrPayload, qrSession } from "@/src/services/telkom/config.js";
import { wibTimestamp } from "@/src/services/telkom/attendance.js";

const SESSION = qrSession();

function getWibTimestamp() {
  return wibTimestamp();
}

export default {
  name: "absensi",
  aliases: ["absen", "qrabsensi", "absensitel"],
  description: "Generate QR code absensi otomatis (Datang / Pulang)",
  usage: "<datang|pulang>",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const currentPrefix = prefix || ".";
    const subCmd = (args[0] || "").toLowerCase();

    const isDatang = subCmd === "datang";
    const isPulang = subCmd === "pulang" || subCmd === "ulang";

    if (!isDatang && !isPulang) {
      return reply(
        `*CARA ABSEN:*\n\n` +
          `• \`${currentPrefix}absensi datang\`\n` +
          `• \`${currentPrefix}absensi pulang\`\n\n` +
          `_ID (${SESSION.id}) & Lemdik (${SESSION.lemdikId}) sudah otomatis terpasang._`
      );
    }

    const mode = isDatang ? "Datang" : "Pulang";
    const timestamp = getWibTimestamp();

    const payload = JSON.stringify(buildQrPayload(`QR ${mode}`, timestamp));

    try {
      const qrBuffer = await QRCode.toBuffer(payload, {
        type: "png",
        errorCorrectionLevel: "H",
        margin: 2,
        scale: 8,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      const caption =
        `*ABSENSI ${mode.toUpperCase()} BERHASIL*\n\n` +
        `*Tipe:* QR ${mode}\n` +
        `*Waktu (WIB):* ${timestamp}\n\n` +
        `_Silakan scan QR code di atas._`;

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          image: qrBuffer,
          caption,
        },
        { quoted: msg }
      );
    } catch (err) {
      console.error("Gagal generate QR Absensi:", err);
      await reply(`Gagal membuat QR Code absensi: ${err.message}`);
    }
  },
};
