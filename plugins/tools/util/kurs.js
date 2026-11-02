import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const cache = createTtlCache({ ttlMs: 30 * 60 * 1000, max: 100 });

const ALIAS = {
  usd: "USD",
  dollar: "USD",
  eur: "EUR",
  euro: "EUR",
  jpy: "JPY",
  yen: "JPY",
  gbp: "GBP",
  pound: "GBP",
  sgd: "SGD",
  myr: "MYR",
  ringgit: "MYR",
  aud: "AUD",
  cny: "CNY",
  yuan: "CNY",
  idr: "IDR",
  rupiah: "IDR",
  krw: "KRW",
  won: "KRW",
};

function norm(code) {
  const c = String(code || "").trim().toLowerCase();
  return ALIAS[c] || c.toUpperCase();
}

async function getRates(base = "USD") {
  const key = `rates:${base}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const data = await request.json(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
    timeout: 12000,
  });
  if (data?.result !== "success" || !data?.rates) throw new Error("Gagal ambil kurs");
  cache.set(key, data.rates);
  return data.rates;
}

export default {
  name: "kurs",
  aliases: ["forex", "exchange", "convert", "rupiah"],
  description: "Kurs forex & konversi mata uang (IDR, USD, EUR, dll)",
  usage: "[jumlah] <dari> <ke>, cth: kurs 100 usd idr | kurs usd idr",
  category: "Tools",
  cooldownMs: 4000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const cur = prefix || ".";
    const raw = args.join(" ").trim();
    if (!raw) {
      return reply(
        `*KURS FOREX*\n\nContoh:\n• \`${cur}kurs 100 usd idr\`\n• \`${cur}kurs eur idr\`\n• \`${cur}kurs 1 btc idr\` (crypto via kurs tidak support, pakai .crypto)\nKode: USD, IDR, EUR, JPY, SGD, MYR, dll`
      );
    }
    const parts = raw.split(/\s+/);
    let amount = 1;
    let from, to;
    if (parts.length === 1) {
      from = norm(parts[0]);
      to = "IDR";
    } else if (parts.length === 2) {
      from = norm(parts[0]);
      to = norm(parts[1]);
    } else if (parts.length >= 3) {
      const maybeNum = Number(parts[0].replace(/,/g, ""));
      if (Number.isFinite(maybeNum)) {
        amount = maybeNum;
        from = norm(parts[1]);
        to = norm(parts[2]);
      } else {
        from = norm(parts[0]);
        to = norm(parts[1]);
      }
    }
    if (!from || !to) return reply("Format: kurs [jumlah] USD IDR");
    await sendTyping();
    try {
      const rates = await getRates(from);
      const rate = rates[to];
      if (!rate) return reply(`Kurs ${from} → ${to} tidak tersedia.`);
      const converted = amount * rate;
      const fmt = (n) =>
        Number(n).toLocaleString("id-ID", { maximumFractionDigits: n >= 1000 ? 2 : 6 });
      return reply(
        `*KURS ${from} → ${to}*\n\n• 1 ${from} = ${fmt(rate)} ${to}\n• ${fmt(amount)} ${from} = ${fmt(converted)} ${to}\n\n_Sumber: open.er-api.com_`
      );
    } catch (err) {
      return reply(`Gagal kurs: ${err?.message || err}`);
    }
  },
};
