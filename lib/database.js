import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { settings } from '@/config/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPaths = {
    users: path.join(__dirname, '..', 'database', 'users.json'),
    premium: path.join(__dirname, '..', 'database', 'premium.json'),
    owner: path.join(__dirname, '..', 'database', 'owner.json'),
    command: path.join(__dirname, '..', 'database', 'command.json'),
    channels: path.join(__dirname, '..', 'database', 'channels.json'),
    groups: path.join(__dirname, '..', 'database', 'groups.json')
};

function createDefaultSchema() {
    return {
        users: {},
        stats: {
            totalCommands: 0,
            commands: {}
        },
        settings: {
            selfMode: false,
            maintenance: false,
            admins: [],
            jpmChannels: []
        },
        groups: {}
    };
}

class Database {
    constructor() {
        this.data = createDefaultSchema();
        this.load();
        this.updatePrivilegedCache();
        this._saveTimeout = null;

        // Setup process exit listeners to ensure data is written on exit
        const exitHandler = () => {
            this.writeToDisk();
            process.exit(0);
        };

        process.once('exit', () => this.writeToDisk());
        process.once('SIGINT', exitHandler);
        process.once('SIGTERM', exitHandler);
        process.once('SIGUSR1', exitHandler);
        process.once('SIGUSR2', exitHandler);
        process.once('uncaughtException', (err) => {
            console.error('Uncaught Exception in database context:', err);
            this.writeToDisk();
            process.exit(1);
        });
    }

    normalizeJid(jid) {
        if (!jid) return '';
        let cleaned = jid.replace(/:.*@/, '@');
        if (!cleaned.includes('@') && /^\d+$/.test(cleaned)) {
            cleaned = `${cleaned}@s.whatsapp.net`;
        }
        return cleaned;
    }

    updatePrivilegedCache() {
        const ownerNum = settings.ownerNumber ? this.normalizeJid(settings.ownerNumber).split('@')[0] : '';
        const pairingNum = settings.pairingNumber ? this.normalizeJid(settings.pairingNumber).split('@')[0] : '';
        const adminNums = (this.data?.settings?.admins || []).map(a => this.normalizeJid(a).split('@')[0]);
        this._privilegedSet = new Set([ownerNum, pairingNum, ...adminNums].filter(Boolean));
    }

    isPrivilegedJid(jid) {
        if (!jid) return false;
        const normalizedJid = this.normalizeJid(jid).split('@')[0];
        return this._privilegedSet?.has(normalizedJid) || false;
    }

    load() {
        try {
            // Ensure database directory exists
            const dbDir = path.join(__dirname, '..', 'database');
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // Migration helper: If old database exists but new users db doesn't, migrate it.
            const oldDbPath = path.join(__dirname, '..', 'config', 'database.json');
            if (fs.existsSync(oldDbPath) && !fs.existsSync(dbPaths.users)) {
                try {
                    const raw = fs.readFileSync(oldDbPath, 'utf8');
                    const parsed = JSON.parse(raw);
                    if (parsed) {
                        console.log('[DB Migration] Migrating config/database.json data to split database files...');
                        if (parsed.users) fs.writeFileSync(dbPaths.users, JSON.stringify(parsed.users, null, 4), 'utf8');
                        if (parsed.stats) fs.writeFileSync(dbPaths.command, JSON.stringify(parsed.stats, null, 4), 'utf8');
                        if (parsed.groups) fs.writeFileSync(dbPaths.groups, JSON.stringify(parsed.groups, null, 4), 'utf8');
                        if (parsed.settings?.jpmChannels) fs.writeFileSync(dbPaths.channels, JSON.stringify(parsed.settings.jpmChannels, null, 4), 'utf8');
                        
                        const ownerSettings = {
                            owner: settings.ownerNumber,
                            admins: parsed.settings?.admins || [],
                            selfMode: parsed.settings?.selfMode || false,
                            maintenance: parsed.settings?.maintenance || false,
                            prefix: parsed.settings?.prefix || settings.prefix
                        };
                        fs.writeFileSync(dbPaths.owner, JSON.stringify(ownerSettings, null, 4), 'utf8');
                        
                        // Extract premium JIDs to premium.json
                        const premiumJids = Object.keys(parsed.users || {}).filter(jid => parsed.users[jid].premium);
                        fs.writeFileSync(dbPaths.premium, JSON.stringify(premiumJids, null, 4), 'utf8');
                        
                        console.log('[DB Migration] Migration completed successfully.');
                    }
                } catch (migrateErr) {
                    console.error('[DB Migration Error]', migrateErr.message);
                }
            }

            // 1. Load users
            let users = {};
            if (fs.existsSync(dbPaths.users)) {
                try {
                    const raw = fs.readFileSync(dbPaths.users, 'utf8');
                    users = raw ? JSON.parse(raw) : {};
                } catch (_) {}
            }

            // 2. Load premium JIDs list
            let premiumList = [];
            if (fs.existsSync(dbPaths.premium)) {
                try {
                    const raw = fs.readFileSync(dbPaths.premium, 'utf8');
                    premiumList = raw ? JSON.parse(raw) : [];
                } catch (_) {}
            }

            // Apply premium flags to users
            if (Array.isArray(premiumList)) {
                premiumList.forEach(jid => {
                    const key = this.normalizeJid(jid);
                    if (key) {
                        if (!users[key]) {
                            users[key] = {
                                registered: false,
                                name: '',
                                banned: false,
                                premium: true,
                                limit: 100,
                                joinedAt: new Date().toISOString()
                            };
                        } else {
                            users[key].premium = true;
                        }
                    }
                });
            }

            // 3. Load owner / settings
            let ownerSettings = { owner: settings.ownerNumber, admins: [], selfMode: false, maintenance: false };
            if (fs.existsSync(dbPaths.owner)) {
                try {
                    const raw = fs.readFileSync(dbPaths.owner, 'utf8');
                    ownerSettings = raw ? JSON.parse(raw) : ownerSettings;
                } catch (_) {}
            }

            // 4. Load stats / command hits
            let stats = { totalCommands: 0, commands: {} };
            if (fs.existsSync(dbPaths.command)) {
                try {
                    const raw = fs.readFileSync(dbPaths.command, 'utf8');
                    stats = raw ? JSON.parse(raw) : stats;
                } catch (_) {}
            }

            // 5. Load JPM channels
            let jpmChannels = [];
            if (fs.existsSync(dbPaths.channels)) {
                try {
                    const raw = fs.readFileSync(dbPaths.channels, 'utf8');
                    jpmChannels = raw ? JSON.parse(raw) : [];
                } catch (_) {}
            }

            // 6. Load group configurations
            let groups = {};
            if (fs.existsSync(dbPaths.groups)) {
                try {
                    const raw = fs.readFileSync(dbPaths.groups, 'utf8');
                    groups = raw ? JSON.parse(raw) : {};
                } catch (_) {}
            }

            // Populate the main data object
            this.data = {
                users: users,
                stats: {
                    totalCommands: stats.totalCommands || 0,
                    commands: stats.commands || {}
                },
                settings: {
                    selfMode: ownerSettings.selfMode || false,
                    maintenance: ownerSettings.maintenance || false,
                    prefix: ownerSettings.prefix || undefined,
                    admins: ownerSettings.admins || [],
                    jpmChannels: jpmChannels || []
                },
                groups: groups
            };
            this.updatePrivilegedCache();

        } catch (err) {
            console.error('Database load error, resetting:', err.message);
            this.data = createDefaultSchema();
            this.save();
        }
    }

