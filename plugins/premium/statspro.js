import { db } from "@/src/core/database.js";

export default {
  name: "statspro",
  description: "Detailed command statistics",
  usage: "",
  premiumOnly: true,
  category: "Premium",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const usage = db.data.usage || {};
    const total = Object.values(usage).reduce((a, b) => a + b, 0);
    const top = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    let text =
      `┌── STATISTIK PENGGUNAAN BOT\n` +
      `│ Total Perintah: ${total}\n` +
      `│ Jumlah Fitur: ${Object.keys(usage).length}\n` +
      `└─\n\n` +
      `┌── TOP 10 COMMAND\n`;
    top.forEach(([cmd, count], i) => {
      const isLast = i === top.length - 1;
      const branch = isLast ? "└─" : "├─";
      text += `${branch} ${cmd}: ${count}x\n`;
    });
    await reply(text);
  },
};
