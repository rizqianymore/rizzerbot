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
      `📊 *STATISTIK PENGGUNAAN BOT*\n\n` +
      `*Total Perintah:* ${total}\n` +
      `*Jumlah Fitur:* ${Object.keys(usage).length}\n\n` +
      `*Top 10 Command:*\n`;
    top.forEach(([cmd, count], i) => {
      text += ` ${i + 1}. ${cmd}: ${count}x\n`;
    });
    await reply(text);
  },
};
