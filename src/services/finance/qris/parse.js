import { parseTLV, calculateCRC16 } from "./tlv.js";

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
