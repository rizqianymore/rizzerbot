/**
 * lib/utils.js — Kyros-MD Shared Utilities
 *
 * Menyediakan helper yang dipakai di banyak tempat agar tidak ada duplikasi:
 *   - getUptimeString()   : format uptime proses
 *   - sleep(ms)           : promise-based delay
 *   - randomDelay(min,max): delay acak anti-spam
 *   - broadcastLock       : singleton Map untuk mutex JPM/Pushkontak
 *   - groupMetaCache      : TTL cache group metadata (30 detik) per-socket
 */

// ─── Uptime ──────────────────────────────────────────────────────────────────

/**
 * Mengembalikan string uptime proses dalam format "Xj Xm Xs".
 * @returns {string}
 */
export function getUptimeString() {
    const uptimeSec = Math.floor(process.uptime());
    const hours   = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    let s = '';
    if (hours   > 0)              s += `${hours}j `;
    if (minutes > 0 || hours > 0) s += `${minutes}m `;
    s += `${seconds}s`;
    return s.trim();
}

// ─── Delay Helpers ────────────────────────────────────────────────────────────

/**
 * Tunda eksekusi selama `ms` milidetik.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Delay acak antara min dan max milidetik.
 * @param {number} min
 * @param {number} max
 * @returns {Promise<void>}
 */
export function randomDelay(min, max) {
    return sleep(Math.floor(min + Math.random() * (max - min)));
}

// ─── Broadcast Lock ───────────────────────────────────────────────────────────

/**
 * Singleton Map sebagai mutex global untuk semua operasi broadcast (JPM & Pushkontak).
 * Key: botJid (string), Value: true
 *
 * Cara pakai:
 *   import { broadcastLock } from '@/lib/utils.js';
 *   if (broadcastLock.has(botJid)) { // sedang berjalan }
 *   broadcastLock.set(botJid, true);
 *   try { ... } finally { broadcastLock.delete(botJid); }
 */
export const broadcastLock = new Map();

// ─── Group Metadata TTL Cache ─────────────────────────────────────────────────

const GROUP_META_TTL_MS = 30_000; // 30 detik

/**
 * Cache entry: { data: groupMetadata, expireAt: timestamp }
 * Key: groupJid
 */
const _groupMetaStore = new Map();

/**
 * Mengambil metadata grup dengan TTL cache 30 detik.
 * Menghindari double round-trip ke WhatsApp API dalam satu pesan handler.
 *
 * @param {object} sock  - Baileys socket
 * @param {string} jid   - Group JID (@g.us)
 * @returns {Promise<object|null>}
 */
export async function getCachedGroupMeta(sock, jid) {
    const now = Date.now();
    const entry = _groupMetaStore.get(jid);

    if (entry && now < entry.expireAt) {
        return entry.data;
    }

    try {
        const meta = await sock.groupMetadata(jid);
        _groupMetaStore.set(jid, { data: meta, expireAt: now + GROUP_META_TTL_MS });
        return meta;
    } catch (_) {
        return null;
    }
}

/**
 * Invalidasi cache untuk grup tertentu (misalnya setelah kick/add member).
 * @param {string} jid
 */
export function invalidateGroupMeta(jid) {
    _groupMetaStore.delete(jid);
}
