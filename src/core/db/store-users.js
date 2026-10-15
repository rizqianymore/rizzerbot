import { auditPrivilege, getRole, normalizeJid, toBoolean } from "./utils.js";
import { resolvePhoneJid } from "./lidmap.js";
import { isPrimaryOwnerJid } from "./botids.js";
import { StoreBase } from "./store-core.js";

export class StoreUsers extends StoreBase {
  ensureUser(normalizedInput) {
    const normalized = resolvePhoneJid(normalizedInput);
    if (!normalized) return null;

    if (normalized.endsWith("@lid") && !this.data.users[normalized]) {
      return this.normalizeUser(normalized, {});
    }
    if (!this.data.users[normalized]) {
      this.data.users[normalized] = this.createUser(normalized);

      this.saveSoon();
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
    if (changed && persist) this.saveSoon();
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

  updateUser(jid, updates = {}, opts = {}) {
    const normalized = resolvePhoneJid(jid);
    if (!normalized) return null;
    if (!normalized.endsWith("@s.whatsapp.net") && !normalized.endsWith("@lid")) return null;

    if (normalized.endsWith("@lid") && !this.data.users[normalized]) {
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

    if (updates.name !== undefined) {
      next.name = String(updates.name ?? "").slice(0, 100);
    }
    if (updates.profile !== undefined) {
      next.profile = String(updates.profile ?? "").slice(0, 500);
    }
    if (updates.registered !== undefined) {
      next.registered = toBoolean(updates.registered) || Boolean(current.owner || current.admin || current.premium);
    }
    if (
      updates.createdAt !== undefined &&
      Number.isFinite(Number(updates.createdAt)) &&
      Number(updates.createdAt) > 0
    ) {
      next.createdAt = Number(updates.createdAt);
    }
    if (updates.lastSeen !== undefined && Number.isFinite(Number(updates.lastSeen))) {
      next.lastSeen = Number(updates.lastSeen);
    }

    const EXTRA_SAFE = new Set(["energy", "energyLastRefill", "exp", "level", "crystals", "spinsWon", "aiMemory"]);
    for (const key of EXTRA_SAFE) {
      if (updates[key] !== undefined) next[key] = updates[key];
    }

    if (privileged) {
      const isPrimary = isPrimaryOwnerJid(normalized);
      const nextOwner = isPrimary
        ? true
        : updates.owner !== undefined
          ? toBoolean(updates.owner)
          : toBoolean(current.owner);
      const nextAdmin =
        nextOwner || (updates.admin !== undefined ? toBoolean(updates.admin) : toBoolean(current.admin));
      const nextPremium =
        nextOwner ||
        nextAdmin ||
        (updates.premium !== undefined ? toBoolean(updates.premium) : toBoolean(current.premium));
      const nextBanned = nextOwner
        ? false
        : updates.banned !== undefined
          ? toBoolean(updates.banned)
          : toBoolean(current.banned);
      next.owner = nextOwner;
      next.admin = nextAdmin;
      next.premium = nextPremium;
      next.banned = nextBanned;
      if (updates.premiumUntil !== undefined) {
        next.premiumUntil =
          Number.isFinite(Number(updates.premiumUntil)) && Number(updates.premiumUntil) > 0
            ? Number(updates.premiumUntil)
            : null;
      }
      if (updates.banned !== undefined && nextOwner) next.banned = false;
    } else {
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

    this.saveSoon();
    return next;
  }

  getUser(jid) {
    return this.ensureUser(resolvePhoneJid(jid));
  }

  deleteUser(jid, actor = "") {
    const normalized = resolvePhoneJid(jid);
    if (!normalized || !normalized.endsWith("@s.whatsapp.net")) return false;
    if (isPrimaryOwnerJid(normalized)) return false;
    if (this.isConfigFileOwner(normalized)) return false;
    const had = Boolean(this.data.users[normalized]);
    delete this.data.users[normalized];
    for (const key of ["ownerNumbers", "adminNumbers", "premiumNumbers"]) {
      const list = this.data.settings?.[key];
      if (Array.isArray(list)) {
        this.data.settings[key] = list.filter((x) => normalizeJid(x) !== normalized);
      }
    }
    this.refreshConfiguredJids();
    auditPrivilege(this.auditStoreKey(), "deleteUser", normalized, false, { actor });
    this.syncPrivilegedUsers();
    this.save();
    return had;
  }
}
