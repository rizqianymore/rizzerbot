import { cacheGet, cacheSet } from "./cache.js";

const DEFAULT_GROUP = "global";
const MAX_GROUPS = 2000;
const MAX_TURNS = 10;
const MAX_CHARS = 1000;
const TTL_MS = 2 * 60 * 60 * 1000;

const buckets = new Map();

function bucketKey(groupId) {
  return String(groupId || DEFAULT_GROUP);
}

function sanitizeTurns(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    const content = String(m.content || "")
      .trim()
      .slice(0, MAX_CHARS);
    if (!content) continue;
    out.push({ role: m.role, content });
  }
  return out.slice(-MAX_TURNS * 2);
}

function getBucket(groupId) {
  const k = bucketKey(groupId);
  const cur = buckets.get(k);
  if (cur && Date.now() - cur.touched < TTL_MS) return cur;
  if (buckets.size >= MAX_GROUPS) {
    const oldest = [...buckets.entries()].sort((a, b) => a[1].touched - b[1].touched)[0];
    if (oldest) buckets.delete(oldest[0]);
  }
  const fresh = { turns: [], touched: Date.now() };
  buckets.set(k, fresh);
  return fresh;
}

export const AI_MEMORY_TURNS = MAX_TURNS;

function groupIdFrom(jid) {
  if (!jid) return DEFAULT_GROUP;
  const s = String(jid);
  if (s.endsWith("@g.us")) return s;
  return s.split("@")[0] || DEFAULT_GROUP;
}

export function getHistory(jid) {
  return getBucket(groupIdFrom(jid)).turns.map((t) => ({ ...t }));
}

export function pushTurn(jid, userText, assistantText) {
  const bucket = getBucket(groupIdFrom(jid));
  const u = String(userText || "")
    .trim()
    .slice(0, MAX_CHARS);
  const a = String(assistantText || "")
    .trim()
    .slice(0, MAX_CHARS);
  if (u) bucket.turns.push({ role: "user", content: u });
  if (a) bucket.turns.push({ role: "assistant", content: a });
  bucket.turns = sanitizeTurns(bucket.turns).slice(-MAX_TURNS * 2);
  bucket.touched = Date.now();
}

export function clearHistory(jid) {
  const k = bucketKey(groupIdFrom(jid));
  const had = (buckets.get(k)?.turns.length || 0) > 0;
  buckets.delete(k);
  return had;
}

export function memoryStats() {
  let turns = 0;
  for (const b of buckets.values()) turns += b.turns.length;
  return { buckets: buckets.size, turns, ttlHours: TTL_MS / 3600000 };
}

export function seedFromUser(store, jid) {
  try {
    const legacy = store?.getUser?.(jid)?.aiMemory;
    const turns = sanitizeTurns(legacy);
    if (!turns.length) return false;
    const bucket = getBucket(groupIdFrom(jid));
    bucket.turns = sanitizeTurns([...turns, ...bucket.turns]).slice(-MAX_TURNS * 2);
    bucket.touched = Date.now();
    store.updateUser(jid, { aiMemory: [] });
    return true;
  } catch {
    return false;
  }
}

export const chatGet = cacheGet;
export const chatSet = cacheSet;

export default { getHistory, pushTurn, clearHistory, memoryStats, seedFromUser, AI_MEMORY_TURNS };
