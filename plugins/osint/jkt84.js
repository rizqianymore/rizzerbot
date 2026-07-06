import axios from "axios";

const localMembersList = [
  "Abigail Rachel",
  "Adeline Wijaya",
  "Afera Thalia",
  "Alya Amanda",
  "Angelina Christy",
  "Anindya Ramadhani",
  "Astrella Virgiananda",
  "Aulia Riza",
  "Aurellia",
  "Aurhel Alana",
  "Bong Aprilli",
  "Carissa Dini",
  "Catherina Vallencia",
  "Cathleen Nixie",
  "Celline Thefani",
  "Chelsea Davina",
  "Christabella Bonita",
  "Cornelia Vanisa",
  "Cynthia Yaputera",
  "Dena Natalia",
  "Desy Natalia",
  "Fahira Putri",
  "Fatimah Azzahra",
  "Febriola Sinambela",
  "Feni Fitriyanti",
  "Fiony Alveria",
  "Freya Jayawardana",
  "Fritzy Rosmerian",
  "Gabriela Abigail",
  "Gendis Mayrannisa",
  "Gita Sekar Andarini",
  "Grace Octaviani",
  "Greesella Adhalia",
  "Hagia Sopia",
  "Heidi Suyangga",
  "Helisma Putri",
  "Hillary Abigail",
  "Humaira Ramadhani",
  "Indah Cahya",
  "Isha Kirana",
  "Jacqueline Immanuela",
  "Jazzlyn Trisha",
  "Jemima Evodie",
  "Jessica Chandra",
  "Jesslyn Elly",
  "Kathrina Irene",
  "Lulu Salsabila",
  "Marsha Lenathea",
  "Maura Nilambari",
  "Maxine Faye",
  "Michelle Alexandra",
  "Michelle Levia",
  "Mikaela Kusjanto",
  "Mutiara Azzahra",
  "Nayla Suji",
  "Nina Tutachia",
  "Nur Intan",
  "Oline Manuel",
  "Pia Meraleo",
  "Putry Jazyta",
  "Raisha Syifa",
  "Ralyne Van Irwan",
  "Ribka Budiman",
  "Sami Maono",
  "Shabilqis Naila",
  "Sona Kalyana",
  "Tana Nona",
  "Victoria Kimberly",
];

export default {
  premiumOnly: true,
  description: "Menampilkan jadwal teater JKT48.",
  usage: "",
  example: "",
  name: "jkt84",
  aliases: ["jkt48", "memberjkt"],
  category: "Fun",
  run: async (sock, msg, args, { sendTyping }) => {
    const query = args.join(" ").trim();
    if (!query) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `⚠️ *Harap masukkan nama member untuk dicari.*\n\n*Contoh:* \`.jkt Freya\``,
        },
        { quoted: msg },
      );
      return;
    }

    await sendTyping();

    try {
      const listRes = await axios.get(
        "https://jkt48.com/api/v1/members?lang=id",
        { timeout: 5000 },
      );
      if (
        !listRes.data ||
        !listRes.data.status ||
        !Array.isArray(listRes.data.data)
      ) {
        throw new Error("Invalid API response structure");
      }

      const apiMembers = listRes.data.data;

      const matches = apiMembers.filter(
        (m) =>
          (m.name && m.name.toLowerCase().includes(query.toLowerCase())) ||
          (m.nickname &&
            m.nickname.toLowerCase().includes(query.toLowerCase())) ||
          (m.code && m.code.toLowerCase().includes(query.toLowerCase())),
      );

      if (matches.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `❌ Member dengan kata kunci *"${query}"* tidak ditemukan di JKT48.`,
          },
          { quoted: msg },
        );
        return;
      }

      if (matches.length > 1) {
        let responseText = `⚠️ *Menemukan beberapa member (${matches.length}). Harap lebih spesifik:*\n\n`;
        matches.forEach((m, index) => {
          responseText += `${index + 1}. *${m.name}* (${m.nickname})\n`;
        });
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: responseText.trim() },
          { quoted: msg },
        );
        return;
      }

      const targetMember = matches[0];
      const memberId = targetMember.jkt48_member_id || targetMember.id;

      if (!memberId) {
        throw new Error("Member ID not found in API list");
      }

      const detailRes = await axios.get(
        `https://jkt48.com/api/v1/members/${memberId}?lang=id`,
        { timeout: 5000 },
      );

      if (!detailRes.data || !detailRes.data.status || !detailRes.data.data) {
        throw new Error("Failed to fetch member details");
      }

      const details = detailRes.data.data;

      let birthDateStr = "-";
      if (details.birth_date) {
        try {
          birthDateStr = new Date(details.birth_date).toLocaleDateString(
            "id-ID",
            {
              day: "numeric",
              month: "long",
              year: "numeric",
            },
          );
        } catch (_) {
          birthDateStr = details.birth_date;
        }
      }

      const detailsText =
        `🎤 *Profil Member JKT48*\n\n` +
        `• *Nama Lengkap:* ${details.name || "-"}\n` +
        `• *Nama Panggilan:* ${details.nickname || "-"}\n` +
        `• *Tipe/Generasi:* ${details.type || "-"}\n` +
        `• *Tanggal Lahir:* ${birthDateStr}\n` +
        `• *Golongan Darah:* ${details.blood_type || "-"}\n` +
        `• *Tinggi Badan:* ${details.body_height ? details.body_height + " cm" : "-"}\n` +
        `• *Horoskop:* ${details.horoscope || "-"}\n\n` +
        `📱 *Media Sosial:*\n` +
        `• *Instagram:* ${details.instagram_account ? "@" + details.instagram_account : "-"}\n` +
        `• *TikTok:* ${details.tiktok_account ? "@" + details.tiktok_account : "-"}\n` +
        `• *Twitter:* ${details.twitter_account ? "@" + details.twitter_account : "-"}\n\n` +
        `*ID Member:* ${memberId}\n\n` +
        `⚡ _Via Kyros-MD API_`;

      const photoUrl =
        details.photo_1 ||
        details.photo_2 ||
        details.photo ||
        targetMember.photo;

      if (photoUrl) {
        try {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              image: { url: photoUrl },
              caption: detailsText,
            },
            { quoted: msg },
          );
        } catch (imgError) {
          console.error(
            "Error sending JKT48 image, falling back to text:",
            imgError,
          );
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: detailsText },
            { quoted: msg },
          );
        }
      } else {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: detailsText },
          { quoted: msg },
        );
      }
    } catch (err) {
      console.error("JKT48 API lookup error:", err);

      const localMatches = localMembersList.filter((name) =>
        name.toLowerCase().includes(query.toLowerCase()),
      );
      if (localMatches.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `❌ Member dengan nama *"${query}"* tidak ditemukan di JKT48 (dan database lokal).`,
          },
          { quoted: msg },
        );
        return;
      }

      if (localMatches.length > 1) {
        let responseText = `⚠️ *Menemukan beberapa member lokal. Harap lebih spesifik:*\n\n`;
        localMatches.forEach((name, index) => {
          responseText += `${index + 1}. *${name}*\n`;
        });
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: responseText.trim() },
          { quoted: msg },
        );
        return;
      }

      const localName = localMatches[0];
      const googleSearch = `https://www.google.com/search?q=${encodeURIComponent("JKT48 " + localName)}`;
      const fallbackText =
        `⚠️ *API JKT48 sedang gangguan. Menampilkan data lokal:*\n\n` +
        `• *Nama:* ${localName}\n\n` +
        `🔗 Info: ${googleSearch}`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: fallbackText },
        { quoted: msg },
      );
    }
  },
};
