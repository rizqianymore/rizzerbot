import { parsePlat } from "./parse.js";
import { formatPlatInfo } from "./format.js";
import { request } from "@/src/utils/request.js";

const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/informasisamsat/databases/(default)/documents";
const SAMSAT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const samsatCache = new Map();

function samsatCacheGet(key) {
  const hit = samsatCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  samsatCache.delete(key);
  return null;
}

function samsatCacheSet(key, data) {
  samsatCache.set(key, { data, expires: Date.now() + SAMSAT_TTL_MS });
  if (samsatCache.size > 200) {
    const firstKey = samsatCache.keys().next().value;
    samsatCache.delete(firstKey);
  }
}

async function firestoreGet(path) {
  const cached = samsatCacheGet(`GET:${path}`);
  if (cached) return cached;
  try {
    const data = await request.json(`${FIRESTORE_BASE}/${path}`, {
      headers: { Accept: "application/json" },
      timeout: 10000,
    });
    samsatCacheSet(`GET:${path}`, data);
    return data;
  } catch (err) {
    if (/HTTP 404\b/.test(err?.message || "")) return null;
    throw err;
  }
}

function parseSamsatDoc(doc) {
  if (!doc?.fields) return null;
  const sv = (k) => doc.fields[k]?.stringValue ?? "-";
  return {
    daerah: sv("Daerah"),
    samsat: sv("Samsat"),
    alamat: sv("Alamat"),
    provinsi: sv("Provinsi"),
    huruf: sv("Huruf"),
  };
}

export async function getSamsatDetail(kode, suffix) {
  const depan = String(kode || "")
    .toUpperCase()
    .trim();
  const belakangKey =
    String(suffix || "")
      .toUpperCase()
      .trim()
      .charAt(0) || "";
  if (!depan) return null;

  const depanDoc = await firestoreGet(`nopol/${encodeURIComponent(depan)}`).catch(() => null);
  if (!depanDoc) return null;

  if (!belakangKey || !/^[A-Z]$/.test(belakangKey)) {
    return null;
  }

  try {
    const doc = await firestoreGet(`nopol/${encodeURIComponent(depan)}/belakang/${belakangKey}`);
    const parsed = parseSamsatDoc(doc);
    if (parsed) return parsed;
  } catch (_) {}

  try {
    const list = await firestoreGet(`nopol/${encodeURIComponent(depan)}/belakang?pageSize=100`);
    const docs = Array.isArray(list?.documents) ? list.documents : [];
    const hit = docs.find(
      (d) =>
        String(d.name || "")
          .split("/")
          .pop()
          ?.toUpperCase() === belakangKey
    );
    return parseSamsatDoc(hit);
  } catch (_) {
    return null;
  }
}

export async function enrichSamsat(parsed) {
  if (!parsed?.valid) return parsed;

  if (parsed.kind !== "sipil" && parsed.kind !== "khusus") return parsed;
  if (!parsed.suffix) return parsed;
  try {
    const detail = await getSamsatDetail(parsed.kode, parsed.suffix);
    if (detail) parsed.samsat = detail;
  } catch (_) {}
  return parsed;
}

export async function getPlatInfoTextOnline(input) {
  const parsed = parsePlat(input);
  if (!parsed.valid) return null;
  await enrichSamsat(parsed);
  return formatPlatInfo(parsed);
}
