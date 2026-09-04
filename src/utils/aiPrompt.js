export const AI_SYSTEM_INSTRUCTION =
  "Instruksi: Jawab dengan ramah, jelas, to the point, dan rangkum HANYA dalam 1 paragraf singkat (maksimal 3-4 kalimat). Dilarang membuat poin-poin, list nomor, atau penjelasan yang bertele-tele.";

/**
 * Bungkus prompt pengguna dengan instruksi 1 paragraf ringkas
 * @param {string} userPrompt
 * @returns {string}
 */
export function formatLLMPrompt(userPrompt) {
  if (!userPrompt) return "";
  return `${AI_SYSTEM_INSTRUCTION}\n\nPertanyaan: ${userPrompt.trim()}`;
}
