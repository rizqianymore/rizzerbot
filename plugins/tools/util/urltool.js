export default {
  name: "urlencode",
  aliases: ["urlenc", "encodeurl", "urldecode", "urldec", "decodeurl"],
  description: "Encode / decode URL",
  usage: "<teks>, cth: urlencode https://a.com/q=hello world | urldecode https%3A%2F%2F",
  category: "Tools",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, prefix }) => {
    const text = args.join(" ").trim();
    const cmd = String(msg.message?.extendedTextMessage?.text || msg.message?.conversation || "")
      .trim()
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/^[./!]/, "");
    const isDecode = ["urldecode", "urldec", "decodeurl"].includes(cmd);
    if (!text) {
      const p = prefix || ".";
      return reply(
        `Kirim teks!\n• Encode: \`${p}urlencode https://example.com/a b\`\n• Decode: \`${p}urldecode https%3A%2F%2Fexample.com%2Fa%20b\``
      );
    }
    try {
      const out = isDecode ? decodeURIComponent(text) : encodeURIComponent(text);
      const label = isDecode ? "DECODED" : "ENCODED";
      return reply(`*URL ${label}:*\n${out}`);
    } catch (err) {
      return reply(`Gagal ${isDecode ? "decode" : "encode"}: ${err?.message || err}`);
    }
  },
};
