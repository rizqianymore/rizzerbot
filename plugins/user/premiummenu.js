import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { settings } from "@/config/settings.js";
import { getPremiumMenu } from "@/lib/view.js";

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
  name: "premiummenu",
  description: "Menampilkan daftar perintah fitur premium.",
  usage: "",
  aliases: [],
  category: "User",
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    await sendTyping();
    const { commands } = await import("@/lib/plugins.js");
    const menuText = getPremiumMenu(commands);
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
