import crypto from "crypto";

const BASE = "https://www.virustotal.com/api/v3";
const POLL_INTERVAL_MS = 15000;
const POLL_MAX = 8;

function apiKey() {
  const key = String(process.env.VT_API_KEY || "").trim();
  if (!key) {
    throw new Error("VT_API_KEY belum diisi. Daftar gratis di https://www.virustotal.com/ lalu isi key di .env");
  }
  return key;
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
