import fs from 'fs';
import { settings } from '@/config/settings.js';
import { cloneValue, isRecord, toBoolean, toJidList } from './utils.js';

export const configDefaults = cloneValue(settings);
export const configuredOwnerValues = [
  settings.ownerNumber,
  settings.pairingNumber,
  settings.ownerNumbers,
];
export const configuredAdminValues = [settings.adminNumbers, settings.admins];
export const configuredPremiumValues = [settings.premiumNumbers, settings.premiumUsers];
export const schemaVersion = 2;

export function normalizeSettings(storedSettings = {}) {
  const result = { ...cloneValue(configDefaults), ...cloneValue(storedSettings) };

  const roleAliases = {
    ownerNumbers: [],
    adminNumbers: ['admins'],
    premiumNumbers: ['premiumUsers'],
  };
  for (const key of Object.keys(roleAliases)) {
    const aliasKey = roleAliases[key].find((k) => storedSettings[k] !== undefined);
    const rawVal = storedSettings[key] ?? (aliasKey !== undefined ? storedSettings[aliasKey] : undefined);
    const sourceVal = rawVal !== undefined ? rawVal : configDefaults[key];

    result[key] = [...new Set(toJidList(sourceVal))].filter((j) => j.endsWith('@s.whatsapp.net'));
  }

  for (const key of ['public', 'maintenance', 'usePairingCode', 'autoRead', 'autoOnline', 'autoForwardTrxToChannel', 'antiBotLuar', 'antiVirtex', 'antiBurst', 'antilinkExtra', 'silentDeny']) {
    result[key] = toBoolean(result[key], configDefaults[key]);
  };

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

export function loadStoreFiles(dbPath, usersDbPath) {
  let stored = {};
  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf8');
      stored = raw ? JSON.parse(raw) : {};
    } catch (_error) {
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
    } catch (_error) {
      const backupUsersPath = `${usersDbPath}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(usersDbPath, backupUsersPath);
      } catch (_) { }
      storedUsers = {};
    }
  }

  return { stored: isRecord(stored) ? stored : {}, storedUsers };
}
