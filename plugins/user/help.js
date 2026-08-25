import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "@/src/core/database.js";
import { settings } from "@/config/settings.js";
import { getMenu } from "@/src/utils/view.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getMenuBanner() {
  const imgPath = settings.linkImage || settings.image;
  if (!imgPath) return null;
  if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
    return { url: imgPath };
  }
  const resolvedPath = path.resolve(process.cwd(), imgPath);
  if (fs.existsSync(resolvedPath)) {
    return { url: resolvedPath };
  }
  const relativePath = path.join(__dirname, "..", "..", imgPath);
  if (fs.existsSync(relativePath)) {
    return { url: relativePath };
  }
  return null;
}

export default {
  name: "help",
  description: "Menampilkan menu bantuan utama.",
  usage: "",
  aliases: ["menu"],
  category: "User",
  run: async (sock, msg, args, { sendTyping, senderName }) => {
    await sendTyping();
    const menuText = getMenu(senderName);
    const bannerImage = getMenuBanner();

    if (bannerImage) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { image: bannerImage, caption: menuText },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: menuText },
        { quoted: msg }
      );
    }
  },
};
