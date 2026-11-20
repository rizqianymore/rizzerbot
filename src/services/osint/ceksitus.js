import axios from "axios";
import dns from "node:dns/promises";

const SUSPICIOUS_KEYWORDS = [
  "undian",
  "berhadiah",
  "klaim-saldo",
  "bansos",
  "prakerja",
  "dana-kaget",
  "login-bca",
  "bri-mo",
  "bni-mobile",
  "pulsa-gratis",
  "kuota-gratis",
  "crypto-profit",
  "investasi-pasti",
  "slot-gacor",
  "judol",
  "maxwin",
  "apk-undangan",
  "surat-tilang.apk",
  "paket-jne.apk",
];

const SUSPICIOUS_TLDS = [
  ".xyz",
  ".top",
  ".club",
  ".buzz",
  ".work",
  ".site",
  ".online",
  ".icu",
  ".fun",
  ".space",
  ".monster",
  ".fit",
  ".rest",
  ".tk",
  ".ml",
  ".cf",
  ".gq",
];

export async function analyzeWebsite(rawUrl) {
  let target = String(rawUrl || "").trim();
  if (!/^https?:\/\//i.test(target)) {
    target = `http://${target}`;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(target);
  } catch (_) {
    return { valid: false, reason: "Format URL / tautan tidak valid." };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!hostname || !hostname.includes(".")) {
    return { valid: false, reason: "Nama domain tidak valid." };
  }

  const riskFactors = [];
  let riskScore = 0;

  const hasSuspiciousTld = SUSPICIOUS_TLDS.some((tld) => hostname.endsWith(tld));
  if (hasSuspiciousTld) {
    riskScore += 25;
    riskFactors.push("Menggunakan TLD berisiko tinggi / murah yang sering disalahgunakan untuk scam");
  }

  const matchedKeywords = SUSPICIOUS_KEYWORDS.filter((kw) => hostname.includes(kw) || parsedUrl.pathname.includes(kw));
  if (matchedKeywords.length > 0) {
    riskScore += 35;
    riskFactors.push(`Terdapat kata kunci mencurigakan: ${matchedKeywords.join(", ")}`);
  }

  if (parsedUrl.pathname.toLowerCase().endsWith(".apk")) {
    riskScore += 40;
    riskFactors.push("Tautan mengarah langsung ke unduhan file .APK (Bahaya pencurian SMS/OTP/Sniffer)");
  }

  let ips = [];
  try {
    const resolved = await dns.lookup(hostname, { all: true });
    ips = resolved.map((r) => r.address);
  } catch (err) {

    riskFactors.push("Domain gagal di-resolve ke IP (Bisa jadi sudah di-takedown / belum aktif)");
  }

  let registrar = "-";
  let createdDate = "-";
  let ageDays = null;

  try {
    const tld = hostname.split(".").pop();
    let rdapUrl = `https://rdap.verisign.com/${tld}/v1/domain/${hostname}`;
    if (tld !== "com" && tld !== "net") {
      rdapUrl = `https://rdap.org/domain/${hostname}`;
    }

    const rdapRes = await axios.get(rdapUrl, { timeout: 6000 }).catch(() => null);
    if (rdapRes?.data) {
      const entities = rdapRes.data.entities || [];
      const registrarEntity = entities.find((e) => e.roles?.includes("registrar"));
      if (registrarEntity?.vcardArray?.[1]) {
        const fn = registrarEntity.vcardArray[1].find((item) => item[0] === "fn");
        if (fn) registrar = fn[3];
      }

      const events = rdapRes.data.events || [];
      const regEvent = events.find((e) => e.eventAction === "registration");
      if (regEvent?.eventDate) {
        createdDate = regEvent.eventDate.split("T")[0];
        const diffMs = Date.now() - new Date(regEvent.eventDate).getTime();
        ageDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (ageDays < 30) {
          riskScore += 30;
          riskFactors.push(`Domain tergolong SANGAT BARU (dibuat ${ageDays} hari lalu) — ciri khas situs penipuan.`);
        }
      }
    }
  } catch (_) {}

  let siteTitle = null;
  try {
    const { isBrightDataEnabled, brightDataRequest } = await import("@/src/services/network/brightdata.js");
    if (isBrightDataEnabled() && ips.length > 0) {
      const html = await brightDataRequest(parsedUrl.origin, { format: "raw", timeout: 20000 });
      if (typeof html === "string") {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) siteTitle = titleMatch[1].trim();
      }
    }
  } catch (_) {}

  let level = "AMAN (LOW RISK)";
  if (riskScore >= 60) {
    level = "🚨 SANGAT BERBAHAYA / TINGGI POTENSI PHISHING";
  } else if (riskScore >= 30) {
    level = "⚠️ WASPADA / POTENSI RISIKO SEDANG";
  }

  return {
    valid: true,
    url: target,
    hostname,
    protocol: parsedUrl.protocol.replace(":", ""),
    ips,
    registrar,
    createdDate,
    ageDays,
    siteTitle,
    riskScore: Math.min(riskScore, 100),
    level,
    riskFactors,
  };
}
