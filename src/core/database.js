import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.json');

const defaultData = {
  users: {},
  settings: {
    public: true,
    prefix: '.'
  },
  usage: {},
  nsfw: {}
};

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
}

let data = JSON.parse(fs.readFileSync(dbPath));

const save = () => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

const ensureUser = (normalized) => {
  if (!data.users[normalized]) {
    data.users[normalized] = {
      name: '',
      premium: false,
      banned: false,
      profile: '',
      createdAt: Date.now()
    };
    save();
  }
  return data.users[normalized];
};

export const db = {
  get data() { return data; },
  save,
  normalizeJid: (jid) => jid ? jid.split(':')[0].split('@')[0] + '@s.whatsapp.net' : '',
  getUser: (jid) => {
    const normalized = db.normalizeJid(jid);
    return ensureUser(normalized);
  },
  recordCommand: (command) => {
    data.usage = data.usage || {};
    data.usage[command] = (data.usage[command] || 0) + 1;
    save();
  },
  isNsfw: (groupId) => Boolean(data.nsfw?.[groupId]),
  setNsfw: (groupId, enabled) => {
    data.nsfw = data.nsfw || {};
    data.nsfw[groupId] = enabled;
    save();
  }
};