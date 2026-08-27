import { getMenu, sendMenuMessage } from "@/src/utils/view.js";

export default {
  name: "help",
  description: "Menampilkan menu bantuan utama bot.",
  usage: "",
  aliases: ["menu"],
  category: "User",
  run: async (sock, msg, args, { sendTyping, senderName }) => {
    await sendTyping();
    const menuText = getMenu(senderName);
    await sendMenuMessage(sock, msg, menuText);
  },
};
