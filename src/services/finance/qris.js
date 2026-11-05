import QRCode from "qrcode";

export function crc16Ccitt(str) {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  let hex = (crc & 0xffff).toString(16).toUpperCase();
  while (hex.length < 4) hex = "0" + hex;
  return hex;
}

export function generateDynamicQris(staticQris, amount) {
  if (!staticQris || typeof staticQris !== "string") {
    throw new Error("Payload QRIS statis tidak valid.");
  }

  let qris = staticQris.trim();
  const crcIndex = qris.lastIndexOf("6304");
  if (crcIndex !== -1) {
    qris = qris.slice(0, crcIndex);
  }

  // Tag 01: 010211 (Statis) diubah jadi 010212 (Dinamis)
  qris = qris.replace("010211", "010212");

  // Tag 54: Transaction Amount
  const amountStr = String(Math.floor(Number(amount)));
  if (isNaN(amount) || Number(amount) < 1) {
    throw new Error("Nominal pembayaran minimal Rp 1.");
  }
  const amountTag = "54" + String(amountStr.length).padStart(2, "0") + amountStr;

  // Tag 58: Country Code (ID)
  const tag58Index = qris.indexOf("5802ID");
  if (tag58Index !== -1) {
    qris = qris.slice(0, tag58Index) + amountTag + qris.slice(tag58Index);
  } else {
    qris = qris + amountTag;
  }

  // Tambahkan Tag 6304 dan hitung CRC16
  const toChecksum = qris + "6304";
  const checksum = crc16Ccitt(toChecksum);
  const finalPayload = toChecksum + checksum;

  return finalPayload;
}

export async function createQrisBuffer(payload) {
  return await QRCode.toBuffer(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}
