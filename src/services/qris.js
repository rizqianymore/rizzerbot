import QRCode from "qrcode";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { db } from "@/src/core/database.js";

/** Map of known EMVCo / QRIS tag IDs to human-readable names */
const TAG_NAMES = {
  "00": "Payload Format Indicator",
  "01": "Point of Initiation Method",
  "02": "Visa",
  "03": "Mastercard",
  "04": "Mastercard",
  "15": "Visa",
  "26": "Merchant Account Information",
  "27": "Merchant Account Information",
  "28": "Merchant Account Information",
  "29": "Merchant Account Information",
  "30": "Merchant Account Information",
  "31": "Merchant Account Information",
  "32": "Merchant Account Information",
  "33": "Merchant Account Information",
  "34": "Merchant Account Information",
  "35": "Merchant Account Information",
  "36": "Merchant Account Information",
  "37": "Merchant Account Information",
  "38": "Merchant Account Information",
  "39": "Merchant Account Information",
  "40": "Merchant Account Information",
  "41": "Merchant Account Information",
  "42": "Merchant Account Information",
  "43": "Merchant Account Information",
  "44": "Merchant Account Information",
  "45": "Merchant Account Information",
  "46": "Merchant Account Information",
  "47": "Merchant Account Information",
  "48": "Merchant Account Information",
  "49": "Merchant Account Information",
  "50": "Merchant Account Information",
  "51": "Merchant Account Information",
  "52": "Merchant Category Code",
  "53": "Transaction Currency",
  "54": "Transaction Amount",
  "55": "Tip or Convenience Indicator",
  "56": "Value of Convenience Fee (Fixed)",
  "57": "Value of Convenience Fee (%)",
  "58": "Country Code",
  "59": "Merchant Name",
  "60": "Merchant City",
  "61": "Postal Code",
  "62": "Additional Data Field",
  "63": "CRC",
};

const NESTED_TAGS = new Set([
  ...Array.from({ length: 26 }, (_, i) => String(i + 26).padStart(2, "0")),
  "62",
]);

/**
 * Calculate CRC16-CCITT checksum for QRIS/EMVCo QR codes.
 * Polynomial: 0x1021, Init: 0xFFFF
 */
