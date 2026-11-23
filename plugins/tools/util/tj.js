import { resolveHalte, searchHalte, tjLive } from "@/src/services/transport/transjakarta.js";

function getWibTime() {
  const now = new Date();
  const wibHours = (now.getUTCHours() + 7) % 24;
  const wibMinutes = now.getUTCMinutes();
  return `${String(wibHours).padStart(2, "0")}:${String(wibMinutes).padStart(2, "0")} WIB`;
}

export default {
  name: "transjakarta",
  aliases: ["tj", "tije", "busway", "halte"],
  description: "Cek bus TransJakarta live, rute koridor, & ETA kedatangan halte (TIJE API)",
  usage: "<nama halte> | cari <nama> | rute <nama halte> [tujuan] | bus <no bodi>",
  category: "Info",
  cooldownMs: 5000,

  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const p = prefix || ".";
    if (!args[0]) {
      return reply(
        `*TRANSJAKARTA LIVE TRACKER (TIJE)*\n\n` +
          `Sistem informasi posisi bus real-time & estimasi kedatangan di halte.\n\n` +
          `*Cara Penggunaan:*\n` +
          `│ \`${p}tj <nama halte>\` : Cek bus yang akan tiba di halte\n` +
          `│ \`${p}tj cari <kata kunci>\` : Cari nama & ID halte di Jakarta\n` +
          `│ \`${p}tj rute <nama halte> [tujuan]\` : Cek rute bus dari halte ini\n` +
          `│ \`${p}tj bus <no bodi>\` : Detail posisi & rute 1 bus (cth: TJ-336)\n` +
          `│ \`${p}tj koridor [nomor/nama]\` : Daftar rute & tarif TransJakarta\n\n` +
          `*Contoh:*\n` +
          `│ \`${p}tj Blok M\`\n` +
          `│ \`${p}tj Monas\`\n` +
          `│ \`${p}tj cari Tebet\`\n` +
          `│ \`${p}tj rute "Jembatan Gantung" Monumen\`\n` +
          `│ \`${p}tj bus TJ-336\``
      );
    }

    const sub = args[0].toLowerCase();
    const timeStr = getWibTime();

    // 1. CARI HALTE
    if (sub === "cari" || sub === "search") {
      const keyword = args.slice(1).join(" ").trim();
      if (!keyword) {
        return reply(`Gunakan: \`${p}tj cari <nama halte>\`\nContoh: \`${p}tj cari Kuningan\``);
      }

      await sendTyping();
      const hits = searchHalte(keyword, 8);

      if (hits.length === 0) {
        return reply(`❌ Halte dengan kata kunci "*${keyword}*" tidak ditemukan di database TransJakarta.`);
      }

      let content =
        `PENCARIAN HALTE TRANSJAKARTA\n` + `Kata Kunci : ${keyword}\n` + `Ditemukan  : ${hits.length} halte\n\n`;

      hits.forEach((h, i) => {
        const routes = (h.routes || [])
          .slice(0, 4)
          .map((r) => r.route_code)
          .join(", ");

        content += `[${i + 1}] ${h.stop_name} (${h.stop_id})\n`;
        if (routes) content += `    Rute : ${routes}\n`;
        content += `\n`;
      });

      return reply(`\`\`\`\n${content.trim()}\n\`\`\`\n\n_Ketik \`${p}tj <nama halte>\` untuk cek kedatangan bus._`);
    }

    // 2. RUTE DARI HALTE (NAIK APA DARI SINI)
    if (sub === "rute" || sub === "naik") {
      const rest = args.slice(1).join(" ").trim();
      if (!rest) {
        return reply(`Gunakan: \`${p}tj rute <nama halte> [tujuan]\`\nContoh: \`${p}tj rute "Blok M" Monas\``);
      }

      let halteQuery = rest;
      let tujuanQuery = "";

      if (rest.startsWith('"')) {
        const endQuote = rest.indexOf('"', 1);
        if (endQuote !== -1) {
          halteQuery = rest.slice(1, endQuote).trim();
          tujuanQuery = rest.slice(endQuote + 1).trim();
        }
      }

      await sendTyping();
      const halte = resolveHalte(halteQuery);
      if (!halte) {
        return reply(`❌ Halte "*${halteQuery}*" tidak ditemukan. Coba ketik: \`${p}tj cari ${halteQuery}\``);
      }

      const res = await tjLive.getRuteFromHalte(halte.stop_lat, halte.stop_lon, {
        radius: 1200,
        tujuan: tujuanQuery || null,
      });

      if (!res.routes || res.routes.length === 0) {
        return reply(
          `\`\`\`\nRUTE DARI HALTE\nHalte : ${halte.stop_name} (${halte.stop_id})\n\nTidak ada rute aktif saat ini.\`\`\``
        );
      }

      let content =
        `RUTE DARI HALTE\n` +
        `Halte : ${res.stopName || halte.stop_name} (${res.stopId || halte.stop_id})\n` +
        `Waktu : ${timeStr}\n` +
        (tujuanQuery ? `Arah  : ${tujuanQuery}\n` : "") +
        `----------------------------------------\n\n`;

      const displayRoutes = res.routes.slice(0, 7);
      displayRoutes.forEach((r, i) => {
        const etaText = r.eta != null ? `${r.eta} mnt` : `Segera`;
        content += `[${i + 1}] Koridor ${r.route} -> ${r.tujuan}\n`;
        content += `    ETA    : ${etaText}\n`;
        content += `    Armada : ${r.jumlahBus} bus terdeteksi\n\n`;
      });

      return reply(`\`\`\`\n${content.trim()}\n\`\`\`\n\n_Sumber: tijeapi.transjakarta.co.id_`);
    }

    // 3. DETAIL 1 BUS BERDASARKAN NOMOR BODI
    if (sub === "bus" || sub === "body") {
      const bodyNo = args[1];
      if (!bodyNo) {
        return reply(`Gunakan: \`${p}tj bus <nomor bodi bus>\`\nContoh: \`${p}tj bus TJ-336\``);
      }

      await sendTyping();
      const bus = await tjLive.getBusDetail(bodyNo);
      if (!bus) {
        return reply(`❌ Bus dengan nomor bodi "*${bodyNo}*" tidak ditemukan dalam area aktif saat ini.`);
      }

      let content =
        `DETAIL ARMADA BUS TRANSJAKARTA\n` +
        `No Bodi   : ${bus.bus_body_no || bodyNo}\n` +
        `Koridor   : ${bus.route_code || "-"} (${bus.route_name || "-"})\n` +
        `Arah      : ${bus.trip_headsign || "-"}\n` +
        `Kecepatan : ${bus.speed || 0} km/j\n` +
        `Stop Lalu : ${bus.prev_stops || "-"}\n` +
        `Stop Depan: ${bus.next_stops || "-"}\n` +
        `----------------------------------------\n\n`;

      if (Array.isArray(bus.stops) && bus.stops.length > 0) {
        content += `HALTE BERIKUTNYA (ETA):\n`;
        const upcomingStops = bus.stops.slice(0, 6);
        upcomingStops.forEach((st, idx) => {
          content += `[${idx + 1}] ${st.parent_stop_name || st.name} (ETA: ${st.eta ?? 0} mnt)\n`;
        });
      }

      return reply(`\`\`\`\n${content.trim()}\n\`\`\``);
    }

    // 4. DAFTAR RUTE / KORIDOR RESMI
    if (sub === "koridor" || sub === "routes" || sub === "daftar") {
      const filterWord = args.slice(1).join(" ").trim();
      await sendTyping();
      const routes = await tjLive.getRoutesList(filterWord);

      if (!routes || routes.length === 0) {
        return reply(`❌ Tidak ditemukan koridor / rute TransJakarta dengan kata kunci "*${filterWord}*".`);
      }

      let content =
        `KORIDOR TRANSJAKARTA\n` +
        `Total Rute : ${routes.length} rute\n` +
        (filterWord ? `Filter     : ${filterWord}\n` : "") +
        `----------------------------------------\n\n`;

      const display = routes.slice(0, 8);
      display.forEach((r) => {
        content += `[${r.route_short_name}] ${r.route_long_name}\n`;
        content += `    Tarif: Rp${r.price || "3.500"} | Tipe: ${r.route_desc || "BRT"}\n\n`;
      });

      return reply(
        `\`\`\`\n${content.trim()}\n\`\`\`\n\n_Menampilkan 8 dari ${routes.length} rute. Persempit: \`${p}tj koridor <daerah>\`_`
      );
    }

    // 5. DEFAULT: CEK BUS TIBA DI HALTE (ETA)
    const query = args.join(" ").trim();
    await sendTyping();

    const halte = resolveHalte(query);
    if (!halte) {
      return reply(
        `❌ Halte *"${query}"* tidak ditemukan di database TransJakarta.\n\n` +
          `_Coba cari nama resminya terlebih dahulu dengan: \`${p}tj cari ${query}\`_`
      );
    }

    const arrivalsData = await tjLive.getHalteArrivals(halte.stop_lat, halte.stop_lon, {
      radius: 1200,
      stopId: halte.stop_id,
      maxAge: 120,
    });

    const arrivals = arrivalsData?.arrivals || [];

    if (arrivals.length === 0) {
      return reply(
        `\`\`\`\nTRANSJAKARTA LIVE BUS\nHalte : ${halte.stop_name} (${halte.stop_id})\nWaktu : ${timeStr}\n\nTidak ada bus aktif dalam radius halte saat ini.\`\`\``
      );
    }

    // Tampilkan 5 armada terdekat
    const displayBuses = arrivals.slice(0, 5);

    let content =
      `TRANSJAKARTA LIVE BUS\n` +
      `Halte : ${halte.stop_name} (${halte.stop_id})\n` +
      `Waktu : ${timeStr}\n` +
      `----------------------------------------\n\n`;

    displayBuses.forEach((b, i) => {
      const etaStr = typeof b.eta === "number" && b.eta > 0 ? `${b.eta} mnt` : `Tiba / Dekat`;
      const distStr = b.jarak != null ? `${Math.round(b.jarak)}m` : "-";

      content += `[${i + 1}] Koridor ${b.route} -> ${b.tujuan}\n`;
      content += `    Bodi : ${b.body}\n`;
      content += `    ETA  : ${etaStr} (±${distStr})\n`;
      content += `    Laju : ${b.speed} km/j (${b.umur ?? 0}s lalu)\n\n`;
    });

    return reply(
      `\`\`\`\n${content.trim()}\n\`\`\`\n\n_Menampilkan 5 armada terdekat. Sumber: tijeapi.transjakarta.co.id_`
    );
  },
};
