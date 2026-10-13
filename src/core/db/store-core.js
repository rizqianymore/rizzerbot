import fs from "fs";
import path from "path";
import { settings } from "@/config/settings.js";
import { getConfiguredJids, getRole, isPremiumExpired, isRecord, normalizeJid, toBoolean } from "./utils.js";
import {
  configuredAdminValues,
  configuredOwnerValues,
  configuredPremiumValues,
  loadStoreFiles,
  normalizeSettings,
  schemaVersion,
} from "./settings.js";
import { lidKeyOf, lidToPnMemory } from "./lidmap.js";

export class StoreBase {
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

    if (this.isMain && isRecord(source.lidMap)) {
      for (const [lidKey, pn] of Object.entries(source.lidMap)) {
        const cleanKey = String(lidKey || "").replace(/\D/g, "");
        const cleanPn = normalizeJid(pn);
        if (cleanKey && cleanPn.endsWith("@s.whatsapp.net") && !lidToPnMemory.has(cleanKey)) {
          lidToPnMemory.set(cleanKey, cleanPn);
        }
      }
    }

    for (const [jid, user] of Object.entries(this.data.users)) {
      if (!jid.endsWith("@lid")) continue;
      const mapped = lidToPnMemory.get(lidKeyOf(jid));
      const privileged = Boolean(user && (user.owner || user.admin || user.premium || user.registered));
      if (mapped) {
        if (!this.data.users[mapped]) {
          this.data.users[mapped] = this.normalizeUser(mapped, {
            ...user,
            owner: false,
            admin: false,
            premium: false,
            registered: false,
          });
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
        } catch (_) {}
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
      } catch (_) {}
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
      fs.writeFileSync(tempUsersPath, usersSerialized, "utf8");
      fs.renameSync(tempUsersPath, this.usersDbPath);
    } catch (_) {
      fs.writeFileSync(this.usersDbPath, usersSerialized, "utf8");
      try {
        fs.rmSync(tempUsersPath, { force: true });
      } catch (_) {}
    }

    const serialized = JSON.stringify(this.data, null, 2);
    const temporaryPath = `${this.dbPath}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, serialized, "utf8");
      fs.renameSync(temporaryPath, this.dbPath);
    } catch (_) {
      fs.writeFileSync(this.dbPath, serialized, "utf8");
      try {
        fs.rmSync(temporaryPath, { force: true });
      } catch (_) {}
    }
  }

  refreshConfiguredJids() {
    const s = this.data.settings;

    this.ownerJids = getConfiguredJids(
      this.isMain
        ? [...configuredOwnerValues, s.ownerNumber, s.pairingNumber, s.ownerNumbers]
        : [s.ownerNumber, s.ownerNumbers]
    );
    this.adminJids = getConfiguredJids(
      this.isMain ? [...configuredAdminValues, s.adminNumbers, s.admins] : [s.adminNumbers, s.admins]
    );
    this.premiumJids = getConfiguredJids(
      this.isMain ? [...configuredPremiumValues, s.premiumNumbers, s.premiumUsers] : [s.premiumNumbers, s.premiumUsers]
    );
  }

  getOwnerName() {
    return this.data?.settings?.ownerName || settings.ownerName || "Owner";
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
    const createdAt =
      Number.isFinite(Number(user.createdAt)) && Number(user.createdAt) > 0 ? Number(user.createdAt) : Date.now();

    return {
      ...user,
      name: typeof user.name === "string" && user.name.trim() ? user.name : owner ? this.getOwnerName() : "",
      registered,
      owner,
      admin,
      premium,
      banned: owner ? false : toBoolean(user.banned),
      profile: typeof user.profile === "string" ? user.profile : "",
      premiumUntil:
        Number.isFinite(Number(user.premiumUntil)) && Number(user.premiumUntil) > 0 ? Number(user.premiumUntil) : null,
      createdAt,
      lastSeen: Number.isFinite(Number(user.lastSeen)) ? Number(user.lastSeen) : createdAt,
      role: getRole({ owner, admin, premium }),
    };
  }

  createUser(jid) {
    return this.normalizeUser(jid, {
      name: this.ownerJids.has(jid) ? this.getOwnerName() : "",
      registered: this.ownerJids.has(jid) || this.adminJids.has(jid) || this.premiumJids.has(jid),
      owner: this.ownerJids.has(jid),
      admin: this.ownerJids.has(jid) || this.adminJids.has(jid),
      premium: this.ownerJids.has(jid) || this.adminJids.has(jid) || this.premiumJids.has(jid),
      banned: false,
      profile: "",
      premiumUntil: null,
      createdAt: Date.now(),
    });
  }
}
