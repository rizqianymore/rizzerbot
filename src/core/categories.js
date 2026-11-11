export const CATEGORY_ORDER = [
  "AI",
  "Social Media",
  "Downloader & Media",
  "Tools",
  "Tools & Media",
  "Stalk",
  "Sticker",
  "Group",
  "User",
  "Premium",
  "Owner",
  "Bug",
  "General",
  "OSINT",
  "Store",
];

export const CATEGORY_ALIASES = {
  ai: "AI",
  "artificial intelligence": "AI",
  chatgpt: "AI",
  gpt: "AI",
  "social media": "Social Media",
  socialmedia: "Social Media",
  socmed: "Social Media",
  sosmed: "Social Media",
  "downloader & media": "Downloader & Media",
  "downloader media": "Downloader & Media",
  downloadermedia: "Downloader & Media",
  downloader: "Downloader & Media",
  download: "Downloader & Media",
  media: "Downloader & Media",
  tools: "Tools",
  tool: "Tools",
  alat: "Tools",
  "tools & media": "Tools & Media",
  "tools and media": "Tools & Media",
  toolsmedia: "Tools & Media",
  toolmedia: "Tools & Media",
  stalk: "Stalk",
  stalking: "Stalk",
  stalker: "Stalk",
  sticker: "Sticker",
  stiker: "Sticker",
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
  bug: "Bug",
  bugs: "Bug",
  exploit: "Bug",
  general: "General",
  umum: "General",
  gen: "General",
  osint: "OSINT",
  os: "OSINT",
  sipil: "OSINT",
  store: "Store",
  toko: "Store",
  shop: "Store",
};

export function sortCategoryKeys(keys) {
  return [...keys].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a) === -1 ? 99 : CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b) === -1 ? 99 : CATEGORY_ORDER.indexOf(b);
    return ia - ib;
  });
}

export function resolveCategoryAlias(raw, existingCategories = []) {
  if (!raw || typeof raw !== "string") return null;
  const clean = raw.trim().toLowerCase();
  if (!clean) return null;

  if (CATEGORY_ALIASES[clean]) {
    return CATEGORY_ALIASES[clean];
  }

  const alphaOnly = clean.replace(/[^a-z0-9]/g, "");
  if (CATEGORY_ALIASES[alphaOnly]) {
    return CATEGORY_ALIASES[alphaOnly];
  }

  const candidatePool = new Set([
    ...CATEGORY_ORDER,
    ...(Array.isArray(existingCategories) ? existingCategories : []),
  ]);

  for (const cat of candidatePool) {
    if (!cat) continue;
    const catLower = cat.toLowerCase();
    const catAlpha = catLower.replace(/[^a-z0-9]/g, "");
    if (catLower === clean || catAlpha === alphaOnly) {
      return cat;
    }
  }

  return null;
}
