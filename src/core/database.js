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

  for (const key of ['public', 'usePairingCode', 'autoRead', 'autoOnline', 'autoForwardTrxToChannel', 'antiBotLuar', 'antiVirtex', 'antiBurst', 'antilinkExtra']) {
    result[key] = toBoolean(result[key], configDefaults[key]);
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
    };

    if (this.data.schemaVersion !== schemaVersion) changed = true;
    if (JSON.stringify(this.data.settings) !== JSON.stringify(source.settings || {})) changed = true;
    if (!isRecord(source.botSettings)) changed = true;
    if (!isRecord(source.usage)) changed = true;
    if (!isRecord(source.nsfw)) changed = true;
    if (source.schemaVersion !== schemaVersion) changed = true;

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

  ensureUser(normalized) {
    if (!normalized) return null;
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
    const normalized = normalizeJid(jid);
    if (!normalized) return false;
    if (
      isPrimaryOwnerJid(normalized) ||
      this.ownerJids.has(normalized) ||
      this.data.users[normalized]?.owner
    ) {
      return true;
    }

    const digits = normalizePhone(normalized);
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
    const normalized = normalizeJid(jid);
    if (!normalized) return false;
    return Boolean(normalized && (this.isOwner(normalized) || this.adminJids.has(normalized) || this.data.users[normalized]?.admin));
  }

  isPremium(jid) {
    const normalized = normalizeJid(jid);
    if (!normalized) return false;
    if (this.isOwner(normalized) || this.isAdmin(normalized) || this.premiumJids.has(normalized)) return true;

    const digits = normalizePhone(normalized);
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
    const normalized = normalizeJid(jid);
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

  updateUser(jid, updates = {}) {
    const normalized = normalizeJid(jid);
    if (!normalized) return null;
    if (!this.data.users[normalized]) {
      this.data.users[normalized] = this.createUser(normalized);
    }
    const current = this.data.users[normalized];

    const isPrimary = isPrimaryOwnerJid(normalized);
    const nextOwner = isPrimary ? true : (updates.owner !== undefined ? toBoolean(updates.owner) : toBoolean(current.owner));
    const nextAdmin = nextOwner || (updates.admin !== undefined ? toBoolean(updates.admin) : toBoolean(current.admin));
    const nextPremium = nextOwner || nextAdmin || (updates.premium !== undefined ? toBoolean(updates.premium) : toBoolean(current.premium));
    const nextBanned = nextOwner ? false : (updates.banned !== undefined ? toBoolean(updates.banned) : toBoolean(current.banned));

    const next = {
      ...current,
      ...updates,
      owner: nextOwner,
      admin: nextAdmin,
      premium: nextPremium,
      banned: nextBanned,
    };

    next.role = getRole(next);
    if (next.premiumUntil === undefined) next.premiumUntil = current.premiumUntil ?? null;

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
    });
    this.syncPrivilegedUsers();
    this.save();
    return user;
  }

  setAdmin(jid, enabled) {
    const normalized = normalizeJid(jid);
    if (!normalized) return null;
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
    });
    this.syncPrivilegedUsers();
    this.save();
    return user;
  }

  setPremium(jid, enabled, days = null) {
    const normalized = normalizeJid(jid);
    if (!normalized) return null;
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
    });
    this.syncPrivilegedUsers();
    this.save();
    return user;
  }

  setBanned(jid, enabled) {
    const normalized = normalizeJid(jid);
    if (!normalized || this.isOwner(normalized)) return this.data.users[normalized] || null;
    return this.updateUser(normalized, { banned: toBoolean(enabled) });
  }

  getUser(jid) {
    return this.ensureUser(normalizeJid(jid));
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
    const phone = normalizePhone(normalized);
    for (const b of list) {
      const nb = normalizeJid(b);
      if (!nb) continue;
      if (nb === normalized) return true;
      if (phone && normalizePhone(nb) === phone) return true;
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
  const digits = normalizePhone(n);
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
function isPrimaryOwnerJid(jid) {
  const normalized = normalizeJid(jid);
  if (!normalized) return false;
  const primary = normalizeJid(mainStore.data?.settings?.ownerNumber || settings.ownerNumber);
  if (primary && normalized === primary) return true;
  const pn = normalizePhone(normalized);
  if (pn && pn.length >= 8) {
    if (primary && normalizePhone(primary) === pn) return true;
    const pairing = normalizeJid(mainStore.data?.settings?.pairingNumber || settings.pairingNumber);
    if (pairing && (pairing === normalized || normalizePhone(pairing) === pn)) return true;
  }
  return false;
}

function isAnyBotJid(jid) {
  const normalized = normalizeJid(jid);
  if (!normalized) return false;
  if (activeBotJids.has(normalized)) return true;

  const phone = normalizePhone(normalized);
  const phoneMatch = (a, b) => a && b && normalizePhone(a) === normalizePhone(b);
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
  const key = normalizePhone(normalized);
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
  const normalizedUser = normalizeJid(userJid);
  if (!normalizedUser) return false;

  const userPhone = normalizePhone(normalizedUser);
  const samePhone = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const pa = normalizePhone(a);
    const pb = normalizePhone(b);
    return Boolean(pa && pb && pa === pb);
  };

  const botIsMain = !normalizedBot || isMainBotJid(normalizedBot);

  if (botIsMain) {
    // Main-bot: owner = primary superowner + daftar owner global main.
    // Owner khusus sub-bot TIDAK berlaku di main (anti-campur).
    if (isPrimaryOwnerJid(normalizedUser)) return true;
    if (mainStore.isOwner(normalizedUser)) return true;
    if (userPhone) {
      const phoneJid = `${userPhone}@s.whatsapp.net`;
      if (isPrimaryOwnerJid(phoneJid) || mainStore.isOwner(phoneJid)) return true;
    }
    if (normalizedBot && samePhone(normalizedUser, normalizedBot)) return true;
    return false;
  }

  // Sub-bot: baca dari database MILIK sub itu (atau fallback mandiri).
  const key = normalizePhone(normalizedBot);
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
