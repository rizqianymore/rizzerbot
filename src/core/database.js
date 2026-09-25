import fs from 'fs';
import path from 'path';
import { settings } from '@/config/settings.js';

const dbPath = process.env.RIZZER_DB_PATH
  ? path.resolve(process.env.RIZZER_DB_PATH)
  : path.join(process.cwd(), 'database.json');
const dbDirectory = path.dirname(dbPath);
const configDefaults = cloneValue(settings);
const configuredOwnerValues = [
  settings.ownerNumber,
  settings.pairingNumber,
  settings.ownerNumbers,
];
const configuredAdminValues = [settings.adminNumbers, settings.admins];
const configuredPremiumValues = [settings.premiumNumbers, settings.premiumUsers];
const schemaVersion = 2;
let data = null;

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

let ownerJids = getConfiguredJids(configuredOwnerValues);
let adminJids = getConfiguredJids(configuredAdminValues);
let premiumJids = getConfiguredJids(configuredPremiumValues);

function refreshConfiguredJids() {
  if (!data?.settings) return;
  const activeSettings = data.settings;
  ownerJids = getConfiguredJids([
    ...configuredOwnerValues,
    activeSettings.ownerNumber,
    activeSettings.pairingNumber,
    activeSettings.ownerNumbers,
  ]);
  adminJids = getConfiguredJids([
    ...configuredAdminValues,
    activeSettings.adminNumbers,
    activeSettings.admins,
  ]);
  premiumJids = getConfiguredJids([
    ...configuredPremiumValues,
    activeSettings.premiumNumbers,
    activeSettings.premiumUsers,
  ]);
}

function getRole(user) {
  if (user.owner) return 'owner';
  if (user.admin) return 'admin';
  if (user.premium) return 'premium';
  return 'user';
}

function getOwnerName() {
  return data?.settings?.ownerName || settings.ownerName || 'Owner';
}

function isPremiumExpired(user) {
  return Boolean(
    user.premiumUntil &&
      Number.isFinite(Number(user.premiumUntil)) &&
      Number(user.premiumUntil) <= Date.now()
  );
}

