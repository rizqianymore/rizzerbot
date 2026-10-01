// src/services/githubstalk.js — stalk profil GitHub via API publik (gratis, tanpa key).
// GET https://api.github.com/users/{username} (limit 60 req/jam tanpa token).

const GITHUB_API = "https://api.github.com/users";
const GH_TTL_MS = 60 * 60 * 1000;
const ghCache = new Map(); // username -> { data, expires }

function cacheGet(key) {
  const hit = ghCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  ghCache.delete(key);
  return null;
}

function cacheSet(key, data) {
  ghCache.set(key, { data, expires: Date.now() + GH_TTL_MS });
  if (ghCache.size > 200) {
    const firstKey = ghCache.keys().next().value;
    ghCache.delete(firstKey);
  }
}

/**
 * Validasi username GitHub: alfanumerik/hyphen, maks 39 char,
 * tidak boleh diawali/diakhiri hyphen.
 */
export function parseGithubUser(rawInput) {
  const raw = String(rawInput || "").trim().replace(/^@/, "");
  if (!raw) return { valid: false, reason: "input kosong. Contoh: .githubstalk torvalds" };
  if (raw.length > 39) return { valid: false, reason: "username maksimal 39 karakter" };
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(raw)) {
    return { valid: false, reason: "format username salah. Contoh: .githubstalk torvalds" };
  }
  return { valid: true, kind: "github", username: raw };
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** Ambil profil. Return object detail atau { notFound: true } / throw saat rate-limit. */
export async function getGithubProfile(username) {
  const user = String(username || "").trim().replace(/^@/, "");
  const cached = cacheGet(user.toLowerCase());
  if (cached) return cached;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${GITHUB_API}/${encodeURIComponent(user)}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "rizzerbot/1.0" },
      signal: ctrl.signal,
    });
    if (res.status === 404) return { notFound: true };
    if (res.status === 403) throw new Error("limit API GitHub habis (60/jam), coba lagi nanti");
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
    const d = await res.json();
    const neat = (v) => {
      const s = String(v ?? "").trim();
      return s || "-";
    };
    const detail = {
      username: neat(d.login),
      name: neat(d.name),
      bio: neat(d.bio),
      company: neat(d.company),
      location: neat(d.location),
      email: neat(d.email),
      blog: neat(d.blog),
      twitter: neat(d.twitter_username),
      followers: Number(d.followers ?? 0).toLocaleString("id-ID"),
      following: Number(d.following ?? 0).toLocaleString("id-ID"),
      repos: Number(d.public_repos ?? 0).toLocaleString("id-ID"),
      gists: Number(d.public_gists ?? 0).toLocaleString("id-ID"),
      created: fmtDate(d.created_at),
      updated: fmtDate(d.updated_at),
      avatar: neat(d.avatar_url),
      url: neat(d.html_url),
    };
    cacheSet(user.toLowerCase(), detail);
    return detail;
  } finally {
    clearTimeout(timer);
  }
}

export function formatGithubInfo(p) {
  const lines = [];
  lines.push(`*INFO GITHUB*`);
  lines.push(`User: ${p.username}`);
  lines.push(`Nama: ${p.name}`);
  lines.push(`Bio: ${p.bio}`);
  lines.push(`Perusahaan: ${p.company}`);
  lines.push(`Lokasi: ${p.location}`);
  lines.push(`Email: ${p.email}`);
  lines.push(`Blog: ${p.blog}`);
  lines.push(`Twitter: ${p.twitter}`);
  lines.push(`Followers: ${p.followers} | Following: ${p.following}`);
  lines.push(`Repo Publik: ${p.repos} | Gist: ${p.gists}`);
  lines.push(`Dibuat: ${p.created}`);
  lines.push(`Update: ${p.updated}`);
  lines.push(`Link: ${p.url}`);
  return lines.join("\n");
}

/** Satu panggilan async untuk plugin: validasi + fetch + format. */
export async function getGithubInfoText(input) {
  const parsed = parseGithubUser(input);
  if (!parsed.valid) return { error: parsed.reason };
  const detail = await getGithubProfile(parsed.username);
  if (detail?.notFound) return { error: `User "${parsed.username}" tidak ditemukan di GitHub.` };
  return { text: formatGithubInfo(detail) };
}
