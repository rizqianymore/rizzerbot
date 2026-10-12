import { normalizeJid, samePhoneJidStrict } from './utils.js';

export const lidToPnMemory = new Map();
export const LID_MAP_MAX = 5000;
let _lidMapSaveTimer = null;
let _getMainStore = null;

export function bindLidStoreProvider(fn) {
  _getMainStore = typeof fn === 'function' ? fn : null;
}

export function lidKeyOf(jid) {
  const s = String(jid || '');
  const at = s.indexOf('@');
  const local = (at >= 0 ? s.slice(0, at) : s).split(':')[0].replace(/\D/g, '');
  return local;
}

export function persistLidMapSoon() {
  try {
    const mainStore = _getMainStore ? _getMainStore() : null;
    if (!mainStore?.data) return;
    if (_lidMapSaveTimer) return;
    _lidMapSaveTimer = setTimeout(() => {
      _lidMapSaveTimer = null;
      try {
        flushLidMap(false);
        mainStore.saveSoon(1500);
      } catch (_) { }
    }, 2000);
    if (_lidMapSaveTimer.unref) _lidMapSaveTimer.unref();
  } catch (_) { }
}

export function flushLidMap(cancelTimer = true) {
  try {
    if (cancelTimer && _lidMapSaveTimer) {
      clearTimeout(_lidMapSaveTimer);
      _lidMapSaveTimer = null;
    }
    const mainStore = _getMainStore ? _getMainStore() : null;
    if (!mainStore?.data) return;
    mainStore.data.lidMap = Object.fromEntries(lidToPnMemory);
  } catch (_) { }
}

export function rememberLidPnMapping(lidJid, pnJid) {
  const pn = normalizeJid(pnJid);
  if (!pn || !pn.endsWith('@s.whatsapp.net')) return false;
  if (!String(lidJid || '').split('@')[0] || !String(lidJid).endsWith('@lid')) return false;
  const key = lidKeyOf(lidJid);
  if (!key) return false;
  if (lidToPnMemory.get(key) === pn) return false;
  lidToPnMemory.set(key, pn);
  if (lidToPnMemory.size > LID_MAP_MAX) {
    const first = lidToPnMemory.keys().next().value;
    lidToPnMemory.delete(first);
  }
  persistLidMapSoon();
  return true;
}

export function resolvePhoneJid(jid) {
  const n = normalizeJid(jid);
  if (!n) return '';
  if (n.endsWith('@s.whatsapp.net')) return n;
  if (n.endsWith('@lid')) {
    const mapped = lidToPnMemory.get(lidKeyOf(n));
    if (mapped) return mapped;
  }
  return n;
}

export function pickPhoneJid(...candidates) {
  const flat = candidates.flat(Infinity).filter(Boolean);
  for (const c of flat) {
    const n = normalizeJid(c);
    if (n && n.endsWith('@s.whatsapp.net')) return n;
  }
  for (const c of flat) {
    const r = resolvePhoneJid(c);
    if (r && r.endsWith('@s.whatsapp.net')) return r;
  }
  return '';
}

export function sameUser(a, b) {
  const na = resolvePhoneJid(a);
  const nb = resolvePhoneJid(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.endsWith('@s.whatsapp.net') && nb.endsWith('@s.whatsapp.net')) {
    return samePhoneJidStrict(na, nb);
  }
  return false;
}

export function learnGroupLidMap(meta) {
  try {
    const parts = meta?.participants || [];
    let learned = false;
    for (const p of parts) {
      if (!p || typeof p !== 'object') continue;
      const phone = normalizeJid(p.phoneNumber || '');
      if (!phone.endsWith('@s.whatsapp.net')) continue;
      for (const cand of [p.id, p.lid]) {
        if (cand && String(cand).endsWith('@lid')) {
          if (rememberLidPnMapping(cand, phone)) learned = true;
        }
      }
    }
    return learned;
  } catch (_) {
    return false;
  }
}