function normalizeUser(jid, user = {}) {
  const isConfiguredOwner = ownerJids.has(jid);
  const isConfiguredAdmin = adminJids.has(jid);
  const isConfiguredPremium = premiumJids.has(jid);
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
      : owner ? getOwnerName() : '',
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

function normalizeSettings(storedSettings = {}) {
  const result = { ...cloneValue(configDefaults), ...cloneValue(storedSettings) };

  const roleAliases = {
    ownerNumbers: [],
    adminNumbers: ['admins'],
    premiumNumbers: ['premiumUsers'],
  };
  for (const key of Object.keys(roleAliases)) {
    const values = [
      result[key],
      ...roleAliases[key].map((alias) => result[alias]),
      configDefaults[key],
      ...roleAliases[key].map((alias) => configDefaults[alias]),
    ];
    result[key] = [...new Set(values.flatMap((value) => toJidList(value)))];
  }

  for (const key of ['public', 'usePairingCode', 'autoRead', 'autoOnline']) {
    result[key] = toBoolean(result[key], configDefaults[key]);
  }
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

function loadData() {
  let stored = {};
  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf8');
      stored = raw ? JSON.parse(raw) : {};
    } catch (error) {
      const backupPath = `${dbPath}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(dbPath, backupPath);
      } catch (_) {}
      stored = {};
    }
  }

  const source = isRecord(stored) ? stored : {};
  const users = isRecord(source.users) ? source.users : {};
  const normalizedUsers = {};
  let changed = !isRecord(source.users);

  for (const [jid, user] of Object.entries(users)) {
    const normalized = normalizeJid(jid);
    if (!normalized || !isRecord(user)) {
      changed = true;
      continue;
    }
    normalizedUsers[normalized] = normalizeUser(normalized, user);
    if (JSON.stringify(normalizedUsers[normalized]) !== JSON.stringify(user)) changed = true;
  }

  const data = {
    ...source,
    schemaVersion,
    users: normalizedUsers,
    settings: normalizeSettings(isRecord(source.settings) ? source.settings : {}),
    usage: isRecord(source.usage) ? source.usage : {},
    nsfw: isRecord(source.nsfw) ? source.nsfw : {},
  };

  if (data.schemaVersion !== schemaVersion) changed = true;
  if (JSON.stringify(data.settings) !== JSON.stringify(source.settings || {})) changed = true;
  if (!isRecord(source.usage)) changed = true;
  if (!isRecord(source.nsfw)) changed = true;
  if (source.schemaVersion !== schemaVersion) changed = true;

  return { data, changed };
}

function writeData() {
  fs.mkdirSync(dbDirectory, { recursive: true });
  const serialized = JSON.stringify(data, null, 2);
  const temporaryPath = `${dbPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, serialized, 'utf8');
    fs.renameSync(temporaryPath, dbPath);
  } catch (_) {
    fs.writeFileSync(dbPath, serialized, 'utf8');
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch (_) {}
  }
}

const loaded = loadData();
data = loaded.data;
refreshConfiguredJids();

function save() {
  writeData();
}

function applyConfiguredAccess(jid, user, persist = true) {
  const before = JSON.stringify(user);
  const next = normalizeUser(jid, user);
  const changed = before !== JSON.stringify(next);
  if (changed) data.users[jid] = next;
  if (changed && persist) save();
  return changed;
}

function createUser(jid) {
  return normalizeUser(jid, {
    name: ownerJids.has(jid) ? getOwnerName() : '',
    registered: ownerJids.has(jid) || adminJids.has(jid) || premiumJids.has(jid),
    owner: ownerJids.has(jid),
    admin: ownerJids.has(jid) || adminJids.has(jid),
    premium: ownerJids.has(jid) || adminJids.has(jid) || premiumJids.has(jid),
    banned: false,
    profile: '',
    premiumUntil: null,
    createdAt: Date.now(),
  });
}

function ensureUser(normalized) {
  if (!normalized) return null;
  if (!data.users[normalized]) {
    data.users[normalized] = createUser(normalized);
    save();
    return data.users[normalized];
  }
  applyConfiguredAccess(normalized, data.users[normalized]);
  return data.users[normalized];
}

function syncPrivilegedUsers() {
  let changed = false;
  const privilegedJids = new Set([...ownerJids, ...adminJids, ...premiumJids]);

  for (const jid of privilegedJids) {
    if (!data.users[jid]) {
      data.users[jid] = createUser(jid);
      changed = true;
      continue;
    }
    if (applyConfiguredAccess(jid, data.users[jid], false)) changed = true;
  }

  for (const [jid, user] of Object.entries(data.users)) {
    const next = normalizeUser(jid, user);
    if (JSON.stringify(next) !== JSON.stringify(user)) {
      data.users[jid] = next;
      changed = true;
    }
  }

  return changed;
}

function isOwner(jid) {
  const normalized = normalizeJid(jid);
  return Boolean(normalized && (ownerJids.has(normalized) || data.users[normalized]?.owner));
}

function isAdmin(jid) {
  const normalized = normalizeJid(jid);
  return Boolean(normalized && (isOwner(normalized) || adminJids.has(normalized) || data.users[normalized]?.admin));
}

function isPremium(jid) {
  const normalized = normalizeJid(jid);
  if (!normalized) return false;
  if (isOwner(normalized) || isAdmin(normalized) || premiumJids.has(normalized)) return true;
  const user = data.users[normalized];
  return Boolean(user?.premium && !isPremiumExpired(user));
}

function getAccess(jid) {
  const normalized = normalizeJid(jid);
  let user = data.users[normalized] || null;
  if (user) {
    applyConfiguredAccess(normalized, user);
    user = data.users[normalized];
  }
  const owner = isOwner(normalized);
  const admin = isAdmin(normalized);
  const premium = isPremium(normalized);
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

function hasAccess(jid, requiredAccess) {
  if (requiredAccess === undefined || requiredAccess === null || requiredAccess === '') {
    return true;
  }
  const requirements = (Array.isArray(requiredAccess) ? requiredAccess : [requiredAccess])
    .filter((requirement) => requirement !== undefined && requirement !== null && requirement !== '');
  if (requirements.length === 0) return true;
  const access = getAccess(jid);
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

function updateUser(jid, updates = {}) {
  const normalized = normalizeJid(jid);
  const current = ensureUser(normalized);
  if (!current) return null;

  const protectedOwner = isOwner(normalized);
  const next = {
    ...current,
    ...updates,
    owner: protectedOwner,
    admin: toBoolean(updates.admin ?? current.admin),
    premium: toBoolean(updates.premium ?? current.premium),
    banned: protectedOwner ? false : toBoolean(updates.banned ?? current.banned),
  };

  if (next.owner) {
    next.premium = true;
    next.banned = false;
  }
  if (next.admin) next.premium = true;
  next.role = getRole(next);
  if (next.premiumUntil === undefined) next.premiumUntil = current.premiumUntil ?? null;

  data.users[normalized] = next;
  save();
  return next;
}

function setPremium(jid, enabled, days = null) {
  const normalized = normalizeJid(jid);
  if (!normalized || isOwner(normalized)) return data.users[normalized] || null;
  if (!enabled && (isAdmin(normalized) || premiumJids.has(normalized))) {
    return data.users[normalized] || null;
  }
  const duration = Number(days);
  const premiumUntil = enabled && Number.isFinite(duration) && duration > 0
    ? Date.now() + duration * 24 * 60 * 60 * 1000
    : null;
  return updateUser(normalized, {
    premium: toBoolean(enabled),
    premiumUntil,
  });
}

function setAdmin(jid, enabled) {
  const normalized = normalizeJid(jid);
  if (!normalized || isOwner(normalized)) return data.users[normalized] || null;
  if (!enabled && adminJids.has(normalized)) return data.users[normalized] || null;
  return updateUser(normalized, { admin: toBoolean(enabled) });
}

function setBanned(jid, enabled) {
  const normalized = normalizeJid(jid);
  if (!normalized || isOwner(normalized)) return data.users[normalized] || null;
  return updateUser(normalized, { banned: toBoolean(enabled) });
}

function updateSettings(updates = {}) {
  const allowedKeys = new Set([...Object.keys(configDefaults), 'admins', 'premiumUsers']);
  const next = { ...data.settings };
  for (const [key, value] of Object.entries(updates)) {
    if (allowedKeys.has(key)) next[key] = cloneValue(value);
  }
  data.settings = normalizeSettings(next);
  refreshConfiguredJids();
  syncPrivilegedUsers();
  save();
  return data.settings;
}

const accessChanged = syncPrivilegedUsers();
if (loaded.changed || accessChanged) save();

export const db = {
  get data() { return data; },
  save,
  normalizeJid,
  getSettings: () => data.settings,
  updateSettings,
  getUser: (jid) => ensureUser(normalizeJid(jid)),
  updateUser,
  setPremium,
  setAdmin,
  setBanned,
  isOwner,
  isAdmin,
  isPremium,
  isConfiguredAdmin: (jid) => adminJids.has(normalizeJid(jid)),
  isConfiguredPremium: (jid) => premiumJids.has(normalizeJid(jid)),
  isBanned: (jid) => getAccess(jid).banned,
  getAccess,
  hasAccess,
  recordCommand: (command) => {
    data.usage[command] = (Number(data.usage[command]) || 0) + 1;
    save();
  },
  isNsfw: (groupId) => toBoolean(data.nsfw?.[groupId]),
  setNsfw: (groupId, enabled) => {
    data.nsfw[groupId] = toBoolean(enabled);
    save();
  },
};
