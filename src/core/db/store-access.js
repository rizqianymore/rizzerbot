import {
  cloneValue,
  getConfiguredJids,
  isPremiumExpired,
  normalizeJid,
  phoneDigitsOfPhoneJid,
  samePhoneJidStrict,
  toBoolean,
} from "./utils.js";
import { configDefaults, configuredOwnerValues, normalizeSettings } from "./settings.js";
import { resolvePhoneJid } from "./lidmap.js";
import { isAnyBotJid, isPrimaryOwnerJid } from "./botids.js";
import { StoreUsers } from "./store-users.js";

export class StoreAccess extends StoreUsers {
  getSettings() {
    return this.data.settings;
  }

  updateSettings(updates = {}) {
    const allowedKeys = new Set([...Object.keys(configDefaults), "admins", "premiumUsers"]);
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
    const normalized = resolvePhoneJid(jid);
    if (!normalized) return false;
    if (isPrimaryOwnerJid(normalized) || this.ownerJids.has(normalized) || this.data.users[normalized]?.owner) {
      return true;
    }

    if (!normalized.endsWith("@s.whatsapp.net")) return false;
    const digits = phoneDigitsOfPhoneJid(normalized);
    if (digits && digits.length >= 8) {
      const phoneJid = `${digits}@s.whatsapp.net`;
      if (isPrimaryOwnerJid(phoneJid) || this.ownerJids.has(phoneJid) || this.data.users[phoneJid]?.owner) {
        return true;
      }
    }

    return false;
  }

  isAdmin(jid) {
    const normalized = resolvePhoneJid(jid);
    if (!normalized) return false;
    return Boolean(
      normalized && (this.isOwner(normalized) || this.adminJids.has(normalized) || this.data.users[normalized]?.admin)
    );
  }

  isPremium(jid) {
    const normalized = resolvePhoneJid(jid);
    if (!normalized) return false;
    if (this.isOwner(normalized) || this.isAdmin(normalized) || this.premiumJids.has(normalized)) return true;

    if (!normalized.endsWith("@s.whatsapp.net")) {
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
      role: owner ? "owner" : admin ? "admin" : premium ? "premium" : "user",
      banned: Boolean(user?.banned) && !owner,
    };
  }

  hasAccess(jid, requiredAccess) {
    if (requiredAccess === undefined || requiredAccess === null || requiredAccess === "") {
      return true;
    }
    const requirements = (Array.isArray(requiredAccess) ? requiredAccess : [requiredAccess]).filter(
      (requirement) => requirement !== undefined && requirement !== null && requirement !== ""
    );
    if (requirements.length === 0) return true;
    const access = this.getAccess(jid);
    const normalizedRequirements = requirements.map((requirement) => String(requirement || "").toLowerCase());
    if (access.banned && !normalizedRequirements.includes("banned")) return false;
    return requirements.every((requirement) => {
      switch (String(requirement || "").toLowerCase()) {
        case "owner":
          return access.owner;
        case "admin":
          return access.admin;
        case "premium":
          return access.premium;
        case "banned":
          return access.banned;
        case "user":
          return Boolean(access.user || access.owner || access.admin || access.premium) && !access.banned;
        default:
          return false;
      }
    });
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

  isConfigFileOwner(jid) {
    const normalized = resolvePhoneJid(jid);
    if (!normalized) return false;
    return getConfiguredJids(configuredOwnerValues).has(normalized);
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
