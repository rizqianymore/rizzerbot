import { request } from "@/src/utils/request.js";

const GITHUB_API = "https://api.github.com/users";
const GH_TTL_MS = 60 * 60 * 1000;
const ghCache = new Map();

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

export function parseGithubUser(rawInput) {
  const raw = String(rawInput || "")
    .trim()
    .replace(/^@/, "");
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

async function scrapeGithubProfile(username) {
  try {
    const html = await request.text(`https://github.com/${encodeURIComponent(username)}`, {
      timeout: 15000,
      headers: { Accept: "text/html" },
    });
    if (!html || typeof html !== "string") return null;
    if (html.includes("404") && html.includes("This is not the web page you are looking for")) return { notFound: true };
    // basic existence check: look for meta property og:title or profile
    if (html.toLowerCase().includes("not found") && html.length < 5000) {
      // heuristic, try also check title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && /not found/i.test(titleMatch[1])) return { notFound: true };
    }
    const extract = (re) => {
      const m = html.match(re);
      return m ? m[1].trim().replace(/\s+/g, " ").slice(0, 200) : "-";
    };
    const name = extract(/<span[^>]*class="[^"]*p-name[^"]*"[^>]*>([^<]+)<\/span>/i) || username;
    const bio = extract(/<div[^>]*class="[^"]*p-note[^"]*"[^>]*>([\s\S]*?)<\/div>/i).replace(/<[^>]+>/g, " ").trim() || "-";
    const followers = extract(/<span[^>]*class="[^"]*text-bold[^"]*"[^>]*>(\d[\d,.]*)<\/span>\s*followers/i) || "-";
    const following = extract(/<span[^>]*class="[^"]*text-bold[^"]*"[^>]*>(\d[\d,.]*)<\/span>\s*following/i) || "-";
    const reposMatch = html.match(/<span[^>]*data-view-component[^>]*>(\d+)<\/span>\s*repositories/i);
    const detail = {
      username,
      name: name || username,
      bio: bio || "-",
      company: "-",
      location: "-",
      email: "-",
      blog: "-",
      twitter: "-",
      followers: followers === "-" ? "-" : followers,
      following: following === "-" ? "-" : following,
      repos: reposMatch ? reposMatch[1] : "-",
      gists: "-",
      created: "-",
      updated: "-",
      avatar: `https://github.com/${username}.png`,
      url: `https://github.com/${username}`,
      _free: true,
    };
    cacheSet(username.toLowerCase(), detail);
    return detail;
  } catch {
    return null;
  }
}

export async function getGithubProfile(username) {
  const user = String(username || "")
    .trim()
    .replace(/^@/, "");
  const cached = cacheGet(user.toLowerCase());
  if (cached) return cached;

  try {
    const headers = { Accept: "application/vnd.github+json" };
    const token = String(process.env.GITHUB_TOKEN || "").trim();
    if (token) headers.Authorization = `Bearer ${token}`;
    const d = await request.json(`${GITHUB_API}/${encodeURIComponent(user)}`, {
      headers,
      timeout: 10000,
    });
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
  } catch (err) {
    if (/HTTP 404\b/.test(err?.message || "")) return { notFound: true };
    if (/HTTP 403\b/.test(err?.message || "") || /HTTP 429\b/.test(err?.message || "") || /limit/i.test(err?.message || "")) {
      // fallback scraping free (tanpa token)
      const scraped = await scrapeGithubProfile(user);
      if (scraped) {
        if (scraped.notFound) return { notFound: true };
        return scraped;
      }
      throw new Error("limit API GitHub habis (60/jam) — coba lagi nanti atau isi GITHUB_TOKEN gratis");
    }
    throw err;
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

export async function getGithubInfoText(input) {
  const parsed = parseGithubUser(input);
  if (!parsed.valid) return { error: parsed.reason };
  const detail = await getGithubProfile(parsed.username);
  if (detail?.notFound) return { error: `User "${parsed.username}" tidak ditemukan di GitHub.` };
  return { text: formatGithubInfo(detail) };
}
