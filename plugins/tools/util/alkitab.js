/**
 * Clean HTML tags and entities from raw verse text
 * @param {string} rawHtml
 * @returns {string}
 */
function cleanVerseHtml(rawHtml) {
  return rawHtml
    .replace(/<x[^>]*\/>/gi, "")
    .replace(/<n[^>]*\/>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Built-in fallback passages for common popular verses
 */
const POPULAR_VERSES = {
  "yohanes 3:16": {
    title: "Yohanes 3:16",
    version: "TB (Terjemahan Baru)",
    verses: [
      "Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal.",
    ],
  },
  "mazmur 23": {
    title: "Mazmur 23:1-6",
    version: "TB (Terjemahan Baru)",
    verses: [
      "23:1 Mazmur Daud. TUHAN adalah gembalaku, takkan kekurangan aku.",
      "23:2 Ia membaringkan aku di padang yang berumput hijau, Ia membimbing aku ke air yang tenang;",
      "23:3 Ia menyegarkan jiwaku. Ia menuntun aku di jalan yang benar oleh karena nama-Nya.",
      "23:4 Sekalipun aku berjalan dalam lembah kekelaman, aku tidak takut bahaya, sebab Engkau besertaku; gada-Mu dan tongkat-Mu, itulah yang menghibur aku.",
      "23:5 Engkau menyediakan hidangan bagiku, di hadapan lawanku; Engkau mengurapi kepalaku dengan minyak; pialaku penuh melimpah.",
      "23:6 Kebajikan dan kemurahan belaka akan mengikuti aku, seumur hidupku; dan aku akan diam dalam rumah TUHAN sepanjang masa.",
    ],
  },
  "matius 6:9-13": {
    title: "Matius 6:9-13 (Doa Bapa Kami)",
    version: "TB (Terjemahan Baru)",
    verses: [
      "6:9 Karena itu berdoalah demikian: Bapa kami yang di sorga, Dikuduskanlah nama-Mu,",
      "6:10 datanglah Kerajaan-Mu, jadilah kehendak-Mu di bumi seperti di sorga.",
      "6:11 Berikanlah kami pada hari ini makanan kami yang secukupnya",
      "6:12 dan ampunilah kami akan kesalahan kami, seperti kami juga mengampuni orang yang bersalah kepada kami;",
      "6:13 dan janganlah membawa kami ke dalam pencobaan, tetapi lepaskanlah kami dari pada yang jahat. (Karena Engkaulah yang empunya Kerajaan dan kuasa dan kemuliaan sampai selama-lamanya. Amin.)",
    ],
  },
  "filipi 4:13": {
    title: "Filipi 4:13",
    version: "TB (Terjemahan Baru)",
    verses: ["Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku."],
  },
  "yeremia 29:11": {
    title: "Yeremia 29:11",
    version: "TB (Terjemahan Baru)",
    verses: [
      "Sebab Aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera dan bukan rancangan kecelakaan, untuk memberikan kepadamu hari depan yang penuh harapan.",
    ],
  },
  "amsal 3:5-6": {
    title: "Amsal 3:5-6",
    version: "TB (Terjemahan Baru)",
    verses: [
      "3:5 Percayalah kepada TUHAN dengan segenap hatimu, dan janganlah bersandar kepada pengertianmu sendiri.",
      "3:6 Akuilah Dia dalam segala lakumu, maka Ia akan meluruskan jalanmu.",
    ],
  },
};

/**
 * Fetch passage from SABDA Alkitab Web
 * @param {string} query
 * @returns {Promise<{ title: string, verses: string[] } | null>}
 */
async function fetchSabdaPassage(query) {
  try {
    const url = `https://alkitab.sabda.org/passage.php?passage=${encodeURIComponent(query)}&mode=text`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    const html = await res.text();
    if (!html || !html.includes('class="texts"')) return null;

    // Extract title (e.g. <h1>Yohanes 3:16</h1> or <h1>Mazmur 23:1-6</h1>)
    const titleMatch = html.match(/<div class="texts"[^>]*>[\s\S]*?<h1>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : query;

    // Extract paragraph title if available
    const subTitleMatch = html.match(/<div class="paragraphtitle">([^<]+)<\/div>/i);
    const subTitle = subTitleMatch ? subTitleMatch[1].trim() : "";

    // Extract verses
    const verses = [];
    const verseRegex = /<span class="vref">([^<]+)<\/span>([\s\S]*?)(?=<span class="vref">|<hr\/>|<\/div>)/gi;
    let match;

    while ((match = verseRegex.exec(html)) !== null) {
      const vref = match[1].trim();
      const rawText = match[2];
      const cleaned = cleanVerseHtml(rawText);
      if (cleaned) {
        verses.push(`${vref} ${cleaned}`);
      }
    }

    if (verses.length === 0) {
      // Single verse or plain text match
      const plainTextMatch = html.match(/<div class="texts"[^>]*>[\s\S]*?<h1>[^<]+<\/h1>([\s\S]*?)<hr\/>/i);
      if (plainTextMatch) {
        const cleaned = cleanVerseHtml(plainTextMatch[1]);
        if (cleaned) verses.push(cleaned);
      }
    }

    return verses.length > 0 ? { title: subTitle ? `${title} (${subTitle})` : title, verses } : null;
  } catch {
    return null;
  }
}

export default {
  name: "alkitab",
  aliases: ["injil", "bible", "ayatalkitab"],
  description: "Cari ayat dan pasal Alkitab / Injil (Terjemahan Baru - SABDA)",
  usage: "<nama kitab & pasal/ayat>\nContoh: .alkitab Yohanes 3:16",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const p = prefix || ".";
    if (!args[0]) {
      return reply(
        `📖 *Pencarian Ayat Alkitab / Injil*\n\n` +
          `Gunakan perintah ini untuk membaca ayat atau pasal Alkitab Terjemahan Baru.\n\n` +
          `*Contoh Penggunaan:*\n` +
          `• \`${p}alkitab Yohanes 3:16\`\n` +
          `• \`${p}alkitab Mazmur 23\`\n` +
          `• \`${p}alkitab Matius 6:9-13\`\n` +
          `• \`${p}alkitab Filipi 4:13\`\n` +
          `• \`${p}alkitab Amsal 3:5-6\``
      );
    }

    const query = args.join(" ").trim();
    const queryLower = query.toLowerCase();
    await sendTyping();

    // 1. Check local popular passages fallback
    if (POPULAR_VERSES[queryLower]) {
      const data = POPULAR_VERSES[queryLower];
      const verseText = data.verses.join("\n\n");
      return reply(
        `📖 *ALKITAB (Terjemahan Baru)*\n` +
          `📍 *${data.title}*\n\n` +
          `${verseText}\n\n` +
          `_Sumber: Yayasan Lembaga SABDA (YLSA)_`
      );
    }

    // 2. Fetch live from SABDA
    const result = await fetchSabdaPassage(query);

    if (!result || result.verses.length === 0) {
      return reply(
        `❌ Ayat atau pasal *"${query}"* tidak ditemukan di Alkitab.\n\n` +
          `_Pastikan penulisan nama kitab dan nomor pasal/ayat sesuai (contoh: \`${p}alkitab Yohanes 3:16\` atau \`${p}alkitab Kejadian 1\`)._`
      );
    }

    // Truncate if too long (max 25 verses per message to avoid exceeding WhatsApp message size)
    const displayVerses = result.verses.slice(0, 25);
    const isTruncated = result.verses.length > 25;
    let messageText = displayVerses.join("\n\n");

    if (isTruncated) {
      messageText += `\n\n_... (ditampilkan 25 ayat dari total ${result.verses.length} ayat. Persempit pencarian ayat untuk melihat bagian spesifik)._`;
    }

    return reply(
      `📖 *ALKITAB (Terjemahan Baru)*\n` +
        `📍 *${result.title}*\n\n` +
        `${messageText}\n\n` +
        `_Sumber: alkitab.sabda.org (YLSA)_`
    );
  },
};
