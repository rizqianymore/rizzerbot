import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "database", "jkt48");

function loadData(filename) {
  try {
    const p = path.join(DATA_DIR, filename);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (_) {
    return [];
  }
}

export default {
  name: "jkt48",
  aliases: ["memberjkt48", "jkt"],
  description: "Cari profil member JKT48, lihat daftar tim, atau acak member",
  usage: "[nama / panggilan / team love / dream / passion / trainee / random / list]",
  category: "User",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    await sendTyping();

    const allMembers = loadData("all.json");
    if (!allMembers || allMembers.length === 0) {
      return reply("Data member JKT48 belum tersedia.");
    }

    const sub = (args[0] || "").toLowerCase().trim();

    // 1. HELP / LIST TEAMS
    if (!sub || sub === "help" || sub === "menu") {
      return reply(
        `*JKT48 MEMBER INFO*\n\n` +
          `• ${currentPrefix}jkt48 <nama/panggilan> (contoh: ${currentPrefix}jkt48 Freya)\n` +
          `• ${currentPrefix}jkt48 random (pilih member acak)\n` +
          `• ${currentPrefix}jkt48 list (tampilkan semua member)\n` +
          `• ${currentPrefix}jkt48 love (anggota Team Love)\n` +
          `• ${currentPrefix}jkt48 dream (anggota Team Dream)\n` +
          `• ${currentPrefix}jkt48 passion (anggota Team Passion)\n` +
          `• ${currentPrefix}jkt48 trainee (anggota Trainee)\n\n` +
          `Total member aktif: *${allMembers.length} member*`
      );
    }

    // 2. TEAM LIST
    const teamFiles = {
      love: "love.json",
      dream: "dream.json",
      passion: "passion.json",
      trainee: "trainee.json",
    };

    if (teamFiles[sub]) {
      const teamList = loadData(teamFiles[sub]);
      const teamTitle = sub.toUpperCase();
      let text = `*JKT48 - TEAM ${teamTitle}* (${teamList.length} Member)\n\n`;
      teamList.forEach((m, idx) => {
        text += `${idx + 1}. *${m.nama}* (${m.panggilan})\n`;
      });
      text += `\nKetik *${currentPrefix}jkt48 <nama>* untuk melihat profil lengkap.`;
      return reply(text);
    }

    // 3. FULL LIST
    if (sub === "list" || sub === "all") {
      let text = `*DAFTAR LENGKAP MEMBER JKT48* (${allMembers.length})\n\n`;
      allMembers.forEach((m, idx) => {
        text += `${idx + 1}. *${m.nama}* (${m.panggilan}) - _${m.tim}_\n`;
      });
      text += `\nKetik *${currentPrefix}jkt48 <nama>* untuk melihat profil lengkap.`;
      return reply(text);
    }

    // 4. RANDOM MEMBER
    let target = null;
    if (sub === "random" || sub === "acak") {
      target = allMembers[Math.floor(Math.random() * allMembers.length)];
    } else {
      // 5. SEARCH BY NAME, NICKNAME, OR CODE
      const query = args.join(" ").toLowerCase().trim();
      // exact nickname
      target = allMembers.find((m) => m.panggilan.toLowerCase() === query);
      // exact name
      if (!target) {
        target = allMembers.find((m) => m.nama.toLowerCase() === query);
      }
      // partial match
      if (!target) {
        target = allMembers.find(
          (m) =>
            m.nama.toLowerCase().includes(query) ||
            m.panggilan.toLowerCase().includes(query) ||
            (m.kode && m.kode.toLowerCase().includes(query))
        );
      }
    }

    if (!target) {
      return reply(`Member dengan kata kunci "*${args.join(" ")}*" tidak ditemukan.\nKetik *${currentPrefix}jkt48 list* untuk melihat daftar.`);
    }

    // BUILD CAPTION PROFILE
    const caption =
      `*PROFIL MEMBER JKT48*\n\n` +
      `• *Nama Lengkap:* ${target.nama}\n` +
      `• *Panggilan:* ${target.panggilan}\n` +
      `• *Tim:* ${target.tim}\n` +
      `• *Tanggal Lahir:* ${target.tanggal_lahir || "-"}\n` +
      `• *Tinggi Badan:* ${target.tinggi || "-"}\n` +
      `• *Golongan Darah:* ${target.golongan_darah || "-"}\n` +
      `• *Horoskop:* ${target.horoskop || "-"}\n\n` +
      `*Media Sosial:*\n` +
      (target.media_sosial?.twitter ? `• X / Twitter: ${target.media_sosial.twitter}\n` : "") +
      (target.media_sosial?.instagram ? `• Instagram: ${target.media_sosial.instagram}\n` : "") +
      (target.media_sosial?.tiktok ? `• TikTok: ${target.media_sosial.tiktok}\n` : "") +
      `\n🔗 *Website Resmi:* ${target.url_profil}`;

    // Send with Photo (Local first, fallback to remote photo_url)
    const localImg = target.foto_lokal ? path.join(process.cwd(), target.foto_lokal) : null;

    try {
      if (localImg && fs.existsSync(localImg)) {
        const imgBuf = fs.readFileSync(localImg);
        return await sock.sendMessage(
          msg.key.remoteJid,
          { image: imgBuf, caption },
          { quoted: msg }
        );
      } else if (target.foto_url) {
        return await sock.sendMessage(
          msg.key.remoteJid,
          { image: { url: target.foto_url }, caption },
          { quoted: msg }
        );
      }
    } catch (err) {
      // If sending photo fails, send plain text
    }

    return reply(caption);
  },
};
