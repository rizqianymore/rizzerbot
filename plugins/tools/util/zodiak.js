const ZODIACS = [
  { name: "Capricorn", start: [12, 22], end: [1, 19], elemen: "Tanah", planet: "Saturnus" },
  { name: "Aquarius", start: [1, 20], end: [2, 18], elemen: "Udara", planet: "Uranus" },
  { name: "Pisces", start: [2, 19], end: [3, 20], elemen: "Air", planet: "Neptunus" },
  { name: "Aries", start: [3, 21], end: [4, 19], elemen: "Api", planet: "Mars" },
  { name: "Taurus", start: [4, 20], end: [5, 20], elemen: "Tanah", planet: "Venus" },
  { name: "Gemini", start: [5, 21], end: [6, 20], elemen: "Udara", planet: "Merkurius" },
  { name: "Cancer", start: [6, 21], end: [7, 22], elemen: "Air", planet: "Bulan" },
  { name: "Leo", start: [7, 23], end: [8, 22], elemen: "Api", planet: "Matahari" },
  { name: "Virgo", start: [8, 23], end: [9, 22], elemen: "Tanah", planet: "Merkurius" },
  { name: "Libra", start: [9, 23], end: [10, 22], elemen: "Udara", planet: "Venus" },
  { name: "Scorpio", start: [10, 23], end: [11, 21], elemen: "Air", planet: "Pluto" },
  { name: "Sagittarius", start: [11, 22], end: [12, 21], elemen: "Api", planet: "Jupiter" },
];

function cariZodiak(d, m) {
  for (const z of ZODIACS) {
    const [sm, sd] = z.start;
    const [em, ed] = z.end;
    if (sm === 12 && em === 1) {
      if ((m === 12 && d >= sd) || (m === 1 && d <= ed)) return z;
    } else {
      if ((m === sm && d >= sd) || (m === em && d <= ed)) return z;
    }
  }
  return ZODIACS[0];
}

export default {
  name: "zodiak",
  aliases: ["zodiac", "ramalzodiak"],
  description: "Cek tanda zodiak, elemen, dan karakteristik berdasarkan tanggal lahir",
  usage: "<tgl-bln>",
  category: "Info",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const input = args.join(" ").trim();

    if (!input) {
      return reply(
        `┌── CEK ZODIAK\n` +
          `│ Periksa lambang bintang zodiak & elemen astrologi.\n` +
          `└──\n\n` +
          `Format: ${p}zodiak <tgl-bln>\n` +
          `Contoh: ${p}zodiak 25-11\n` +
          `Contoh: ${p}zodiak 14-02`
      );
    }

    const parts = input.split(/[-/.]/);
    const d = Number(parts[0]);
    const m = Number(parts[1]);

    if (isNaN(d) || isNaN(m) || d < 1 || d > 31 || m < 1 || m > 12) {
      return reply(`❌ Tanggal tidak valid. Gunakan format \`DD-MM\`, contoh: \`${p}zodiak 25-11\``);
    }

    const z = cariZodiak(d, m);

    const text =
      `┌── HASIL CEK ZODIAK\n` +
      `│ Tanggal Lahir : ${d.toString().padStart(2, "0")}/${m.toString().padStart(2, "0")}\n` +
      `└──\n\n` +
      `├── Zodiak    : *${z.name}*\n` +
      `├── Elemen    : ${z.elemen}\n` +
      `├── Planet    : ${z.planet}\n` +
      `└── Karakter  : Memiliki tekad yang kuat, setia kawan, dan adaptif terhadap tantangan.`;

    return reply(text);
  },
};
