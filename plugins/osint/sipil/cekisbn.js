import { searchIsbn, searchBookByTitle, formatIsbnResult } from "@/src/services/osint/isbn.js";

export default {
  name: "cekisbn",
  aliases: ["isbn", "cekbuku", "caribuku"],
  description: "Cek data buku via ISBN atau judul (OpenLibrary + Google Books)",
  usage: "<ISBN-10 / ISBN-13 / judul buku>",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const input = (args || []).join(" ").trim();

    if (!input) {
      return reply(
        `*CEK ISBN / DATA BUKU*\n\n` +
          `Masukkan ISBN-10, ISBN-13, atau judul buku.\n\n` +
          `*Contoh ISBN:*\n` +
          `• \`${currentPrefix}cekisbn 9786020334567\`\n` +
          `• \`${currentPrefix}isbn 978-602-03-3456-7\`\n` +
          `• \`${currentPrefix}cekbuku 0134685997\`\n\n` +
          `*Contoh Judul:*\n` +
          `• \`${currentPrefix}caribuku Effective Java\`\n` +
          `• \`${currentPrefix}cekbuku Laskar Pelangi\`\n\n` +
          `_Sumber: OpenLibrary & Google Books (gratis, no API key)_`
      );
    }

    await sendTyping();

    // Check if input looks like ISBN
    const clean = input.replace(/[^0-9Xx]/g, "").toUpperCase();
    const isIsbn = (clean.length === 10 || clean.length === 13) && /^[0-9X]{10,13}$/.test(clean);

    try {
      let data;
      if (isIsbn) {
        data = await searchIsbn(input);
      } else {
        data = await searchBookByTitle(input);
      }
      return reply(formatIsbnResult(data));
    } catch (err) {
      return reply(`${err.message}`);
    }
  },
};
