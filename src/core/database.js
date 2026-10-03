import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { settings } from '@/config/settings.js';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)])
    );
  }
  return value;
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return digits;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return Boolean(fallback);
}

function normalizeJid(value) {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (raw.startsWith('@') && !raw.slice(1).includes('@')) {
    const numeric = normalizePhone(raw.slice(1));
    return numeric ? `${numeric}@s.whatsapp.net` : '';
  }

  const atIndex = raw.indexOf('@');
  if (atIndex >= 0) {
    const local = raw.slice(0, atIndex).split(':')[0];
    const domain = raw.slice(atIndex + 1).toLowerCase();
    if (domain === 'g.us' || domain === 'broadcast' || domain === 'newsletter') {
      return `${local}@${domain}`;
    }
    if (domain === 'lid') return `${local}@lid`;
    const numeric = normalizePhone(local);
    return `${numeric || local}@s.whatsapp.net`;
  }

  const numeric = normalizePhone(raw);
  return numeric ? `${numeric}@s.whatsapp.net` : '';
}

function toJidList(values) {
  const list = Array.isArray(values) ? values : [values];
  return list
    .flatMap((value) => String(value || '').split(/[,;]/))
    .map((value) => value.trim())
    .map((value) => normalizeJid(value))
    .filter(Boolean);
}

function getConfiguredJids(values) {
  return new Set(toJidList(values));
}

function getRole(user) {
  if (user.owner) return 'owner';
  if (user.admin) return 'admin';
  if (user.premium) return 'premium';
  return 'user';
}

function isPremiumExpired(user) {
  return Boolean(
    user.premiumUntil &&
    Number.isFinite(Number(user.premiumUntil)) &&
    Number(user.premiumUntil) <= Date.now()
  );
}

// ── Audit permanen untuk setiap perubahan hak (jawab "kok tiba-tiba jadi owner?") ──
// Ditulis ke database/privilege-audit.json (max 500 entri, append-only).
function auditPrivilege(storeKey, action, targetJid, enabled, extra = {}) {
  try {
    const auditPath = path.join(process.cwd(), 'database', 'privilege-audit.json');
    let entries = [];
    if (fs.existsSync(auditPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
        if (Array.isArray(parsed)) entries = parsed;
      } catch (_) { /* file korup -> mulai baru */ }
    }
    entries.push({
      at: new Date().toISOString(),
      store: storeKey || 'main',
      action,
      target: targetJid || '',
      enabled: Boolean(enabled),
      ...extra,
    });
    if (entries.length > 500) entries = entries.slice(entries.length - 500);
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    fs.writeFileSync(auditPath, JSON.stringify(entries, null, 2), 'utf8');
  } catch (_) { /* audit tidak boleh menggagalkan perintah */ }
}

// PENTING: JID @lid (privacy-preserving ID) dan nomor telepon @s.whatsapp.net
// adalah NAMESPACE BERBEDA. Digit LID bukan nomor telepon, jadi dilarang
// membandingkan digit keduanya (false match = eskalasi owner ke orang salah).
// Semua perbandingan nomor telepon WAJIB memakai helper strict di bawah.
function phoneDigitsOfPhoneJid(jid) {
  if (!jid || !String(jid).endsWith('@s.whatsapp.net')) return '';
  return normalizePhone(jid);
}

function samePhoneJidStrict(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (!String(a).endsWith('@s.whatsapp.net') || !String(b).endsWith('@s.whatsapp.net')) return false;
  const da = normalizePhone(a);
  const dbb = normalizePhone(b);
  return Boolean(da && dbb && da === dbb);
}

// ── Peta LID → nomor HP: database SELALU nomor HP, bukan LID ──
// WhatsApp kini mengirim participant grup sebagai @lid (privacy ID) dan
// menyertakan pasangan nomor HP di participantAlt / remoteJidAlt pesan serta
// groupMetadata (participant.phoneNumber). Setiap pasangan yang terlihat
// disimpan di sini (persisted di main DB, max 5000) sehingga seluruh akses
// database — sender, quoted, mention, admin grup — memakai nomor HP.
// Tanpa peta ini, satu orang bisa punya 2 identitas (LID + HP) dan lolos cek.
const lidToPnMemory = new Map(); // digit LID -> '62xxx@s.whatsapp.net'
const LID_MAP_MAX = 5000;
let _lidMapSaveTimer = null;

function lidKeyOf(jid) {
  const s = String(jid || '');
  const at = s.indexOf('@');
  const local = (at >= 0 ? s.slice(0, at) : s).split(':')[0].replace(/\D/g, '');
  return local;
}

