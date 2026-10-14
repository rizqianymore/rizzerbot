import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const API = "https://site.api.espn.com/apis/site/v2/sports";
const WEB_API = "https://site.web.api.espn.com/apis/v2/sports";

const cache = createTtlCache({ ttlMs: 5 * 60 * 1000, max: 200 });
const tableCache = createTtlCache({ ttlMs: 30 * 60 * 1000, max: 100 });

export const FOOTBALL_LEAGUES = {
  epl: { id: "eng.1", label: "Liga Inggris" },
  inggris: { id: "eng.1", label: "Liga Inggris" },
  laliga: { id: "esp.1", label: "La Liga Spanyol" },
  spanyol: { id: "esp.1", label: "La Liga Spanyol" },
  seriea: { id: "ita.1", label: "Serie A Italia" },
  italia: { id: "ita.1", label: "Serie A Italia" },
  bundesliga: { id: "ger.1", label: "Bundesliga Jerman" },
  jerman: { id: "ger.1", label: "Bundesliga Jerman" },
  ligue1: { id: "fra.1", label: "Ligue 1 Prancis" },
  prancis: { id: "fra.1", label: "Ligue 1 Prancis" },
  ucl: { id: "uefa.champions", label: "Liga Champions" },
  champions: { id: "uefa.champions", label: "Liga Champions" },
  uel: { id: "uefa.europa", label: "Liga Europa" },
  europa: { id: "uefa.europa", label: "Liga Europa" },
};

export const NBA = { sport: "basketball", id: "nba", label: "NBA" };

export function resolveLeague(input) {
  const k = String(input || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!k || k === "default") return { key: "epl", sport: "soccer", ...FOOTBALL_LEAGUES.epl };
  for (const [key, l] of Object.entries(FOOTBALL_LEAGUES)) {
    if (key === k) return { key, sport: "soccer", ...l };
  }
  return null;
}

async function fetchScoreboard(sport, leagueId) {
  const key = `sb:${sport}:${leagueId}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const data = await request.json(`${API}/${sport}/${leagueId}/scoreboard`, { timeout: 15000 });
  cache.set(key, data);
  return data;
}

async function fetchStandings(sport, leagueId) {
  const key = `st:${sport}:${leagueId}`;
  const hit = tableCache.get(key);
  if (hit !== undefined) return hit;
  const data = await request.json(`${WEB_API}/${sport}/${leagueId}/standings`, { timeout: 15000 });
  tableCache.set(key, data);
  return data;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return iso;
  }
}

function fmtMatch(event) {
  const comp = event?.competitions?.[0];
  if (!comp) return null;
  const teams = comp.competitors || [];
  const home = teams.find((t) => t.homeAway === "home") || teams[0];
  const away = teams.find((t) => t.homeAway === "away") || teams[1];
  if (!home || !away) return null;
  const st = comp.status?.type || {};
  const state = st.state || event?.status?.state;
  const hn = home.team?.shortDisplayName || home.team?.abbreviation || "?";
  const an = away.team?.shortDisplayName || away.team?.abbreviation || "?";
  if (state === "pre") {
    return `${hn} vs ${an} (${fmtDate(comp.date || event.date)})`;
  }
  if (state === "in") {
    const detail = comp.status?.type?.shortDetail || comp.status?.type?.detail || "LIVE";
    return `${hn} ${home.score ?? "-"} - ${away.score ?? "-"} ${an} [${detail}]`;
  }
  return `${hn} ${home.score ?? "-"} - ${away.score ?? "-"} ${an} (FT)`;
}

export async function getFootballBoard(leagueKey) {
  const league = resolveLeague(leagueKey);
  if (!league) {
    const names = [...new Set(Object.values(FOOTBALL_LEAGUES).map((l) => l.label))].join(", ");
    throw new Error(`Liga tidak dikenal. Pilihan: ${names}.`);
  }
  const data = await fetchScoreboard(league.sport, league.id);
  const events = Array.isArray(data?.events) ? data.events : [];
  const lines = [];
  for (const e of events.slice(0, 15)) {
    const line = fmtMatch(e);
    if (line) lines.push(`• ${line}`);
  }
  return { label: league.label, lines };
}

export async function getFootballTable(leagueKey, top = 6) {
  const league = resolveLeague(leagueKey);
  if (!league) {
    const names = [...new Set(Object.values(FOOTBALL_LEAGUES).map((l) => l.label))].join(", ");
    throw new Error(`Liga tidak dikenal. Pilihan: ${names}.`);
  }
  const data = await fetchStandings(league.sport, league.id);
  const entries = data?.children?.[0]?.standings?.entries || [];
  const stat = (e, n) => e.stats?.find((s) => s.name === n)?.displayValue ?? "-";
  const rows = entries.slice(0, Math.max(1, Math.min(20, top))).map((e, i) => {
    const name = e.team?.shortDisplayName || e.team?.abbreviation || "?";
    return `${i + 1}. ${name} — ${stat(e, "points")} pts (M${stat(e, "wins")} S${stat(e, "ties")} K${stat(e, "losses")})`;
  });
  return { label: league.label, rows };
}

export async function getNbaBoard() {
  const data = await fetchScoreboard(NBA.sport, NBA.id);
  const events = Array.isArray(data?.events) ? data.events : [];
  const lines = [];
  for (const e of events.slice(0, 15)) {
    const line = fmtMatch(e);
    if (line) lines.push(`• ${line}`);
  }
  return { label: NBA.label, lines };
}

export function formatBoard({ label, lines }, emptyHint) {
  if (!lines.length) return `*${label}*\n\n${emptyHint || "Tidak ada pertandingan pada periode ini."}`;
  return `*${label}*\n\n${lines.join("\n")}`;
}

export function formatTable({ label, rows }) {
  if (!rows.length) return `*Klasemen ${label}*\n\nData kosong.`;
  return `*Klasemen ${label}*\n\n${rows.join("\n")}`;
}
