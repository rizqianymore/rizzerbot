import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { settings } from "../../config/settings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPaths = {
  users: path.join(__dirname, "..", "..", "database", "users.json"),
  premium: path.join(__dirname, "..", "..", "database", "premium.json"),
  owner: path.join(__dirname, "..", "..", "database", "owner.json"),
  command: path.join(__dirname, "..", "..", "database", "command.json"),
  channels: path.join(__dirname, "..", "..", "database", "channels.json"),
  groups: path.join(__dirname, "..", "..", "database", "groups.json"),
  blacklist: path.join(__dirname, "..", "..", "database", "blacklist.json"),
  cctv: path.join(__dirname, "..", "..", "database", "cctv.json"),
};

const normalizeJidCache = new Map();

function createDefaultSchema() {
  return {
    users: {},
    stats: {
      totalCommands: 0,
      commands: {},
    },
    settings: {
      selfMode: false,
      maintenance: false,
      onlyGroup: false,
      onlyPrivate: false,
      antiSpam: true,
      registrationOpen: true,
      admins: [],
      limited: [],
      jpmChannels: [],
      jpmBlacklist: [],
    },
    groups: {},
  };
}

class Database {
  constructor() {
    this.data = createDefaultSchema();
    this.load();
    this.updatePrivilegedCache();
    this._saveTimeout = null;

    const exitHandler = () => {
      this.writeToDisk();
      process.exit(0);
    };

    process.once("exit", () => this.writeToDisk());
    process.once("SIGINT", exitHandler);
    process.once("SIGTERM", exitHandler);
    process.once("SIGUSR1", exitHandler);
    process.once("SIGUSR2", exitHandler);
    process.once("uncaughtException", (err) => {
      console.error("Uncaught Exception in database context:", err);
      this.writeToDisk();
      process.exit(1);
    });
  }

  normalizeJid(jid) {
    if (!jid) return "";
    if (typeof jid !== "string") jid = String(jid);
    const cached = normalizeJidCache.get(jid);
    if (cached !== undefined) return cached;
    let cleaned = jid.replace(/:.*@/, "@");
    if (!cleaned.includes("@") && /^\d+$/.test(cleaned)) {
      cleaned = `${cleaned}@s.whatsapp.net`;
    }
    normalizeJidCache.set(jid, cleaned);
    return cleaned;
  }

  updatePrivilegedCache() {
    const ownerNum = settings.ownerNumber
      ? this.normalizeJid(settings.ownerNumber).split("@")[0]
      : "";
    const pairingNum = settings.pairingNumber
      ? this.normalizeJid(settings.pairingNumber).split("@")[0]
      : "";
    const adminNums = (this.data?.settings?.admins || []).map(
      (a) => this.normalizeJid(a).split("@")[0]
    );
    this._privilegedSet = new Set(
      [ownerNum, pairingNum, ...adminNums].filter(Boolean)
    );
    if (this._isPrivilegedCache) {
      this._isPrivilegedCache.clear();
    }
  }

  isPrivilegedJid(jid) {
    if (!jid) return false;
    if (!this._isPrivilegedCache) {
      this._isPrivilegedCache = new Map();
    }
    const cached = this._isPrivilegedCache.get(jid);
    if (cached !== undefined) return cached;
    const normalizedJid = this.normalizeJid(jid).split("@")[0];
    const result = this._privilegedSet?.has(normalizedJid) || false;
    this._isPrivilegedCache.set(jid, result);
    return result;
  }

