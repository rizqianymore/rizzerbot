import crypto from "crypto";
import { request } from "@/src/utils/request.js";

const BASE = "https://www.virustotal.com/api/v3";
const POLL_INTERVAL_MS = 15000;
const POLL_MAX = 8;

export function hasVtKey() {
  return Boolean(String(process.env.VT_API_KEY || "").trim());
}

function apiKey() {
  const key = String(process.env.VT_API_KEY || "").trim();
  if (!key) {
    throw new Error("VT_API_KEY belum diisi. Daftar gratis di https://www.virustotal.com/ lalu isi key di .env");
  }
  return key;
}

// ============ FREE MODE (scraping, tanpa API key) ============
async function checkUrlHaus(targetUrl) {
  try {
    const data = await request.post("https://urlhaus-api.abuse.ch/v1/url/", `url=${encodeURIComponent(targetUrl)}`, {
      timeout: 15000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      responseType: "json",
    });
    if (data?.query_status === "ok") {
      return {
        malicious: true,
        threat: data.threat || data.url_status || "malicious",
        tags: data.tags || [],
        reference: data.urlhaus_reference || "",
        raw: data,
      };
    }
    if (data?.query_status === "no_results") return { malicious: false };
    return null;
  } catch {
    return null;
  }
}

async function checkUrlScan(targetUrl) {
  try {
    let host = targetUrl;
    try { host = new URL(targetUrl).hostname; } catch {}
    const data = await request.json(`https://urlscan.io/api/v1/search/?q=domain:${encodeURIComponent(host)}`, {
      timeout: 15000,
    });
    const results = Array.isArray(data?.results) ? data.results : [];
    // cari exact url match
    const exact = results.find((r) => r?.page?.url === targetUrl || r?.page?.url?.includes(targetUrl));
    const verdict = exact?.verdicts?.overall?.malicious === true || exact?.verdicts?.overall?.score > 0;
    return { found: results.length > 0, malicious: verdict, count: results.length, raw: exact || null };
  } catch {
    return null;
  }
}

async function checkPhishTankFree(targetUrl) {
  try {
    // PhishTank free check via urlhaus fallback: coba GET phishtank search page (scraping)
    const html = await request.text(`https://checkurl.phishtank.com/checkurl/index.php?url=${encodeURIComponent(targetUrl)}`, {
      timeout: 15000,
    });
    if (typeof html === "string" && /phish/i.test(html) && /verified/i.test(html)) {
      return { maybePhish: html.toLowerCase().includes("phish") };
    }
    return null;
  } catch {
    return null;
  }
}

export async function scanUrlFree(targetUrl) {
  let url = String(targetUrl || "").trim();
  if (!url) throw new Error("URL kosong.");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const [haus, scan] = await Promise.all([checkUrlHaus(url), checkUrlScan(url)]);

  let malicious = 0;
  let suspicious = 0;
  let harmless = 0;
  let undetected = 0;
  const detections = [];

  if (haus?.malicious) {
    malicious += 1;
    detections.push(`URLHaus (${haus.threat})`);
    if (haus.tags?.length) detections.push(`tags: ${haus.tags.slice(0, 3).join(", ")}`);
  } else if (haus && !haus.malicious) {
    harmless += 1;
  }

  if (scan?.malicious) {
    malicious += 1;
    detections.push(`urlscan.io (verdict malicious)`);
  } else if (scan?.found) {
    harmless += 1;
  }

  // heuristic: jika tidak ada yang flag tapi pernah ada di urlscan -> anggap undetected
  if (!haus && !scan) {
    undetected = 1;
  } else if (malicious === 0 && suspicious === 0) {
    harmless = Math.max(harmless, 1);
    undetected = 0;
  }

  const isClean = malicious === 0 && suspicious === 0;
  // minimal 1 harmless jika clean
  if (isClean && harmless === 0) harmless = 1;

  return {
    url,
    free: true,
    stats: { malicious, suspicious, harmless, undetected },
    results: Object.fromEntries(detections.map((d, i) => [`free-${i}`, { category: "malicious", result: d }])),
    detections,
    sources: {
      urlhaus: haus,
      urlscan: scan,
    },
  };
}

