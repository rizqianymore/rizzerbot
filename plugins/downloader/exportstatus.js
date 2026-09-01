import { exec } from "child_process";
import util from "util";
import fs from "fs";
import path from "path";

const execAsync = util.promisify(exec);

export default {
  premiumOnly: true,
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

      await execAsync(`zip -r -j ${zipPath} ${statusesDir}

