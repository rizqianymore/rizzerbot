import { getPluginsMenu, sendMenuMessage } from "@/src/utils/view.js";

export default {
  name: "plugins",
  description: "Menampilkan daftar plugin terpasang secara dinamis.",
  usage: "",
  aliases: ["plugin"],
  category: "User",
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    await sendTyping();
    const { commands } = await import("@/src/core/loader.js");
    const menuText = getPluginsMenu(commands);
    await sendMenuMessage(sock, msg, menuText);
  },
};
