export default {
  name: "cekheader",
  aliases: ["headercheck", "securityheaders", "cekheaders", "secscan", "httpsec"],
  description: "Cek header keamanan HTTP (HSTS, CSP, X-Frame-Options, dll) untuk sebuah URL",
  usage: "<url>, cth: cekheader https://example.com",
  premiumOnly: true,
  cooldownMs: 4000,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const raw = (args[0] || "").trim();
    if (!raw) {
      return reply(`Masukkan URL!\nContoh: \`${currentPrefix}cekheader https://example.com\``);
    }

    let url = raw;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    await sendTyping();
    await reply(`Memeriksa header keamanan untuk *${url}*...`);

    let res;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 15000);
      res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
      clearTimeout(t);
    } catch (err) {
      return reply(`Gagal mengakses URL: ${err?.message || err}`);
    }

    const h = (name) => res.headers.get(name) || "";

    const checks = [
      { key: "strict-transport-security", label: "HSTS", good: !!h("strict-transport-security") },
      { key: "content-security-policy", label: "CSP", good: !!h("content-security-policy") },
      { key: "x-frame-options", label: "X-Frame-Options", good: !!h("x-frame-options") },
      { key: "x-content-type-options", label: "X-Content-Type-Options", good: h("x-content-type-options").toLowerCase() === "nosniff" },
      { key: "referrer-policy", label: "Referrer-Policy", good: !!h("referrer-policy") },
      { key: "permissions-policy", label: "Permissions-Policy", good: !!h("permissions-policy") },
    ];

    const score = checks.filter((c) => c.good).length;
    const grade = score >= 5 ? "A" : score >= 3 ? "B" : score >= 1 ? "C" : "D";

    const lines = [
      `*HTTP SECURITY HEADERS*`,
      ``,
      `• URL: \`${res.url}\``,
      `• Status: ${res.status} ${res.statusText}`,
      `• Server: ${h("server") || "-"}`,
      `• Skor: ${score}/${checks.length} (Grade ${grade})`,
      ``,
      `*Header Keamanan:*`,
    ];

    for (const c of checks) {
      lines.push(`   ${c.good ? "✅" : "❌"} ${c.label}: ${h(c.key) ? h(c.key).slice(0, 80) : "tidak ada"}`);
    }

    lines.push(``, `_Catatan: penilaian dasar berdasarkan keberadaan header._`);

    return reply(lines.join("\n"));
  },
};