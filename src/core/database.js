import { normalizeJid } from "./db/utils.js";
import {
  resolvePhoneJid,
  pickPhoneJid,
  sameUser,
  rememberLidPnMapping,
  learnGroupLidMap,
  flushLidMap,
  bindLidStoreProvider,
} from "./db/lidmap.js";
import {
  setMainBotJid,
  getMainBotJid,
  getKnownSubDigits,
  isAnyBotJid,
  isPrimaryOwnerJid,
  registerBotJid,
  bindBotIdProviders,
} from "./db/botids.js";
import { getBotSettings, updateBotSettings, isBotOwner } from "./db/bot-settings.js";
import { stores, mainStore, activeStore, ensureSubStore, runWithBot, mainAccessor } from "./db/stores.js";

export { flushLidMap, setMainBotJid, getMainBotJid };

bindLidStoreProvider(() => mainStore);
bindBotIdProviders({ getMainStore: () => mainStore, getStores: () => stores });

export const db = {
  get data() {
    return activeStore().data;
  },
  save: () => activeStore().save(),
  normalizeJid,
  resolvePhoneJid,
  pickPhoneJid,
  sameUser,
  rememberLidPn: rememberLidPnMapping,
  learnGroupLidMap,
  getSettings: () => activeStore().getSettings(),
  updateSettings: (u) => activeStore().updateSettings(u),
  getBotSettings,
  updateBotSettings,
  isBotOwner,
  isAnyBotJid,
  setMainBotJid,
  getMainBotJid,
  runWithBot,
  main: mainAccessor,
  ensureSubStore: (botJid, seed) => ensureSubStore(botJid, seed),
  getKnownSubDigits,
  isExternalBotJid: (jid) => activeStore().isExternalBotJid(jid),
  getUser: (jid) => activeStore().getUser(jid),
  updateUser: (jid, updates) => activeStore().updateUser(jid, updates),
  registerBotJid,
  setOwner: (jid, enabled) => activeStore().setOwner(jid, enabled),
  setAdmin: (jid, enabled) => activeStore().setAdmin(jid, enabled),
  setPremium: (jid, enabled, days) => activeStore().setPremium(jid, enabled, days),
  setBanned: (jid, enabled) => activeStore().setBanned(jid, enabled),
  deleteUser: (jid) => activeStore().deleteUser(jid),
  isOwner: (jid) => activeStore().isOwner(jid),
  isAdmin: (jid) => activeStore().isAdmin(jid),
  isPremium: (jid) => activeStore().isPremium(jid),
  isPrimaryOwner: (jid) => isPrimaryOwnerJid(jid),
  getAllPremiumUsers: () => activeStore().getAllPremiumUsers(),
  isConfiguredAdmin: (jid) => activeStore().isConfiguredAdmin(jid),
  isConfiguredPremium: (jid) => activeStore().isConfiguredPremium(jid),
  isBanned: (jid) => activeStore().isBanned(jid),
  getAccess: (jid) => activeStore().getAccess(jid),
  hasAccess: (jid, req) => activeStore().hasAccess(jid, req),
  recordCommand: (command) => activeStore().recordCommand(command),
  isAntilink: (groupId) => activeStore().isAntilink(groupId),
  setAntilink: (groupId, enabled) => activeStore().setAntilink(groupId, enabled),
};

export function flushAllStores() {
  try {
    flushLidMap(true);
  } catch (_) {}
  for (const store of stores.values()) {
    try {
      if (store._saveTimer) {
        clearTimeout(store._saveTimer);
        store._saveTimer = null;
      }
      store.save();
    } catch (_) {}
  }
}

if (typeof process !== "undefined" && !process.env.RIZZER_NO_FLUSH_HOOK) {
  const flush = () => {
    try {
      flushAllStores();
    } catch (_) {}
  };
  process.once("beforeExit", flush);
  process.once("SIGINT", () => {
    flush();
  });
  process.once("SIGTERM", () => {
    flush();
  });
}

export default db;