  load() {
    try {
      const dbDir = path.join(__dirname, "..", "..", "database");
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      let users = {};
      if (fs.existsSync(dbPaths.users)) {
        try {
          const raw = fs.readFileSync(dbPaths.users, "utf8");
          users = raw ? JSON.parse(raw) : {};
        } catch (_) {}
      }

      let premiumList = [];
      if (fs.existsSync(dbPaths.premium)) {
        try {
          const raw = fs.readFileSync(dbPaths.premium, "utf8");
          premiumList = raw ? JSON.parse(raw) : [];
        } catch (_) {}
      }

      if (Array.isArray(premiumList)) {
        premiumList.forEach((jid) => {
          const key = this.normalizeJid(jid);
          if (key) {
            if (!users[key]) {
              users[key] = {
                registered: false,
                name: "",
                banned: false,
                premium: true,
                limit: 100,
                joinedAt: new Date().toISOString(),
              };
            } else {
              users[key].premium = true;
            }
          }
        });
      }

      let ownerSettings = {
        owner: settings.ownerNumber,
        admins: [],
        selfMode: false,
        maintenance: false,
        registrationOpen: true,
      };
      if (fs.existsSync(dbPaths.owner)) {
        try {
          const raw = fs.readFileSync(dbPaths.owner, "utf8");
          ownerSettings = raw ? JSON.parse(raw) : ownerSettings;
        } catch (_) {}
      }

      let stats = { totalCommands: 0, commands: {} };
      if (fs.existsSync(dbPaths.command)) {
        try {
          const raw = fs.readFileSync(dbPaths.command, "utf8");
          stats = raw ? JSON.parse(raw) : stats;
        } catch (_) {}
      }

      let jpmChannels = [];
      if (fs.existsSync(dbPaths.channels)) {
        try {
          const raw = fs.readFileSync(dbPaths.channels, "utf8");
          jpmChannels = raw ? JSON.parse(raw) : [];
        } catch (_) {}
      }

      let groups = {};
      if (fs.existsSync(dbPaths.groups)) {
        try {
          const raw = fs.readFileSync(dbPaths.groups, "utf8");
          groups = raw ? JSON.parse(raw) : {};
        } catch (_) {}
      }

      let jpmBlacklist = [];
      if (fs.existsSync(dbPaths.blacklist)) {
        try {
          const raw = fs.readFileSync(dbPaths.blacklist, "utf8");
          jpmBlacklist = raw ? JSON.parse(raw) : [];
        } catch (_) {}
      }

      let cctvAliases = {};
      if (fs.existsSync(dbPaths.cctv)) {
        try {
          const raw = fs.readFileSync(dbPaths.cctv, "utf8");
          cctvAliases = raw ? JSON.parse(raw) : {};
        } catch (_) {}
      }

      this.data = {
        users: users,
        stats: {
          totalCommands: stats.totalCommands || 0,
          commands: stats.commands || {},
        },
        settings: {
          selfMode: ownerSettings.selfMode || false,
          maintenance: ownerSettings.maintenance || false,
          onlyGroup: ownerSettings.onlyGroup || false,
          onlyPrivate: ownerSettings.onlyPrivate || false,
          antiSpam: ownerSettings.antiSpam !== false,
          prefix: ownerSettings.prefix || undefined,
          admins: ownerSettings.admins || [],
          registrationOpen: ownerSettings.registrationOpen !== false,
          jpmChannels: jpmChannels || [],
          jpmBlacklist: jpmBlacklist || [],
        },
        groups: groups,
        cctvAliases: cctvAliases || {},
      };
      this.updatePrivilegedCache();
    } catch (err) {
      console.error("Database load error, resetting:", err.message);
      this.data = createDefaultSchema();
      this.save();
    }
  }

  save() {
    if (this._saveTimeout) return;
    this._saveTimeout = setTimeout(() => {
      this._saveTimeout = null;
      this.writeToDisk();
    }, 3000);
  }