function persistLidMapSoon() {
  try {
    if (typeof mainStore === 'undefined' || !mainStore?.data) return;
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

// Tulis peta LID→HP dari memori ke main DB SEKARANG (dipakai saat flush/exit
// agar pemetaan yang baru dipelajari tidak hilang bila timer belum jalan).
export function flushLidMap(cancelTimer = true) {
  try {
    if (cancelTimer && _lidMapSaveTimer) {
      clearTimeout(_lidMapSaveTimer);
      _lidMapSaveTimer = null;
    }
    if (typeof mainStore === 'undefined' || !mainStore?.data) return;
    mainStore.data.lidMap = Object.fromEntries(lidToPnMemory);
  } catch (_) { }
}

function rememberLidPnMapping(lidJid, pnJid) {
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

// Kembalikan nomor HP untuk JID apa pun: HP tetap, LID dipetakan bila dikenal,
// LID tak dikenal dikembalikan apa adanya (pemanggil yang memutuskan).
function resolvePhoneJid(jid) {
  const n = normalizeJid(jid);
  if (!n) return '';
  if (n.endsWith('@s.whatsapp.net')) return n;
  if (n.endsWith('@lid')) {
    const mapped = lidToPnMemory.get(lidKeyOf(n));
    if (mapped) return mapped;
  }
  return n;
}

// Ambil kandidat nomor HP pertama dari banyak sumber (participantAlt,
// remoteJidAlt, participant, phoneNumber, dsb) — termasuk via peta LID.
function pickPhoneJid(...candidates) {
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

// Samakan dua identitas user dengan sadar-peta: LID terpetakan dianggap sama
// dengan nomor HP-nya. LID tak dikenal TIDAK PERNAH sama dengan nomor HP.
function sameUser(a, b) {
  const na = resolvePhoneJid(a);
  const nb = resolvePhoneJid(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.endsWith('@s.whatsapp.net') && nb.endsWith('@s.whatsapp.net')) {
    return samePhoneJidStrict(na, nb);
  }
  return false;
}

// Pelajari pasangan LID↔HP dari metadata grup (participant.phoneNumber / .lid).
function learnGroupLidMap(meta) {
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

const configDefaults = cloneValue(settings);
const configuredOwnerValues = [
  settings.ownerNumber,
  settings.pairingNumber,
  settings.ownerNumbers,
];
const configuredAdminValues = [settings.adminNumbers, settings.admins];
const configuredPremiumValues = [settings.premiumNumbers, settings.premiumUsers];
const schemaVersion = 2;

const MAIN_KEY = '';
const SUBBOTS_DIR = path.join(process.cwd(), 'database', 'subbots');
let activeBotJids = new Set();
let mainBotJidMemory = '';

export function setMainBotJid(jid) {
  const n = normalizeJid(jid);
  if (n) mainBotJidMemory = n;
}
export function getMainBotJid() {
  if (mainBotJidMemory) return mainBotJidMemory;
  try {
    return normalizeJid(mainStore.data?.settings?.ownerNumber || settings.ownerNumber);
  } catch (_) {
    return '';
  }
}
function isMainBotJid(jid) {
  const n = normalizeJid(jid);
  if (!n) return false;
  if (mainBotJidMemory && n === mainBotJidMemory) return true;
  try {
    const s = mainStore.data?.settings || {};
    const o = normalizeJid(s.ownerNumber || settings.ownerNumber);
    const p = normalizeJid(s.pairingNumber || settings.pairingNumber);
    if ((o && n === o) || (p && n === p)) return true;
    const pn = normalizePhone(n);
    if (pn && ((o && normalizePhone(o) === pn) || (p && normalizePhone(p) === pn))) return true;
  } catch (_) { }
  return false;
}

function registerBotJid(jid) {
  const normalized = normalizeJid(jid);
  if (!normalized) return;
  activeBotJids.add(normalized);
}

// ── Store: satu database mandiri (main atau satu sub-bot) ────
function normalizeSettings(storedSettings = {}) {
  const result = { ...cloneValue(configDefaults), ...cloneValue(storedSettings) };

  const roleAliases = {
    ownerNumbers: [],
    adminNumbers: ['admins'],
    premiumNumbers: ['premiumUsers'],
  };
  for (const key of Object.keys(roleAliases)) {
    const rawVal = storedSettings[key] ?? roleAliases[key].find(k => storedSettings[k] !== undefined);
    const sourceVal = rawVal !== undefined ? rawVal : configDefaults[key];
    // Hanya nomor telepon asli (@s.whatsapp.net) yang boleh jadi daftar peran.
    // ID sementara (@lid), grup, dan channel otomatis dibuang saat save.
    result[key] = [...new Set(toJidList(sourceVal))].filter((j) => j.endsWith('@s.whatsapp.net'));
  }

  for (const key of ['public', 'maintenance', 'usePairingCode', 'autoRead', 'autoOnline', 'autoForwardTrxToChannel', 'antiBotLuar', 'antiVirtex', 'antiBurst', 'antilinkExtra', 'silentDeny']) {
    result[key] = toBoolean(result[key], configDefaults[key]);
  };
  // Daftar command publik: hanya nama command valid (huruf kecil), selain itu dibuang.
  if (!Array.isArray(result.publicCommands)) {
    result.publicCommands = [...(configDefaults.publicCommands || [])];
  } else {
    result.publicCommands = [...new Set(
      result.publicCommands.map((c) => String(c || '').trim().toLowerCase()).filter(Boolean)
    )];
  }
  if (!Array.isArray(result.botNumbers)) {
    result.botNumbers = toJidList(result.botNumbers ?? configDefaults.botNumbers ?? []);
  } else {
    result.botNumbers = [...new Set(toJidList(result.botNumbers))];
  }
  const maxLen = Number(result.maxMessageLength);
  result.maxMessageLength = Number.isFinite(maxLen) && maxLen > 0
    ? Math.min(maxLen, 20000)
    : Number(configDefaults.maxMessageLength ?? 5000);
  if (
    typeof result.prefix !== 'string' ||
    !result.prefix.trim() ||
    result.prefix.trim().length > 3 ||
    /\s/.test(result.prefix)
  ) {
    result.prefix = configDefaults.prefix || '.';
  } else {
    result.prefix = result.prefix.trim();
  }

  const cooldownTime = Number(result.cooldownTime);
  const responseDelay = Number(result.responseDelay);
  result.cooldownTime = Number.isFinite(cooldownTime) && cooldownTime >= 0
    ? cooldownTime
    : Number(configDefaults.cooldownTime ?? 0);
  result.responseDelay = Number.isFinite(responseDelay) && responseDelay >= 0
    ? responseDelay
    : Number(configDefaults.responseDelay ?? 0);

  return result;
}

function loadStoreFiles(dbPath, usersDbPath) {
  let stored = {};
  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf8');
      stored = raw ? JSON.parse(raw) : {};
    } catch (error) {
      const backupPath = `${dbPath}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(dbPath, backupPath);
      } catch (_) { }
      stored = {};
    }
  }

  let storedUsers = {};
  if (fs.existsSync(usersDbPath)) {
    try {
      const rawUsers = fs.readFileSync(usersDbPath, 'utf8');
      if (rawUsers && rawUsers.trim()) {
        const parsedUsers = JSON.parse(rawUsers);
        if (isRecord(parsedUsers)) {
          storedUsers = parsedUsers;
        }
      }
    } catch (error) {
      const backupUsersPath = `${usersDbPath}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(usersDbPath, backupUsersPath);
      } catch (_) { }
      storedUsers = {};
    }
  }

  return { stored: isRecord(stored) ? stored : {}, storedUsers };
}

class Store {
  constructor(key, isMain, dbPath, usersDbPath) {
    this.key = key;
    this.isMain = isMain;
    this.dbPath = dbPath;
    this.usersDbPath = usersDbPath;
    this.ownerJids = new Set();
    this.adminJids = new Set();
    this.premiumJids = new Set();
    this.data = null;

    const { stored, storedUsers } = loadStoreFiles(dbPath, usersDbPath);
    const source = stored;
    const baseUsers = isRecord(source.users) ? source.users : {};
    const users = { ...baseUsers, ...storedUsers };
    const normalizedUsers = {};
    let changed = !isRecord(source.users);

    for (const [jid, user] of Object.entries(users)) {
      const normalized = normalizeJid(jid);
      if (!normalized || !isRecord(user)) {
        changed = true;
        continue;
      }
      normalizedUsers[normalized] = this.normalizeUser(normalized, user);
      if (JSON.stringify(normalizedUsers[normalized]) !== JSON.stringify(user)) changed = true;
    }

    this.data = {
      ...source,
      schemaVersion,
      users: normalizedUsers,
      settings: normalizeSettings(isRecord(source.settings) ? source.settings : {}),
      botSettings: isRecord(source.botSettings) ? source.botSettings : {},
      usage: isRecord(source.usage) ? source.usage : {},
      nsfw: isRecord(source.nsfw) ? source.nsfw : {},
      lidMap: isRecord(source.lidMap) ? source.lidMap : {},
    };

    if (this.data.schemaVersion !== schemaVersion) changed = true;
    if (JSON.stringify(this.data.settings) !== JSON.stringify(source.settings || {})) changed = true;
    if (!isRecord(source.botSettings)) changed = true;
    if (!isRecord(source.usage)) changed = true;
    if (!isRecord(source.nsfw)) changed = true;
    if (!isRecord(source.lidMap)) changed = true;
    if (source.schemaVersion !== schemaVersion) changed = true;

    // Muat peta LID→HP global (satu kebenaran untuk semua store) dari main DB.
    if (this.isMain && isRecord(source.lidMap)) {
      for (const [lidKey, pn] of Object.entries(source.lidMap)) {
        const cleanKey = String(lidKey || '').replace(/\D/g, '');
        const cleanPn = normalizeJid(pn);
        if (cleanKey && cleanPn.endsWith('@s.whatsapp.net') && !lidToPnMemory.has(cleanKey)) {
          lidToPnMemory.set(cleanKey, cleanPn);
        }
      }
    }

    // Sapu database dari entri @lid: database HANYA untuk nomor HP.
    // - @lid yang sudah terpetakan → digabung ke entri nomor HP-nya.
    // - @lid sampah (tanpa hak & tak terdaftar) → dibuang.
    // - @lid berhak tapi tak terpetakan (warisan) → dipertahankan + peringatan.
    for (const [jid, user] of Object.entries(this.data.users)) {
      if (!jid.endsWith('@lid')) continue;
      const mapped = lidToPnMemory.get(lidKeyOf(jid));
      const privileged = Boolean(user && (user.owner || user.admin || user.premium || user.registered));
      if (mapped) {
        if (!this.data.users[mapped]) {
          this.data.users[mapped] = this.normalizeUser(mapped, { ...user, owner: false, admin: false, premium: false, registered: false });
        } else if (!this.data.users[mapped].name && user.name) {
          this.data.users[mapped].name = String(user.name).slice(0, 100);
        }
        delete this.data.users[jid];
        changed = true;
      } else if (!privileged) {
        delete this.data.users[jid];
        changed = true;
      } else {
        try {
          console.warn(`[DB] Entri @lid berhak tak terpetakan dipertahankan: ${jid} (pindahkan manual ke nomor HP)`);
        } catch (_) { }
      }
    }

    this.refreshConfiguredJids();
    const accessChanged = this.syncPrivilegedUsers();
    if (changed || accessChanged || !fs.existsSync(usersDbPath)) this.save();
  }

  saveSoon(ms = 1500) {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      try {
        this.save();
      } catch (_) { }
    }, ms);
    if (this._saveTimer.unref) this._saveTimer.unref();
  }

  flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this.save();
  }

  save() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    const dbDirectory = path.dirname(this.dbPath);
    fs.mkdirSync(dbDirectory, { recursive: true });
    fs.mkdirSync(path.dirname(this.usersDbPath), { recursive: true });

    const usersSerialized = JSON.stringify(this.data.users || {}, null, 2);
    const tempUsersPath = `${this.usersDbPath}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tempUsersPath, usersSerialized, 'utf8');
      fs.renameSync(tempUsersPath, this.usersDbPath);
    } catch (_) {
      fs.writeFileSync(this.usersDbPath, usersSerialized, 'utf8');
      try {
        fs.rmSync(tempUsersPath, { force: true });
      } catch (_) { }
    }

    const serialized = JSON.stringify(this.data, null, 2);
    const temporaryPath = `${this.dbPath}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, serialized, 'utf8');
      fs.renameSync(temporaryPath, this.dbPath);
    } catch (_) {
      fs.writeFileSync(this.dbPath, serialized, 'utf8');
      try {
        fs.rmSync(temporaryPath, { force: true });
      } catch (_) { }
    }
  }

  refreshConfiguredJids() {
    const s = this.data.settings;
    // Main mewarisi config file (perilaku lama dipertahankan persis).
    // Sub hanya memakai setting database MILIKNYA (isolasi penuh).
    this.ownerJids = getConfiguredJids(
      this.isMain
        ? [...configuredOwnerValues, s.ownerNumber, s.pairingNumber, s.ownerNumbers]
        : [s.ownerNumber, s.ownerNumbers]
    );
    this.adminJids = getConfiguredJids(
      this.isMain
        ? [...configuredAdminValues, s.adminNumbers, s.admins]
        : [s.adminNumbers, s.admins]
    );
    this.premiumJids = getConfiguredJids(
      this.isMain
        ? [...configuredPremiumValues, s.premiumNumbers, s.premiumUsers]
        : [s.premiumNumbers, s.premiumUsers]
    );
  }

  getOwnerName() {
    return this.data?.settings?.ownerName || settings.ownerName || 'Owner';
  }

  normalizeUser(jid, user = {}) {
    const isConfiguredOwner = this.ownerJids.has(jid);
    const isConfiguredAdmin = this.adminJids.has(jid);
    const isConfiguredPremium = this.premiumJids.has(jid);

    const owner = isConfiguredOwner || toBoolean(user.owner);
    const admin = owner || isConfiguredAdmin || toBoolean(user.admin);
    const expired = isPremiumExpired(user);
    const premium = owner || admin || isConfiguredPremium || (toBoolean(user.premium) && !expired);
    const registered = owner || admin || premium || toBoolean(user.registered);
    const createdAt = Number.isFinite(Number(user.createdAt)) && Number(user.createdAt) > 0
      ? Number(user.createdAt)
      : Date.now();

    return {
      ...user,
      name: typeof user.name === 'string' && user.name.trim()
        ? user.name
        : owner ? this.getOwnerName() : '',
      registered,
      owner,
      admin,
      premium,
      banned: owner ? false : toBoolean(user.banned),
      profile: typeof user.profile === 'string' ? user.profile : '',
      premiumUntil: Number.isFinite(Number(user.premiumUntil)) && Number(user.premiumUntil) > 0
        ? Number(user.premiumUntil)
        : null,
      createdAt,
      lastSeen: Number.isFinite(Number(user.lastSeen)) ? Number(user.lastSeen) : createdAt,
      role: getRole({ owner, admin, premium }),
    };
  }

  createUser(jid) {
    return this.normalizeUser(jid, {
      name: this.ownerJids.has(jid) ? this.getOwnerName() : '',
      registered: this.ownerJids.has(jid) || this.adminJids.has(jid) || this.premiumJids.has(jid),
      owner: this.ownerJids.has(jid),
      admin: this.ownerJids.has(jid) || this.adminJids.has(jid),
      premium: this.ownerJids.has(jid) || this.adminJids.has(jid) || this.premiumJids.has(jid),
      banned: false,
      profile: '',
      premiumUntil: null,
      createdAt: Date.now(),
    });
  }

  ensureUser(normalizedInput) {
    // Selalu kerja dalam nomor HP: LID terpetakan → HP-nya.
    const normalized = resolvePhoneJid(normalizedInput);
    if (!normalized) return null;
    // LID tak terpetakan: jangan buat baris DB — kembalikan sementara.
    if (normalized.endsWith('@lid') && !this.data.users[normalized]) {
      return this.normalizeUser(normalized, {});
    }
    if (!this.data.users[normalized]) {
      this.data.users[normalized] = this.createUser(normalized);
      this.save();
      return this.data.users[normalized];
    }
    this.applyConfiguredAccess(normalized, this.data.users[normalized]);
    return this.data.users[normalized];
  }

  applyConfiguredAccess(jid, user, persist = true) {
    const before = JSON.stringify(user);
    const next = this.normalizeUser(jid, user);
    const changed = before !== JSON.stringify(next);
    if (changed) this.data.users[jid] = next;
    if (changed && persist) this.save();
    return changed;
  }

  syncPrivilegedUsers() {
    let changed = false;
    const privilegedJids = new Set([...this.ownerJids, ...this.adminJids, ...this.premiumJids]);

    for (const jid of privilegedJids) {
      if (!this.data.users[jid]) {
        this.data.users[jid] = this.createUser(jid);
        changed = true;
        continue;
      }
      if (this.applyConfiguredAccess(jid, this.data.users[jid], false)) changed = true;
    }

    for (const [jid, user] of Object.entries(this.data.users)) {
      const next = this.normalizeUser(jid, user);
      if (JSON.stringify(next) !== JSON.stringify(user)) {
        this.data.users[jid] = next;
        changed = true;
      }
    }

    return changed;
  }

  getSettings() {
    return this.data.settings;
  }

  updateSettings(updates = {}) {
    const allowedKeys = new Set([...Object.keys(configDefaults), 'admins', 'premiumUsers']);
    const next = { ...this.data.settings };
    for (const [key, value] of Object.entries(updates)) {
      if (allowedKeys.has(key)) next[key] = cloneValue(value);
    }
    this.data.settings = normalizeSettings(next);
    this.refreshConfiguredJids();
    this.syncPrivilegedUsers();
    this.save();
    return this.data.settings;
  }

  isOwner(jid) {
    // LID terpetakan otomatis jadi nomor HP di sini (owner kirim via LID tetap dikenali).
    const normalized = resolvePhoneJid(jid);
    if (!normalized) return false;
    if (
      isPrimaryOwnerJid(normalized) ||
      this.ownerJids.has(normalized) ||
      this.data.users[normalized]?.owner
    ) {
      return true;
    }

    // Fallback varian format nomor (08xx vs 628xx) — HANYA untuk JID telepon.
    // @lid tidak punya nomor telepon, jadi tidak ada fallback untuknya.
    if (!normalized.endsWith('@s.whatsapp.net')) return false;
    const digits = phoneDigitsOfPhoneJid(normalized);
    if (digits && digits.length >= 8) {
      const phoneJid = `${digits}@s.whatsapp.net`;
      if (
        isPrimaryOwnerJid(phoneJid) ||
        this.ownerJids.has(phoneJid) ||
        this.data.users[phoneJid]?.owner
      ) {
        return true;
      }
    }

    return false;
  }

  isAdmin(jid) {
    const normalized = resolvePhoneJid(jid);
    if (!normalized) return false;
    return Boolean(normalized && (this.isOwner(normalized) || this.adminJids.has(normalized) || this.data.users[normalized]?.admin));
  }

  isPremium(jid) {
    const normalized = resolvePhoneJid(jid);
    if (!normalized) return false;
    if (this.isOwner(normalized) || this.isAdmin(normalized) || this.premiumJids.has(normalized)) return true;

    // Fallback varian format nomor — HANYA untuk JID telepon (@lid tidak difallback).
    if (!normalized.endsWith('@s.whatsapp.net')) {
      const user = this.data.users[normalized];
      return Boolean(user?.premium && !isPremiumExpired(user));
    }
    const digits = phoneDigitsOfPhoneJid(normalized);
    if (digits && digits.length >= 8) {
      const phoneJid = `${digits}@s.whatsapp.net`;
      if (this.isOwner(phoneJid) || this.isAdmin(phoneJid) || this.premiumJids.has(phoneJid)) return true;
      const phoneUser = this.data.users[phoneJid];
      if (phoneUser?.premium && !isPremiumExpired(phoneUser)) return true;
    }

    const user = this.data.users[normalized];
    return Boolean(user?.premium && !isPremiumExpired(user));
  }

  getAccess(jid) {
    const normalized = resolvePhoneJid(jid);
    let user = this.data.users[normalized] || null;
    if (user) {
      this.applyConfiguredAccess(normalized, user);
      user = this.data.users[normalized];
    }
    const owner = this.isOwner(normalized);
    const admin = this.isAdmin(normalized);
    const premium = this.isPremium(normalized);
    return {
      jid: normalized,
      user,
      owner,
      admin,
      premium,
      role: owner ? 'owner' : admin ? 'admin' : premium ? 'premium' : 'user',
      banned: Boolean(user?.banned) && !owner,
    };
  }

  hasAccess(jid, requiredAccess) {
    if (requiredAccess === undefined || requiredAccess === null || requiredAccess === '') {
      return true;
    }
    const requirements = (Array.isArray(requiredAccess) ? requiredAccess : [requiredAccess])
      .filter((requirement) => requirement !== undefined && requirement !== null && requirement !== '');
    if (requirements.length === 0) return true;
    const access = this.getAccess(jid);
    const normalizedRequirements = requirements.map((requirement) => String(requirement || '').toLowerCase());
    if (access.banned && !normalizedRequirements.includes('banned')) return false;
    return requirements.every((requirement) => {
      switch (String(requirement || '').toLowerCase()) {
        case 'owner':
          return access.owner;
        case 'admin':
          return access.admin;
        case 'premium':
          return access.premium;
        case 'banned':
          return access.banned;
        case 'user':
          return Boolean(access.user || access.owner || access.admin || access.premium) && !access.banned;
        default:
          return false;
      }
    });
  }

  // Jalur umum (plugin biasa, sync nama, dsb) HANYA boleh mengubah field
  // non-hak. Perubahan owner/admin/premium/banned/premiumUntil WAJIB lewat
  // setOwner/setAdmin/setPremium/setBanned (opts.privileged=true) agar tidak ada
  // plugin yang tidak sengaja / disusupi bisa eskalasi hak via updateUser.
  // Ini menutup vektor "tiba-tiba jadi owner/premium sendiri".
  updateUser(jid, updates = {}, opts = {}) {
    // LID terpetakan otomatis jadi nomor HP — baris DB selalu nomor HP.
    const normalized = resolvePhoneJid(jid);
    if (!normalized) return null;
    if (!normalized.endsWith('@s.whatsapp.net') && !normalized.endsWith('@lid')) return null;
    // LID yang belum terpetakan: JANGAN buat baris DB baru (DB khusus nomor HP).
    // Kembalikan objek sementara agar alur baca (nama, profil) tetap jalan.
    // Hanya field aman yang disalin — field hak TIDAK PERNAH dari input.
    if (normalized.endsWith('@lid') && !this.data.users[normalized]) {
      return this.normalizeUser(normalized, {
        name: updates.name,
        profile: updates.profile,
      });
    }
    if (!this.data.users[normalized]) {
      this.data.users[normalized] = this.createUser(normalized);
    }
    const current = this.data.users[normalized];
    const privileged = Boolean(opts && opts.privileged === true);

    const next = { ...current };
    // Field aman untuk jalur umum (dibatasi panjang agar tidak spam DB).
    if (updates.name !== undefined) {
      next.name = String(updates.name ?? '').slice(0, 100);
    }
    if (updates.profile !== undefined) {
      next.profile = String(updates.profile ?? '').slice(0, 500);
    }
    if (updates.registered !== undefined) {
      next.registered = toBoolean(updates.registered) || Boolean(current.owner || current.admin || current.premium);
    }
    if (updates.createdAt !== undefined && Number.isFinite(Number(updates.createdAt)) && Number(updates.createdAt) > 0) {
      next.createdAt = Number(updates.createdAt);
    }
    if (updates.lastSeen !== undefined && Number.isFinite(Number(updates.lastSeen))) {
      next.lastSeen = Number(updates.lastSeen);
    }
    // Salin field statistik non-hak lain yang sudah ada (energy/exp/level/dll)
    // hanya bila pemanggil menyebutkannya eksplisit — selain daftar di bawah
    // dan selain field hak, agar perilaku plugin lama tidak rusak.
    const EXTRA_SAFE = new Set(['energy', 'energyLastRefill', 'exp', 'level', 'crystals', 'spinsWon']);
    for (const key of EXTRA_SAFE) {
      if (updates[key] !== undefined) next[key] = updates[key];
    }

    if (privileged) {
      const isPrimary = isPrimaryOwnerJid(normalized);
      const nextOwner = isPrimary ? true : (updates.owner !== undefined ? toBoolean(updates.owner) : toBoolean(current.owner));
      const nextAdmin = nextOwner || (updates.admin !== undefined ? toBoolean(updates.admin) : toBoolean(current.admin));
      const nextPremium = nextOwner || nextAdmin || (updates.premium !== undefined ? toBoolean(updates.premium) : toBoolean(current.premium));
      const nextBanned = nextOwner ? false : (updates.banned !== undefined ? toBoolean(updates.banned) : toBoolean(current.banned));
      next.owner = nextOwner;
      next.admin = nextAdmin;
      next.premium = nextPremium;
      next.banned = nextBanned;
      if (updates.premiumUntil !== undefined) {
        next.premiumUntil = Number.isFinite(Number(updates.premiumUntil)) && Number(updates.premiumUntil) > 0
          ? Number(updates.premiumUntil)
          : null;
      }
      if (updates.banned !== undefined && nextOwner) next.banned = false;
    } else {
      // Jalur umum: pertahankan hak existing; abaikan upaya perubahan hak.
      // premiumUntil dari jalur umum juga diabaikan (hanya setPremium boleh set).
      next.owner = toBoolean(current.owner);
      next.admin = toBoolean(current.admin) || next.owner;
      next.premium = toBoolean(current.premium) || next.owner || next.admin;
      next.banned = next.owner ? false : toBoolean(current.banned);
      next.premiumUntil = current.premiumUntil ?? null;
      if (isPrimaryOwnerJid(normalized)) {
        next.owner = true;
        next.admin = true;
        next.premium = true;
        next.banned = false;
      }
    }

    next.role = getRole(next);

    this.data.users[normalized] = next;
    this.save();
    return next;
  }

  setOwner(jid, enabled) {
    const normalized = normalizeJid(jid);
    if (!normalized) return null;
    // Tolak JID non-telepon (@lid, grup, channel) sebagai owner.
    if (enabled && !normalized.endsWith('@s.whatsapp.net')) return null;
    if (!enabled && isPrimaryOwnerJid(normalized)) {
      return this.data.users[normalized] || null; // Primary owner cannot be removed
    }

    const currentList = Array.isArray(this.data.settings.ownerNumbers) ? this.data.settings.ownerNumbers : [];
    let nextList;
    if (enabled) {
      nextList = [...new Set([...currentList, normalized])];
    } else {
      nextList = currentList.filter((num) => normalizeJid(num) !== normalized);
    }
    this.data.settings.ownerNumbers = nextList;
    this.refreshConfiguredJids();

    const user = this.updateUser(normalized, {
      owner: Boolean(enabled),
      admin: Boolean(enabled),
      premium: Boolean(enabled),
      banned: enabled ? false : undefined,
    }, { privileged: true });
    auditPrivilege(this.isMain ? 'main' : this.key, 'setOwner', normalized, enabled);
    this.syncPrivilegedUsers();
    this.save();
    return user;
  }

  setAdmin(jid, enabled) {
    const normalized = normalizeJid(jid);
    if (!normalized) return null;
    if (enabled && !normalized.endsWith('@s.whatsapp.net')) return null;
    if (this.isOwner(normalized)) return this.data.users[normalized] || null;

    const currentList = Array.isArray(this.data.settings.adminNumbers) ? this.data.settings.adminNumbers : [];
    let nextList;
    if (enabled) {
      nextList = [...new Set([...currentList, normalized])];
    } else {
      nextList = currentList.filter((num) => normalizeJid(num) !== normalized);
    }
    this.data.settings.adminNumbers = nextList;
    this.refreshConfiguredJids();

    const user = this.updateUser(normalized, {
      admin: Boolean(enabled),
      premium: enabled ? true : undefined,
    }, { privileged: true });
    auditPrivilege(this.isMain ? 'main' : this.key, 'setAdmin', normalized, enabled);
    this.syncPrivilegedUsers();
    this.save();
    return user;
  }

  setPremium(jid, enabled, days = null) {
    const normalized = normalizeJid(jid);
    if (!normalized) return null;
    if (enabled && !normalized.endsWith('@s.whatsapp.net')) return null;
    if (this.isOwner(normalized) || this.isAdmin(normalized)) return this.data.users[normalized] || null;

    const duration = Number(days);
    const premiumUntil = enabled && Number.isFinite(duration) && duration > 0
      ? Date.now() + duration * 24 * 60 * 60 * 1000
      : null;

    const currentList = Array.isArray(this.data.settings.premiumNumbers) ? this.data.settings.premiumNumbers : [];
    let nextList;
    if (enabled) {
      nextList = [...new Set([...currentList, normalized])];
    } else {
      nextList = currentList.filter((num) => normalizeJid(num) !== normalized);
    }
    this.data.settings.premiumNumbers = nextList;
    this.refreshConfiguredJids();

    const user = this.updateUser(normalized, {
      premium: Boolean(enabled),
      premiumUntil,
    }, { privileged: true });
    auditPrivilege(this.isMain ? 'main' : this.key, 'setPremium', normalized, enabled, days ? { days: Number(days) } : {});
    this.syncPrivilegedUsers();
    this.save();
    return user;
  }

  setBanned(jid, enabled) {
    const normalized = resolvePhoneJid(jid);
    if (!normalized || this.isOwner(normalized)) return this.data.users[normalized] || null;
    // Ban LID tak terpetakan tidak ada gunanya (identitas tak stabil) — tolak.
    if (normalized.endsWith('@lid') && !this.data.users[normalized]) return null;
    const user = this.updateUser(normalized, { banned: toBoolean(enabled) }, { privileged: true });
    auditPrivilege(this.isMain ? 'main' : this.key, 'setBanned', normalized, enabled);
    return user;
  }

  // Hapus permanen 1 user dari database + cabut dari daftar peran agar tidak
  // lahir kembali via syncPrivilegedUsers. Primary owner TAK BISA dihapus.
  // Dipakai plugin deluser/cleanusers (wajib SuperOwner di level plugin).
  deleteUser(jid) {
    const normalized = resolvePhoneJid(jid);
    if (!normalized || !normalized.endsWith('@s.whatsapp.net')) return false;
    if (isPrimaryOwnerJid(normalized)) return false;
    const had = Boolean(this.data.users[normalized]);
    delete this.data.users[normalized];
    for (const key of ['ownerNumbers', 'adminNumbers', 'premiumNumbers']) {
      const list = this.data.settings?.[key];
      if (Array.isArray(list)) {
        this.data.settings[key] = list.filter((x) => normalizeJid(x) !== normalized);
      }
    }
    this.refreshConfiguredJids();
    auditPrivilege(this.isMain ? 'main' : this.key, 'deleteUser', normalized, false);
    this.save();
    return had;
  }

  getUser(jid) {
    return this.ensureUser(resolvePhoneJid(jid));
  }

  isBanned(jid) {
    return this.getAccess(jid).banned;
  }

  isConfiguredAdmin(jid) {
    return this.adminJids.has(normalizeJid(jid));
  }

  isConfiguredPremium(jid) {
    return this.premiumJids.has(normalizeJid(jid));
  }

  getAllPremiumUsers() {
    const list = [];
    const seen = new Set();
    for (const [jid, user] of Object.entries(this.data.users || {})) {
      if (this.isOwner(jid) || this.isAdmin(jid)) continue;
      if (user.premium && !isPremiumExpired(user)) {
        seen.add(jid);
        list.push({
          jid,
          premiumUntil: user.premiumUntil,
          isPermanent: !user.premiumUntil,
        });
      }
    }
    const configured = Array.isArray(this.data.settings?.premiumNumbers) ? this.data.settings.premiumNumbers : [];
    for (const item of configured) {
      const normalized = normalizeJid(item);
      if (normalized && !seen.has(normalized) && !this.isOwner(normalized) && !this.isAdmin(normalized)) {
        seen.add(normalized);
        const u = this.data.users?.[normalized];
        list.push({
          jid: normalized,
          premiumUntil: u?.premiumUntil || null,
          isPermanent: !u?.premiumUntil,
        });
      }
    }
    return list;
  }

  recordCommand(command) {
    this.data.usage[command] = (Number(this.data.usage[command]) || 0) + 1;
    this.saveSoon(2000);
  }

  isAntilink(groupId) {
    return toBoolean(this.data.antilink?.[groupId]);
  }

  setAntilink(groupId, enabled) {
    if (!this.data.antilink) this.data.antilink = {};
    this.data.antilink[groupId] = toBoolean(enabled);
    this.save();
  }

  isExternalBotJid(jid) {
    const normalized = normalizeJid(jid);
    if (!normalized) return false;
    if (isAnyBotJid(normalized)) return true;
    const list = Array.isArray(this.data?.settings?.botNumbers) ? this.data.settings.botNumbers : [];
    const phone = phoneDigitsOfPhoneJid(normalized);
    for (const b of list) {
      const nb = normalizeJid(b);
      if (!nb) continue;
      if (nb === normalized) return true;
      if (phone && samePhoneJidStrict(nb, normalized)) return true;
    }
    return false;
  }
}

