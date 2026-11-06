/**
 * GSMA Reporting Body Identifier (RBI)
 * Dua digit pertama IMEI menentukan badan akreditasi yang mengalokasikan TAC.
 */
export const GSMA_RBI = {
  "01": "CTIA (Amerika Serikat / Global)",
  "30": "Iridium (Komunikasi Satelit Global)",
  "33": "DGPT (Prancis / Eropa)",
  "35": "BABT (Inggris Raya / Eropa / Global)",
  "44": "BABT (Inggris Raya)",
  "45": "NTA (Denmark)",
  "49": "BZT (Jerman)",
  "50": "BIPT (Belgia)",
  "51": "KBA (Inggris)",
  "52": "Mediatel (Republik Ceko)",
  "53": "TUV (Jerman)",
  "54": "Telkom (Afrika Selatan)",
  "86": "TAF (China / Telekomunikasi Asia)",
  "91": "MSAI (India)",
  "98": "BABT (Multi-mode GSM/CDMA)",
  "99": "TIA (CDMA Global)",
};

/**
 * Mapping TAC prefix 4-8 digit untuk merek dan model populer
 */
export const TAC_DATABASE = {
  // Apple
  "3520": { brand: "Apple", model: "iPhone Series (11/12/13/14)" },
  "3530": { brand: "Apple", model: "iPhone Series (SE/X/XR/XS)" },
  "3533": { brand: "Apple", model: "iPhone Series (8/8 Plus)" },
  "3538": { brand: "Apple", model: "iPhone 11 Pro / Pro Max" },
  "3544": { brand: "Apple", model: "iPhone 12 Pro / Pro Max" },
  "3550": { brand: "Apple", model: "iPhone 13 Pro / Pro Max" },
  "3560": { brand: "Apple", model: "iPhone 14 Pro / Pro Max" },
  "3570": { brand: "Apple", model: "iPhone 15 Series" },
  "3580": { brand: "Apple", model: "iPhone 16 Series" },
  "0124": { brand: "Apple", model: "iPhone Series (US Model)" },
  "0134": { brand: "Apple", model: "iPhone Series (US Model)" },

  // Samsung
  "3590": { brand: "Samsung", model: "Galaxy A/M Series" },
  "3592": { brand: "Samsung", model: "Galaxy S Series" },
  "3594": { brand: "Samsung", model: "Galaxy Z Fold / Z Flip" },
  "3584": { brand: "Samsung", model: "Galaxy Note / Ultra Series" },
  "3565": { brand: "Samsung", model: "Galaxy Tab / Smart Device" },

  // Xiaomi / POCO / Redmi
  "8600": { brand: "Xiaomi", model: "Redmi / POCO Series" },
  "8626": { brand: "Xiaomi", model: "Mi / Xiaomi Flagship Series" },
  "8652": { brand: "Xiaomi", model: "Redmi Note Series" },

  // BBK Group (Oppo, Vivo, Realme, OnePlus)
  "8610": { brand: "Oppo", model: "Oppo A / Reno Series" },
  "8615": { brand: "Oppo", model: "Oppo Find Series" },
  "8620": { brand: "Vivo", model: "Vivo Y / V Series" },
  "8625": { brand: "Vivo", model: "Vivo X Flagship Series" },
  "8630": { brand: "Realme", model: "Realme Number / C Series" },
  "8635": { brand: "Realme", model: "Realme GT Series" },
  "8670": { brand: "OnePlus", model: "OnePlus Series" },

  // Transsion (Infinix, Tecno, Itel)
  "8650": { brand: "Transsion (Infinix/Tecno/Itel)", model: "Infinix Hot / Note Series" },
  "8655": { brand: "Transsion (Infinix/Tecno/Itel)", model: "Tecno Pova / Camon Series" },
  "8658": { brand: "Transsion (Infinix/Tecno/Itel)", model: "Itel Series" },

  // Huawei / Honor
  "8640": { brand: "Huawei", model: "Huawei Nova / Mate Series" },
  "8645": { brand: "Honor", model: "Honor Magic / X Series" },

  // Google Pixel
  "3577": { brand: "Google", model: "Pixel Series (Pixel 6/7/8/9)" },
  "3578": { brand: "Google", model: "Pixel Pro Series" },

  // Motorola / Lenovo
  "3517": { brand: "Motorola", model: "Moto G / Edge Series" },
  "8680": { brand: "Lenovo", model: "Lenovo Legion / Tab" },
};

/**
 * Validasi Check Digit IMEI menggunakan Algoritma Luhn (Modulus 10)
 */
export function validateLuhn(imeiStr) {
  if (imeiStr.length < 14) return { valid: false, expected: null };
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = parseInt(imeiStr[i], 10);
    if (i % 2 !== 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  const actualCheckDigit = parseInt(imeiStr[14], 10);
  return {
    valid: expectedCheckDigit === actualCheckDigit,
    expected: expectedCheckDigit,
    actual: actualCheckDigit,
  };
}

/**
 * Parse nomor IMEI lengkap secara forensik & OSINT
 */
export function parseImei(rawImei) {
  const clean = String(rawImei || "").replace(/[^0-9]/g, "");
  if (!clean) {
    return { valid: false, reason: "Nomor IMEI tidak boleh kosong." };
  }

  if (clean.length !== 15 && clean.length !== 14) {
    return {
      valid: false,
      reason: `Panjang IMEI tidak sesuai (${clean.length} digit). Standar IMEI adalah 15 digit (atau 14 digit tanpa check digit).`,
    };
  }

  const tac = clean.slice(0, 8);
  const rbi = clean.slice(0, 2);
  const serialNumber = clean.slice(8, 14);
  const checkDigit = clean.length === 15 ? clean.slice(14, 15) : null;

  const luhn = clean.length === 15 ? validateLuhn(clean) : null;

  // Lookup Manufacturer & Model dari TAC
  let identified = null;
  for (const len of [8, 6, 4]) {
    const subTac = tac.slice(0, len);
    if (TAC_DATABASE[subTac]) {
      identified = TAC_DATABASE[subTac];
      break;
    }
  }

  const reportingBody = GSMA_RBI[rbi] || `GSMA Allocated Body (${rbi})`;

  return {
    valid: true,
    imei: clean,
    tac,
    reportingBody,
    serialNumber,
    checkDigit,
    luhnValid: luhn ? luhn.valid : null,
    expectedCheckDigit: luhn ? luhn.expected : null,
    brand: identified?.brand || "Belum Terpetakan / Merek Lain",
    model: identified?.model || "Perangkat GSM/LTE/5G Global",
    imeiFormatted: `${tac.slice(0, 2)}-${tac.slice(2, 8)}-${serialNumber}-${checkDigit || "X"}`,
    beacukaiCheckUrl: "https://www.beacukai.go.id/register-imei.html",
    kemenperinCheckUrl: "https://imei.kemenperin.go.id/",
  };
}
