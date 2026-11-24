const AKSARA_MAP = {
  ha: "ꦲ",
  na: "ꦤ",
  ca: "ꦕ",
  ra: "ꦫ",
  ka: "ꦏ",
  da: "ꦢ",
  ta: "ꦠ",
  sa: "ꦱ",
  wa: "ꦮ",
  la: "ꦭ",
  pa: "ꦥ",
  dha: "ꦝ",
  ja: "ꦗ",
  ya: "ꦪ",
  nya: "ꦚ",
  ma: "ꦩ",
  ga: "ꦒ",
  ba: "ꦧ",
  tha: "ꦛ",
  nga: "ꦔ",
  a: "ꦲ",
  i: "ꦲꦶ",
  u: "ꦲꦸ",
  e: "ꦲꦺ",
  o: "ꦲꦺꦴ",
};

export function latinToJawa(text = "") {
  let str = text.toLowerCase().trim();
  let result = "";
  let i = 0;

  while (i < str.length) {
    if (str[i] === " ") {
      result += " ";
      i++;
      continue;
    }

    const three = str.slice(i, i + 3);
    if (AKSARA_MAP[three]) {
      result += AKSARA_MAP[three];
      i += 3;
      continue;
    }

    const two = str.slice(i, i + 2);
    if (AKSARA_MAP[two]) {
      result += AKSARA_MAP[two];
      i += 2;
      continue;
    }

    const one = str[i];
    if (AKSARA_MAP[one]) {
      result += AKSARA_MAP[one];
    } else {
      result += one;
    }
    i++;
  }

  return result || "ꦲꦤꦕꦫꦏ";
}

export default {
  name: "aksarajawa",
  aliases: ["carakan", "jawa", "hanacaraka"],
  description: "Konversi teks tulisan latin ke Aksara Jawa (Hanacaraka)",
  usage: "<teks latin>",
  category: "Tools",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const text = args.join(" ").trim();
    const p = prefix || ".";

    if (!text) {
      return reply(
        `*KONVERSI AKSARA JAWA (HANACARAKA)*\n\n` +
          `Format: \`${p}aksarajawa <kalimat latin>\`\n` +
          `Contoh: \`${p}aksarajawa sugeng enjang\``
      );
    }

    await sendTyping();
    const converted = latinToJawa(text);

    const out = `*AKSARA JAWA (HANACARAKA)*\n\n` + `Latin  : ${text}\n` + `Aksara : *${converted}*`;

    return reply(out);
  },
};
