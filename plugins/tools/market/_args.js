import { normalizeRangeKey } from "@/src/services/finance/market/constants.js";

const RANGE_TOKENS = new Set([
  "1d",
  "1h",
  "hari",
  "harian",
  "today",
  "5d",
  "5h",
  "minggu",
  "1w",
  "1mo",
  "1m",
  "bulan",
  "bulanan",
  "1bln",
  "3mo",
  "3m",
  "3bln",
  "6mo",
  "6m",
  "6bln",
  "1y",
  "1t",
  "tahun",
  "1thn",
  "5y",
  "5t",
  "5thn",
  "max",
  "all",
  "semua",
  "ytd",
]);

export function parseMarketArgs(args = [], defaultRange = "1mo") {
  let range = defaultRange;
  const words = [];

  for (const raw of args) {
    const token = String(raw || "")
      .trim()
      .toLowerCase();
    if (!token) continue;
    const normalized = normalizeRangeKey(token, null);
    if (normalized && RANGE_TOKENS.has(token) && words.length === 0) {
      range = normalized;
      continue;
    }
    if (normalized && RANGE_TOKENS.has(token) && words.length > 0) {
      range = normalized;
      continue;
    }
    words.push(raw);
  }

  return { query: words.join(" ").trim(), range };
}

export async function sendChart(sock, msg, reply, { quote, text, render }) {
  const jid = msg.key.remoteJid;
  try {
    const buffer = await render(quote);
    if (text.length > 900) {
      await sock.sendMessage(jid, { image: buffer }, { quoted: msg });
      return await reply(text);
    }
    return await sock.sendMessage(jid, { image: buffer, caption: text }, { quoted: msg });
  } catch (err) {
    await reply(`${text}\n\n_Grafik gagal dibuat: ${err.message}_`);
  }
}
