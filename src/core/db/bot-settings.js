import { settings } from "@/config/settings.js";
import { cloneValue, normalizeJid, phoneDigitsOfPhoneJid, samePhoneJidStrict, toBoolean } from "./utils.js";
import { configDefaults, normalizeSettings } from "./settings.js";
import { resolvePhoneJid } from "./lidmap.js";
import { isMainBotJid, isPrimaryOwnerJid } from "./botids.js";
import { ensureSubStore, findLegacySubConfig, mainStore, peekSubStoreByKey } from "./stores.js";

export function getBotSettings(botJid) {
  const normalized = normalizeJid(botJid);
  if (!normalized || isMainBotJid(normalized)) {
    const s = mainStore.data.settings || {};
    const primaryOwnerJid = normalizeJid(s.ownerNumber || settings.ownerNumber);
    return {
      ...s,
      ownerNumber: primaryOwnerJid || s.ownerNumber,
      ownerNumbers: Array.isArray(s.ownerNumbers) ? s.ownerNumbers : [],
    };
  }
  const key = phoneDigitsOfPhoneJid(normalized);
  const store = key ? peekSubStoreByKey(key) : null;
  if (store) {
    const s = store.data.settings || {};
    return {
      ...s,
      ownerNumber: normalizeJid(s.ownerNumber) || normalized,
      ownerNumbers: Array.isArray(s.ownerNumbers) ? s.ownerNumbers : [],
    };
  }

  const legacy = key ? findLegacySubConfig(key) : null;
  return {
    ...cloneValue(configDefaults),
    public:
      legacy?.public !== undefined
        ? toBoolean(legacy.public, configDefaults.public)
        : toBoolean(configDefaults.public, false),
    prefix:
      typeof legacy?.prefix === "string" && legacy.prefix.trim() ? legacy.prefix.trim() : configDefaults.prefix || ".",
    botName: legacy?.botName || `SubBot (+${key || normalized})`,
    ownerNumber: (legacy?.ownerNumber && normalizeJid(legacy.ownerNumber)) || normalized,
    ownerNumbers: Array.isArray(legacy?.ownerNumbers) ? legacy.ownerNumbers.map(normalizeJid).filter(Boolean) : [],
  };
}

export function updateBotSettings(botJid, updates = {}) {
  const normalized = normalizeJid(botJid);
  if (!normalized || isMainBotJid(normalized)) {
    return mainStore.updateSettings(updates);
  }
  const store = ensureSubStore(normalized);
  const current = store.data.settings;
  if (updates.public !== undefined) {
    current.public = toBoolean(updates.public);
  }
  if (updates.prefix !== undefined) {
    const p = String(updates.prefix).trim();
    if (p && p.length <= 3 && !/\s/.test(p)) {
      current.prefix = p;
    }
  }
  if (updates.botName !== undefined) {
    current.botName = String(updates.botName).trim();
  }
  if (updates.ownerNumber !== undefined) {
    const clean = normalizeJid(updates.ownerNumber);
    if (clean) current.ownerNumber = clean;
  }
  if (updates.ownerNumbers !== undefined && Array.isArray(updates.ownerNumbers)) {
    current.ownerNumbers = updates.ownerNumbers.map(normalizeJid).filter((j) => j && j.endsWith("@s.whatsapp.net"));
  }
  store.data.settings = normalizeSettings(current);
  store.refreshConfiguredJids();
  store.syncPrivilegedUsers();
  store.save();
  return getBotSettings(normalized);
}

export function isBotOwner(botJid, userJid) {
  const normalizedBot = normalizeJid(botJid);
  const normalizedUser = resolvePhoneJid(userJid);
  if (!normalizedUser) return false;

  const samePhone = samePhoneJidStrict;

  if (isPrimaryOwnerJid(normalizedUser)) return true;
  if (mainStore.isOwner(normalizedUser)) return true;

  const botIsMain = !normalizedBot || isMainBotJid(normalizedBot);
  if (botIsMain) {
    if (normalizedUser.endsWith("@s.whatsapp.net")) {
      const userPhone = phoneDigitsOfPhoneJid(normalizedUser);
      if (userPhone) {
        const phoneJid = `${userPhone}@s.whatsapp.net`;
        if (isPrimaryOwnerJid(phoneJid) || mainStore.isOwner(phoneJid)) return true;
      }
    }
    return false;
  }

  const key = phoneDigitsOfPhoneJid(normalizedBot);
  const store = key ? peekSubStoreByKey(key) : null;
  const botOwner = store ? normalizeJid(store.data.settings?.ownerNumber) : "";
  const botOwnersList =
    store && Array.isArray(store.data.settings?.ownerNumbers) ? store.data.settings.ownerNumbers.map(normalizeJid) : [];

  if (botOwner && samePhone(normalizedUser, botOwner)) return true;
  if (botOwnersList.some((o) => samePhone(normalizedUser, o))) return true;

  return false;
}
