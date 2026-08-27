import { getPremiumMenu, sendMenuMessage } from "@/src/utils/view.js";

export default {
  name: "premiummenu",
  description: "Menampilkan daftar perintah fitur premium.",
  usage: "",
  aliases: [],
  category: "User",
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    await sendTyping();
    const { commands } = await import("@/src/core/loader.js");
    const menuText = getPremiumMenu(commands);
    await sendMenuMessage(sock, msg, menuText);
  },
};
