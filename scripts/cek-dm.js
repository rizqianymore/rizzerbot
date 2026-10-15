import { db } from "../src/core/database.js";

const botJid = process.argv[2] || "";
const s = botJid ? db.getBotSettings(botJid) : db.getSettings();
console.log(JSON.stringify({
  botJid: botJid || "(main)",
  public: s.public,
  prefix: s.prefix,
  maintenance: s.maintenance,
  silentDeny: s.silentDeny,
  publicCommands: s.publicCommands,
  botNumbers: s.botNumbers,
  bannedSample: Object.entries(db.data.users || {}).filter(([,u]) => u?.banned).slice(0,5).map(([j]) => j),
}, null, 2));
