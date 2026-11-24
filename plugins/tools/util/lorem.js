export default {
  name: "lorem",
  aliases: ["loremipsum", "placeholdertext", "dummytemp"],
  description: "Generator teks dummy placeholder Lorem Ipsum (paragraf / kalimat / kata)",
  usage: "[jumlah] [kata/kalimat/paragraf]",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const LOREM_WORDS = [
      "lorem",
      "ipsum",
      "dolor",
      "sit",
      "amet",
      "consectetur",
      "adipiscing",
      "elit",
      "sed",
      "do",
      "eiusmod",
      "tempor",
      "incididunt",
      "ut",
      "labore",
      "et",
      "dolore",
      "magna",
      "aliqua",
      "enim",
      "ad",
      "minim",
      "veniam",
      "quis",
      "nostrud",
      "exercitation",
      "ullamco",
      "laboris",
      "nisi",
      "aliquip",
      "ex",
      "ea",
      "commodo",
      "consequat",
      "duis",
      "aute",
      "irure",
      "in",
      "reprehenderit",
      "voluptate",
      "velit",
      "esse",
      "cillum",
      "fugiat",
      "nulla",
      "pariatur",
      "excepteur",
      "sint",
      "occaecat",
      "cupidatat",
      "non",
      "proident",
      "sunt",
      "culpa",
      "qui",
      "officia",
      "deserunt",
      "mollit",
      "anim",
      "id",
      "est",
      "laborum",
    ];

    let count = parseInt(args[0], 10);
    if (!Number.isFinite(count) || count <= 0) count = 3;
    if (count > 20) count = 20;

    const type = (args[1] || "paragraf").toLowerCase();

    function getRandomSentence(minWords = 6, maxWords = 14) {
      const len = Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords;
      const s = [];
      for (let i = 0; i < len; i++) {
        s.push(LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]);
      }
      s[0] = s[0].charAt(0).toUpperCase() + s[0].slice(1);
      return s.join(" ") + ".";
    }

    function getRandomParagraph(sentencesCount = 4) {
      const p = [];
      for (let i = 0; i < sentencesCount; i++) {
        p.push(getRandomSentence());
      }
      return p.join(" ");
    }

    let result = "";
    if (type.startsWith("kata") || type.startsWith("word")) {
      const w = [];
      for (let i = 0; i < Math.min(count, 150); i++) {
        w.push(LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]);
      }
      result = w.join(" ");
    } else if (type.startsWith("kalimat") || type.startsWith("sent")) {
      const s = [];
      for (let i = 0; i < count; i++) {
        s.push(getRandomSentence());
      }
      result = s.join("\n\n");
    } else {
      const paragraphs = [];
      for (let i = 0; i < count; i++) {
        paragraphs.push(getRandomParagraph());
      }
      result = paragraphs.join("\n\n");
    }

    const text =
      `┌── LOREM IPSUM GENERATOR\n` +
      `│ Jumlah : ${count} ${type}\n` +
      `└──\n\n` +
      `${result}\n\n` +
      `_Tips: Ketik \`${p}lorem 5 kata\` atau \`${p}lorem 2 paragraf\`_`;

    return reply(text);
  },
};
