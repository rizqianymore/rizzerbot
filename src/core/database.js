import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { settings } from "../../config/settings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPaths = {
  users: path.join(__dirname, "..", "..", "database", "users.json"),
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
      groupLock: false,
      allowedGroups: [],
      disabledPlugins: [],
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

    // Ambil list admin langsung dari profil di users.json
    const adminNums = Object.keys(this.data?.users || {})
      .filter((k) => this.data.users[k]?.admin || this.data.users[k]?.role === "admin")
      .map((a) => this.normalizeJid(a).split("@")[0]);

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

      // Normalisasi & Unifikasi seluruh role ke dalam schema terpusat users.json
      for (const [jid, u] of Object.entries(users)) {
        const cleanJid = this.normalizeJid(jid);
        const isOwner =
          cleanJid.split("@")[0] === this.normalizeJid(settings.ownerNumber).split("@")[0] ||
          cleanJid.split("@")[0] === this.normalizeJid(settings.pairingNumber).split("@")[0];

        users[cleanJid] = {
          name: u.name || (isOwner ? settings.ownerName : ""),
          role: isOwner
            ? "owner"
            : u.admin
            ? "admin"
            : u.limited
            ? "limited"
            : u.premium
            ? "premium"
            : "user",
          registered: Boolean(u.registered || isOwner),
          owner: Boolean(u.owner || isOwner),
          admin: Boolean(u.admin || false),
          premium: Boolean(u.premium || isOwner || u.admin),
          limited: Boolean(u.limited || isOwner || u.admin),
          banned: Boolean(u.banned && !isOwner),
          limit: isOwner ? 999999 : typeof u.limit === "number" ? u.limit : 100,
          premiumExpiresAt: u.premiumExpiresAt || null,
          joinedAt: u.joinedAt || new Date().toISOString(),
          lastSeen: u.lastSeen || new Date().toISOString(),
        };
      }

      let ownerSettings = {
        owner: settings.ownerNumber,
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
          registrationOpen: ownerSettings.registrationOpen !== false,
          groupLock: ownerSettings.groupLock || false,
          allowedGroups: ownerSettings.allowedGroups || [],
          disabledPlugins: [],
          jpmChannels: jpmChannels || [],
          jpmBlacklist: jpmBlacklist || [],
        },
        groups: groups,
        cctvAliases: cctvAliases || {},
      };

      this.ensurePrivilegedUsers();
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

      // Single source of truth untuk seluruh user: users.json
      this.safeWriteFileSync(
        dbPaths.users,
        JSON.stringify(this.data.users, null, 4)
      );

      const ownerSettings = {
        owner: settings.ownerNumber,
        selfMode: this.data.settings.selfMode || false,
        maintenance: this.data.settings.maintenance || false,
        onlyGroup: this.data.settings.onlyGroup || false,
        onlyPrivate: this.data.settings.onlyPrivate || false,
        antiSpam: this.data.settings.antiSpam !== false,
        prefix: this.data.settings.prefix || settings.prefix,
        registrationOpen: this.data.settings.registrationOpen !== false,
        groupLock: this.data.settings.groupLock || false,
        allowedGroups: this.data.settings.allowedGroups || [],
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
        name: privileged ? settings.ownerName : "",
        role: privileged ? "owner" : "user",
        registered: privileged,
        owner: privileged,
        admin: false,
        premium: privileged,
        limited: privileged,
        banned: false,
        limit: privileged ? 999999 : 100,
        premiumExpiresAt: null,
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
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
      if (!this.data.users[key].owner) {
        this.data.users[key].owner = true;
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
      this.data.users[key].owner = true;
    }

    // Perbarui role otomatis jika flag berubah
    if (this.data.users[key].owner) {
      this.data.users[key].role = "owner";
    } else if (this.data.users[key].admin) {
      this.data.users[key].role = "admin";
    } else if (this.data.users[key].limited) {
      this.data.users[key].role = "limited";
    } else if (this.data.users[key].premium) {
      this.data.users[key].role = "premium";
    } else {
      this.data.users[key].role = "user";
    }

    this.updatePrivilegedCache();
    this.save();
  }

  ensurePrivilegedUsers() {
    const privilegedNumbers = [
      this.normalizeJid(settings.ownerNumber),
      this.normalizeJid(settings.pairingNumber),
    ].filter(Boolean);

    let changed = false;
    for (const jid of privilegedNumbers) {
      if (!this.data.users[jid]) {
        this.data.users[jid] = {
          name: settings.ownerName || "Owner",
          role: "owner",
          registered: true,
          owner: true,
          admin: true,
          premium: true,
          limited: true,
          banned: false,
          limit: 999999,
          premiumExpiresAt: null,
          joinedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        };
        changed = true;
      } else {
        if (!this.data.users[jid].registered || !this.data.users[jid].premium || !this.data.users[jid].owner) {
          this.data.users[jid].registered = true;
          this.data.users[jid].premium = true;
          this.data.users[jid].owner = true;
          this.data.users[jid].limited = true;
          this.data.users[jid].banned = false;
          this.data.users[jid].role = "owner";
          this.data.users[jid].limit = 999999;
          changed = true;
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

  resetDatabase(botJid = null) {
    const dbDir = path.join(__dirname, "..", "..", "database");
    const backupDir = path.join(dbDir, "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 1. Automatic Snapshot Backup Before Wipe
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFilePath = path.join(backupDir, `backup-${timestamp}.json`);
    try {
      this.safeWriteFileSync(backupFilePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error("[DB Backup Failed]", err.message);
    }

    // 2. Reset to fresh default schema
    this.data = createDefaultSchema();

    // 3. Preserve and Auto-Seed Owner and Active Bot numbers
    const privilegedNumbers = [
      this.normalizeJid(settings.ownerNumber),
      this.normalizeJid(settings.pairingNumber),
      botJid ? this.normalizeJid(botJid) : null,
    ].filter(Boolean);

    for (const jid of privilegedNumbers) {
      this.data.users[jid] = {
        name: settings.ownerName || "Owner",
        role: "owner",
        registered: true,
        owner: true,
        admin: true,
        premium: true,
        limited: true,
        banned: false,
        limit: 999999,
        premiumExpiresAt: null,
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };
    }

    this.updatePrivilegedCache();
    this.flushSync();

    return {
      success: true,
      backupFile: backupFilePath,
      preservedUsers: privilegedNumbers,
    };
  }
}

export const db = new Database();
