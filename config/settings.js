import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "config", "config.json");

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn("[Config] Gagal membaca config.json, fallback aktif:", err.message);
  }
  return {};
}

const rawConfig = loadConfig();

export const settings = {
  botName: rawConfig.botName || "Rizzer Bot",
  ownerName: rawConfig.ownerName || "Pentagon",
  ownerNumber: rawConfig.ownerNumber || "6287847566690",
  pairingNumber: rawConfig.pairingNumber || "6287847566690",
  ownerNumbers: rawConfig.ownerNumbers || [],
  premiumNumbers: rawConfig.premiumNumbers || [],
  adminNumbers: rawConfig.adminNumbers || [],
  usePairingCode: rawConfig.usePairingCode ?? true,

  public: rawConfig.public ?? true,
  maintenance: rawConfig.maintenance ?? false,
  maintenanceMessage: rawConfig.maintenanceMessage || "[!] Bot sedang maintenance. Coba lagi nanti.",
  prefix: rawConfig.prefix || ".",

  publicCommands: rawConfig.publicCommands || ["sewa", "owner", "ping", "uptime", "menu", "help", "panduan"],

  silentDeny: rawConfig.silentDeny ?? false,

  autoRead: rawConfig.autoRead ?? false,
  autoOnline: rawConfig.autoOnline ?? true,
  cooldownTime: rawConfig.cooldownTime || 0,
  responseDelay: rawConfig.responseDelay || 0,

  antiBotLuar: rawConfig.antiBotLuar ?? true,
  botNumbers: rawConfig.botNumbers || [],
  antiVirtex: rawConfig.antiVirtex ?? true,
  maxMessageLength: rawConfig.maxMessageLength || 5000,
  antiBurst: rawConfig.antiBurst ?? true,
  antilinkExtra: rawConfig.antilinkExtra ?? true,

  stickerPackName: rawConfig.stickerPackName || "Rizzer Bot Stickers",
  stickerAuthor: rawConfig.stickerAuthor || "Rizzer Bot [Private]",
  image: rawConfig.image || "assets/image/banner.png",
  linkTitle: rawConfig.linkTitle || "Rizzer Bot",
  linkBody: rawConfig.linkBody || "Simple & Clean WhatsApp Bot",
  linkUrl: rawConfig.linkUrl || "https://whatsapp.com/",
  linkImage: rawConfig.linkImage || "assets/image/banner.png",

  channelJid: rawConfig.channelJid || "",
  channelName: rawConfig.channelName || "Official Channel",
  autoForwardTrxToChannel: rawConfig.autoForwardTrxToChannel ?? false,

  siswaApiUrl:
    rawConfig.siswaApiUrl ||
    "https://script.google.com/macros/s/AKfycbzFd_CjY2y6jnle9hmlp71nyxy8mscur2tWF8gz773-IthSVkKF3v3Px3viPhPcA4U2mw/exec",

  qrisString: rawConfig.qrisPayload || rawConfig.qrisString || "",
  qrisMerchantName: rawConfig.qrisMerchantName || "Rizzer Cloud",
  qrisCity: rawConfig.qrisCity || "JAKARTA BARAT",
};
