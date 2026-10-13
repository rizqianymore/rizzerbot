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

export function sortCategoryKeys(keys) {
  return [...keys].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a) === -1 ? 99 : CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b) === -1 ? 99 : CATEGORY_ORDER.indexOf(b);
    return ia - ib;
  });
}

export function resolveCategoryAlias(raw) {
  if (!raw) return null;
  return CATEGORY_ALIASES[raw.toLowerCase()] || null;
}
