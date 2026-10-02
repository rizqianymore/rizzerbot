// plugins/stalker/npmstalk.js — perintah "npmstalk" (TANPA API key).
// Backend: npm Registry publik (search + packument) — pengganti JereAPI yang sudah tidak ada.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

const NPM_LOGO =
  "https://raw.githubusercontent.com/npm/logos/master/npm%20square/npm-square-red-rounded.png";

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function fmtAuthor(author) {
  if (!author) return "-";
  if (typeof author === "string") return author;
  return author.name || author.email || "-";
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`npm Registry HTTP ${res.status}`);
  return res.json();
}

export default {
  name: "npmstalk",
  aliases: ["stalknpm", "npminfo"],
  description: "Intip info package NPM: versi, author, lisensi, repo (gratis)",
  usage: "<nama package, cth: axios>",
  premiumOnly: true,
  category: "Stalker",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const query = args.join(" ").trim();
    if (!query) {
      return reply(
        `*NPM STALKER*\n\n` +
        `Penggunaan: *${prefix}npmstalk <nama package>*\n` +
        `Contoh: *${prefix}npmstalk axios*`
      );
    }

    const react = (emoji) =>
      sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});
    await react("🕕");

    try {
      // 1. Cari package paling relevan
      const search = await getJson(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=5`
      );
      const hit = search?.objects?.[0]?.package;
      if (!hit?.name) throw new Error(`Package NPM "${query}" tidak ditemukan`);

      // 2. Ambil detail packument (ringan: hanya field yang dipakai)
      const detail = (await getJson(`https://registry.npmjs.org/${encodeURIComponent(hit.name)}`)) || {};
      const latestTag = detail?.["dist-tags"]?.latest;
      const latestMeta = (latestTag && detail?.versions?.[latestTag]) || {};
      const versionCount = detail?.versions ? Object.keys(detail.versions).length : 0;
      const maintainers = Array.isArray(detail?.maintainers)
        ? detail.maintainers.slice(0, 5).map((m) => m.name || m.email).filter(Boolean).join(", ")
        : "-";
      const keywords = Array.isArray(latestMeta.keywords || hit.keywords)
        ? (latestMeta.keywords || hit.keywords).slice(0, 6).join(", ")
        : "-";
      const links = latestMeta.dist?.tarball
        ? { ...(hit.links || {}), tarball: latestMeta.dist.tarball }
        : hit.links || {};
      const pubDate = formatDate(detail?.time?.[latestTag] || detail?.time?.modified || hit.date);

      let card = `*NPM STALKER*\n`;
      card += `Package: ${hit.name}\n`;
      card += `Versi: ${latestTag || hit.version || "-"}\n`;
      if (versionCount) card += `Total Versi: ${versionCount}\n`;
      if (hit.description || latestMeta.description)
        card += `Deskripsi: ${hit.description || latestMeta.description}\n`;
      card += `Author: ${fmtAuthor(latestMeta.author || hit.author)}\n`;
      card += `Maintainers: ${maintainers}\n`;
      card += `Lisensi: ${latestMeta.license || hit.license || "-"}\n`;
      card += `Publish: ${pubDate}\n`;
      if (keywords !== "-") card += `Keywords: ${keywords}\n`;
      if (links.npm) card += `NPM: ${links.npm}\n`;
      if (links.repository) card += `Repo: ${links.repository}\n`;
      if (links.homepage) card += `Homepage: ${links.homepage}`;

      try {
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: { url: NPM_LOGO }, caption: card },
          { quoted: msg }
        );
      } catch {
        await reply(card);
      }
      await react("✅");
    } catch (err) {
      await react("❌");
      await reply(`*NPM STALKER GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
