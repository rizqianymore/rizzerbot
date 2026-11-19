import { db } from "@/src/core/database.js";

export default {
  name: "ping",
  description: "Check bot speed",
  usage: "",
  category: "User",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    sendTyping();
    const rawJid = msg.key.remoteJid;
    const targetJid = rawJid?.endsWith("@lid") ? db.resolvePhoneJid(rawJid) || rawJid : rawJid;
    const start = Date.now();
    try {
      const sent = await sock.sendMessage(targetJid, { text: "Ping..." }, { quoted: msg });
      const speed = Date.now() - start;
      const text = `┌── SPEED TEST\n` + `│ Status: Online\n` + `│ Response: ${speed}ms\n` + `└─`;
      if (sent?.key) {
        await sock.sendMessage(targetJid, { text, edit: sent.key }).catch(async () => {
          await reply(text);
        });
      } else {
        await reply(text);
      }
    } catch (_) {
      const speed = Date.now() - start;
      const text = `┌── SPEED TEST\n` + `│ Status: Online\n` + `│ Response: ${speed}ms\n` + `└─`;
      await reply(text);
    }
  },
};