// ── Registri store + konteks async ────────────────────────────
const botAls = new AsyncLocalStorage();
const stores = new Map();

function mainPaths() {
  const dbPath = path.join(process.cwd(), 'database', 'database.json');
  const usersDbPath = path.join(process.cwd(), 'database', 'users.json');
  return { dbPath, usersDbPath };
}

function subPaths(digits) {
  const dir = path.join(SUBBOTS_DIR, digits);
  return {
    dbPath: path.join(dir, 'database.json'),
    usersDbPath: path.join(dir, 'users.json'),
  };
}

const { dbPath: MAIN_DB_PATH, usersDbPath: MAIN_USERS_PATH } = mainPaths();
const mainStore = new Store(MAIN_KEY, true, MAIN_DB_PATH, MAIN_USERS_PATH);
stores.set(MAIN_KEY, mainStore);

function resolveStoreKey(botJid) {
  const n = normalizeJid(botJid);
  if (!n || isMainBotJid(n)) return MAIN_KEY;
  const digits = phoneDigitsOfPhoneJid(n);
  return digits || MAIN_KEY;
}

function activeStore() {
  const key = botAls.getStore();
  if (key === undefined || key === null) return mainStore;
  const s = stores.get(key);
  if (s) return s;
  // Store sub dihapus di tengah jalan? Muat ulang bila folder masih ada.
  if (key !== MAIN_KEY) {
    const peeked = peekSubStoreByKey(key);
    if (peeked) return peeked;
  }
  return mainStore;
}

