export const settings = {
  botName: process.env.BOT_NAME || "Rizzer Bot",
  ownerName: process.env.OWNER_NAME || "Pentagon",
  ownerNumber: process.env.OWNER_NUMBER || "",
  pairingNumber: process.env.PAIRING_NUMBER || "",
  ownerNumbers: [],
  premiumNumbers: [],
  adminNumbers: [],
  usePairingCode: true,

  public: true,
  maintenance: false,
  maintenanceMessage: "[!] Bot sedang maintenance. Coba lagi nanti.",
  prefix: process.env.PREFIX || ".",
  publicCommands: ["sewa", "owner", "ping", "uptime", "menu", "help", "panduan"],
  silentDeny: false,
  autoRead: false,
  autoOnline: true,
  cooldownTime: 0,
  responseDelay: 0,
  menuImage: true,

  antiBotLuar: true,
  botNumbers: [],
  antiVirtex: true,
  maxMessageLength: 5000,
  antiBurst: true,
  antilinkExtra: true,

  stickerPackName: process.env.STICKER_PACK_NAME || "Rizzer Bot Stickers",
  stickerAuthor: process.env.STICKER_AUTHOR || "Rizzer Bot [Private]",
  image: "assets/image/banner.png",
  linkTitle: "Rizzer Bot",
  linkBody: "Simple & Clean WhatsApp Bot",
  linkUrl: "https://whatsapp.com/",
  linkImage: "assets/image/banner.png",

  channelJid: process.env.CHANNEL_JID || "",
  channelName: process.env.CHANNEL_NAME || "Official Channel",
  autoForwardTrxToChannel: false,

  siswaApiUrl: process.env.SISWA_API_URL || "",
  qrisPayload: process.env.QRIS_PAYLOAD || "",
  qrisString: process.env.QRIS_PAYLOAD || "",
  qrisMerchantName: process.env.QRIS_MERCHANT_NAME || "Rizzer Cloud",
  qrisCity: process.env.QRIS_CITY || "JAKARTA",

  env: new Proxy(
    {},
    {
      get: (_, prop) => process.env[prop] || "",
      set: (_, prop, value) => {
        process.env[prop] = String(value);
        return true;
      },
      has: (_, prop) => prop in process.env,
    }
  ),
};
