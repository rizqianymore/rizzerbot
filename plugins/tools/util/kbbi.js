import { request } from "@/src/utils/request.js";

function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default {
  name: "kbbi",
  aliases: ["kamus", "artikata", "definisi"],
  description: "Cari definisi kata di KBBI Kemdikbud",
  usage: "<kata>, cth: kbbi demokrasi",
  category: "Tools",
  cooldownMs: 4000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const cur = prefix || ".";
    const word = (args[0] || "").trim().toLowerCase();
    if (!word) return reply(`Masukkan kata!\nContoh: \`${cur}kbbi inovasi\``);
    if (!/^[a-zA-Z-]+$/.test(word)) return reply("Kata hanya huruf a-z.");
    await sendTyping();
    const hosts = [
      `https://kbbi.web.id/${encodeURIComponent(word)}`,
      `https://kbbi.kemdikbud.go.id/entri/${encodeURIComponent(word)}`,
    ];
    let html = "";
    let lastErr = "";
    for (const h of hosts) {
      try {
        html = await request.text(h, { timeout: 15000 });
        if (html && typeof html === "string" && html.length > 500) break;
      } catch (e) {
        lastErr = e?.message || "";
      }
    }
    try {
      if (!html || typeof html !== "string" || html.length < 200) {
        return reply(`Gagal ambil KBBI: ${lastErr || "host tidak respon"}`);
      }
      if (html.includes("Entri tidak ditemukan") || html.includes("tidak ditemukan") || html.includes("404 Not Found")) {
        return reply(`Kata *${word}* tidak ditemukan di KBBI.`);
      }
      const olMatch = html.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
      let defs = [];
      if (olMatch) {
        const li = [...olMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
        defs = li.map((m) => stripHtml(m[1])).filter(Boolean).slice(0, 5);
      }
      if (!defs.length) {
        const alt = html.match(/<div[^>]*class="[^"]*container[^"]*"[^>]*>([\s\S]{200,1200})<\/div>/i);
        if (alt) {
          const t = stripHtml(alt[1]).slice(0, 600);
          if (t) defs = [t];
        }
      }
      if (!defs.length) {
        // fallback ambil meta description
        const meta = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
        if (meta) defs = [stripHtml(meta[1]).slice(0, 500)];
      }
      if (!defs.length) return reply(`Kata *${word}* ditemukan tapi definisi tidak ter-parse. Cek: https://kbbi.web.id/${word}`);
      const lines = [`*KBBI: ${word}*`, ""];
      defs.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
      lines.push("", `Sumber: kbbi.web.id/${word}`);
      return reply(lines.join("\n").slice(0, 3500));
    } catch (err) {
      return reply(`Gagal KBBI: ${err?.message || err}`);
    }
  },
};
