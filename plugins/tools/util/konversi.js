export default {
  name: "konversi",
  aliases: ["unitconvert", "convertunit", "ukur"],
  description: "Konversi satuan panjang, berat, suhu, dan kapasitas digital data",
  usage: "<nilai> <dari> <ke>",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";

    if (args.length < 3) {
      return reply(
        `┌── KONVERSI SATUAN UNIT\n` +
          `│ Konversi nilai suhu, panjang, berat, dan data storage.\n` +
          `└──\n\n` +
          `Format: ${p}konversi <nilai> <dari> <ke>\n` +
          `Contoh:\n` +
          `├── Suhu    : \`${p}konversi 100 c f\` (Celcius ke Fahrenheit)\n` +
          `├── Panjang : \`${p}konversi 5 km m\` (Kilometer ke Meter)\n` +
          `├── Berat   : \`${p}konversi 2.5 kg g\` (Kg ke Gram)\n` +
          `└── Data    : \`${p}konversi 1024 mb gb\` (Megabyte ke Gigabyte)`
      );
    }

    const val = parseFloat(args[0].replace(",", "."));
    const from = args[1].toLowerCase();
    const to = args[2].toLowerCase();

    if (isNaN(val)) {
      return reply(`❌ Nilai angka "${args[0]}" tidak valid.`);
    }

    // 1. Suhu
    const tempMap = ["c", "celcius", "f", "fahrenheit", "k", "kelvin", "r", "reaumur"];
    if (tempMap.includes(from) && tempMap.includes(to)) {
      let c = val;
      if (from === "f" || from === "fahrenheit") c = (val - 32) * (5 / 9);
      else if (from === "k" || from === "kelvin") c = val - 273.15;
      else if (from === "r" || from === "reaumur") c = val * (5 / 4);

      let targetVal = c;
      let unitName = "°C";
      if (to === "f" || to === "fahrenheit") {
        targetVal = c * (9 / 5) + 32;
        unitName = "°F";
      } else if (to === "k" || to === "kelvin") {
        targetVal = c + 273.15;
        unitName = "K";
      } else if (to === "r" || to === "reaumur") {
        targetVal = c * (4 / 5);
        unitName = "°R";
      }

      return reply(
        `┌── KONVERSI SUHU\n` +
          `│ Input  : ${val} ${from.toUpperCase()}\n` +
          `│ Output : *${targetVal.toFixed(2)} ${unitName}*\n` +
          `└──`
      );
    }

    // 2. Panjang (meter)
    const lenToMeter = {
      km: 1000,
      m: 1,
      cm: 0.01,
      mm: 0.001,
      mi: 1609.34,
      mile: 1609.34,
      yard: 0.9144,
      foot: 0.3048,
      ft: 0.3048,
      inch: 0.0254,
    };
    if (lenToMeter[from] && lenToMeter[to]) {
      const inMeters = val * lenToMeter[from];
      const result = inMeters / lenToMeter[to];
      return reply(
        `┌── KONVERSI PANJANG\n` +
          `│ Input  : ${val} ${from}\n` +
          `│ Output : *${result.toLocaleString("id-ID", { maximumFractionDigits: 4 })} ${to}*\n` +
          `└──`
      );
    }

    // 3. Berat (gram)
    const weightToGram = {
      kg: 1000,
      g: 1,
      mg: 0.001,
      ton: 1000000,
      pon: 500,
      lb: 453.592,
      oz: 28.3495,
    };
    if (weightToGram[from] && weightToGram[to]) {
      const inGrams = val * weightToGram[from];
      const result = inGrams / weightToGram[to];
      return reply(
        `┌── KONVERSI BERAT\n` +
          `│ Input  : ${val} ${from}\n` +
          `│ Output : *${result.toLocaleString("id-ID", { maximumFractionDigits: 4 })} ${to}*\n` +
          `└──`
      );
    }

    // 4. Data Storage (Bytes)
    const dataToBytes = {
      b: 1,
      byte: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
      tb: 1024 * 1024 * 1024 * 1024,
    };
    if (dataToBytes[from] && dataToBytes[to]) {
      const inBytes = val * dataToBytes[from];
      const result = inBytes / dataToBytes[to];
      return reply(
        `┌── KONVERSI DIGITAL DATA\n` +
          `│ Input  : ${val} ${from.toUpperCase()}\n` +
          `│ Output : *${result.toLocaleString("id-ID", { maximumFractionDigits: 4 })} ${to.toUpperCase()}*\n` +
          `└──`
      );
    }

    return reply(`❌ Pasangan satuan \`${from}\` ke \`${to}\` belum didukung atau tidak satu kategori.`);
  },
};