export function calculateCRC16(str) {
  let crc = 0xffff;

  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Parse raw TLV string into array of TLV elements
 */
export function parseTLV(data) {
  const elements = [];
  let pos = 0;

  while (pos < data.length) {
    if (pos + 4 > data.length) break;

    const tag = data.substring(pos, pos + 2);
    const length = parseInt(data.substring(pos + 2, pos + 4), 10);

    if (isNaN(length) || pos + 4 + length > data.length) break;

    const value = data.substring(pos + 4, pos + 4 + length);
    const name = TAG_NAMES[tag] ?? `Unknown (${tag})`;

    const element = { tag, name, length, value };

    if (NESTED_TAGS.has(tag)) {
      element.children = parseTLV(value);
    }

    elements.push(element);
    pos += 4 + length;
  }

  return elements;
}

/**
 * Parse QRIS string into structured metadata
 */
export function parseQRIS(qrisString) {
  const raw = parseTLV(qrisString);
  const findTag = (tag) => raw.find((t) => t.tag === tag);

  const methodValue = findTag("01")?.value;
  const method = methodValue === "12" ? "dynamic" : "static";

  const tipIndicatorValue = findTag("55")?.value;
  let tipIndicator;
  if (tipIndicatorValue === "01") tipIndicator = "prompt";
  else if (tipIndicatorValue === "02") tipIndicator = "fixed";
  else if (tipIndicatorValue === "03") tipIndicator = "percentage";

  const merchantAccountInfo = raw
    .filter((t) => {
      const tagNum = parseInt(t.tag, 10);
      return tagNum >= 26 && tagNum <= 51 && t.children;
    })
    .map((t) => {
      const children = t.children ?? [];
      const findChild = (childTag) => children.find((c) => c.tag === childTag);

      return {
        tag: t.tag,
        globallyUniqueId: findChild("00")?.value ?? "",
        merchantId: findChild("01")?.value ?? findChild("02")?.value,
        merchantCriteria: findChild("03")?.value,
        fields: children,
      };
    });

  return {
    version: findTag("00")?.value ?? "01",
    method,
    merchantAccountInfo,
    merchantCategoryCode: findTag("52")?.value ?? "",
    currency: findTag("53")?.value ?? "360",
    amount: findTag("54")?.value,
    tipIndicator,
    tipFixed: findTag("56")?.value,
    tipPercentage: findTag("57")?.value,
    countryCode: findTag("58")?.value ?? "ID",
    merchantName: findTag("59")?.value ?? "",
    merchantCity: findTag("60")?.value ?? "",
    postalCode: findTag("61")?.value ?? "",
    additionalData: findTag("62")?.children,
    crc: findTag("63")?.value ?? "",
    raw,
  };
}

/**
 * Validate a QRIS string structure and CRC16
 */
export function validateQRIS(qrisString) {
  const errors = [];
  if (!qrisString || typeof qrisString !== "string" || !qrisString.trim()) {
    return { valid: false, errors: ["String QRIS kosong"] };
  }

  const str = qrisString.trim();
  if (!str.startsWith("000201")) {
    errors.push('QRIS harus dimulai dengan format indikator "000201"');
  }

  if (str.length < 20) {
    errors.push("Panjang string QRIS terlalu pendek");
    return { valid: false, errors };
  }

  const dataWithoutCRC = str.substring(0, str.length - 4);
  const declaredCRC = str.substring(str.length - 4);
  const calculatedCRC = calculateCRC16(dataWithoutCRC);

  if (declaredCRC.toUpperCase() !== calculatedCRC) {
    errors.push(`CRC tidak sesuai: terbaca ${declaredCRC.toUpperCase()}, kalkulasi ${calculatedCRC}`);
  }

  const elements = parseTLV(str);
  if (elements.length === 0) {
    errors.push("Gagal membaca struktur elemen TLV");
    return { valid: false, errors };
  }

  const tags = new Set(elements.map((e) => e.tag));
  const requiredTags = ["00", "01", "52", "53", "58", "59", "60", "63"];

  for (const req of requiredTags) {
    if (!tags.has(req)) {
      errors.push(`Tag wajib ${req} tidak ditemukan`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function buildTLVString(elements) {
  return elements
    .map((el) => {
      const value = el.children ? buildTLVString(el.children) : el.value;
      const length = value.length.toString().padStart(2, "0");
      return `${el.tag}${length}${value}`;
    })
    .join("");
}

function makeTLV(tag, value, name = "") {
  return { tag, name, length: value.length, value };
}

/**
 * Convert static QRIS string to dynamic with specified amount and optional fee
 * Follows verssache/qris-dinamis logic
 */
export function convertQRIS(qrisString, { amount, fee = null } = {}) {
  const elements = parseTLV(qrisString);
  const result = [];
  let amountInserted = false;

  const managedTags = new Set(["54", "55", "56", "57", "63"]);

  for (const el of elements) {
    if (managedTags.has(el.tag)) continue;

    if (el.tag === "01") {
      // Ubah static (11) ke dynamic (12)
      result.push(makeTLV("01", "12", "Point of Initiation Method"));
      continue;
    }

    // Sisipkan amount & fee sebelum tag 58 (Country Code)
    if (el.tag === "58" && !amountInserted) {
      const amountStr = Math.round(Number(amount)).toString();
      result.push(makeTLV("54", amountStr, "Transaction Amount"));

      if (fee && fee.value > 0) {
        if (fee.type === "fixed") {
          result.push(makeTLV("55", "02", "Tip or Convenience Indicator"));
          result.push(makeTLV("56", Math.round(fee.value).toString(), "Value of Convenience Fee (Fixed)"));
        } else {
          result.push(makeTLV("55", "03", "Tip or Convenience Indicator"));
          result.push(makeTLV("57", fee.value.toString(), "Value of Convenience Fee (%)"));
        }
      }

      amountInserted = true;
    }

    result.push(el);
  }

  const withoutCRC = buildTLVString(result);
  const crcInput = withoutCRC + "6304";
  const crc = calculateCRC16(crcInput);

  return crcInput + crc;
}

/**
 * Get active QRIS string from database or fallback to settings
 */
export function getActiveQrisString() {
  const settings = db.getSettings();
  return (
    settings.qrisString ||
    "00020101021126570011ID.DANA.WWW011893600915303511630202090351163020303UMI51440014ID.CO.QRIS.WWW0215ID10265955012340303UMI5204899953033605802ID5912Rizzer Cloud6013JAKARTA BARAT610511850630425C2"
  );
}

/**
 * Generate high-aesthetic QRIS Payment Card (PNG Buffer)
 */
export async function generateQrisCard({
  qrisPayload,
  amount = 0,
  merchantName = "Rizzer Cloud",
  merchantCity = "JAKARTA BARAT",
  fee = 0,
  expiredMinutes = 15,
}) {
  // 1. Generate QR Code image buffer with high quality
  const qrImageBuffer = await QRCode.toBuffer(qrisPayload, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  const qrImage = await loadImage(qrImageBuffer);

  // 2. Setup Canvas
  const width = 640;
  const height = 900;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background - Dark Modern FinTech Glassmorphism
  ctx.fillStyle = "#0c1017";
  ctx.fillRect(0, 0, width, height);

  // Radial glowing top background
  const radialGlow = ctx.createRadialGradient(width / 2, 70, 20, width / 2, 70, 320);
  radialGlow.addColorStop(0, "rgba(239, 68, 68, 0.2)");
  radialGlow.addColorStop(1, "rgba(12, 16, 23, 0)");
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, height);

  // Main Card Wrapper
  const cardX = 30;
  const cardY = 30;
  const cardW = width - 60;
  const cardH = height - 60;
  const radius = 24;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = "#161c26";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#2b3442";
  ctx.stroke();
  ctx.restore();

  // QRIS Standard Header Banner (Red / National Standard Accent)
  const headerH = 76;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, headerH, [radius, radius, 0, 0]);
  ctx.fillStyle = "#b91c1c";
  ctx.fill();
  ctx.restore();

  // QRIS Logo Text in Header
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("QRIS", width / 2, cardY + 45);

  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = "#fecaca";
  ctx.fillText("QUICK RESPONSE CODE INDONESIAN STANDARD", width / 2, cardY + 63);

  // Merchant Information
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(merchantName.toUpperCase(), width / 2, cardY + 115);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px sans-serif";
  ctx.fillText(`NMID / Kota: ${merchantCity}`, width / 2, cardY + 138);

  // QR Box Container (White clean card)
  const qrBoxSize = 340;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = cardY + 155;
  const qrRadius = 18;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, qrRadius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#e2e8f0";
  ctx.stroke();
  ctx.restore();

  // Draw QR Inside
  const qrPadding = 16;
  ctx.drawImage(
    qrImage,
    qrBoxX + qrPadding,
    qrBoxY + qrPadding,
    qrBoxSize - qrPadding * 2,
    qrBoxSize - qrPadding * 2
  );

  // Center QRIS Badge Icon in middle of QR
  const centerSize = 46;
  const centerX = (width - centerSize) / 2;
  const centerY = qrBoxY + (qrBoxSize - centerSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(centerX, centerY, centerSize, centerSize, 8);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ef4444";
  ctx.stroke();

  ctx.fillStyle = "#ef4444";
  ctx.textAlign = "center";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("QRIS", width / 2, centerY + 28);
  ctx.restore();

  // Price Container Box
  const priceBoxY = qrBoxY + qrBoxSize + 22;
  const priceBoxH = 82;
  const priceBoxW = cardW - 48;
  const priceBoxX = cardX + 24;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(priceBoxX, priceBoxY, priceBoxW, priceBoxH, 14);
  ctx.fillStyle = "#0f172a";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#334155";
  ctx.stroke();
  ctx.restore();

  if (amount > 0) {
    const formattedAmount = "Rp " + Math.round(amount).toLocaleString("id-ID");
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("TOTAL NOMINAL PEMBAYARAN", width / 2, priceBoxY + 28);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(formattedAmount, width / 2, priceBoxY + 62);
  } else {
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("TIPE PEMBAYARAN", width / 2, priceBoxY + 28);

    ctx.fillStyle = "#10b981";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("QRIS STATIS (Bebas Input)", width / 2, priceBoxY + 60);
  }

  // Supported Banks & E-Wallets badge
  const bankY = priceBoxY + priceBoxH + 28;
  ctx.textAlign = "center";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "13px sans-serif";
  ctx.fillText("DANA • BCA • MANDIRI • BRI • BNI • OVO • GOPAY • SHOPEEPAY", width / 2, bankY);

  // Footer notes & expiry
  ctx.fillStyle = "#64748b";
  ctx.font = "11px sans-serif";
  const expText =
    amount > 0
      ? `Scan dengan aplikasi m-Banking atau E-Wallet apa saja. Berlaku ${expiredMinutes} menit.`
      : "Scan dengan aplikasi pembayaran apa saja dan masukkan nominal manual.";
  ctx.fillText(expText, width / 2, cardY + cardH - 18);

  return canvas.toBuffer("image/png");
}
