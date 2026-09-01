import { exec } from "child_process";
import util from "util";
import fs from "fs";
import path from "path";

const execAsync = util.promisify(exec);

export default {
  description:
    "Mengekspor seluruh file media status WhatsApp yang terunduh ke dalam file ZIP.",
  usage: "[clear]",
  example: "clear",
  name: "exportstatus",
  aliases: ["getstatus", "statuszip"],
  category: "Owner",
  ownerOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    const statusesDir = path.join(process.cwd(), "statuses");

    if (!fs.existsSync(statusesDir)) {
      fs.mkdirSync(statusesDir, { recursive: true });
    }

    const fileCount = fs.readdirSync(statusesDir).length;
    if (fileCount === 0) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Belum ada status yang terkumpul." },
        { quoted: msg },
      );
      return;
    }

    await sendTyping();
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: `🔄 Sedang mengompres ${fileCount} status ke file ZIP...` },
      { quoted: msg },
    );

    const zipPath = path.join(process.cwd(), "statuses_export.zip");

    try {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

      await execAsync(`zip -r -j ${zipPath} ${statusesDir}/*`);

      const buffer = fs.readFileSync(zipPath);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          document: buffer,
          mimetype: "application/zip",
          fileName: `Status_Export_${Date.now()}.zip`,
          caption: "✅ Ini semua status yang berhasil dikumpulkan sejauh ini.",
        },
        { quoted: msg },
      );

      fs.unlinkSync(zipPath);

      if (args[0] === "clear") {
        const files = fs.readdirSync(statusesDir);
        for (const file of files) {
          fs.unlinkSync(path.join(statusesDir, file));
        }
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "🧹 Folder status telah dibersihkan." },
          { quoted: msg },
        );
      } else {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: "💡 Tips: Ketik *.exportstatus clear* untuk mengekspor lalu membersihkan folder dari server agar tidak penuh.",
          },
          { quoted: msg },
        );
      }
    } catch (err) {
      console.error("Export Status Error:", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Gagal mengekspor status: ${err.message}` },
        { quoted: msg },
      );
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    }
  },
};
