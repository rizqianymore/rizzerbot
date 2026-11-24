export default {
  name: "slugify",
  aliases: ["makeslug", "urlslug"],
  description: "Ubah judul / kalimat menjadi format URL Slug SEO yang bersih",
  usage: "<kalimat>",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const text = args.join(" ").trim();

    if (!text) {
      return reply(
        `┌── URL SLUG GENERATOR\n` +
          `│ Konversi judul artikel / teks menjadi URL Slug bersih.\n` +
          `└──\n\n` +
          `Format: ${p}slugify <judul>\n` +
          `Contoh: ${p}slugify Cara Mudah Belajar Node.js di Tahun 2026!`
      );
    }

    const slug = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    const result =
      `┌── URL SLUG RESULT\n` +
      `│ Teks Asli : "${text}"\n` +
      `└──\n\n` +
      `├── Slug Standard : \`${slug}\`\n` +
      `└── Panjang       : ${slug.length} karakter\n\n` +
      `_Siap disematkan untuk link blog, artikel web, atau endpoint API._`;

    return reply(result);
  },
};
