import fs from "fs";
import path from "path";
import { settings } from "@/config/settings.js";
import { normalizeJid, normalizePhone, phoneDigitsOfPhoneJid, samePhoneJidStrict } from "./utils.js";
import { resolvePhoneJid } from "./lidmap.js";

export const MAIN_KEY = "";
export const SUBBOTS_DIR = path.join(process.cwd(), "database", "subbots");

const activeBotJids = new Set();
let mainBotJidMemory = "";
const _providers = { getMainStore: null, getStores: null };

export function bindBotIdProviders(providers = {}) {
  if (typeof providers.getMainStore === "function") _providers.getMainStore = providers.getMainStore;
  if (typeof providers.getStores === "function") _providers.getStores = providers.getStores;
}

export function setMainBotJid(jid) {
  const n = normalizeJid(jid);
  if (n) mainBotJidMemory = n;
}

export function getMainBotJid() {
  if (mainBotJidMemory) return mainBotJidMemory;
  try {
    const mainStore = _providers.getMainStore ? _providers.getMainStore() : null;
    return normalizeJid(mainStore?.data?.settings?.ownerNumber || settings.ownerNumber);
  } catch (_) {
    return "";
  }
}

export function isMainBotJid(jid) {
  const n = normalizeJid(jid);
  if (!n) return false;
  if (mainBotJidMemory && n === mainBotJidMemory) return true;
  try {
    const mainStore = _providers.getMainStore ? _providers.getMainStore() : null;
    const s = mainStore?.data?.settings || {};
    const o = normalizeJid(s.ownerNumber || settings.ownerNumber);
    const p = normalizeJid(s.pairingNumber || settings.pairingNumber);
    if ((o && n === o) || (p && n === p)) return true;
    const pn = normalizePhone(n);
    if (pn && ((o && normalizePhone(o) === pn) || (p && normalizePhone(p) === pn))) return true;
  } catch (_) {}
  return false;
}

export function registerBotJid(jid) {
  const normalized = normalizeJid(jid);
  if (!normalized) return;
  activeBotJids.add(normalized);
}

const SUB_DIGITS_TTL_MS = 30_000;
let _subDigitsCache = { at: 0, value: [] };

export function invalidateSubDigitsCache() {
  _subDigitsCache.at = 0;
}

export function getKnownSubDigits() {
  const now = Date.now();
  if (now - _subDigitsCache.at < SUB_DIGITS_TTL_MS) return [..._subDigitsCache.value];
  const stores = _providers.getStores ? _providers.getStores() : null;
  const out = new Set(stores ? stores.keys() : []);
  out.delete(MAIN_KEY);
  try {
    if (fs.existsSync(SUBBOTS_DIR)) {
      for (const entry of fs.readdirSync(SUBBOTS_DIR)) {
        const digits = String(entry).replace(/[^0-9]/g, "");
        if (digits) out.add(digits);
      }
    }
  } catch (_) {}
  _subDigitsCache = { at: now, value: [...out] };
  return [...out];
}

export function isPrimaryOwnerJid(jid) {
  const normalized = resolvePhoneJid(jid);
  if (!normalized || !normalized.endsWith("@s.whatsapp.net")) return false;
  const mainStore = _providers.getMainStore ? _providers.getMainStore() : null;
  const primary = normalizeJid(mainStore?.data?.settings?.ownerNumber || settings.ownerNumber);
  if (primary && normalized === primary) return true;
  const pn = phoneDigitsOfPhoneJid(normalized);
  if (pn && pn.length >= 8) {
    if (primary && phoneDigitsOfPhoneJid(primary) === pn) return true;
    const pairing = normalizeJid(mainStore?.data?.settings?.pairingNumber || settings.pairingNumber);
    if (
      pairing &&
      pairing.endsWith("@s.whatsapp.net") &&
      (pairing === normalized || phoneDigitsOfPhoneJid(pairing) === pn)
    )
      return true;
  }
  return false;
}

export function isAnyBotJid(jid) {
  const normalized = normalizeJid(jid);
  if (!normalized) return false;
  if (activeBotJids.has(normalized)) return true;

  const phone = phoneDigitsOfPhoneJid(normalized);
  const phoneMatch = (a, b) => samePhoneJidStrict(a, b);
  for (const b of activeBotJids) {
    if (b === normalized || (phone && phoneMatch(b, normalized))) return true;
  }

  if (phone) {
    for (const digits of getKnownSubDigits()) {
      if (digits === phone) return true;
    }
  }

  try {
    const mainStore = _providers.getMainStore ? _providers.getMainStore() : null;
    const keys = mainStore?.data?.botSettings ? Object.keys(mainStore.data.botSettings) : [];
    for (const k of keys) {
      const nk = normalizeJid(k);
      if (!nk) continue;
      if (nk === normalized || (phone && phoneMatch(nk, normalized))) return true;
    }
  } catch (_) {}
  return false;
}