    save() {
        this.updatePrivilegedCache();
        if (this._saveTimeout) return;
        this._saveTimeout = setTimeout(() => {
            this._saveTimeout = null;
            this.writeToDisk();
        }, 3000); // Debounce disk I/O to every 3 seconds max
    }

    safeWriteFileSync(filePath, content) {
        const tempPath = filePath + '.tmp';
        try {
            fs.writeFileSync(tempPath, content, 'utf8');
            fs.renameSync(tempPath, filePath);
        } catch (err) {
            console.error(`Error writing atomically to ${filePath}:`, err.message);
            // Fallback to direct write if rename fails
            fs.writeFileSync(filePath, content, 'utf8');
        }
    }

    writeToDisk() {
        try {
            const dbDir = path.join(__dirname, '..', 'database');
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // 1. Write users
            this.safeWriteFileSync(dbPaths.users, JSON.stringify(this.data.users, null, 4));

            // 2. Write premium users list (only JIDs)
            const premiumJids = Object.keys(this.data.users).filter(jid => this.data.users[jid].premium);
            this.safeWriteFileSync(dbPaths.premium, JSON.stringify(premiumJids, null, 4));

            // 3. Write owner settings
            const ownerSettings = {
                owner: settings.ownerNumber,
                admins: this.data.settings.admins || [],
                selfMode: this.data.settings.selfMode || false,
                maintenance: this.data.settings.maintenance || false,
                prefix: this.data.settings.prefix || settings.prefix
            };
            this.safeWriteFileSync(dbPaths.owner, JSON.stringify(ownerSettings, null, 4));

            // 4. Write command hits
            this.safeWriteFileSync(dbPaths.command, JSON.stringify(this.data.stats, null, 4));

            // 5. Write JPM channels
            this.safeWriteFileSync(dbPaths.channels, JSON.stringify(this.data.settings.jpmChannels || [], null, 4));

            // 6. Write groups
            this.safeWriteFileSync(dbPaths.groups, JSON.stringify(this.data.groups || {}, null, 4));

        } catch (err) {
            console.error('Database writeToDisk error:', err.message);
        }
    }

    // Always uses a normalized JID key so the same user never appears twice.
    getUser(jid) {
        const key = this.normalizeJid(jid);
        const privileged = this.isPrivilegedJid(key);

        if (!this.data.users[key]) {
            // First time this user is seen — create their profile
            this.data.users[key] = {
                registered: privileged,
                name: privileged ? settings.ownerName : '',
                banned: false,
                premium: privileged,
                limit: 100,
                joinedAt: new Date().toISOString()
            };
            this.save();
        } else if (privileged) {
            // User already exists — make sure they always have privileged flags
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
        const user = this.getUser(key);         // ensure entry exists with correct key
        this.data.users[key] = { ...user, ...props };

        // Privileged users can never be banned or lose registered/premium status
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
            ...(this.data.settings.admins || []).map(a => this.normalizeJid(a))
        ].filter(Boolean);

        let changed = false;
        for (const jid of privilegedNumbers) {
            if (!this.data.users[jid]) {
                this.data.users[jid] = {
                    registered: true,
                    name: (jid === this.normalizeJid(settings.ownerNumber) || jid === this.normalizeJid(settings.pairingNumber)) ? settings.ownerName : '',
                    banned: false,
                    premium: true,
                    limit: 100,
                    joinedAt: new Date().toISOString()
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
        if (!this.data.groups[jid]) {
            this.data.groups[jid] = { antilink: false };
            this.save();
        }
        return this.data.groups[jid];
    }

    updateGroup(jid, props) {
        const group = this.getGroup(jid);
        this.data.groups[jid] = { ...group, ...props };
        this.save();
    }

    recordCommand(cmdName) {
        this.data.stats.totalCommands++;
        this.data.stats.commands[cmdName] = (this.data.stats.commands[cmdName] || 0) + 1;
        this.save();
    }
}

export const db = new Database();
