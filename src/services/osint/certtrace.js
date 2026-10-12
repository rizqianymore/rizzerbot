// Certificate Transparency lookup via crt.sh (gratis, tanpa API key).
// Menemukan subdomain + riwayat sertifikat sebuah domain.

const CRT_BASE = "https://crt.sh/";
const OTX_BASE = "https://otx.alienvault.com/api/v1/indicators/domain/";
const HT_BASE = "https://api.hackertarget.com/hostsearch/?q=";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function cleanDomain(input) {
  let d = String(input || "").trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "").split("/")[0].split("?")[0].split("#")[0].split("@").pop();
  d = d.replace(/^\*\./, "").replace(/:\d+$/, "").replace(/\.+$/, "");
  return d;
}

export function isValidDomain(domain) {
  if (!domain || domain.length > 253) return false;
  return /^(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain);
}

function splitNames(nameValue) {
  return String(nameValue || "")
    .split("\n")
    .map((s) => s.trim().toLowerCase().replace(/^\*\./, ""))
    .filter(Boolean);
}

function shortIssuer(issuerName) {
  const m = String(issuerName || "").match(/O=([^,]+)/);
  return (m ? m[1] : issuerName || "-").trim().slice(0, 40) || "-";
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function certStatus(notAfter) {
  const ms = new Date(notAfter).getTime() - Date.now();
  if (isNaN(ms)) return "❓";
  if (ms < 0) return "⛔ kedaluwarsa";
  if (ms < 30 * 86400000) return "⚠️ <30 hari";
  return "✅ aktif";
}

async function fetchCrtSh(domain) {
  const url = `${CRT_BASE}?q=%25.${encodeURIComponent(domain)}&output=json`;

  let res = null;
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(25000),
    });
    lastStatus = res.status;
    if (res.ok) break;
    if (![429, 502, 503].includes(res.status) || attempt === 3) break;
    await new Promise((r) => setTimeout(r, 2500 * attempt));
    res = null;
  }
  if (!res || !res.ok) {
    throw new Error(`crt.sh HTTP ${lastStatus || "gagal terhubung"}`);
  }

  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows)) throw new Error("Respons crt.sh tidak valid");
  return rows;
}

async function fetchOtx(domain) {
  const res = await fetch(`${OTX_BASE}${encodeURIComponent(domain)}/passive_dns`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`OTX HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  const records = data?.passive_dns;
  if (!Array.isArray(records)) throw new Error("Respons OTX tidak valid");
  return records.map((r) => r.hostname).filter(Boolean);
}

async function fetchHackerTarget(domain) {
  const res = await fetch(`${HT_BASE}${encodeURIComponent(domain)}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Hackertarget HTTP ${res.status}`);
  const text = await res.text();
  if (/error|no records|limit/i.test(text.slice(0, 200))) throw new Error("Hackertarget tanpa hasil");
  return text.split("\n").map((line) => line.split(",")[0].trim().toLowerCase()).filter(Boolean);
}

export async function searchCerts(input) {
  const domain = cleanDomain(input);
  if (!isValidDomain(domain)) {
    throw new Error("Format domain tidak valid (contoh: example.com)");
  }

  const subSet = new Set();
  let rows = [];
  let latest = null;
  const issuers = new Map();
  const sources = [];

  try {
    rows = await fetchCrtSh(domain);
    sources.push("crt.sh");
  } catch (_) {
    rows = [];
  }

  if (!rows.length) {
    const settled = await Promise.allSettled([fetchOtx(domain), fetchHackerTarget(domain)]);
    for (const s of settled) {
      if (s.status === "fulfilled") {
        for (const n of s.value) subSet.add(n.replace(/^\*\./, ""));
      }
    }
    if (subSet.size) sources.push("OTX/Hackertarget");
  }

  for (const r of rows) {
    for (const n of splitNames(r.name_value)) {
      if (n === domain || n.endsWith(`.${domain}`)) subSet.add(n);
    }
    const issuer = shortIssuer(r.issuer_name);
    issuers.set(issuer, (issuers.get(issuer) || 0) + 1);
    if (!latest || new Date(r.entry_timestamp) > new Date(latest.entry_timestamp)) {
      latest = r;
    }
  }

  if (!subSet.size && !rows.length) {
    throw new Error(
      `Tidak ada data untuk *${domain}* (crt.sh sedang limit, coba lagi beberapa saat)`
    );
  }
  if (!subSet.size) subSet.add(domain);

  return {
    domain,
    totalCerts: rows.length,
    subdomains: [...subSet].sort(),
    issuers: [...issuers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    latest: latest
      ? {
          commonName: latest.common_name || "-",
          issuer: shortIssuer(latest.issuer_name),
          notBefore: latest.not_before,
          notAfter: latest.not_after,
          status: certStatus(latest.not_after),
        }
      : null,
    sources,
  };
}

export async function getCertTraceText(input) {
  const r = await searchCerts(input);
  const shown = r.subdomains.slice(0, 30);

  const lines = [
    `🔒 *CERTIFICATE TRANSPARENCY*`,
    `Domain: \`${r.domain}\``,
    `Sumber: ${r.sources.join(" + ") || "-"}`,
    `Sertifikat tercatat: *${r.totalCerts}*`,
    `Subdomain unik: *${r.subdomains.length}*`,
    ``,
    `*Subdomain ditemukan:*`,
    ...shown.map((s, i) => `${i + 1}. \`${s}\``),
  ];

  if (r.subdomains.length > shown.length) {
    lines.push(`_...dan ${r.subdomains.length - shown.length} lainnya._`);
  }

  if (r.issuers.length) {
    lines.push(``, `*Penerbit teratas:*`);
    r.issuers.forEach(([name, count]) => lines.push(`• ${name} (${count})`));
  }

  if (r.latest) {
    lines.push(
      ``,
      `*Sertifikat terbaru:*`,
      `CN: \`${r.latest.commonName}\``,
      `Issuer: ${r.latest.issuer}`,
      `Berlaku: ${fmtDate(r.latest.notBefore)} → ${fmtDate(r.latest.notAfter)}`,
      `Status: ${r.latest.status}`
    );
  }

  return lines.join("\n");
}
