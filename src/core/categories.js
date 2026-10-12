// Urutan tampil kategori pada menu & daftar plugin.
// Dipakai bersama oleh plugins/menu.js dan plugins/tools/util/listplugins.js
export const CATEGORY_ORDER = [
  "Bug",
  "News",
  "Social Media",
  "AI",
  "Sticker",
  "Tools",
  "Group",
  "User",
  "Premium",
  "Owner",
  "Sports",
  "Stalker",
  "OSINT",
  "General",
];

// Alias input user -> kategori resmi (lowercase).
export const CATEGORY_ALIASES = {
  bug: "Bug",
  bugs: "Bug",
  exploit: "Bug",
  news: "News",
  berita: "News",
  "social media": "Social Media",
  socialmedia: "Social Media",
  socmed: "Social Media",
  sosmed: "Social Media",
  ai: "AI",
  sticker: "Sticker",
  stiker: "Sticker",
  tools: "Tools",
  tool: "Tools",
  alat: "Tools",
  group: "Group",
  grup: "Group",
  grub: "Group",
  gc: "Group",
  user: "User",
  usr: "User",
  pengguna: "User",
  premium: "Premium",
  prem: "Premium",
  pro: "Premium",
  owner: "Owner",
  own: "Owner",
  creator: "Owner",
  general: "General",
  sports: "Sports",
  sport: "Sports",
  stalker: "Stalker",
  stalk: "Stalker",
  osint: "OSINT",
  recon: "OSINT",
  intel: "OSINT",
};

/**
 * Kembalikan daftar key kategori terurut sesuai CATEGORY_ORDER.
 * Kategori tak dikenal diletakkan di akhir (prioritas 99).
 */
export function sortCategoryKeys(keys) {
  return [...keys].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a) === -1 ? 99 : CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b) === -1 ? 99 : CATEGORY_ORDER.indexOf(b);
    return ia - ib;
  });
}

/**
 * Resolve nama kategori dari input user (case-insensitive).
 * Mengembalikan null bila tidak dikenal.
 */
export function resolveCategoryAlias(raw) {
  if (!raw) return null;
  return CATEGORY_ALIASES[raw.toLowerCase()] || null;
}
