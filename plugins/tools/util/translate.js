export default {
  name: "trans",
  aliases: ["trfree", "tl"],
  description: "Translate teks ke bahasa lain gratis (Google free, tanpa premium)",
  usage: "<lang> <teks> | reply teks",
  category: "Tools",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix, quoted }) => {
    const cur = prefix || ".";

    const isLangCode = (s) => {
      if (!s || typeof s !== "string") return false;
      const v = s.trim();
      if (v.length < 2 || v.length > 5) return false;
      return /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(v);
    };

    let targetLang = "en";
    let text = "";

    if (args.length && isLangCode(args[0])) {
      targetLang = args[0].toLowerCase();
      text = args.slice(1).join(" ").trim();
    } else {
      text = args.join(" ").trim();
    }

    if (!text && quoted) {
      text =
        quoted.conversation ||
        quoted.extendedTextMessage?.text ||
        quoted.imageMessage?.caption ||
        quoted.videoMessage?.caption ||
        quoted.documentMessage?.caption ||
        quoted.documentWithCaptionMessage?.message?.documentMessage?.caption ||
        "";
      text = String(text || "").trim();
    }

    if (!text) {
      return reply(
        `Gunakan: \`${cur}translate <lang> <teks>\` atau reply pesan\nContoh: \`${cur}tr en halo dunia\` | \`${cur}tr ja hello world\` | reply teks dengan \`${cur}tr id\``
      );
    }

    // batasi panjang agar tidak kepanjangan untuk Google
    if (text.length > 4000) text = text.slice(0, 4000);

    await sendTyping();

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!Array.isArray(data) || !Array.isArray(data[0])) {
        throw new Error("Format respon tidak dikenal");
      }

      const translated = data[0]
        .map((seg) => (Array.isArray(seg) ? seg[0] : ""))
        .filter((v) => typeof v === "string")
        .join("");

      if (!translated) throw new Error("Hasil terjemahan kosong");

      const srcLang = data[2] || data[0]?.[0]?.[2] || "auto";

      return reply(`🌐 Translate ${srcLang} → ${targetLang}:\n${translated}`);
    } catch (err) {
      return reply(`Gagal translate: ${err?.message || err}`);
    }
  },
};
