import { fetchJSON } from "./client.js";

export async function getSeasons(limit = 30, offset = 0) {
  const data = await fetchJSON(`/seasons?limit=${limit}&offset=${offset}`);
  return data;
}

export function parseSeasonParam(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s || s === "current" || s === "now" || s === "tahun ini") return "current";
  if (/^\d{4}$/.test(s)) {
    const y = Number(s);
    if (y < 1950 || y > new Date().getFullYear() + 1)
      return { error: `Tahun harus 1950–${new Date().getFullYear() + 1}.` };
    return s;
  }
  return { error: `Tahun "${raw}" tidak valid. Contoh: .f1standings 2024` };
}
export async function getDriversChampionship(season) {
  return fetchJSON(`/${season}/drivers-championship?limit=30&offset=0`);
}
export async function getConstructorsChampionship(season) {
  return fetchJSON(`/${season}/constructors-championship?limit=30&offset=0`);
}

export async function getRacesByYear(year) {
  return fetchJSON(`/${year}?limit=30&offset=0`);
}
export async function getRaceDetail(year, round) {
  return fetchJSON(`/${year}/${round}`);
}
export async function getCurrentLast() {
  return fetchJSON("/current/last");
}
export async function getCurrentNext() {
  return fetchJSON("/current/next");
}

const RESULT_TYPES = new Set(["race", "qualy", "fp1", "fp2", "fp3", "sprint/race", "sprint/qualy"]);
export function parseResultType(raw) {
  const s = String(raw || "race")
    .trim()
    .toLowerCase();
  const map = {
    race: "race",
    balapan: "race",
    qualy: "qualy",
    qualifying: "qualy",
    kualifikasi: "qualy",
    q: "qualy",
    fp1: "fp1",
    fp2: "fp2",
    fp3: "fp3",
    sprint: "sprint/race",
    "sprint-race": "sprint/race",
    "sprint-qualy": "sprint/qualy",
    sprintqualy: "sprint/qualy",
    sq: "sprint/qualy",
  };
  return map[s] || null;
}
export async function getSessionResult(year, round, type = "race", limit = 20) {
  if (!RESULT_TYPES.has(type)) throw new Error(`Tipe sesi "${type}" tidak dikenal.`);
  return fetchJSON(`/${year}/${round}/${type}?limit=${limit}&offset=0`);
}
export async function getLastSessionResult(type = "race", limit = 10) {
  if (!RESULT_TYPES.has(type)) throw new Error(`Tipe sesi "${type}" tidak dikenal.`);
  return fetchJSON(`/current/last/${type}?limit=${limit}&offset=0`);
}