async function checkMalwareBazaar(hash) {
  try {
    const data = await request.post("https://mb-api.abuse.ch/api/v1/", `query=get_info&hash=${encodeURIComponent(hash)}`, {
      timeout: 15000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      responseType: "json",
    });
    if (data?.query_status === "ok" && Array.isArray(data.data) && data.data.length > 0) {
      const info = data.data[0];
      return {
        found: true,
        malicious: true,
        signature: info.signature || info.file_name || "malware",
        tags: info.tags || [],
        raw: info,
      };
    }
    if (data?.query_status === "hash_not_found" || data?.query_status === "no_results") return { found: false, malicious: false };
    return null;
  } catch {
    return null;
  }
}

async function checkHashLookup(hash) {
  try {
    const data = await request.json(`https://hashlookup.circl.lu/lookup/sha256/${encodeURIComponent(hash)}`, {
      timeout: 15000,
    });
    if (data?.hash) return { found: true, raw: data };
    return { found: false };
  } catch (e) {
    // 404 = not found
    if (String(e?.message || "").includes("404")) return { found: false };
    return null;
  }
}

async function checkVtGuiFree(hash) {
  try {
    // Coba scrape VT GUI tanpa key: https://www.virustotal.com/gui/file/<hash>/detection (butuh browser)
    // fallback ke ui search endpoint yang kadang terbuka tanpa key
    const data = await request.json(`https://www.virustotal.com/ui/files/${encodeURIComponent(hash)}`, {
      timeout: 15000,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (data?.data?.attributes?.last_analysis_stats) {
      const s = data.data.attributes.last_analysis_stats;
      return { found: true, stats: s, results: data.data.attributes.last_analysis_results, raw: data };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fileReportFree(buffer, fileName = "file") {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Buffer file kosong.");
  const hash = sha256(buffer);
  const [mb, hl, vtGui] = await Promise.all([checkMalwareBazaar(hash), checkHashLookup(hash), checkVtGuiFree(hash)]);

  if (vtGui?.found) {
    // VT GUI berhasil tanpa key -> pakai stats asli
    return {
      hash,
      fileName,
      free: true,
      known: true,
      stats: vtGui.stats || { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 },
      results: vtGui.results || {},
      detections: ["VirusTotal GUI (free scrape)"],
      sources: { vtGui, mb, hl },
    };
  }

  if (mb?.found && mb.malicious) {
    return {
      hash,
      fileName,
      free: true,
      known: true,
      stats: { malicious: 1, suspicious: 0, harmless: 0, undetected: 0 },
      results: { "MalwareBazaar": { category: "malicious", result: mb.signature } },
      detections: [`MalwareBazaar: ${mb.signature} [${(mb.tags || []).slice(0, 3).join(", ")}]`],
      sources: { mb, hl },
    };
  }

  // jika hashlookup found tapi tidak malicious -> anggap known harmless
  if (hl?.found) {
    return {
      hash,
      fileName,
      free: true,
      known: true,
      stats: { malicious: 0, suspicious: 0, harmless: 1, undetected: 0 },
      results: {},
      detections: [],
      sources: { hl, mb },
    };
  }

  // tidak ditemukan di free DB -> unknown (mungkin clean, perlu scan manual)
  return {
    hash,
    fileName,
    free: true,
    known: false,
    stats: { malicious: 0, suspicious: 0, harmless: 0, undetected: 1 },
    results: {},
    detections: [],
    sources: { mb, hl },
  };
}

async function vtFetch(path, { method = "GET", body, contentType } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "x-apikey": apiKey(),
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body,
    signal: AbortSignal.timeout(30000),
  });
  if (res.status === 401) throw new Error("VT_API_KEY salah/kedaluwarsa (401).");
  if (res.status === 429) throw new Error("Limit VirusTotal tercapai (429, key gratis: 4/menit). Coba lagi nanti.");
  if (res.status === 404) {
    const err = new Error("Tidak ditemukan di database VirusTotal (404).");
    err.code = 404;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`VirusTotal HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json();
}

async function pollAnalysis(analysisId) {
  let last = null;
  for (let i = 0; i < POLL_MAX; i++) {
    const data = await vtFetch(`/analyses/${analysisId}`);
    last = data?.data?.attributes;
    if (last?.status === "completed") return last;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Analisis belum selesai setelah ${(POLL_INTERVAL_MS * POLL_MAX) / 1000} detik. Cek manual di virustotal.com`
  );
}

export function summarizeStats(stats = {}) {
  const malicious = Number(stats.malicious) || 0;
  const suspicious = Number(stats.suspicious) || 0;
  const harmless = Number(stats.harmless) || 0;
  const undetected = Number(stats.undetected) || 0;
  return { malicious, suspicious, harmless, undetected, clean: malicious === 0 && suspicious === 0 };
}

export function topDetections(results = {}, limit = 5) {
  const out = [];
  for (const [engine, r] of Object.entries(results)) {
    if (r?.category === "malicious" || r?.category === "suspicious") {
      out.push(`${engine} (${r.result || r.category})`);
    }
    if (out.length >= limit) break;
  }
  return out;
}

export async function scanUrl(targetUrl) {
  let url = String(targetUrl || "").trim();
  if (!url) throw new Error("URL kosong.");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const form = new URLSearchParams({ url });
  const submitted = await vtFetch("/urls", {
    method: "POST",
    body: form.toString(),
    contentType: "application/x-www-form-urlencoded",
  });
  const analysisId = submitted?.data?.id;
  if (!analysisId) throw new Error("Gagal submit URL ke VirusTotal.");
  const analysis = await pollAnalysis(analysisId);
  return { url, stats: analysis?.stats || {}, results: analysis?.results || {} };
}

export function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function fileReport(buffer, fileName = "file") {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Buffer file kosong.");
  if (buffer.length > 100 * 1024 * 1024) throw new Error("File >100 MB, melebihi batas scan.");
  const hash = sha256(buffer);

  try {
    const known = await vtFetch(`/files/${hash}`);
    const attrs = known?.data?.attributes || {};
    return {
      hash,
      fileName,
      known: true,
      stats: attrs.last_analysis_stats || {},
      results: attrs.last_analysis_results || {},
      names: attrs.names || [],
    };
  } catch (err) {
    if (err?.code !== 404) throw err;
  }

  let uploadUrl = `${BASE}/files`;
  if (buffer.length > 32 * 1024 * 1024) {
    const u = await vtFetch("/files/upload_url");
    if (!u?.data) throw new Error("Gagal meminta upload URL.");
    uploadUrl = u.data;
  }
  const boundary = `----rizzerbot${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${String(fileName).replace(/"/g, "")}"\r\nContent-Type: application/octet-stream\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "x-apikey": apiKey(), "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat([head, buffer, tail]),
    signal: AbortSignal.timeout(120000),
  });
  if (res.status === 401) throw new Error("VT_API_KEY salah/kedaluwarsa (401).");
  if (res.status === 429) throw new Error("Limit VirusTotal tercapai (429). Coba lagi nanti.");
  if (!res.ok) throw new Error(`Upload gagal (HTTP ${res.status}).`);
  const uploaded = await res.json();
  const analysisId = uploaded?.data?.id;
  if (!analysisId) throw new Error("Gagal upload file ke VirusTotal.");
  const analysis = await pollAnalysis(analysisId);
  const fresh = await vtFetch(`/files/${hash}`).catch(() => null);
  const attrs = fresh?.data?.attributes || {};
  return {
    hash,
    fileName,
    known: false,
    stats: analysis?.stats || attrs.last_analysis_stats || {},
    results: analysis?.results || attrs.last_analysis_results || {},
    names: attrs.names || [],
  };
}

export function formatVerdict(title, { stats, results, extra = [] }) {
  const s = summarizeStats(stats);
  const head = s.clean ? "BERSIH" : "BERBAHAYA";
  const lines = [`*VIRUSTOTAL: ${head}*`, ``, `• Target: ${title}`, ...extra];
  lines.push(`• Malicious: ${s.malicious} | Suspicious: ${s.suspicious}`);
  lines.push(`• Harmless: ${s.harmless} | Undetected: ${s.undetected}`);
  if (!s.clean) {
    const tops = topDetections(results);
    if (tops.length) {
      lines.push(``, `Terdeteksi oleh:`, ...tops.map((t) => `  - ${t}`));
    }
  }
  return lines.join("\n");
}
