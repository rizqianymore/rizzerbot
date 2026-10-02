// plugins/bug/bugmenu.js — perintah "bugmenu" (1 file = 1 perintah).
// Tampilan dibangun di @/src/services/bug/menu.js (dipakai juga oleh `.menu bug`).
import { sendBugMenu } from "@/src/services/bug/index.js";

export default {
  name: "bugmenu",
  aliases: ["bug", "listbug"],
  description: "Menampilkan menu bug nomor + bug grup + owner",
  usage: "",
  category: "Bug",
  run: async (sock, msg, args, { sendTyping }) => {
    await sendTyping();
    await sendBugMenu(sock, msg);
  },
};
