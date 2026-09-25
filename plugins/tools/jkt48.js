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

const JKT48_BASE = "https://jkt48.com";

const MONTH_NAMES = {
  januari: 1, jan: 1, january: 1,
  februari: 2, feb: 2, february: 2,
  maret: 3, mar: 3, march: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  agustus: 8, agu: 8, agt: 8, august: 8,
  september: 9, sep: 9,
  oktober: 10, okt: 10, october: 10,
  november: 11, nov: 11,
  desember: 12, des: 12, december: 12,
};

function formatDate(dateStr) {
  if (!dateStr) return "tanggal belum ditentukan";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch (_) {
    return dateStr;
  }
}

function formatPrice(num) {
  if (!num) return "belum ditentukan";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

function parseUserQuery(args, now = new Date()) {
  const raw = args.join(" ").trim().toLowerCase();
  if (!raw) {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  if (raw === "hari ini" || raw === "today") {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  if (raw === "besok" || raw === "tomorrow") {
    const tmrw = new Date(now.getTime() + 86400000);
    const y = tmrw.getFullYear();
    const m = tmrw.getMonth() + 1;
    const d = tmrw.getDate();
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  // Format: YYYY-MM-DD
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  // Format: DD-MM-YYYY atau DD/MM/YYYY
  match = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (match) {
    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const y = parseInt(match[3], 10);
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  // Format: "4 September 2026" atau "4 September"
  match = raw.match(/^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?$/);
  if (match && MONTH_NAMES[match[2]]) {
    const d = parseInt(match[1], 10);
    const m = MONTH_NAMES[match[2]];
    const y = match[3] ? parseInt(match[3], 10) : now.getFullYear();
    return {
      type: "date",
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      year: y,
      month: m,
      day: d,
    };
  }

  // Format: Angka hari dalam bulan ini (misal "4" atau "15")
  if (/^\d{1,2}$/.test(raw)) {
    const d = parseInt(raw, 10);
    if (d >= 1 && d <= 31) {
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      return {
        type: "date",
        dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        year: y,
        month: m,
        day: d,
      };
    }
  }

  // Jika bukan tanggal, dianggap sebagai kode show atau slug
  return { type: "code", code: args.join(" ").trim() };
}

export default [
  {
    name: "jkt48",
    aliases: ["memberjkt", "jkt", "jktmember"],
    description: "Informasi profil dan daftar member resmi JKT48",
    premiumOnly: true,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const query = args.join(" ").trim();

      if (!query) {
        await reply("Memuat daftar member resmi langsung dari web JKT48...");
        try {
          const members = await getJkt48Members();
          const sampleNames = members
            .slice(0, 6)
            .map((m) => m.name)
            .join(", ");

          const text = `Saat ini JKT48 memiliki ${members.length} member aktif yang beraktivitas di berbagai tim dan generasi, seperti ${sampleNames}, dan lainnya. Anda dapat membaca profil lengkap serta melihat foto resmi masing-masing member dengan mengetikkan perintah ${prefix}jkt48 diikuti nama atau ID member yang ingin dicari, sebagai contoh ${prefix}jkt48 Freya atau ${prefix}jkt48 244.`;

          await reply(text);
        } catch (err) {
          await reply(`Gagal memuat daftar member: ${err.message}`);
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

        // Gambar embed hanya dari situs resmi JKT48
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
  },

  {
    name: "jkt48news",
    aliases: ["jktnews", "beritajkt48"],
    description: "Rangkuman berita dan pengumuman resmi terbaru JKT48",
    premiumOnly: true,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      await reply("Memuat rangkuman berita terbaru dari situs resmi JKT48...");

      const limit = parseInt(args[0], 10) || 5;

      try {
        const newsList = await getJkt48News(limit);
        if (!Array.isArray(newsList) || newsList.length === 0) {
          return reply("Tidak ada pengumuman berita JKT48 yang tersedia saat ini.");
        }

        const newsNarrative = newsList
          .map((item, idx) => {
            const tgl = formatDate(item.valid_date_from);
            const cat = item.category ? `kategori *${item.category}*` : "pengumuman";
            const url = item.link ? `${JKT48_BASE}/news/${item.link}` : "situs web JKT48";
            return `${idx + 1}. *${item.title}* (${cat}, dirilis pada *${tgl}*, tautan: ${url})`;
          })
          .join("; ");

        const text = `Berikut rangkuman berita dan pengumuman resmi terbaru dari manajemen JKT48: ${newsNarrative}. Untuk membaca rincian lengkap setiap pengumuman, silakan akses tautan resmi yang tertera.`;

        await reply(text);
      } catch (err) {
        console.error("[JKT48 News Error]", err.message);
        await reply(`Gagal mengambil berita JKT48: ${err.message}`);
      }
    },
  },

  {
    name: "jkt48schedule",
    aliases: ["jktschedule", "jadwaljkt48", "jktjadwal", "jkt48show"],
    description: "Jadwal dan rincian show theater resmi JKT48 dengan pemilihan tanggal spesifik",
    premiumOnly: true,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();

      const parsed = parseUserQuery(args);

      // Jika input berupa kode show atau slug spesifik
      if (parsed.type === "code") {
        await reply(`Mencari rincian pertunjukan "${parsed.code}"...`);

        try {
          const detail = await getJkt48ScheduleDetail(parsed.code);
          const team = detail.jkt48_member_type ? `oleh *Tim ${detail.jkt48_member_type}*` : "oleh JKT48";
          const price = formatPrice(detail.default_price);
          const showDate = formatDate(detail.date);
          const showTime =
            detail.start_time && detail.end_time
              ? `*${detail.start_time.slice(0, 5)} hingga ${detail.end_time.slice(0, 5)} WIB*`
              : "waktu belum ditentukan";
          const openGate = detail.reception_start_time
            ? `dengan waktu open gate mulai *${detail.reception_start_time.slice(0, 5)} WIB*`
            : "";

          const memberNames =
            Array.isArray(detail.jkt48_member) && detail.jkt48_member.length > 0
              ? `Pertunjukan ini menampilkan *${detail.jkt48_member.length} member* yaitu ${detail.jkt48_member.map((m) => m.name).join(", ")}.`
              : "Daftar member penampil akan diumumkan kemudian.";

          const salesSummary =
            Array.isArray(detail.sales_period) && detail.sales_period.length > 0
              ? `Penjualan tiket dibuka untuk ` +
              detail.sales_period
                .map(
                  (s) =>
                    `*${s.label}* (${formatDate(s.start_date)} sampai ${formatDate(s.end_date)}, metode ${s.sales_method || "langsung"})`
                )
                .join(", ") +
              "."
              : "";

          const text = `Pertunjukan teater *${detail.title}* ${team} dengan kode *${detail.code || parsed.code}* dijadwalkan pada *${showDate}* pukul ${showTime} ${openGate} dengan harga tiket *${price}*. ${memberNames} ${salesSummary} Informasi lengkap dan reservasi tiket resmi dapat diakses melalui ${JKT48_BASE}/schedule/${detail.link || parsed.code}.`;

          return await reply(text);
        } catch (err) {
          console.error("[JKT48 Show Detail Error]", err.message);
          return await reply(`Gagal memuat rincian pertunjukan: ${err.message}`);
        }
      }

      // Pencarian berdasarkan tanggal spesifik
      const targetDateStr = parsed.dateStr;
      const formattedTargetDate = formatDate(targetDateStr);

      await reply(`Memeriksa jadwal pertunjukan JKT48 untuk tanggal ${formattedTargetDate}...`);

      try {
        const { schedules } = await getJkt48Schedules(parsed.month, parsed.year);

        if (!Array.isArray(schedules) || schedules.length === 0) {
          return reply(
            `Tidak ditemukan data jadwal pertunjukan JKT48 untuk periode ${parsed.month}/${parsed.year}.`
          );
        }

        // Cari jadwal yang tepat berada di tanggal yang dipilih
        const exactShows = schedules.filter((s) => s.date === targetDateStr);

        if (exactShows.length > 0) {
          const exactNarrative = exactShows
            .map((s, idx) => {
              const team = s.jkt48_member_type ? `oleh *Tim ${s.jkt48_member_type}*` : "";
              const time =
                s.start_time && s.end_time
                  ? `pukul *${s.start_time.slice(0, 5)} hingga ${s.end_time.slice(0, 5)} WIB*`
                  : "waktu menyesuaikan";
              const code = s.reference_code ? ` (kode show *${s.reference_code}*)` : "";
              return `${idx + 1}. *${s.title}* ${team} ${time}${code}, tautan ${JKT48_BASE}/schedule/${s.link}`;
            })
            .join("; ");

          const text = `Pada tanggal *${formattedTargetDate}*, JKT48 menyelenggarakan pertunjukan teater resmi sebagai berikut: ${exactNarrative}. Untuk melihat daftar member penampil dan pemesanan tiket, ketikkan perintah ${prefix}jktschedule diikuti kode show yang tertera.`;

          return await reply(text);
        }

        // Jika tidak ada jadwal pada tanggal yang dipilih, tampilkan minimal 5 opsi alternatif terdekat
        const targetTime = new Date(targetDateStr).getTime();
        const sortedAlternatives = [...schedules].sort((a, b) => {
          const diffA = Math.abs(new Date(a.date).getTime() - targetTime);
          const diffB = Math.abs(new Date(b.date).getTime() - targetTime);
          return diffA - diffB;
        });

        const topAlternatives = sortedAlternatives.slice(0, 5);
        const altNarrative = topAlternatives
          .map((s, idx) => {
            const tgl = formatDate(s.date);
            const team = s.jkt48_member_type ? `oleh *Tim ${s.jkt48_member_type}*` : "";
            const time =
              s.start_time && s.end_time
                ? `pukul *${s.start_time.slice(0, 5)} WIB*`
                : "";
            const code = s.reference_code ? `kode show *${s.reference_code}*` : `kode show *${s.link}*`;
            return `${idx + 1}. *${s.title}* ${team} pada *${tgl}* ${time} (${code}, tautan ${JKT48_BASE}/schedule/${s.link})`;
          })
          .join("; ");

        const text = `Tidak terdapat jadwal pertunjukan teater JKT48 pada tanggal *${formattedTargetDate}*. Sebagai 5 opsi alternatif pertunjukan terdekat, Anda dapat menyaksikan: ${altNarrative}. Untuk melihat rincian member yang tampil serta reservasi tiket, silakan gunakan perintah ${prefix}jktschedule diikuti kode show yang Anda pilih.`;

        await reply(text);
      } catch (err) {
        console.error("[JKT48 Schedule Error]", err.message);
        await reply(`Gagal memuat jadwal pertunjukan JKT48: ${err.message}`);
      }
    },
  },

  {
    name: "jkt48showroom",
    aliases: ["jktshowroom", "showroomjkt", "srjkt48", "srjkt"],
    description: "Peringkat dan leaderboard live Showroom member JKT48",
    premiumOnly: true,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
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
          const liveStatus = item.profile?.is_onlive ? "🔴 *Sedang Live*" : "⚪ *Offline*";
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
  },

  {
    name: "jkt48theater",
    aliases: ["jkttheater", "showtheater", "jadwalteater"],
    description: "Jadwal pertunjukan teater mingguan JKT48 beserta link tiket live streaming & teater",
    premiumOnly: true,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      await reply("Memuat jadwal pertunjukan teater JKT48 minggu ini...");

      try {
        const schedules = await getShowroomSchedules(true);

        if (!Array.isArray(schedules) || schedules.length === 0) {
          return await reply("Tidak ada pertunjukan teater mingguan yang terdaftar saat ini.");
        }

        const lines = [
          `*Jadwal Teater JKT48 Minggu Ini*`,
          `_Sumber: Live Theater & Showroom API_`,
          ``,
        ];

        for (const item of schedules) {
          const showDateStr = item.showDate ? formatDate(item.showDate.split("T")[0]) : "-";
          const time = item.showTime ? `pukul *${item.showTime} WIB*` : "";
          const setlistName = item.setlist?.name || "Pertunjukan Teater";

          let specialTag = "";
          if (item.isBirthdayShow && item.birthdayMember?.name) {
            specialTag = ` 🎂 *Birthday Show ${item.birthdayMember.name}*`;
          } else if (item.isGraduationShow && item.graduateMember?.name) {
            specialTag = ` 🎓 *Graduation Show ${item.graduateMember.name}*`;
          }

          lines.push(`• *${setlistName}*${specialTag}`);
          lines.push(`  - Tanggal & Waktu: *${showDateStr}* ${time}`.trim());

          if (item.ticketTheater) {
            lines.push(`  - Tiket Teater: ${item.ticketTheater}`);
          }
          if (item.ticketShowroom) {
            lines.push(`  - Live Streaming: ${item.ticketShowroom}`);
          }

          if (Array.isArray(item.memberList) && item.memberList.length > 0) {
            const memberNames = item.memberList.map((m) => m.stage_name || m.name).join(", ");
            lines.push(`  - Member Lineup: ${memberNames}`);
          }
          lines.push(``);
        }

        lines.push(`Ketik \`${prefix}jktschedule\` untuk memeriksa jadwal di kalender resmi situs web JKT48.`);

        const caption = lines.join("\n").trim();
        const firstWithImage = schedules.find((s) => s.setlist?.image);

        if (firstWithImage?.setlist?.image) {
          try {
            const img = await fetchBuffer(firstWithImage.setlist.image, { redirect: "follow" });
            return await sock.sendMessage(
              msg.key.remoteJid,
              { image: img, caption },
              { quoted: msg }
            );
          } catch (_) {}
        }

        await reply(caption);
      } catch (err) {
        console.error("[JKT48 Theater Error]", err.message);
        await reply(`Gagal memuat jadwal teater mingguan: ${err.message}`);
      }
    },
  },
];


