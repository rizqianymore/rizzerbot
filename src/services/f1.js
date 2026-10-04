const F1_BASE = "https://f1api.dev/api";
const FETCH_TIMEOUT_MS = 15000;

const cache = new Map();
function cacheGet(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  cache.delete(key);
  return null;
}
function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
  if (cache.size > 300) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
}

async function fetchJSON(path) {
  const cached = cacheGet(`json:${path}`);
  if (cached) return cached;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${F1_BASE}${path}`, {
      headers: { Accept: "application/json", "User-Agent": "rizzerbot/1.0" },
      signal: ctrl.signal,
    });
    if (res.status === 404) {
      const body = await res.text().catch(() => "");
      let msg = "Data tidak ditemukan (404).";
      try {
        const j = JSON.parse(body);
        if (j?.message) msg = j.message;
      } catch (_) {}
      const err = new Error(msg);
      err.status = 404;
      throw err;
    }
    if (!res.ok) throw new Error(`F1 API HTTP ${res.status}`);
    const data = await res.json();

    const dynamic = /championship|current|last|next|\/\d{4}\//.test(path);
    cacheSet(`json:${path}`, data, dynamic ? 10 * 60 * 1000 : 12 * 60 * 60 * 1000);
    return data;
  } catch (err) {
    if (err?.name === "AbortError") throw new Error("F1 API timeout, coba lagi.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllList(listPath, listKey, { pageSize = 100, maxTotal = 1200 } = {}) {
  const cacheKey = `all:${listPath}:${listKey}`;
  const hit = cacheGet(cacheKey);
  if (hit) return hit;
  const out = [];
  for (let offset = 0; offset < maxTotal; offset += pageSize) {
    const sep = listPath.includes("?") ? "&" : "?";
    const data = await fetchJSON(`${listPath}${sep}limit=${pageSize}&offset=${offset}`);
    const arr = data?.[listKey] || [];
    if (!Array.isArray(arr) || arr.length === 0) break;
    out.push(...arr);
    if (arr.length < pageSize) break;
  }
  cacheSet(cacheKey, out, 12 * 60 * 60 * 1000);
  return out;
}

const norm = (s) => String(s ?? "").toLowerCase();
function matchDriver(d, q) {
  const query = norm(q);
  return [d.driverId, d.name, d.surname, `${d.name} ${d.surname}`, d.shortName]
    .some((v) => norm(v).includes(query));
}
function matchTeam(t, q) {
  const query = norm(q);
  return [t.teamId, t.teamName].some((v) => norm(v).includes(query));
}
function matchCircuit(c, q) {
  const query = norm(q);
  return [c.circuitId, c.circuitName, c.city, c.country].some((v) => norm(v).includes(query));
}

export async function getDriverById(id) {
  const data = await fetchJSON(`/drivers/${encodeURIComponent(String(id).toLowerCase())}`);
  const d = data?.driver?.[0] || data?.drivers?.[0];
  if (!d) throw Object.assign(new Error(`Driver "${id}" tidak ditemukan.`), { status: 404 });
  return d;
}
export async function searchDrivers(query, limit = 10) {
  const q = String(query || "").trim();
  if (!q) {
    const data = await fetchJSON(`/drivers?limit=${limit}&offset=0`);
    return data?.drivers || [];
  }

  const idGuess = q.toLowerCase().replace(/\s+/g, "_");
  try {
    const direct = await getDriverById(idGuess);
    if (direct && matchDriver(direct, q)) return [direct];
  } catch (_) {}

  const all = await fetchAllList("/drivers", "drivers");
  const hits = all.filter((d) => matchDriver(d, q));

  hits.sort((a, b) => {
    const score = (d) =>
      norm(d.driverId) === norm(q) || norm(d.shortName) === norm(q) ? 0
      : norm(d.surname) === norm(q) ? 1 : 2;
    return score(a) - score(b);
  });
  return hits.slice(0, limit);
}

export async function getTeamById(id) {
  const data = await fetchJSON(`/teams/${encodeURIComponent(String(id).toLowerCase())}`);
  const t = data?.team?.[0] || data?.teams?.[0];
  if (!t) throw Object.assign(new Error(`Tim "${id}" tidak ditemukan.`), { status: 404 });
  return t;
}
export async function searchTeams(query, limit = 10) {
  const q = String(query || "").trim();
  if (!q) {
    const data = await fetchJSON(`/teams?limit=${limit}&offset=0`);
    return data?.teams || [];
  }
  const idGuess = q.toLowerCase().replace(/\s+/g, "_");
  try {
    const direct = await getTeamById(idGuess);
    if (direct && matchTeam(direct, q)) return [direct];
  } catch (_) {}
  const all = await fetchAllList("/teams", "teams", { maxTotal: 600 });
  return all.filter((t) => matchTeam(t, q)).slice(0, limit);
}

export async function getCircuitById(id) {
  const data = await fetchJSON(`/circuits/${encodeURIComponent(String(id).toLowerCase())}`);
  const c = data?.circuit?.[0] || data?.circuits?.[0];
  if (!c) throw Object.assign(new Error(`Sirkuit "${id}" tidak ditemukan.`), { status: 404 });
  return c;
}
export async function searchCircuits(query, limit = 10) {
  const q = String(query || "").trim();
  if (!q) {
    const data = await fetchJSON(`/circuits?limit=${limit}&offset=0`);
    return data?.circuits || [];
  }
  const idGuess = q.toLowerCase().replace(/\s+/g, "_");
  try {
    const direct = await getCircuitById(idGuess);
    if (direct && matchCircuit(direct, q)) return [direct];
  } catch (_) {}
  const all = await fetchAllList("/circuits", "circuits", { maxTotal: 300 });
  return all.filter((c) => matchCircuit(c, q)).slice(0, limit);
}

export async function getSeasons(limit = 30, offset = 0) {
  const data = await fetchJSON(`/seasons?limit=${limit}&offset=${offset}`);
  return data;
}

export function parseSeasonParam(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s || s === "current" || s === "now" || s === "tahun ini") return "current";
  if (/^\d{4}$/.test(s)) {
    const y = Number(s);
    if (y < 1950 || y > new Date().getFullYear() + 1) return { error: `Tahun harus 1950–${new Date().getFullYear() + 1}.` };
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
  const s = String(raw || "race").trim().toLowerCase();
  const map = {
    race: "race", balapan: "race",
    qualy: "qualy", qualifying: "qualy", kualifikasi: "qualy", q: "qualy",
    fp1: "fp1", fp2: "fp2", fp3: "fp3",
    sprint: "sprint/race", "sprint-race": "sprint/race",
    "sprint-qualy": "sprint/qualy", sprintqualy: "sprint/qualy", sq: "sprint/qualy",
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

const WIKI_TIMEOUT_MS = 12000;
const WIKI_MIN_BYTES = 8 * 1024;
const wikiBufCache = new Map();

function wikiCacheGet(title) {
  const hit = wikiBufCache.get(title);
  if (hit && hit.expires > Date.now()) return hit.data;
  wikiBufCache.delete(title);
  return null;
}
function wikiCacheSet(title, data) {
  wikiBufCache.set(title, { data, expires: Date.now() + 12 * 60 * 60 * 1000 });
  if (wikiBufCache.size > 100) wikiBufCache.delete(wikiBufCache.keys().next().value);
}

function extractWikiTitle(wikiUrl) {
  try {
    const u = new URL(String(wikiUrl || ""));
    if (!/\.wikipedia\.org$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/wiki\/(.+)/);
    if (!m) return null;
    const title = decodeURIComponent(m[1]).trim();
    if (!title || title.length > 200) return null;
    return title;
  } catch (_) {
    return null;
  }
}

function isRealImageBuffer(buf) {
  if (!buf || buf.length < WIKI_MIN_BYTES) return false;
  const b = buf;
  const isJpeg = b[0] === 0xff && b[1] === 0xd8;
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  const isGif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
  return isJpeg || isPng || isWebp || isGif;
}

async function fetchWithTimeout(url, { timeoutMs = WIKI_TIMEOUT_MS, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "rizzerbot/1.0", ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function getWikiThumbnail(wikiUrl, thumbSize = 1000) {
  const title = extractWikiTitle(wikiUrl);
  if (!title) return null;
  const cached = wikiCacheGet(title);
  if (cached) return cached;
  try {

    const api = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&formatversion=2&pithumbsize=${thumbSize}`;
    const res = await fetchWithTimeout(api);
    const j = await res.json();
    const page = j?.query?.pages?.[0];
    const src = page?.thumbnail?.source;
    if (src && typeof src === "string" && src.startsWith("https://")) {
      const buf = await downloadValidImage(src);
      if (buf) {
        wikiCacheSet(title, buf);
        return buf;
      }
    }

    const logoBuf = await getWikiLogoFallback(title, thumbSize);
    if (logoBuf) {
      wikiCacheSet(title, logoBuf);
      return logoBuf;
    }
    return null;
  } catch (_) {
    return null;
  }
}

