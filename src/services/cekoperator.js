// Mapping prefix nomor HP Indonesia ke operator (offline, tanpa API).
// Catatan: hasil berdasarkan alokasi prefix, bukan HLR live.
// Nomor portabilitas (pindah operator dengan nomor sama) tidak terdeteksi.

const PREFIXES = [
  // Telkomsel (kartuHalo, simPATI, Kartu As, by.U)
  { prefix: "0811", operator: "Telkomsel", brand: "kartuHalo" },
  { prefix: "0812", operator: "Telkomsel", brand: "simPATI" },
  { prefix: "0813", operator: "Telkomsel", brand: "simPATI" },
  { prefix: "0821", operator: "Telkomsel", brand: "simPATI" },
  { prefix: "0822", operator: "Telkomsel", brand: "simPATI" },
  { prefix: "0823", operator: "Telkomsel", brand: "Kartu As" },
  { prefix: "0851", operator: "Telkomsel", brand: "kartuHalo / by.U" },
  { prefix: "0852", operator: "Telkomsel", brand: "Kartu As" },
  { prefix: "0853", operator: "Telkomsel", brand: "Kartu As" },

  // Indosat Ooredoo Hutchison (IM3, Matrix, Mentari)
  { prefix: "0814", operator: "Indosat", brand: "Matrix / Mentari" },
  { prefix: "0815", operator: "Indosat", brand: "Matrix / Mentari" },
  { prefix: "0816", operator: "Indosat", brand: "Matrix / Mentari" },
  { prefix: "0855", operator: "Indosat", brand: "IM3" },
  { prefix: "0856", operator: "Indosat", brand: "IM3" },
  { prefix: "0857", operator: "Indosat", brand: "IM3" },
  { prefix: "0858", operator: "Indosat", brand: "IM3" },

  // XL Axiata (termasuk EXCELCOM lama)
  { prefix: "0817", operator: "XL Axiata", brand: "XL" },
  { prefix: "0818", operator: "XL Axiata", brand: "XL" },
  { prefix: "0819", operator: "XL Axiata", brand: "XL" },
  { prefix: "0859", operator: "XL Axiata", brand: "XL" },
  { prefix: "0877", operator: "XL Axiata", brand: "XL" },
  { prefix: "0878", operator: "XL Axiata", brand: "XL" },

  // AXIS (bagian dari XL Axiata)
  { prefix: "0831", operator: "AXIS", brand: "AXIS" },
  { prefix: "0832", operator: "AXIS", brand: "AXIS" },
  { prefix: "0833", operator: "AXIS", brand: "AXIS" },
  { prefix: "0838", operator: "AXIS", brand: "AXIS" },

  // Tri (3 / Hutchison)
  { prefix: "0895", operator: "Tri", brand: "3 (Tri)" },
  { prefix: "0896", operator: "Tri", brand: "3 (Tri)" },
  { prefix: "0897", operator: "Tri", brand: "3 (Tri)" },
  { prefix: "0898", operator: "Tri", brand: "3 (Tri)" },
  { prefix: "0899", operator: "Tri", brand: "3 (Tri)" },

  // Smartfren
  { prefix: "0881", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0882", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0883", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0884", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0885", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0886", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0887", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0888", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0889", operator: "Smartfren", brand: "Smartfren" },
];

// Urutkan dari prefix terpanjang agar longest-match menang.
const SORTED = [...PREFIXES].sort((a, b) => b.prefix.length - a.prefix.length);

export function normalizeNumber(input) {
  let n = String(input || "").trim().replace(/[\s\-().]/g, "");
  if (n.startsWith("+62")) n = "0" + n.slice(3);
  else if (n.startsWith("62")) n = "0" + n.slice(2);
  return n;
}

export function parseOperator(input) {
  const normalized = normalizeNumber(input);
  if (!/^08\d{7,12}$/.test(normalized)) {
    return { valid: false, reason: "format nomor tidak valid (contoh: 081212345678)", normalized };
  }
  const hit = SORTED.find((p) => normalized.startsWith(p.prefix));
  if (!hit) {
    return { valid: false, reason: `prefix ${normalized.slice(0, 4)} tidak dikenal`, normalized };
  }
  return {
    valid: true,
    normalized,
    prefix: hit.prefix,
    operator: hit.operator,
    brand: hit.brand,
  };
}

export function getOperatorInfoText(input) {
  const r = parseOperator(input);
  if (!r.valid) {
    return `❌ ${r.reason || "Nomor tidak valid."}`;
  }
  return (
    `📱 *INFO OPERATOR SELULER*\n` +
    `Nomor: \`${r.normalized}\`\n` +
    `Prefix: \`${r.prefix}*\`\n` +
    `Operator: *${r.operator}*\n` +
    `Kartu: *${r.brand}*\n\n` +
    `_Berdasarkan alokasi prefix, bukan data HLR live._`
  );
}
