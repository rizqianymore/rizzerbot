import { request } from "@/src/utils/request.js";

const PEJABAT_BASE = "https://pejabat.id";

export function normalizeQuery(query = "") {
  return String(query || "")
    .trim()
    .toLowerCase();
}

export function formatDprMember(member) {
  const fields = [
    ["Nama", member.nama || "-"],
    ["Jabatan", member.jabatan || "Anggota DPR RI"],
    ["Fraksi", member.fraksi || "-"],
    ["Dapil", member.dapil || "-"],
    ["Komisi/AKD", member.komisi || "-"],
  ];

  if (member.ttl) fields.push(["TTL", member.ttl]);
  if (member.pendidikan) fields.push(["Pendidikan", member.pendidikan]);
  if (member.periode) fields.push(["Periode", member.periode]);
  if (member.url) fields.push(["Sumber Data", member.url]);

  const lines = ["*PROFIL ANGGOTA DPR RI*"];
  fields.forEach(([label, val], idx) => {
    const isLast = idx === fields.length - 1;
    lines.push(`${isLast ? "└─" : "├─"} ${label.padEnd(12, " ")}: ${val}`);
  });

  return lines.join("\n");
}

export async function fetchPejabatDpr(query = "", { logger } = {}) {
  const targetUrl = `${PEJABAT_BASE}/dpr`;
  const cleanQ = normalizeQuery(query);

  let html = "";
  try {
    html = await request.text(targetUrl, {
      timeout: 25000,
      bypassCloudflare: "auto",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
  } catch (err) {
    logger?.warn?.(`[pejabat.id] Scrape langsung gagal: ${err.message}`);
  }

  if (!html || html.includes("Memastikan anda bukan BOT") || html.includes("challenge-platform")) {
    throw new Error(
      "Situs https://pejabat.id/dpr saat ini sedang membatasi akses bot dengan proteksi Cloudflare Turnstile/Bot Challenge."
    );
  }

  const members = [];
  const cardRegex = /<article[^>]*class=["'][^"']*dpr-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    const cardContent = match[1];
    const nameMatch = cardContent.match(/<h[234][^>]*>([^<]+)<\/h[234]>/i);
    const fraksiMatch = cardContent.match(/Fraksi\s*:?\s*([^<\n]+)/i);
    const dapilMatch = cardContent.match(/Dapil\s*:?\s*([^<\n]+)/i);
    const komisiMatch = cardContent.match(/Komisi\s*:?\s*([^<\n]+)/i);

    if (nameMatch) {
      members.push({
        nama: nameMatch[1].trim(),
        fraksi: fraksiMatch ? fraksiMatch[1].trim() : "-",
        dapil: dapilMatch ? dapilMatch[1].trim() : "-",
        komisi: komisiMatch ? komisiMatch[1].trim() : "-",
      });
    }
  }

  if (cleanQ) {
    return members.filter(
      (m) =>
        m.nama.toLowerCase().includes(cleanQ) ||
        m.fraksi.toLowerCase().includes(cleanQ) ||
        m.dapil.toLowerCase().includes(cleanQ)
    );
  }

  return members;
}
