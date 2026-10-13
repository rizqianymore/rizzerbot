import { auditPrivilege, normalizeJid, toBoolean } from "./utils.js";
import { resolvePhoneJid } from "./lidmap.js";
import { isPrimaryOwnerJid } from "./botids.js";
import { StoreAccess } from "./store-access.js";

export class Store extends StoreAccess {
  setOwner(jid, enabled) {
    const normalized = normalizeJid(jid);
    if (!normalized) return null;

    if (enabled && !normalized.endsWith("@s.whatsapp.net")) return null;
    if (!enabled && isPrimaryOwnerJid(normalized)) {
      return this.data.users[normalized] || null;
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

    const user = this.updateUser(
      normalized,
      {
        owner: Boolean(enabled),
        admin: Boolean(enabled),
        premium: Boolean(enabled),
        banned: enabled ? false : undefined,
      },
      { privileged: true }
    );
    auditPrivilege(this.isMain ? "main" : this.key, "setOwner", normalized, enabled);
    this.syncPrivilegedUsers();
    this.save();
    return user;
  }

  setAdmin(jid, enabled) {
    const normalized = normalizeJid(jid);
    if (!normalized) return null;
    if (enabled && !normalized.endsWith("@s.whatsapp.net")) return null;
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

    const user = this.updateUser(
      normalized,
      {
        admin: Boolean(enabled),
        premium: enabled ? true : undefined,
      },
      { privileged: true }
    );
    auditPrivilege(this.isMain ? "main" : this.key, "setAdmin", normalized, enabled);
    this.syncPrivilegedUsers();
    this.save();
    return user;
  }

  setPremium(jid, enabled, days = null) {
    const normalized = normalizeJid(jid);
    if (!normalized) return null;
    if (enabled && !normalized.endsWith("@s.whatsapp.net")) return null;
    if (this.isOwner(normalized) || this.isAdmin(normalized)) return this.data.users[normalized] || null;

    const duration = Number(days);
    const premiumUntil =
      enabled && Number.isFinite(duration) && duration > 0 ? Date.now() + duration * 24 * 60 * 60 * 1000 : null;

    const currentList = Array.isArray(this.data.settings.premiumNumbers) ? this.data.settings.premiumNumbers : [];
    let nextList;
    if (enabled) {
      nextList = [...new Set([...currentList, normalized])];
    } else {
      nextList = currentList.filter((num) => normalizeJid(num) !== normalized);
    }
    this.data.settings.premiumNumbers = nextList;
    this.refreshConfiguredJids();

    const user = this.updateUser(
      normalized,
      {
        premium: Boolean(enabled),
        premiumUntil,
      },
      { privileged: true }
    );
    auditPrivilege(
      this.isMain ? "main" : this.key,
      "setPremium",
      normalized,
      enabled,
      days ? { days: Number(days) } : {}
    );
    this.syncPrivilegedUsers();
    this.save();
    return user;
  }

  setBanned(jid, enabled) {
    const normalized = resolvePhoneJid(jid);
    if (!normalized || this.isOwner(normalized)) return this.data.users[normalized] || null;

    if (normalized.endsWith("@lid") && !this.data.users[normalized]) return null;
    const user = this.updateUser(normalized, { banned: toBoolean(enabled) }, { privileged: true });
    auditPrivilege(this.isMain ? "main" : this.key, "setBanned", normalized, enabled);
    return user;
  }
}
