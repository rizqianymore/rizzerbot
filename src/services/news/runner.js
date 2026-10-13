import { parseNewsArgs, formatNewsList, sendNewsResult } from "./format.js";

export async function runNewsCommand({ sock, msg, args, ctx, config }) {
  const { reply, sendTyping, prefix } = ctx;
  await sendTyping();

  const { url, query, limit, page } = parseNewsArgs(args);
  const size = limit || 5;
  const offset = (page - 1) * size;

  try {
    if (url) return await runReadArticle({ sock, msg, reply, config, url, prefix });

    if (query) {
      await reply(`🔍 Mencari berita *"${query}"* di ${config.label}...`);
      const items = await config.search({ query, limit: size, offset, page });
      return await sendList({
        sock,
        msg,
        reply,
        config,
        prefix,
        items,
        size,
        page,
        title: `HASIL PENCARIAN ${String(config.label).toUpperCase()}`,
        subtitle: `Topik: "${query}"${page > 1 ? ` • Halaman ${page}` : ""}`,
        hasQuery: true,
        emptyText: `Tidak ditemukan berita dengan topik *"${query}"* di ${config.label}.`,
      });
    }

    await reply(config.loadingText || `📰 Memuat berita terkini dari ${config.label}...`);
    const items = await config.latest({ limit: size, offset, page });
    return await sendList({
      sock,
      msg,
      reply,
      config,
      prefix,
      items,
      size,
      page,
      title: config.latestTitle || `BERITA TERKINI ${config.label}`,
      subtitle: config.latestSubtitle || `${items.length} berita terbaru`,
      emptyText: `Belum ada berita terbaru dari ${config.label} saat ini.`,
    });
  } catch (err) {
    await reply(`❌ ${config.errorLabel || "Gagal mengambil berita"}: ${err.message}`);
  }
}

async function runReadArticle({ sock, msg, reply, config, url, prefix }) {
  if (typeof config.article !== "function") {
    return reply(
      `❌ ${config.label} belum mendukung membaca artikel dari tautan tersebut.\n` +
        `💡 Gunakan \`${prefix}${config.command} <topik>\` untuk mencari berita.`
    );
  }

  await reply(config.readingText || "📖 Mengambil isi lengkap berita...");
  const detail = await config.article(url);
  const lines = [`*${detail.title}*`];
  const meta = [detail.time, detail.author ? `✍️ ${detail.author}` : ""].filter(Boolean).join(" • ");
  if (meta) lines.push(`_${meta}_`);
  lines.push("", detail.content, "", `🔗 *Tautan:* ${detail.url}`);

  return sendNewsResult({
    sock,
    msg,
    reply,
    caption: lines.join("\n").trim(),
    imageUrl: detail.image,
  });
}

async function sendList({ sock, msg, reply, config, prefix, items, page, title, subtitle, emptyText, hasQuery }) {
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0) {
    const hint = page > 1 ? `\n💡 Ketik \`${prefix}${config.command}\` untuk ke halaman pertama.` : "";
    return reply(`${emptyText}${hint}`);
  }

  const footer = [
    hasQuery
      ? `💡 \`${prefix}${config.command} <topik> [jumlah]\` • \`${prefix}${config.command} halaman ${page + 1} <topik>\` untuk lanjut halaman`
      : `💡 \`${prefix}${config.command} <topik> [jumlah]\` untuk cari topik • \`${prefix}${config.command} halaman ${page + 1}\` untuk lanjut halaman`,
    page > 1 ? `_Halaman ${page}_` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const caption = formatNewsList({ title, subtitle, items: list, footer });
  const imageUrl = list.find((item) => item.image)?.image;

  return sendNewsResult({ sock, msg, reply, caption, imageUrl });
}
