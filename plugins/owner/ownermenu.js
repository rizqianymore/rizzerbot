import { getOwnerMenu, sendMenuMessage } from "@/src/utils/view.js";

export default {
  name: "ownermenu",
  description: "Menampilkan daftar perintah khusus owner bot.",
  usage: "",
  aliases: [],
  category: "Owner",
  ownerOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    await sendTyping();
    const { commands } = await import("@/src/core/loader.js");
    const menuText = getOwnerMenu(commands);
    await sendMenuMessage(sock, msg, menuText);
  },
};
