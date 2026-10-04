const PLATFORMS = [
  { name: "GitHub", url: (u) => `https://github.com/${u}`, check: (u) => `https://api.github.com/users/${u}` },
  { name: "Telegram", url: (u) => `https://t.me/${u}`, check: (u) => `https://t.me/${u}` },
  { name: "TikTok", url: (u) => `https://www.tiktok.com/@${u}`, check: (u) => `https://www.tiktok.com/@${u}` },
  { name: "Reddit", url: (u) => `https://www.reddit.com/user/${u}`, check: (u) => `https://www.reddit.com/user/${u}/about.json` },
  { name: "Pinterest", url: (u) => `https://www.pinterest.com/${u}/`, check: (u) => `https://www.pinterest.com/${u}/` },
  { name: "Steam", url: (u) => `https://steamcommunity.com/id/${u}`, check: (u) => `https://steamcommunity.com/id/${u}` },
  { name: "Medium", url: (u) => `https://medium.com/@${u}`, check: (u) => `https://medium.com/@${u}` },
  { name: "Dev.to", url: (u) => `https://dev.to/${u}`, check: (u) => `https://dev.to/${u}` },
  { name: "GitLab", url: (u) => `https://gitlab.com/${u}`, check: (u) => `https://gitlab.com/${u}` },
];

export default {
  name: "userhunt",
  aliases: ["sherlock", "stalkuser", "usercheck", "huntuser"],
  description: "Lacak keberadaan username di berbagai platform sosial media & developer",
  usage: "<username, cth: torvalds>",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const username = (args[0] || "").trim().replace(/^@/, "");

    if (!username) {
      return reply(
        `❌ Masukkan username yang ingin dicari!\n` +
        `Contoh: \`${currentPrefix}userhunt torvalds\``
      );
    }

    if (!/^[a-zA-Z0-9_\-\.]{3,30}$/.test(username)) {
      return reply("❌ Format username tidak valid (hanya huruf, angka, dot, strip, underscore, 3-30 karakter).");
    }

    await sendTyping();
    await reply(`🔍 Melacak jejak username *${username}* di 9 platform online...`);

    const results = await Promise.allSettled(
      PLATFORMS.map(async (p) => {
        const checkUrl = p.check(username);
        const profileUrl = p.url(username);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);

        try {
          const res = await fetch(checkUrl, {
            method: "HEAD",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            signal: ctrl.signal,
          });

          if (res.status === 200 || res.status === 301 || res.status === 302) {
            return { name: p.name, exists: true, url: profileUrl };
          }
          return { name: p.name, exists: false };
        } catch {
          return { name: p.name, exists: false };
        } finally {
          clearTimeout(timer);
        }
      })
    );

    const found = [];
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value.exists) {
        found.push(r.value);
      }
    });

    const lines = [
      `🕵️‍♂️ *OSINT USERNAME SCANNER*`,
      `Target: \`${username}\``,
      `Hasil: Ditemukan di *${found.length}* dari *${PLATFORMS.length}* platform`,
      ``,
    ];

    if (found.length === 0) {
      lines.push(`_Tidak ditemukan akun publik aktif dengan username tersebut di platform yang dicek._`);
    } else {
      found.forEach((item, idx) => {
        lines.push(`${idx + 1}. *${item.name}*: ${item.url}`);
      });
    }

    return reply(lines.join("\n"));
  },
};
