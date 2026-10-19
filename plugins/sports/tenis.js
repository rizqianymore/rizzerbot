import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const API = "https://site.api.espn.com/apis/site/v2/sports";
const cache = createTtlCache({ ttlMs: 5 * 60 * 1000, max: 200 });

const TENNIS_TOURNAMENTS = {
  wta: { id: "tennis_wta", label: "WTA Tour" },
  atp: { id: "tennis_atp", label: "ATP Tour" },
  wimbledon: { id: "wimbledon", label: "Wimbledon" },
  usopen: { id: "usopen", label: "US Open" },
  frenchopen: { id: "frenchopen", label: "French Open" },
  australianopen: { id: "australianopen", label: "Australian Open" },
};

export function resolveTour(input) {
  const k = String(input || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return { key: "wta", ...TENNIS_TOURNAMENTS.wta };
  for (const [key, t] of Object.entries(TENNIS_TOURNAMENTS)) {
    if (key === k) return { key, ...t };
  }
  return null;
}

async function fetchTennisBoard(tourKey) {
  const key = `tennis:${tourKey}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const tour = TENNIS_TOURNAMENTS[tourKey];
  if (!tour) return null;
  try {
    const data = await request.json(`${API}/tennis/${tour.id}/scoreboard`, { timeout: 15000 });
    cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

function fmtTennisMatch(event) {
  const comp = event?.competitions?.[0];
  if (!comp) return null;
  const teams = comp.competitors || [];
  const player1 = teams.find((t) => t.homeAway === "home") || teams[0];
  const player2 = teams.find((t) => t.homeAway === "away") || teams[1];
  if (!player1 || !player2) return null;
  const st = comp.status?.type || {};
  const state = st.state || event?.status?.state;
  const p1 = player1.team?.shortDisplayName || player1.user?.displayName || "?";
  const p2 = player2.team?.shortDisplayName || player2.user?.displayName || "?";
  if (state === "pre") {
    return `${p1} vs ${p2} (${new Date(event.date || Date.now()).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })})`;
  }
  if (state === "in") {
    const detail = comp.status?.type?.shortDetail || comp.status?.type?.detail || "LIVE";
    const p1s = player1.score ?? "-";
    const p2s = player2.score ?? "-";
    return `${p1} ${p1s} - ${p2s} ${p2} [${detail}]`;
  }
  const p1f = player1.score ?? "-";
  const p2f = player2.score ?? "-";
  return `${p1} ${p1f} - ${p2f} ${p2} (FT)`;
}

export async function getTennisBoard(tourKey) {
  const tour = resolveTour(tourKey);
  if (!tour) {
    const labels = Object.values(TENNIS_TOURNAMENTS).map((t) => t.label).join(", ");
    throw new Error(`Turnir tidak dikenal. Pilihan: ${labels}.`);
  }
  const data = await fetchTennisBoard(tour.key);
  if (!data) {
    return { label: tour.label, lines: ["Sedang mencari data..."] };
  }
  const events = Array.isArray(data?.events) ? data.events : [];
  const lines = [];
  for (const e of events.slice(0, 10)) {
    const line = fmtTennisMatch(e);
    if (line) lines.push(`• ${line}`);
  }
  if (lines.length === 0) lines.push("Tidak ada pertandingan live/sekarang.");
  return { label: tour.label, lines };
}

export function formatTennisBoard({ label, lines }) {
  if (!lines.length) return `*${label}*\n\nTidak ada data pertandingan.";
  return `*${label}*\n\n${lines.join("\n")}`;
}