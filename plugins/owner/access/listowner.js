import { db } from "@/src/core/database.js";

export default {
  name: "listowner",
  aliases: ["owners"],
  description: "Lihat daftar semua Owner bot",
  usage: "",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, botJid, isPrimarySuperOwner }) => {
    const activeBotJid = botJid || db.normalizeJid(sock.user?.id);
    const isSub = Boolean(sock.isSubBot) || !db.isMainBotJid(activeBotJid);
    const botConfig = db.getBotSettings(activeBotJid);
    const mainConfig = db.main().getSettings();

    const primary = db.normalizeJid(mainConfig.ownerNumber);
    const pairing = db.normalizeJid(mainConfig.pairingNumber);
    const botDedicatedOwner = db.normalizeJid(botConfig.ownerNumber);
    const configFileOwners = [db.normalizeJid(mainConfig.ownerNumber), db.normalizeJid(mainConfig.pairingNumber)];

    const groups = new Map();
    const add = (jid, label) => {
      const key = db.normalizeJid(jid);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key).add(label);
    };

    add(primary, "Primary SuperOwner");
    if (pairing && pairing !== primary) add(pairing, "Nomor Pairing (Owner)");

    if (!isSub) add(botDedicatedOwner, "Bot Owner");
    else if (botDedicatedOwner) add(botDedicatedOwner, "Owner Tetap Bot Ini");

    for (const o of Array.isArray(botConfig.ownerNumbers) ? botConfig.ownerNumbers : []) add(o, "Owner Bot Ini");
    if (!isSub || isPrimarySuperOwner) {
      for (const o of Array.isArray(mainConfig.ownerNumbers) ? mainConfig.ownerNumbers : []) add(o, "Owner Bot Utama");
    }

    const uniqueOwners = [...groups.keys()];
    let text = `*DAFTAR OWNER (+${activeBotJid.split("@")[0]})*\n\n`;

    uniqueOwners.forEach((j, i) => {
      const tags = [...groups.get(j)].map((t) => `_${t}_`).join(" • ");
      const configNote = configFileOwners.includes(j) ? " 🔒config" : "";
      text += `${i + 1}. +${j.split("@")[0]} ${configNote}\n   ${tags}\n`;
    });

    text += `\nTotal: ${uniqueOwners.length} owner terdaftar`;
    if (!isPrimarySuperOwner) text += "\n_Daftar dibatasi; Hubungi SuperOwner untuk data lengkap._";
    if (isSub) text += "\n_Owner Bot Utama ikut berkuasa di semua sub-bot._";
    reply(text);
  },
};
