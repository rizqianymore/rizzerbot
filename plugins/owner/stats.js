import fs from "fs";
import path from "path";
import { db } from '@/src/core/database.js';

function fileSize(p) {
  try {
    const st = fs.statSync(p);
    if (st.size < 1024) return `${st.size} B`;
    if (st.size < 1048576) return `${(st.size / 1024).toFixed(1)} KB`;
    return `${(st.size / 1048576).toFixed(2)} MB`;
  } catch (_) {
    return "-";
  }
}

export default {
  "name": "stats",
  "aliases": ["dbstats", "statistik"],
  "description": "Statistik database & pemakaian bot",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, senderJid, logger }) => {
      logger?.warn?.(`[OwnerCmd] stats oleh ${senderJid}`);
      const users = Object.entries(db.data.users || {});
      let owners = 0, admins = 0, premiums = 0, banned = 0, registered = 0;
      for (const [, u] of users) {
        if (!u) continue;
        if (u.owner) owners++;
        else if (u.admin) admins++;
        else if (u.premium) premiums++;
        if (u.banned) banned++;
        if (u.registered) registered++;
      }
      const usage = db.data.usage || {};
      const top = Object.entries(usage)
        .map(([cmd, n]) => [cmd, Number(n) || 0])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const totalCmd = Object.values(usage).reduce((a, b) => a + (Number(b) || 0), 0);
      const lidMapSize = Object.keys(db.data.lidMap || {}).length;
      const root = process.cwd();
      reply(
        `📊 *STATISTIK BOT*\n\n` +
        `👥 *User:* ${users.length} total\n` +
        `• Owner: ${owners} | Admin: ${admins} | Premium: ${premiums}\n` +
        `• Terdaftar: ${registered} | Banned: ${banned}\n` +
        `• Peta LID→HP: ${lidMapSize} entri\n\n` +
        `⌨️ *Command dijalankan:* ${totalCmd}x\n` +
        (top.length ? top.map(([c, n], i) => `${i + 1}. .${c} — ${n}x`).join("\n") + "\n\n" : "") +
        `💾 *Ukuran file:*\n` +
        `• database.json: ${fileSize(path.join(root, "database", "database.json"))}\n` +
        `• users.json: ${fileSize(path.join(root, "database", "users.json"))}\n` +
        `• transactions.json: ${fileSize(path.join(root, "database", "transactions.json"))}`
      );
    },
};
