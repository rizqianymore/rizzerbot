import { commands } from "@/src/core/loader.js";
import { settings } from "@/config/settings.js";
import { db } from "@/src/core/database.js";

export default {
  name: "menu",
  aliases: ["help"],
  description: "Display the bot's menu.",
  category: "General",
  run: async (sock, msg, args, { sendTyping, isOwner, isPremium, prefix }) => {
    await sendTyping();
    
    const categories = {};
    commands.forEach((cmd) => {
      if (cmd.ownerOnly && !isOwner) return;
      if (cmd.premiumOnly && !isPremium) return;
      
      const cat = cmd.category || "General";
      if (!categories[cat]) categories[cat] = [];
      if (!categories[cat].includes(cmd.name)) {
        categories[cat].push(cmd.name);
      }
    });

    let menuText = `*${settings.botName}*\n`;
    menuText += `Prefix: [ ${prefix} ]\n`;
    menuText += `Status: ${isOwner ? 'Owner' : isPremium ? 'Premium' : 'Free User'}\n\n`;

    const order = ["Social Media", "AI", "Sticker", "Group", "Tools", "User", "Premium", "Owner", "General"];
    const catKeys = Object.keys(categories).sort(
      (a, b) => {
        const ia = order.indexOf(a) === -1 ? 99 : order.indexOf(a);
        const ib = order.indexOf(b) === -1 ? 99 : order.indexOf(b);
        return ia - ib;
      }
    );

    for (const cat of catKeys) {
      menuText += `*${cat.toUpperCase()}*\n`;
      menuText += categories[cat].map(c => ` > ${prefix}${c}`).join("\n");
      menuText += "\n\n";
    }

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: menuText.trim() },
      { quoted: msg }
    );
  },
};
