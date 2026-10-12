export const DEVICE_PROFILES = [
  {
    name: "Windows 11 Chrome",
    type: "desktop",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
    viewport: { width: 1920, height: 1080, isMobile: false, hasTouch: false },
  },
  {
    name: "Windows 11 Edge",
    type: "desktop",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0",
    secChUa: '"Chromium";v="134", "Microsoft Edge";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
    viewport: { width: 1536, height: 864, isMobile: false, hasTouch: false },
  },
  {
    name: "macOS Sonoma Chrome",
    type: "desktop",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?0",
    secChUaPlatform: '"macOS"',
    viewport: { width: 1680, height: 1050, isMobile: false, hasTouch: false },
  },
  {
    name: "Samsung Galaxy S24 Ultra",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.39 Mobile Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?1",
    secChUaPlatform: '"Android"',
    viewport: { width: 412, height: 915, isMobile: true, hasTouch: true },
  },
  {
    name: "Google Pixel 8 Pro",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.39 Mobile Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?1",
    secChUaPlatform: '"Android"',
    viewport: { width: 412, height: 892, isMobile: true, hasTouch: true },
  },
  {
    name: "iPhone 16 Pro Max",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    secChUa: null,
    secChUaMobile: "?1",
    secChUaPlatform: '"iOS"',
    viewport: { width: 440, height: 956, isMobile: true, hasTouch: true },
  },
];

export const ACCEPT_LANGUAGES = [
  "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "id-ID,id;q=0.9,en;q=0.8",
  "en-US,en;q=0.9,id;q=0.8",
  "en-GB,en;q=0.9,en-US;q=0.8,id;q=0.7",
];

export function getRandomDevice(preferredType = "any") {
  let pool = DEVICE_PROFILES;
  if (preferredType === "mobile" || preferredType === "desktop") {
    pool = DEVICE_PROFILES.filter((d) => d.type === preferredType);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
