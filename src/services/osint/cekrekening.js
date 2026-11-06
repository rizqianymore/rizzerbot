/**
 * Format Bank & E-Wallet di Indonesia
 */
export const BANK_CODES = {
  bca: { name: "Bank Central Asia (BCA)", code: "014", digits: "10" },
  bri: { name: "Bank Rakyat Indonesia (BRI)", code: "002", digits: "15" },
  mandiri: { name: "Bank Mandiri", code: "008", digits: "13" },
  bni: { name: "Bank Negara Indonesia (BNI)", code: "009", digits: "10" },
  cimb: { name: "CIMB Niaga", code: "022", digits: "13" },
  permata: { name: "Bank Permata", code: "013", digits: "10" },
  danamon: { name: "Bank Danamon", code: "011", digits: "10" },
  bsi: { name: "Bank Syariah Indonesia (BSI)", code: "451", digits: "10" },
  btn: { name: "Bank Tabungan Negara (BTN)", code: "200", digits: "16" },
  jago: { name: "Bank Jago", code: "542", digits: "12" },
  seabank: { name: "SeaBank", code: "535", digits: "12" },
  dana: { name: "DANA", code: "e-wallet", digits: "10-13" },
  gopay: { name: "GoPay", code: "e-wallet", digits: "10-13" },
  ovo: { name: "OVO", code: "e-wallet", digits: "10-13" },
  shopeepay: { name: "ShopeePay", code: "e-wallet", digits: "10-13" },
  linkaja: { name: "LinkAja", code: "e-wallet", digits: "10-13" },
};

/**
 * Normalisasi dan deteksi kemungkinan Bank / E-Wallet
 */
export function detectBank(rawQuery) {
  const q = String(rawQuery || "").toLowerCase();
  for (const [key, val] of Object.entries(BANK_CODES)) {
    if (q.includes(key) || q.includes(val.name.toLowerCase())) {
      return { key, ...val };
    }
  }
  return null;
}

/**
 * Cek nomor rekening / e-wallet penipu menggunakan scraping via Bright Data Web Unlocker
 * Fallback ke portal resmi pengaduan
 * @param {string} accountNo 
 * @param {string} [bankName]
 * @returns {Promise<object>}
 */
export async function checkRekening(accountNo, bankName = "") {
  const cleanAccount = String(accountNo || "").replace(/[^0-9]/g, "");
  if (!cleanAccount || cleanAccount.length < 5 || cleanAccount.length > 25) {
    return {
      valid: false,
      reason: "Nomor rekening atau e-wallet harus berupa 5-25 digit angka.",
    };
  }

  const detected = detectBank(bankName);
  const targetUrl = `https://kredibel.com/cari/rekening/${cleanAccount}`;

  let scraped = false;
  let reports = 0;
  let status = "Belum Ada Riwayat Laporan";
  let details = {};

  try {
    const { isBrightDataEnabled, brightDataRequest } = await import("@/src/services/network/brightdata.js");
    if (isBrightDataEnabled()) {
      const html = await brightDataRequest(targetUrl, {
        format: "raw",
        timeout: 30000,
      });

      if (typeof html === "string" && html.length > 200 && !html.includes("Just a moment...")) {
        scraped = true;
        // Parse laporan fraud
        const reportMatch = html.match(/(\d+)\s*(?:laporan|keluhan|kasus)/i);
        if (reportMatch) {
          reports = parseInt(reportMatch[1], 10);
        }

        if (html.includes("Berpotensi Penipuan") || html.includes("Pernah Dilaporkan") || reports > 0) {
          status = "🚨 BERPOTENSI PENIPUAN (Pernah Dilaporkan)";
        } else if (html.includes("Belum Pernah Dilaporkan") || html.includes("Terverifikasi")) {
          status = "✅ Belum Pernah Dilaporkan / Bersih";
        }
      }
    }
  } catch (_) {}

  return {
    valid: true,
    account: cleanAccount,
    bank: detected?.name || bankName || "Semua Bank / E-Wallet",
    scraped,
    reports,
    status,
    details,
    kredibelUrl: `https://kredibel.com/cari/rekening/${cleanAccount}`,
    cekrekeningUrl: "https://cekrekening.id/",
  };
}
