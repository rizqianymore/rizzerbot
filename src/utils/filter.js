/**
 * Filter komprehensif kata-kata jorok, kata kasar eksplisit, konten pornografi / 18+
 * Berlaku secara global untuk SEMUA plugins & commands di bot.
 */

export const BANNED_PATTERNS = [
  // 1. Pornografi, Seksual Eksplisit & Slang 18+ Berat (Indonesia, English, Japanese slang)
  /\b(?:bokep|porn|porno|pornografi|hentai|ecchi|sex|seks|ngentot|ngewe|kontol|memek|pepek|itil|jembut|tetek|toket|coli|colmek|crot|vagina|penis|bugil|telanjang|lonte|perek|open\s*bo|bispak|jav|masturbasi|cum|creampie|blowjob|deepthroat|dildo|sange|horny|bokepjepang|bokepindo|pornhub|xnxx|xvideos|nude|nudes|boobs|tits|pussy|dick|cock|milf|hentaihaven|rule34)\b/i,

  // 2. Makian Jorok Ekstrem / Pelecehan
  /\b(?:pantek|puki|pukimak|pecun|jablay)\b/i,
];

/**
 * Memeriksa apakah teks atau array teks mengandung kata jorok / 18+
 * @param {string|string[]} textOrArray
 * @returns {{ isViolation: boolean, matchedWord?: string }}
 */
export function checkProfanity(textOrArray) {
  if (!textOrArray) return { isViolation: false };

  let text = "";
  if (Array.isArray(textOrArray)) {
    text = textOrArray.join(" ");
  } else if (typeof textOrArray === "string") {
    text = textOrArray;
  } else {
    return { isViolation: false };
  }

  // Normalisasi teks (bersihkan simbol, angka pengganti huruf seperti k0nt0l / b0k3p)
  let normalized = text
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/@/g, "a")
    .replace(/[._\-+*#$!?:;,"'/\\]/g, " ")
    .replace(/\s+/g, " ");

  for (const pattern of BANNED_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      return {
        isViolation: true,
        matchedWord: match[0].trim(),
      };
    }
  }

  return { isViolation: false };
}
