import {
  getJkt48Members,
  getJkt48MemberDetail,
  getJkt48News,
  getJkt48Schedules,
  getJkt48ScheduleDetail,
  getShowroomLeaderboard,
  getShowroomSchedules,
} from "@/src/services/hiburan/jkt48.js";
import { fetchBuffer } from "@/src/services/network/scrape.js";

const JKT48_BASE = "https://jkt48.com";

export default {
  "name": "jkt48",
  "aliases": ["memberjkt","jkt","jktmember"],
  "description": "Informasi profil dan daftar member resmi JKT48",
  "usage": "<nama/id member>",
  "premiumOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const query = args.join(" ").trim();

      if (!query) {
        await reply("📋 Memuat daftar member JKT48...");
        try {
          const members = await getJkt48Members();
          if (!Array.isArray(members) || members.length === 0) {
            return reply("❌ Data member tidak ditemukan.");
          }

          let text = `👥 *DAFTAR MEMBER JKT48 (${members.length} Member)*\n\n`;

          members.slice(0, 20).forEach((m, idx) => {
            text += `${idx + 1}. *${m.name}* (ID: ${m.id || "-"})\n`;
          });

          if (members.length > 20) {
            text += `_... dan ${members.length - 20} member lainnya._\n`;
          }

          text += `💡 *Cara Pilih Member:*\n`;
          text += `Ketik: *${prefix}jkt48 <nama / ID>*\n`;
          text += `_Contoh: *${prefix}jkt48 ${members[0]?.name || "Freya"}*_`;

          await reply(text.trim());
        } catch (err) {
          await reply(`❌ Gagal memuat daftar member: ${err.message}`);
        }
        return;
      }

      await reply(`Mencari data member "${query}" langsung dari web resmi JKT48...`);
      try {
        const info = await getJkt48MemberDetail(query);
        const birthDateStr =
          info.birthDate && !isNaN(new Date(info.birthDate))
            ? new Date(info.birthDate).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
            : null;

        const igHandle = info.instagram
          ? info.instagram.replace(/.*instagram\.com\/?/, "").replace(/\//g, "")
          : null;
        const twHandle = info.twitter
          ? info.twitter.replace(/.*x\.com\/?|.*twitter\.com\/?/, "").replace(/\//g, "")
          : null;
        const ttHandle = info.tiktok
          ? info.tiktok.replace(/.*tiktok\.com\/?@?/, "").replace(/\//g, "")
          : null;

        const socials = [];
        if (igHandle) socials.push(`Instagram @${igHandle}`);
        if (twHandle) socials.push(`Twitter @${twHandle}`);
        if (ttHandle) socials.push(`TikTok @${ttHandle}`);

        let socialJoin = "";
        if (socials.length === 1) socialJoin = socials[0];
        else if (socials.length === 2) socialJoin = `${socials[0]} dan ${socials[1]}`;
        else if (socials.length > 2)
          socialJoin = `${socials.slice(0, -1).join(", ")}, serta ${socials[socials.length - 1]}`;

        const socialText = socialJoin
          ? ` Penggemar dapat mengikuti aktivitas kesehariannya melalui media sosial resminya di ${socialJoin}.`
          : "";

        const fan = info.fandom;
        const realName = fan?.realName || info.name;
        const nickName = info.nickname || info.name;
        const teamDesc = info.type ? `Tim ${info.type}` : "Member Aktif";
        const genText = fan?.generation || "-";
        const hometown = fan?.hometown || info.birthPlace || "-";
        const birthDate = birthDateStr || "-";
        const blood = info.bloodType && info.bloodType !== "-" ? info.bloodType : "-";
        const height = info.height && info.height !== "-" ? info.height : "-";
        const zodiac = info.horoscope && info.horoscope !== "-" ? info.horoscope : "-";
        const catchphrase = fan?.catchphrase ? `"${fan.catchphrase}"` : "-";

        const lines = [
          `*Profil Member JKT48*`,
          ``,
          `• Nama Lengkap: *${realName}*`,
          `• Nama Panggilan: *${nickName}*`,
          `• Tim & Generasi: *${teamDesc}* (${genText})`,
          `• Tempat, Tanggal Lahir: *${hometown}*, *${birthDate}*`,
          `• Golongan Darah: *${blood}*`,
          `• Tinggi Badan: *${height}*`,
          `• Zodiak: *${zodiac}*`,
          `• Jikoshoukai / Catchphrase: ${catchphrase}`,
        ];

        if (fan?.trivia && fan.trivia.length > 0) {
          lines.push(`• Fakta Menarik:`);
          for (const item of fan.trivia) {
            lines.push(`  - ${item.replace(/\.+$/, "")}`);
          }
        }

        if (socials.length > 0) {
          lines.push(`• Media Sosial: *${socials.join(" | ")}*`);
        }

        if (fan?.wikiImageUrl) {
          lines.push(`• Foto Fandom: ${fan.wikiImageUrl}`);
        }

        const caption = lines.join("\n");

        let photoUrl = info.photo;
        if (photoUrl && !photoUrl.startsWith("http")) {
          photoUrl = `${JKT48_BASE}${photoUrl.startsWith("/") ? "" : "/"}${photoUrl}`;
        }

        if (photoUrl) {
          try {
            const img = await fetchBuffer(photoUrl, { redirect: "follow" });
            return await sock.sendMessage(
              msg.key.remoteJid,
              { image: img, caption },
              { quoted: msg }
            );
          } catch (_) {}
        }

        await reply(caption);
      } catch (err) {
        await reply(`Gagal memuat profil member: ${err.message}`);
      }
    },
};