const LOGO_DENY = ["commons-logo", "wikimedia", "wikipedia", "edit-", "icon", "button", "symbol", "arrow", "increase", "decrease", "check-", "red x", "green tick"];
async function getWikiLogoFallback(title, thumbSize) {
  try {
    const api = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=images&format=json&formatversion=2&imlimit=100`;
    const res = await fetchWithTimeout(api);
    const j = await res.json();
    const imgs = j?.query?.pages?.[0]?.images || [];
    const cands = imgs
      .map((i) => String(i?.title || ""))
      .filter((t) => t.toLowerCase().startsWith("file:") && t.toLowerCase().includes("logo"))
      .filter((t) => !LOGO_DENY.some((d) => t.toLowerCase().includes(d)))
      .sort((a, b) => {
        const rank = (t) => (/\.svg$/i.test(t) ? 0 : /\.(png|jpg|jpeg)$/i.test(t) ? 1 : 2);
        return rank(a) - rank(b);
      });
    for (const fileTitle of cands.slice(0, 3)) {
      const name = fileTitle.replace(/^file:/i, "");
      for (const host of ["commons.wikimedia.org", "en.wikipedia.org"]) {
        const url = `https://${host}/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${thumbSize}`;
        const buf = await downloadValidImage(url).catch(() => null);
        if (buf) return buf;
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}

async function downloadValidImage(url) {
  const img = await fetchWithTimeout(url);
  const ct = String(img.headers.get("content-type") || "");
  if (!ct.startsWith("image/")) return null;
  const buf = Buffer.from(await img.arrayBuffer());
  if (!isRealImageBuffer(buf)) return null;
  return buf;
}

export async function replyDetail(sock, msg, replyFn, caption, wikiUrl) {
  const text = String(caption || "").trim() || "-";
  try {
    const img = await getWikiThumbnail(wikiUrl);
    if (img) {

      if (text.length > 1000) {
        await sock.sendMessage(msg.key.remoteJid, { image: img }, { quoted: msg });
        await replyFn(text);
      } else {
        await sock.sendMessage(msg.key.remoteJid, { image: img, caption: text }, { quoted: msg });
      }
      return "image";
    }
  } catch (_) {}
  await replyFn(text);
  return "text";
}

export function fmtDriver(d) {
  const full = `${d.name ?? "-"} ${d.surname ?? ""}`.trim();
  return (
    `🏎️ *${full}* (${d.shortName || "-"})\n` +
    `• ID: ${d.driverId}\n` +
    `• No: ${d.number ?? "-"} | Kebangsaan: ${d.nationality ?? "-"}\n` +
    `• Lahir: ${d.birthday ?? "-"}\n` +
    `• Wiki: ${d.url ?? "-"}`
  );
}
export function fmtTeam(t) {
  return (
    `🏁 *${t.teamName}* (\`${t.teamId}\`)\n` +
    `• Negara: ${t.teamNationality ?? t.country ?? "-"}\n` +
    `• Debut: ${t.firstAppeareance ?? t.firstAppareance ?? "-"}\n` +
    `• Gelar konstruktor: ${t.constructorsChampionships ?? "-"}\n` +
    `• Gelar pembalap: ${t.driversChampionships ?? "-"}\n` +
    `• Wiki: ${t.url ?? "-"}`
  );
}
export function fmtCircuit(c) {
  const len = typeof c.circuitLength === "number" ? `${c.circuitLength} m` : (c.circuitLength ?? "-");
  return (
    `🔄 *${c.circuitName}* (\`${c.circuitId}\`)\n` +
    `• ${c.city ?? "-"}, ${c.country ?? "-"}\n` +
    `• Panjang: ${len} | Tikungan: ${c.numberOfCorners ?? c.corners ?? "-"}\n` +
    `• Debut F1: ${c.firstParticipationYear ?? "-"}\n` +
    `• Rekor lap: ${c.lapRecord ?? "-"} (${c.fastestLapYear ?? "-"}, ${c.fastestLapDriverId ?? "-"} / ${c.fastestLapTeamId ?? "-"})\n` +
    `• Wiki: ${c.url ?? "-"}`
  );
}
export function fmtDriversStandings(data, limit = 10) {
  const arr = data?.drivers_championship || [];
  const lines = [`🏆 *Klasemen Pembalap ${data?.season ?? ""}*`];
  arr.slice(0, limit).forEach((r) => {
    const d = r.driver || {};
    lines.push(`${r.position}. ${d.name ?? ""} ${d.surname ?? ""} (${d.shortName ?? r.driverId}) — ${r.teamId} | ${r.points} pts | 🏅${r.wins ?? 0}`);
  });
  return lines.join("\n");
}
export function fmtConstructorsStandings(data, limit = 10) {
  const arr = data?.constructors_championship || [];
  const lines = [`🏆 *Klasemen Konstruktor ${data?.season ?? ""}*`];
  arr.slice(0, limit).forEach((r) => {
    lines.push(`${r.position}. ${r.team?.teamName ?? r.teamId} | ${r.points} pts | 🏅${r.wins ?? 0}`);
  });
  return lines.join("\n");
}
export function fmtRaceList(data, limit = 15) {
  const races = data?.races || [];
  const lines = [`🗓️ *Jadwal F1 ${data?.season ?? ""}* (${races.length} seri)`];
  races.slice(0, limit).forEach((r) => {
    const date = r.schedule?.race?.date || r.date || "-";
    lines.push(`R${r.round}. ${r.raceName} — ${date}`);
  });
  if (races.length > limit) lines.push(`_... dan ${races.length - limit} seri lainnya._`);
  return lines.join("\n");
}
export function fmtRaceDetail(data) {
  const r = (data?.race || [])[0];
  if (!r) return "Data balapan tidak ditemukan.";
  const s = r.schedule || {};
  const c = r.circuit || {};
  return (
    `🏁 *${r.raceName}* (R${r.round}, ${data?.season ?? ""})\n` +
    `• Sirkuit: ${c.circuitName ?? "-"} (${c.city ?? "-"}, ${c.country ?? "-"})\n` +
    `• Lap: ${r.laps ?? "-"} | Race: ${s.race?.date ?? "-"} ${s.race?.time ?? ""}\n` +
    `• Kualifikasi: ${s.qualy?.date ?? "-"} ${s.qualy?.time ?? ""}\n` +
    `• Pemenang: ${r.winner ? `${r.winner.name} ${r.winner.surname} (${r.winner.shortName ?? "-"})` : "-"}${r.teamWinner ? ` — ${r.teamWinner.teamName ?? r.teamWinner.teamId ?? ""}` : ""}\n` +
    `• Fastest lap: ${r.fast_lap?.fast_lap ?? "-"} (${r.fast_lap?.fast_lap_driver_id ?? "-"})`
  );
}
export function fmtSessionResults(data, limit = 10) {
  const info = data?.races || {};
  const results = info.results || info.qualyResults || info.fpResults || info.sprintResults || [];
  const title = info.raceName ? `*${info.raceName}* (R${info.round ?? "-"}, ${data?.season ?? ""})` : "*Hasil F1*";
  const lines = [`🏁 ${title}`];
  results.slice(0, limit).forEach((r) => {
    const d = r.driver || {};
    const name = `${d.name ?? ""} ${d.surname ?? ""}`.trim() || r.driverId || "-";
    if (r.q3 !== undefined || r.q1 !== undefined) {
      lines.push(`P${r.gridPosition ?? "-"} ${name} (${d.shortName ?? "-"}): Q1 ${r.q1 ?? "-"} | Q2 ${r.q2 ?? "-"} | Q3 ${r.q3 ?? "-"}`);
    } else {
      const pos = r.position ?? "-";
      const time = r.time ?? r.fastLap ?? (r.retired ? `DNF (${r.retired})` : "-");
      lines.push(`P${pos} ${name} (${d.shortName ?? "-"} | ${r.team?.teamId ?? r.teamId ?? "-"}) — ${r.points ?? 0} pts | ${time}`);
    }
  });
  if (results.length > limit) lines.push(`_... dan ${results.length - limit} hasil lainnya._`);
  return lines.join("\n");
}
