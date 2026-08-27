import { getUserMenu, sendMenuMessage } from "@/src/utils/view.js";

export default {
  name: "usermenu",
  description: "Menampilkan daftar perintah dasar untuk pengguna.",
  usage: "",
  aliases: [],
  category: "User",
  run: async (sock, msg, args, { sendTyping }) => {
    await sendTyping();
    const { commands } = await import("@/src/core/loader.js");
    const menuText = getUserMenu(commands);
    await sendMenuMessage(sock, msg, menuText);
  },
};
