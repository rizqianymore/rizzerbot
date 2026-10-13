import QRCode from "qrcode";

const ID = 3919;
const LEMDIK_ID = 47;

function getWibTimestamp() {
  const d = new Date();

  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const wib = new Date(utc + 3600000 * 7);

  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())} ` +
    `${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())}`
  );
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
          `_ID (${ID}) & Lemdik (${LEMDIK_ID}) sudah otomatis terpasang._`
      );
    }

    const mode = isDatang ? "Datang" : "Pulang";
    const timestamp = getWibTimestamp();

    const payload = JSON.stringify({
      id: ID,
      lemdikId: LEMDIK_ID,
      createdAt: timestamp,
      type: `QR ${mode}`,
    });

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
