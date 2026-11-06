/**
 * Daftar Ekspedisi dan format deteksi nomor resi umum
 */
export const COURIERS = {
  jne: {
    name: "JNE Express",
    pattern: /^[0-9]{15,16}$|^JNE[0-9]{10,13}$/i,
    trackUrl: (resi) => `https://www.jne.co.id/id/tracking/trace/${resi}`,
  },
  jnt: {
    name: "J&T Express",
    aliases: ["j&t", "jnt express"],
    pattern: /^(JP|JX|JZ|JD|JS|JT)[0-9]{10,12}$/i,
    trackUrl: (resi) => `https://www.jet.co.id/track?awb=${resi}`,
  },
  sicepat: {
    name: "SiCepat Ekspres",
    aliases: ["sicepat express"],
    pattern: /^(00[0-9]{10}|[0-9]{12})$/,
    trackUrl: (resi) => `https://www.sicepat.com/checkAwb/${resi}`,
  },
  spx: {
    name: "Shopee Xpress (SPX)",
    aliases: ["shopee", "shopee express"],
    pattern: /^SPXID[0-9A-Z]{8,14}$/i,
    trackUrl: (resi) => `https://spx.co.id/track?awb=${resi}`,
  },
  anteraja: {
    name: "Anteraja",
    pattern: /^100[0-9]{11,13}$/,
    trackUrl: (resi) => `https://anteraja.id/tracking/${resi}`,
  },
  pos: {
    name: "Pos Indonesia",
    pattern: /^(POS|P)[0-9]{11,13}$|^[0-9]{11}$/,
    trackUrl: (resi) => `https://www.posindonesia.co.id/id/tracking/${resi}`,
  },
  lion: {
    name: "Lion Parcel",
    pattern: /^(LP|99)[0-9]{10,12}$/i,
    trackUrl: (resi) => `https://lionparcel.com/track/${resi}`,
  },
  tiki: {
    name: "TIKI",
    pattern: /^(66|03)[0-9]{10}$/,
    trackUrl: (resi) => `https://www.tiki.id/id/tracking/${resi}`,
  },
};

/**
 * Deteksi ekspedisi otomatis dari awb / input
 */
export function detectCourier(rawCourier = "", awb = "") {
  const c = String(rawCourier || "").trim().toLowerCase();
  if (c && COURIERS[c]) return { key: c, ...COURIERS[c] };

  if (c) {
    for (const [key, val] of Object.entries(COURIERS)) {
      if (c === key || val.name.toLowerCase().includes(c) || (val.aliases && val.aliases.includes(c))) {
        return { key, ...val };
      }
    }
  }

  // Cek pattern AWB jika kurir tidak dispesifikasikan
  const cleanAwb = String(awb || "").trim();
  for (const [key, val] of Object.entries(COURIERS)) {
    if (val.pattern && val.pattern.test(cleanAwb)) {
      return { key, ...val };
    }
  }

  return null;
}

/**
 * Lacak nomor resi paket dengan fallback web scraping via Bright Data
 * @param {string} awb
 * @param {string} [courierInput]
 * @returns {Promise<object>}
 */
export async function trackResi(awb, courierInput = "") {
  const cleanAwb = String(awb || "").trim().replace(/[^a-zA-Z0-9-]/g, "");
  if (!cleanAwb || cleanAwb.length < 6 || cleanAwb.length > 35) {
    return {
      valid: false,
      reason: "Nomor resi tidak valid (panjang minimal 6 - 35 karakter alfanumerik).",
    };
  }

  const detected = detectCourier(courierInput, cleanAwb);
  const courierKey = detected ? detected.key : "jne";
  const courierName = detected ? detected.name : (courierInput.toUpperCase() || "Ekspedisi Otomatis");

  // Portal agregator publik dengan Bright Data Unlocker
  const targetUrl = `https://cekresi.com/?noresi=${encodeURIComponent(cleanAwb)}`;

  let scraped = false;
  let status = "Menunggu Update / Dalam Pengiriman";
  let history = [];
  let sender = "-";
  let receiver = "-";

  try {
    const { isBrightDataEnabled, brightDataRequest } = await import("@/src/services/network/brightdata.js");
    if (isBrightDataEnabled()) {
      const html = await brightDataRequest(targetUrl, { format: "raw", timeout: 30000 });
      if (typeof html === "string" && html.length > 200 && !html.includes("Just a moment...")) {
        scraped = true;
        // Parsing status pengiriman
        const statusMatch = html.match(/<(?:td|span|div)[^>]*class="[^"]*status[^"]*"[^>]*>([^<]+)<\/(?:td|span|div)>/i) ||
                            html.match(/Status\s*:\s*<[^>]+>([^<]+)<\/[^>]+>/i);
        if (statusMatch) status = statusMatch[1].trim();

        // Riwayat transit
        const historyRegex = /<li[^>]*>\s*<span[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/span>\s*<div[^>]*>([^<]+)<\/div>/gi;
        let match;
        while ((match = historyRegex.exec(html)) !== null) {
          history.push({
            date: match[1].trim(),
            desc: match[2].trim(),
          });
          if (history.length >= 6) break;
        }
      }
    }
  } catch (_) {}

  return {
    valid: true,
    awb: cleanAwb,
    courier: courierName,
    status,
    scraped,
    sender,
    receiver,
    history,
    directTrackUrl: detected?.trackUrl ? detected.trackUrl(cleanAwb) : `https://cekresi.com/?noresi=${cleanAwb}`,
  };
}
