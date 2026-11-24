export default {
  name: "useragent",
  aliases: ["uaparse", "ua", "parseua"],
  description: "Bedah dan analisis informasi string User-Agent browser / perangkat",
  usage: "<user-agent string>",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const ua = args.join(" ").trim();

    if (!ua) {
      return reply(
        `┌── USER-AGENT PARSER\n` +
          `│ Ekstrak OS, Browser, Device, dan Engine dari User-Agent.\n` +
          `└──\n\n` +
          `Format: ${p}useragent <ua string>\n` +
          `Contoh: ${p}useragent Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36`
      );
    }

    let os = "Unknown OS";
    if (/windows nt 10/i.test(ua)) os = "Windows 10 / 11";
    else if (/windows nt 6\.3/i.test(ua)) os = "Windows 8.1";
    else if (/windows nt 6\.1/i.test(ua)) os = "Windows 7";
    else if (/android (\d+([._]\d+)*)/i.test(ua)) os = `Android ${RegExp.$1}`;
    else if (/iphone os (\d+([._]\d+)*)/i.test(ua)) os = `iOS (iPhone) ${RegExp.$1.replace(/_/g, ".")}`;
    else if (/ipad.*os (\d+([._]\d+)*)/i.test(ua)) os = `iPadOS ${RegExp.$1.replace(/_/g, ".")}`;
    else if (/mac os x (\d+([._]\d+)*)/i.test(ua)) os = `macOS ${RegExp.$1.replace(/_/g, ".")}`;
    else if (/linux/i.test(ua)) os = "Linux";

    let browser = "Unknown Browser";
    if (/edg\/([0-9.]+)/i.test(ua)) browser = `Microsoft Edge ${RegExp.$1}`;
    else if (/chrome\/([0-9.]+)/i.test(ua)) browser = `Google Chrome ${RegExp.$1}`;
    else if (/firefox\/([0-9.]+)/i.test(ua)) browser = `Mozilla Firefox ${RegExp.$1}`;
    else if (/safari\/([0-9.]+)/i.test(ua) && !/chrome/i.test(ua)) browser = `Apple Safari ${RegExp.$1}`;
    else if (/opr\/([0-9.]+)/i.test(ua)) browser = `Opera ${RegExp.$1}`;

    let device = "Desktop / PC";
    if (/mobile/i.test(ua)) device = "Mobile (Smartphone)";
    else if (/tablet|ipad/i.test(ua)) device = "Tablet";
    else if (/bot|crawler|spider/i.test(ua)) device = "Search Engine Bot / Crawler";

    const text =
      `┌── USER-AGENT ANALYSIS\n` +
      `│ String: ${ua.slice(0, 60)}${ua.length > 60 ? "..." : ""}\n` +
      `└──\n\n` +
      `├── Sistem Operasi : ${os}\n` +
      `├── Aplikasi/Web   : ${browser}\n` +
      `├── Kategori Alat  : ${device}\n` +
      `└── Rendering      : ${/applewebkit/i.test(ua) ? "WebKit / Blink" : /gecko/i.test(ua) ? "Gecko" : "Lainnya"}`;

    return reply(text);
  },
};