  flushSync() {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }
    this.writeToDisk();
  }

  safeWriteFileSync(filePath, content) {
    const tempPath = filePath + ".tmp";
    try {
      fs.writeFileSync(tempPath, content, "utf8");
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      console.error(`Error writing atomically to ${filePath}:`, err.message);
      fs.writeFileSync(filePath, content, "utf8");
    }
  }

  writeToDisk() {
    try {
      const dbDir = path.join(__dirname, "..", "..", "database");
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.safeWriteFileSync(
        dbPaths.users,
        JSON.stringify(this.data.users, null, 4)
      );

      const premiumJids = Object.keys(this.data.users).filter(
        (jid) => this.data.users[jid].premium
      );
      this.safeWriteFileSync(
        dbPaths.premium,
        JSON.stringify(premiumJids, null, 4)
      );

      const ownerSettings = {
        owner: settings.ownerNumber,
        admins: this.data.settings.admins || [],
        selfMode: this.data.settings.selfMode || false,
        maintenance: this.data.settings.maintenance || false,
        onlyGroup: this.data.settings.onlyGroup || false,
        onlyPrivate: this.data.settings.onlyPrivate || false,
        antiSpam: this.data.settings.antiSpam !== false,
        prefix: this.data.settings.prefix || settings.prefix,
        registrationOpen: this.data.settings.registrationOpen !== false,
      };
      this.safeWriteFileSync(
        dbPaths.owner,
        JSON.stringify(ownerSettings, null, 4)
      );

      this.safeWriteFileSync(
        dbPaths.command,
        JSON.stringify(this.data.stats, null, 4)
      );

      this.safeWriteFileSync(
        dbPaths.channels,
        JSON.stringify(this.data.settings.jpmChannels || [], null, 4)
      );

      this.safeWriteFileSync(
        dbPaths.groups,
        JSON.stringify(this.data.groups || {}, null, 4)
      );

      this.safeWriteFileSync(
        dbPaths.blacklist,
        JSON.stringify(this.data.settings.jpmBlacklist || [], null, 4)
      );

      this.safeWriteFileSync(
        dbPaths.cctv,
        JSON.stringify(this.data.cctvAliases || {}, null, 4)
      );
    } catch (err) {
      console.error("Database writeToDisk error:", err.message);
    }
  }

  getUser(jid) {
    const key = this.normalizeJid(jid);
    const privileged = this.isPrivilegedJid(key);

    if (!this.data.users[key]) {
      this.data.users[key] = {
        registered: privileged,
        name: privileged ? settings.ownerName : "",
        banned: false,
        premium: privileged,
        limit: 100,
        joinedAt: new Date().toISOString(),
      };
      this.save();
    } else if (privileged) {
      let changed = false;
      if (!this.data.users[key].registered) {
        this.data.users[key].registered = true;
        changed = true;
      }
      if (!this.data.users[key].premium) {
        this.data.users[key].premium = true;
        changed = true;
      }
      if (!this.data.users[key].name && privileged) {
        this.data.users[key].name = settings.ownerName;
        changed = true;
      }
      if (changed) this.save();
    }

    return this.data.users[key];
  }

  updateUser(jid, props) {
    const key = this.normalizeJid(jid);
    const user = this.getUser(key);
    this.data.users[key] = { ...user, ...props };

    if (this.isPrivilegedJid(key)) {
      this.data.users[key].registered = true;
      this.data.users[key].premium = true;
      this.data.users[key].banned = false;
    }

    this.save();
  }

  ensurePrivilegedUsers() {
    const privilegedNumbers = [
      this.normalizeJid(settings.ownerNumber),
      this.normalizeJid(settings.pairingNumber),
      ...(this.data.settings.admins || []).map((a) => this.normalizeJid(a)),
    ].filter(Boolean);

    let changed = false;
    for (const jid of privilegedNumbers) {
      if (!this.data.users[jid]) {
        this.data.users[jid] = {
          registered: true,
          name:
            jid === this.normalizeJid(settings.ownerNumber) ||
            jid === this.normalizeJid(settings.pairingNumber)
              ? settings.ownerName
              : "",
          banned: false,
          premium: true,
          limit: 100,
          joinedAt: new Date().toISOString(),
        };
        changed = true;
        console.log(`[DB] Seeded privileged user: ${jid}`);
      } else {
        if (!this.data.users[jid].registered || !this.data.users[jid].premium) {
          this.data.users[jid].registered = true;
          this.data.users[jid].premium = true;
          this.data.users[jid].banned = false;
          changed = true;
          console.log(`[DB] Updated privileged flags for: ${jid}`);
        }
      }
    }
    if (changed) this.save();
  }

  getGroup(jid) {
    if (!this.data.groups) this.data.groups = {};
    return this.data.groups[jid] || null;
  }

  updateGroup(jid, props) {
    if (!this.data.groups) this.data.groups = {};

    const existing = this.data.groups[jid] || { antilink: false };
    this.data.groups[jid] = { ...existing, ...props };
    this.save();
  }

  recordCommand(cmdName) {
    this.data.stats.totalCommands++;
    this.data.stats.commands[cmdName] =
      (this.data.stats.commands[cmdName] || 0) + 1;
    this.save();
  }

  getCctvAlias(target) {
    if (!this.data.cctvAliases) this.data.cctvAliases = {};
    const targetLower = target.toLowerCase();
    for (const [id, camData] of Object.entries(this.data.cctvAliases)) {
      if (camData && camData.alias && camData.alias.toLowerCase() === targetLower) {
        return id;
      }
    }
    return null;
  }

  setCctvAlias(cameraId, name, alias) {
    if (!this.data.cctvAliases) this.data.cctvAliases = {};
    this.data.cctvAliases[cameraId] = {
      name: name || this.data.cctvAliases[cameraId]?.name || "",
      alias: alias || ""
    };
    this.save();
  }

  deleteCctvAlias(aliasName) {
    if (!this.data.cctvAliases) this.data.cctvAliases = {};
    const targetLower = aliasName.toLowerCase();
    for (const [id, camData] of Object.entries(this.data.cctvAliases)) {
      if (camData && camData.alias && camData.alias.toLowerCase() === targetLower) {
        this.data.cctvAliases[id].alias = "";
        this.save();
        return true;
      }
    }
    return false;
  }

  getSettings() {
    return this.data.settings || {};
  }

  updateSettings(props) {
    this.data.settings = { ...(this.data.settings || {}), ...props };
    this.save();
    return this.data.settings;
  }
}

export const db = new Database();
