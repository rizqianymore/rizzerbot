const MORSE = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  " ": "/",
};
const REVERSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

function encodeMorse(text) {
  return String(text || "")
    .toUpperCase()
    .split("")
    .map((c) => MORSE[c] || "")
    .filter(Boolean)
    .join(" ");
}

function decodeMorse(code) {
  return String(code || "")
    .trim()
    .split(/\s+/)
    .map((c) => (c === "/" ? " " : REVERSE[c] || ""))
    .join("")
    .replace(/\s+/g, " ");
}

export default {
  name: "morse",
  aliases: ["morsecode", "sandimorse"],
  description: "Encode / decode morse",
  usage: "<enc|dec> <teks>, cth: morse enc hello | morse dec .... . .-.. .-.. ---",
  category: "Tools",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, prefix }) => {
    const cur = prefix || ".";
    const mode = (args[0] || "").toLowerCase();
    const text = args.slice(1).join(" ").trim();
    if (!text || !["enc", "encode", "dec", "decode"].includes(mode)) {
      return reply(
        `*MORSE*\nContoh:\n• \`${cur}morse enc hello world\`\n• \`${cur}morse dec .... . .-.. .-.. ---\``
      );
    }
    const isDec = ["dec", "decode"].includes(mode);
    const out = isDec ? decodeMorse(text) : encodeMorse(text);
    if (!out) return reply("Gagal morse, cek format.");
    return reply(`*MORSE ${isDec ? "DECODE" : "ENCODE"}:*\n${out}`);
  },
};