function peekSubStoreByKey(digits) {
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

function findLegacySubConfig(digits) {
  try {
    const legacy = mainStore.data?.botSettings || {};
    for (const [k, v] of Object.entries(legacy)) {
      if (normalizePhone(k) === digits && isRecord(v)) return v;
    }
  } catch (_) { }
  return null;
}

function ensureSubStore(botJid, seed = {}) {
  const key = resolveStoreKey(botJid);
  if (!key || key === MAIN_KEY) return mainStore;
  const existing = peekSubStoreByKey(key);
  if (existing) {
    // Lengkapi seed yang belum ada TANPA menimpa setting mandiri.
    let touched = false;
    if (seed.botName && !existing.data.settings.botName) {
      existing.data.settings.botName = String(seed.botName);
      touched = true;
    }
    const curOwner = normalizeJid(existing.data.settings.ownerNumber || '');
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
  if (typeof legacy?.prefix === 'string' && legacy.prefix.trim()) initial.prefix = legacy.prefix.trim();

  const s = new Store(key, false, dbPath, usersDbPath);
  s.data.settings = normalizeSettings({ ...s.data.settings, ...initial });
  // Pastikan identitas owner sub selalu valid
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

function getKnownSubDigits() {
  const out = new Set(stores.keys());
  out.delete(MAIN_KEY);
  try {
    if (fs.existsSync(SUBBOTS_DIR)) {
      for (const entry of fs.readdirSync(SUBBOTS_DIR)) {
        const digits = String(entry).replace(/[^0-9]/g, '');
        if (digits) out.add(digits);
      }
    }
  } catch (_) { }
  return [...out];
}

// Primary SuperOwner = HANYA nomor utama (ownerNumber/pairingNumber + varian formatnya).
// Daftar ownerNumbers TIDAK termasuk primary (mereka owner biasa: bisa dihapus,
// tidak punya hak superowner seperti eval/restart/--all).
// Hanya JID telepon (@s.whatsapp.net) yang bisa jadi primary — @lid DITOLAK
// (namespace berbeda, digitnya bukan nomor telepon).
function isPrimaryOwnerJid(jid) {
  // LID terpetakan → nomor HP dulu, jadi owner yang kirim via LID tetap dikenali.
  const normalized = resolvePhoneJid(jid);
  if (!normalized || !normalized.endsWith('@s.whatsapp.net')) return false;
  const primary = normalizeJid(mainStore.data?.settings?.ownerNumber || settings.ownerNumber);
  if (primary && normalized === primary) return true;
  const pn = phoneDigitsOfPhoneJid(normalized);
  if (pn && pn.length >= 8) {
    if (primary && phoneDigitsOfPhoneJid(primary) === pn) return true;
    const pairing = normalizeJid(mainStore.data?.settings?.pairingNumber || settings.pairingNumber);
    if (pairing && pairing.endsWith('@s.whatsapp.net') &&
      (pairing === normalized || phoneDigitsOfPhoneJid(pairing) === pn)) return true;
  }
  return false;
}

function isAnyBotJid(jid) {
  const normalized = normalizeJid(jid);
  if (!normalized) return false;
  if (activeBotJids.has(normalized)) return true;

  // Perbandingan digit hanya sesama nomor telepon. @lid tidak pernah
  // disamakan digitnya dengan nomor bot (namespace berbeda).
  const phone = phoneDigitsOfPhoneJid(normalized);
  const phoneMatch = (a, b) => samePhoneJidStrict(a, b);
  for (const b of activeBotJids) {
    if (b === normalized || (phone && phoneMatch(b, normalized))) return true;
  }
  // Sub-bot yang punya database sendiri tetap dianggap bot walau belum online.
  if (phone) {
    for (const digits of getKnownSubDigits()) {
      if (digits === phone) return true;
    }
  }
  // Kompat lama: sub yang pernah terdaftar di botSettings main.
  try {
    const keys = mainStore.data?.botSettings ? Object.keys(mainStore.data.botSettings) : [];
    for (const k of keys) {
      const nk = normalizeJid(k);
      if (!nk) continue;
      if (nk === normalized || (phone && phoneMatch(nk, normalized))) return true;
    }
  } catch (_) { }
  return false;
}

// ── API lintas-store (dispatcher & plugin pakai ini) ──────────
function getBotSettings(botJid) {
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
  // Fallback untuk JID sub yang belum punya database: mandiri, tidak ikut main.
  const legacy = key ? findLegacySubConfig(key) : null;
  return {
    ...cloneValue(configDefaults),
    public: legacy?.public !== undefined ? toBoolean(legacy.public, configDefaults.public) : toBoolean(configDefaults.public, false),
    prefix: typeof legacy?.prefix === 'string' && legacy.prefix.trim() ? legacy.prefix.trim() : (configDefaults.prefix || '.'),
    botName: legacy?.botName || `SubBot (+${key || normalized})`,
    ownerNumber: (legacy?.ownerNumber && normalizeJid(legacy.ownerNumber)) || normalized,
    ownerNumbers: Array.isArray(legacy?.ownerNumbers) ? legacy.ownerNumbers.map(normalizeJid).filter(Boolean) : [],
  };
}

function updateBotSettings(botJid, updates = {}) {
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
    current.ownerNumbers = updates.ownerNumbers.map(normalizeJid).filter((j) => j && j.endsWith('@s.whatsapp.net'));
  }
  store.data.settings = normalizeSettings(current);
  store.refreshConfiguredJids();
  store.syncPrivilegedUsers();
  store.save();
  return getBotSettings(normalized);
}

function isBotOwner(botJid, userJid) {
  const normalizedBot = normalizeJid(botJid);
  // LID pengirim yang sudah terpetakan langsung jadi nomor HP di sini.
  const normalizedUser = resolvePhoneJid(userJid);
  if (!normalizedUser) return false;

  // samPhone STRICT: hanya sesama @s.whatsapp.net. @lid tidak pernah
  // dianggap sama dengan nomor telepon (cegah impersonasi owner via LID).
  const samePhone = samePhoneJidStrict;

  const botIsMain = !normalizedBot || isMainBotJid(normalizedBot);

  if (botIsMain) {
    // Main-bot: owner = primary superowner + daftar owner global main.
    // Owner khusus sub-bot TIDAK berlaku di main (anti-campur).
    if (isPrimaryOwnerJid(normalizedUser)) return true;
    if (mainStore.isOwner(normalizedUser)) return true;
    // Fallback varian format nomor — hanya untuk JID telepon.
    if (normalizedUser.endsWith('@s.whatsapp.net')) {
      const userPhone = phoneDigitsOfPhoneJid(normalizedUser);
      if (userPhone) {
        const phoneJid = `${userPhone}@s.whatsapp.net`;
        if (isPrimaryOwnerJid(phoneJid) || mainStore.isOwner(phoneJid)) return true;
      }
    }
    if (normalizedBot && samePhone(normalizedUser, normalizedBot)) return true;
    return false;
  }

  // Sub-bot: baca dari database MILIK sub itu (atau fallback mandiri).
  const key = phoneDigitsOfPhoneJid(normalizedBot);
  const store = key ? peekSubStoreByKey(key) : null;
  const botOwner = store ? normalizeJid(store.data.settings.ownerNumber) : '';
  const botOwnersList = store && Array.isArray(store.data.settings.ownerNumbers)
    ? store.data.settings.ownerNumbers.map(normalizeJid)
    : [];
  const fallbackOwner = !store && normalizedBot;

  if (botOwner && samePhone(normalizedUser, botOwner)) return true;
  if (botOwnersList.some((o) => samePhone(normalizedUser, o))) return true;
  if (fallbackOwner && samePhone(normalizedUser, fallbackOwner)) return true;
  if (samePhone(normalizedUser, normalizedBot)) return true;
  if (isPrimaryOwnerJid(normalizedUser)) return true;
  return false;
}

function runWithBot(botJid, fn) {
  return botAls.run(resolveStoreKey(botJid), fn);
}

function mainAccessor() {
  return {
    get data() { return mainStore.data; },
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
    setOwner: (j, e) => mainStore.setOwner(j, e),
    setAdmin: (j, e) => mainStore.setAdmin(j, e),
    setPremium: (j, e, d) => mainStore.setPremium(j, e, d),
    setBanned: (j, e) => mainStore.setBanned(j, e),
    getAllPremiumUsers: () => mainStore.getAllPremiumUsers(),
    recordCommand: (c) => mainStore.recordCommand(c),
    isAntilink: (g) => mainStore.isAntilink(g),
    setAntilink: (g, e) => mainStore.setAntilink(g, e),
  };
}

// ── Facade db (nama & perilaku kompatibel) ────────────────────
export const db = {
  get data() { return activeStore().data; },
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
  try { flushLidMap(true); } catch (_) { }
  for (const store of stores.values()) {
    try {
      if (store._saveTimer) {
        clearTimeout(store._saveTimer);
        store._saveTimer = null;
      }
      store.save();
    } catch (_) { }
  }
}

if (typeof process !== "undefined" && !process.env.RIZZER_NO_FLUSH_HOOK) {
  const flush = () => {
    try {
      flushAllStores();
    } catch (_) { }
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
