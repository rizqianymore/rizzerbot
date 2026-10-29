export const CATEGORY_ORDER = [
  "Social Media",
  "Downloader & Media",
  "Tools",
  "Sticker",
  "Group",
  "User",
  "Premium",
  "Owner",
  "Bug",
  "General",
  "OSINT",
];

export const CATEGORY_ALIASES = {
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
  osint: "OSINT",
  os: "OSINT",
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
