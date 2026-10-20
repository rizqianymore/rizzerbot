import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const API = "https://site.api.espn.com/apis/site/v2/sports";
const cache = createTtlCache({ ttlMs: 5 * 60 * 1000, max: 200 });

const TENNIS_TOURNAMENTS = {
  wta: { type: "tour", id: "wta", label: "WTA Tour" },
  atp: { type: "tour", id: "atp", label: "ATP Tour" },
  wimbledon: { type: "slam", label: "Wimbledon", keywords: ["wimbledon"] },
  usopen: { type: "slam", label: "US Open", keywords: ["us open"] },
  frenchopen: { type: "slam", label: "French Open", keywords: ["roland garros", "french open"] },
  australianopen: { type: "slam", label: "Australian Open", keywords: ["australian open"] },
};

export function resolveTour(input) {
  const k = String(input || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!k) return { key: "wta", ...TENNIS_TOURNAMENTS.wta };
  for (const [key, t] of Object.entries(TENNIS_TOURNAMENTS)) {
    if (key === k) return { key, ...t };
  }
  return null;
}

async function fetchTour(id) {
  const key = `tennis:${id}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  try {
    const data = await request.json(`${API}/tennis/${id}/scoreboard`, { timeout: 15000 });
    cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

function eventMatchesSlam(event, keywords) {
  const name = String(event?.name || event?.shortName || "").toLowerCase();
  return keywords.some((keyword) => name.includes(keyword));
}

function collectCompetitions(event) {
  const competitions = [];
  if (Array.isArray(event?.competitions)) competitions.push(...event.competitions);
  for (const grouping of Array.isArray(event?.groupings) ? event.groupings : []) {
    if (Array.isArray(grouping?.competitions)) competitions.push(...grouping.competitions);
  }
  return competitions;
}

function athleteName(comp) {
  return comp?.athlete?.shortName || comp?.athlete?.displayName || comp?.athlete?.fullName || "?";
}

function formatTennisSets(home, away) {
  const h = Array.isArray(home?.linescores) ? home.linescores : [];
  const a = Array.isArray(away?.linescores) ? away.linescores : [];
  const count = Math.max(h.length, a.length);
  if (!count) return "";
  const parts = [];
  for (let i = 0; i < count; i++) {
    const hv = h[i]?.value ?? "-";
    const av = a[i]?.value ?? "-";
    let part = `${hv}-${av}`;
    const tb = h[i]?.tiebreak ?? a[i]?.tiebreak;
    if (tb !== undefined && tb !== null) part += `(${tb})`;
    parts.push(part);
  }
  return parts.join(" ");
}

function fmtTennisMatch(comp) {
  const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
  const home = competitors.find((c) => c.homeAway === "home") || competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") || competitors[1];
  if (!home || !away) return null;

  const p1 = athleteName(home);
  const p2 = athleteName(away);
  const st = comp.status?.type || {};
  const state = st.state || comp?.status?.state;

  if (state === "pre") {
    const when = new Date(comp.date || comp.startDate || Date.now()).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${p1} vs ${p2} (${when})`;
  }

  if (state === "in") {
    const detail = st.shortDetail || st.detail || "LIVE";
    const sets = formatTennisSets(home, away);
    return sets ? `${p1} vs ${p2} [${sets}] [${detail}]` : `${p1} vs ${p2} [${detail}]`;
  }

  const note = Array.isArray(comp?.notes)
    ? comp.notes.find((n) => n?.type === "event")?.text
    : null;
  if (note) return note;

  const sets = formatTennisSets(home, away);
  return sets ? `${p1} vs ${p2} (${sets})` : `${p1} vs ${p2} (FT)`;
}

export async function getTennisBoard(tourKey) {
  const tour = resolveTour(tourKey);
  if (!tour) {
    const labels = Object.values(TENNIS_TOURNAMENTS)
      .map((t) => t.label)
      .join(", ");
    throw new Error(`Turnir tidak dikenal. Pilihan: ${labels}.`);
  }

  const competitions = [];

  if (tour.type === "tour") {
    const data = await fetchTour(tour.id);
    if (!data) return { label: tour.label, lines: ["Sedang mencari data..."] };
    for (const event of Array.isArray(data?.events) ? data.events : []) {
      competitions.push(...collectCompetitions(event));
    }
  } else {
    const [atpData, wtaData] = await Promise.all([fetchTour("atp"), fetchTour("wta")]);
    if (!atpData && !wtaData) {
      return { label: tour.label, lines: ["Sedang mencari data..."] };
    }
    for (const data of [atpData, wtaData]) {
      for (const event of Array.isArray(data?.events) ? data.events : []) {
        if (!eventMatchesSlam(event, tour.keywords)) continue;
        competitions.push(...collectCompetitions(event));
      }
    }
  }

  const lines = [];
  for (const competition of competitions.slice(0, 20)) {
    const line = fmtTennisMatch(competition);
    if (line) lines.push(`• ${line}`);
  }
  if (lines.length === 0) lines.push("Tidak ada pertandingan live/sekarang.");
  return { label: tour.label, lines };
}

export function formatTennisBoard({ label, lines }) {
  if (!lines.length) return `*${label}*\n\nTidak ada data pertandingan.`;
  return `*${label}*\n\n${lines.join("\n")}`;
}

export default {
  name: "tenis",
  aliases: ["tennis", "hasiltenis", "jadwaltenis"],
  description: "Hasil & jadwal turnamen tenis (ATP, WTA, Grand Slam)",
  usage: "[atp|wta|wimbledon|usopen|frenchopen|australianopen]",
  premiumOnly: true,
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    try {
      const board = await getTennisBoard(args?.[0]);
      return reply(formatTennisBoard(board));
    } catch (err) {
      return reply(`Gagal memuat data tenis: ${err.message}`);
    }
  },
};
