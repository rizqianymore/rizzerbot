import { db } from "../src/core/database.js";

const botJid = process.argv[2] || "";
const pick = (s) => ({
  public: s.public,
  prefix: s.prefix,
  maintenance: s.maintenance,
  silentDeny: s.silentDeny,
  publicCommands: s.publicCommands,
  botNumbers: s.botNumbers,
});
const s = botJid ? db.getBotSettings(botJid) : db.getSettings();
const out = { botJid: botJid || "(main)", ...pick(s) };
if (!botJid) {
  try {
    const keys = Object.keys(db.data.botSettings || {});
    if (keys.length > 0) {
      out.subBots = keys.map((k) => ({ jid: k, ...pick(db.getBotSettings(k)) }));
    }
  } catch {}
  try {
    out.bannedSample = Object.entries(db.data.users || {})
      .filter(([, u]) => u?.banned)
      .slice(0, 5)
      .map(([j]) => j);
  } catch {}
}
console.log(JSON.stringify(out, null, 2));
