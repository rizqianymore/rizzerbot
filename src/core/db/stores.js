import fs from "fs";
import path from "path";
import { AsyncLocalStorage } from "node:async_hooks";
import { isRecord, normalizeJid, normalizePhone, phoneDigitsOfPhoneJid, toBoolean } from "./utils.js";
import { normalizeSettings } from "./settings.js";
import { MAIN_KEY, SUBBOTS_DIR, isMainBotJid, registerBotJid } from "./botids.js";
import { Store } from "./store-admin.js";

export const botAls = new AsyncLocalStorage();
export const stores = new Map();

export function mainPaths() {
  const dbPath = path.join(process.cwd(), "database", "database.json");
  const usersDbPath = path.join(process.cwd(), "database", "users.json");
  return { dbPath, usersDbPath };
}

export function subPaths(digits) {
  const dir = path.join(SUBBOTS_DIR, digits);
  return {
    dbPath: path.join(dir, "database.json"),
    usersDbPath: path.join(dir, "users.json"),
  };
}

const { dbPath: MAIN_DB_PATH, usersDbPath: MAIN_USERS_PATH } = mainPaths();
export const mainStore = new Store(MAIN_KEY, true, MAIN_DB_PATH, MAIN_USERS_PATH);
stores.set(MAIN_KEY, mainStore);

export function resolveStoreKey(botJid) {
  const n = normalizeJid(botJid);
  if (!n || isMainBotJid(n)) return MAIN_KEY;
  const digits = phoneDigitsOfPhoneJid(n);
  return digits || MAIN_KEY;
}

export function activeStore() {
  const key = botAls.getStore();
  if (key === undefined || key === null) return mainStore;
  const s = stores.get(key);
  if (s) return s;

  if (key !== MAIN_KEY) {
    const peeked = peekSubStoreByKey(key);
    if (peeked) return peeked;
  }
  return mainStore;
}

export function peekSubStoreByKey(digits) {
  if (!digits || digits === MAIN_KEY) return null;
  if (stores.has(digits)) return stores.get(digits);
  const { dbPath, usersDbPath } = subPaths(digits);
  if (!fs.existsSync(dbPath) && !fs.existsSync(usersDbPath)) return null;
  try {
    const s = new Store(digits, false, dbPath, usersDbPath);
    stores.set(digits, s);
    return s;
  } catch (_) {
    return null;
  }
}

export function findLegacySubConfig(digits) {
  try {
    const legacy = mainStore.data?.botSettings || {};
    for (const [k, v] of Object.entries(legacy)) {
      if (normalizePhone(k) === digits && isRecord(v)) return v;
    }
  } catch (_) {}
  return null;
}

export function ensureSubStore(botJid, seed = {}) {
  const key = resolveStoreKey(botJid);
  if (!key || key === MAIN_KEY) return mainStore;
  const existing = peekSubStoreByKey(key);
  if (existing) {
    let touched = false;
    if (seed.botName && !existing.data.settings.botName) {
      existing.data.settings.botName = String(seed.botName);
      touched = true;
    }
    const curOwner = normalizeJid(existing.data.settings.ownerNumber || "");
    if (seed.ownerNumber && !curOwner) {
      const clean = normalizeJid(seed.ownerNumber);
      if (clean) {
        existing.data.settings.ownerNumber = clean;
        touched = true;
      }
    }
    if (touched) {
      existing.data.settings = normalizeSettings(existing.data.settings);
      existing.refreshConfiguredJids();
      existing.syncPrivilegedUsers();
      existing.save();
    }
    return existing;
  }

  const { dbPath, usersDbPath } = subPaths(key);
  const legacy = findLegacySubConfig(key);
  const normalized = normalizeJid(botJid);
  const initial = {
    botName: seed.botName || legacy?.botName || `SubBot (+${key})`,
    ownerNumber: normalizeJid(seed.ownerNumber || legacy?.ownerNumber || `${key}@s.whatsapp.net`),
    ownerNumbers: Array.isArray(seed.ownerNumbers)
      ? seed.ownerNumbers.map(normalizeJid).filter(Boolean)
      : Array.isArray(legacy?.ownerNumbers)
        ? legacy.ownerNumbers.map(normalizeJid).filter(Boolean)
        : [],
  };
  if (legacy?.public !== undefined) initial.public = toBoolean(legacy.public, true);
  if (typeof legacy?.prefix === "string" && legacy.prefix.trim()) initial.prefix = legacy.prefix.trim();

  const s = new Store(key, false, dbPath, usersDbPath);
  s.data.settings = normalizeSettings({ ...s.data.settings, ...initial });

  if (!normalizeJid(s.data.settings.ownerNumber)) {
    s.data.settings.ownerNumber = `${key}@s.whatsapp.net`;
  }
  if (!Array.isArray(s.data.settings.ownerNumbers)) s.data.settings.ownerNumbers = [];
  s.refreshConfiguredJids();
  s.syncPrivilegedUsers();
  s.save();
  stores.set(key, s);
  registerBotJid(normalized || `${key}@s.whatsapp.net`);
  return s;
}

export function runWithBot(botJid, fn) {
  return botAls.run(resolveStoreKey(botJid), fn);
}

export function mainAccessor() {
  return {
    get data() {
      return mainStore.data;
    },
    save: () => mainStore.save(),
    getSettings: () => mainStore.getSettings(),
    updateSettings: (u) => mainStore.updateSettings(u),
    getUser: (j) => mainStore.getUser(j),
    updateUser: (j, u) => mainStore.updateUser(j, u),
    getAccess: (j) => mainStore.getAccess(j),
    hasAccess: (j, r) => mainStore.hasAccess(j, r),
    isOwner: (j) => mainStore.isOwner(j),
    isAdmin: (j) => mainStore.isAdmin(j),
    isPremium: (j) => mainStore.isPremium(j),
    isBanned: (j) => mainStore.isBanned(j),
    isConfigFileOwner: (j) => mainStore.isConfigFileOwner(j),
    setOwner: (j, e, a) => mainStore.setOwner(j, e, a),
    setAdmin: (j, e, a) => mainStore.setAdmin(j, e, a),
    setPremium: (j, e, d, a) => mainStore.setPremium(j, e, d, a),
    setBanned: (j, e, a) => mainStore.setBanned(j, e, a),
    getAllPremiumUsers: () => mainStore.getAllPremiumUsers(),
    recordCommand: (c) => mainStore.recordCommand(c),
    isAntilink: (g) => mainStore.isAntilink(g),
    setAntilink: (g, e) => mainStore.setAntilink(g, e),
  };
}
