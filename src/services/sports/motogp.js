import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const API = "https://api.motogp.pulselive.com/motogp/v1/results";

const cache = createTtlCache({ ttlMs: 30 * 60 * 1000, max: 100 });

const CATEGORIES = {
  motogp: "MotoGP",
  moto2: "Moto2",
  moto3: "Moto3",
  gp: "MotoGP",
};

export function resolveCategory(input) {
  const k = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!k) return "motogp";
  if (CATEGORIES[k]) return k === "gp" ? "motogp" : k;
  return null;
}

async function get(path) {
  const hit = cache.get(path);
  if (hit !== undefined) return hit;
  const data = await request.json(`${API}${path}`, { timeout: 15000 });
  cache.set(path, data);
  return data;
}

export async function getSeasons() {
  return get("/seasons");
}

export async function resolveSeason(year) {
  const seasons = await getSeasons();
  if (!Array.isArray(seasons) || !seasons.length) throw new Error("Data musim MotoGP kosong.");
  if (!year) {
    return seasons.find((s) => s.current) || seasons[0];
  }
  const found = seasons.find((s) => Number(s.year) === Number(year));
  if (!found) {
    const years = seasons.map((s) => s.year).join(", ");
    throw new Error(`Musim ${year} tidak ada. Tersedia: ${years}.`);
  }
  return found;
}

export async function getCategories(seasonUuid) {
  return get(`/categories?seasonUuid=${encodeURIComponent(seasonUuid)}`);
}

export async function resolveCategoryUuid(seasonUuid, categoryKey) {
  const cats = await getCategories(seasonUuid);
  const want = (CATEGORIES[categoryKey] || "").toLowerCase();
  const found = (Array.isArray(cats) ? cats : []).find((c) =>
    String(c.name || "")
      .toLowerCase()
      .startsWith(want)
  );
  if (!found) throw new Error(`Kelas ${categoryKey} tidak ditemukan.`);
  return found;
}

export async function getEvents(year) {
  const season = await resolveSeason(year);
  const events = await get(`/events?seasonUuid=${encodeURIComponent(season.id)}`);
  return { season, events: Array.isArray(events) ? events.filter((e) => !e.test) : [] };
}

export async function getStandings(year, categoryKey = "motogp", top = 8) {
  const season = await resolveSeason(year);
  const cat = await resolveCategoryUuid(season.id, categoryKey);
  const data = await get(
    `/standings?seasonUuid=${encodeURIComponent(season.id)}&categoryUuid=${encodeURIComponent(cat.id)}`
  );
  const rows = Array.isArray(data?.classification) ? data.classification : [];
  return { season, category: cat.name.replace(/™/g, ""), rows: rows.slice(0, Math.max(1, Math.min(20, top))) };
}

function fmtRange(e) {
  const opt = { day: "numeric", month: "short" };
  try {
    const a = new Date(e.date_start).toLocaleDateString("id-ID", opt);
    const b = new Date(e.date_end).toLocaleDateString("id-ID", opt);
    return a === b ? a : `${a}–${b}`;
  } catch (_) {
    return e.date_start || "-";
  }
}

export function formatSchedule({ season, events }, mode = "next") {
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.date_end).getTime() >= now - 86400000);
  const past = events.filter((e) => new Date(e.date_end).getTime() < now - 86400000);
  const line = (e) => `• ${e.name} (${e.short_name}) — ${e.circuit?.name || "-"}, ${fmtRange(e)} [${e.status}]`;

  if (mode === "all") {
    if (!events.length) return `*Jadwal MotoGP ${season.year}*\n\nData kosong.`;
    return `*Jadwal MotoGP ${season.year}*\n\n${events.map(line).join("\n")}`;
  }
  const next = upcoming[0];
  const last = past.at(-1);
  const parts = [`*MotoGP ${season.year}*`, ""];
  parts.push(last ? `Terakhir: ${last.name} (${last.short_name}) [${last.status}]` : "Terakhir: -");
  parts.push(
    next
      ? `Berikutnya: ${next.name} (${next.short_name}) — ${next.circuit?.name || "-"}, ${fmtRange(next)}`
      : "Berikutnya: -"
  );
  return parts.join("\n");
}

export function formatStandings({ season, category, rows }) {
  if (!rows.length) return `*Klasemen ${category} ${season.year}*\n\nData kosong.`;
  const lines = rows.map((r) => {
    const rider = r.rider?.full_name || "?";
    const num = r.rider?.number ? ` #${r.rider.number}` : "";
    const team = r.team?.name ? ` (${r.team.name})` : "";
    const wins = r.race_wins ? ` | ${r.race_wins} menang` : "";
    return `${r.position}. ${rider}${num}${team} — ${r.points ?? 0} pts${wins}`;
  });
  return `*Klasemen ${category} ${season.year}*\n\n${lines.join("\n")}`;
}
