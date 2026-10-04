import {
  getJkt48Members,
  getJkt48MemberDetail,
  getJkt48News,
  getJkt48Schedules,
  getJkt48ScheduleDetail,
  getShowroomLeaderboard,
  getShowroomSchedules,
} from "@/src/services/jkt48.js";
import { fetchBuffer } from "@/src/services/scrape.js";

export default {
  "name": "jkt48showroom",
  "aliases": ["jktshowroom","showroomjkt","srjkt48","srjkt"],
  "description": "Peringkat dan leaderboard live Showroom member JKT48",
  "usage": "",
  "premiumOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      await reply("Memuat data leaderboard Showroom member JKT48...");

      try {
        const res = await getShowroomLeaderboard();
        const list = res?.data || [];
        const filterDate = res?.filterDate;

        if (list.length === 0) {
          return await reply("Belum ada data aktivitas live Showroom JKT48 untuk periode ini.");
        }

        const periodInfo = filterDate
          ? `Periode ${filterDate.startDate || ""} - ${filterDate.endDate || filterDate.month || ""}`.trim()
          : "Bulan Ini";

        const lines = [
          `*Leaderboard Showroom Member JKT48*`,
          `_${periodInfo}_`,
          ``,
        ];

        for (const item of list) {
          const liveStatus = item.profile?.is_onlive ? "*Sedang Live*" : "Offline";
          lines.push(`*#${item.rank}* • *${item.username}*`);
          lines.push(`• Total Live: *${item.total_live} kali* (${liveStatus})`);
          if (item.room_id) {
            lines.push(`• Tautan Room: https://www.showroom-live.com/room/profile?room_id=${item.room_id}`);
          }
          if (item.profile?.image_square || item.profile?.image) {
            lines.push(`• Foto Profil: ${item.profile.image_square || item.profile.image}`);
          }
          lines.push(``);
        }

        const topMember = list[0];
        const topImage = topMember?.profile?.image_square || topMember?.profile?.image;

        const caption = lines.join("\n").trim();

        if (topImage) {
          try {
            const img = await fetchBuffer(topImage, { redirect: "follow" });
            return await sock.sendMessage(
              msg.key.remoteJid,
              { image: img, caption },
              { quoted: msg }
            );
          } catch (_) {}
        }

        await reply(caption);
      } catch (err) {
        console.error("[JKT48 Showroom Error]", err.message);
        await reply(`Gagal memuat leaderboard Showroom: ${err.message}`);
      }
    },
};
