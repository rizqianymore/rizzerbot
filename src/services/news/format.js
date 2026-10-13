import { fetchBuffer } from "@/src/services/network/scrape.js";

export const NEWS_LIMIT_MAX = 15;

export function parseNewsArgs(args = []) {
  const words = args.map((arg) => String(arg || "").trim()).filter(Boolean);
  if (!words.length) return { url: "", query: "", limit: 0, page: 1 };

  if (/^https?:\/\//i.test(words[0])) {
    return { url: words[0], query: "", limit: 0, page: 1 };
  }

  let page = 1;
  for (let i = 0; i < words.length; i++) {
    if (/^(halaman|hal|page)$/i.test(words[i]) && /^\d+$/.test(words[i + 1] || "")) {
      page = Math.max(1, parseInt(words.splice(i + 1, 1)[0], 10));
      words.splice(i, 1);
      i--;
    }
  }

  let limit = 0;
  const last = words[words.length - 1];
  if (last && /^\d{1,2}$/.test(last)) {
    limit = Math.min(Math.max(parseInt(last, 10), 1), NEWS_LIMIT_MAX);
    words.pop();
  }

  return { url: "", query: words.join(" ").trim(), limit, page };
}

export function formatNewsDateTime(date) {
  if (!date) return "";
  try {
    return date.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return "";
  }
}

export function formatNewsList({ title, subtitle, items, footer }) {
  const lines = [`*${title}*`];
  if (subtitle) lines.push(`_${subtitle}_`);
  lines.push("");

  items.forEach((item, index) => {
    lines.push(`*${index + 1}. ${item.title}*`);
    const meta = [item.source, item.channel, item.time || formatNewsDateTime(item.date)].filter(Boolean).join(" • ");
    if (meta) lines.push(`   ${meta}`);
    const normTitle = normalizeText(item.title);
    const normSnippet = normalizeText(item.snippet);
    if (item.snippet && normSnippet !== normTitle && !normSnippet.startsWith(normTitle)) {
      lines.push(`   ${truncate(item.snippet, 180)}`);
    }
    if (item.url) lines.push(`   🔗 ${item.url}`);
    lines.push("");
  });

  if (footer) lines.push(footer);
  return lines.join("\n").trim();
}

export async function sendNewsResult({ sock, msg, reply, caption, imageUrl }) {
  if (imageUrl) {
    try {
      const image = await fetchBuffer(imageUrl, { redirect: "follow" });
      return await sock.sendMessage(msg.key.remoteJid, { image, caption }, { quoted: msg });
    } catch (_) {}
  }
  return await reply(caption);
}

function truncate(text, max) {
  const value = String(text).trim();
  return value.length > max ? `${value.slice(0, max).trim()}…` : value;
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
