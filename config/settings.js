export const settings = {
  botName: "Rizzer Bot",
  ownerName: "Pentagon",
  ownerNumber: "6287847566690",
  pairingNumber: "6287847566690",
  ownerNumbers: [],
  premiumNumbers: [],
  adminNumbers: [],
  usePairingCode: true,

  public: true,
  maintenance: false,
  maintenanceMessage: "[!] Bot sedang maintenance. Coba lagi nanti.",
  prefix: ".",
  publicCommands: ["sewa", "owner", "ping", "uptime", "menu", "help", "panduan"],
  silentDeny: false,
  autoRead: false,
  autoOnline: true,
  cooldownTime: 0,
  responseDelay: 0,

  antiBotLuar: true,
  botNumbers: [],
  antiVirtex: true,
  maxMessageLength: 5000,
  antiBurst: true,
  antilinkExtra: true,

  stickerPackName: "Rizzer Bot Stickers",
  stickerAuthor: "Rizzer Bot [Private]",
  image: "assets/image/banner.png",
  linkTitle: "Rizzer Bot",
  linkBody: "Simple & Clean WhatsApp Bot",
  linkUrl: "https://whatsapp.com/",
  linkImage: "assets/image/banner.png",

  channelJid: "",
  channelName: "Official Channel",
  autoForwardTrxToChannel: false,

  siswaApiUrl:
    "https://script.google.com/macros/s/AKfycbzFd_CjY2y6jnle9hmlp71nyxy8mscur2tWF8gz773-IthSVkKF3v3Px3viPhPcA4U2mw/exec",

  qrisPayload:
    "00020101021126570011ID.DANA.WWW011893600915303511630202090351163020303UMI51440014ID.CO.QRIS.WWW0215ID10265955012340303UMI5204899953033605802ID5912Rizzer Cloud6013JAKARTA BARAT610511850630425C2",
  qrisString:
    "00020101021126570011ID.DANA.WWW011893600915303511630202090351163020303UMI51440014ID.CO.QRIS.WWW0215ID10265955012340303UMI5204899953033605802ID5912Rizzer Cloud6013JAKARTA BARAT610511850630425C2",
  qrisMerchantName: "Rizzer Cloud",
  qrisCity: "JAKARTA BARAT",

  env: {
    GEMINI_API_KEY: "",
    GEMINI_MODEL: "gemini-2.0-flash",
    DEEPSEEK_API_KEY: "",
    DEEPSEEK_COOKIE_TOKEN: "",
    GROQ_API_KEY: "",
    OPENROUTER_API_KEY: "",
    OPENCODE_API_KEY: "",
    CEREBRAS_API_KEY: "",
    MISTRAL_API_KEY: "",
    GITHUB_TOKEN: "",
    NVIDIA_API_KEY: "",
    OCRSPACE_API_KEY: "",
    VT_API_KEY: "",

    BRIGHTDATA_ENABLED: "1",
    BRIGHTDATA_CUSTOMER: "hl_66a04297",
    BRIGHTDATA_COUNTRY: "",
    BRIGHTDATA_FIRST_HOSTS: "",

    BRIGHTDATA_API_KEY: "",
    BRIGHTDATA_ZONE: "web_unlocker2",

    BRIGHTDATA_PROXY_ZONE: "web_unlocker2",
    BRIGHTDATA_PROXY_PASSWORD: "g3rcwgbqusu6",
    BRIGHTDATA_PROXY: "",
    BRIGHTDATA_PROXY_HOST: "brd.superproxy.io",
    BRIGHTDATA_PROXY_PORT: "44445",

    BRIGHTDATA_ISP_ZONE: "isp_proxy1",
    BRIGHTDATA_ISP_PASSWORD: "g0rh6l0cvv2w",

    BRIGHTDATA_SCRAPING_BROWSER_ENABLED: "1",
    BRIGHTDATA_SCRAPING_BROWSER_ZONE: "scraping_browser1",
    BRIGHTDATA_SCRAPING_BROWSER_PASSWORD: "",
    BRIGHTDATA_SCRAPING_BROWSER_WS: "",

    BRIGHTDATA_DATASET_API_KEY: "",

    ALLOW_EVAL: "true",
    SLOW_CMD_MS: "3000",
    COMMAND_TIMEOUT_MS: "30000",
    PUPPETEER_EXECUTABLE_PATH: "",
  },
};

if (settings.env && typeof settings.env === "object") {
  for (const [key, value] of Object.entries(settings.env)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      process.env[key] = String(value);
    }
  }
}
