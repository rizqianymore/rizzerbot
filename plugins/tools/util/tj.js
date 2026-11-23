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
        `┌── TRANSJAKARTA LIVE TRACKER (TIJE)\n` +
          `│ Posisi bus real-time & estimasi kedatangan di halte.\n` +
          `└──\n\n` +
          `├── [1] Cek Bus Tiba di Halte\n` +
          `│   Format: ${p}tj <nama halte>\n` +
          `│   Contoh: ${p}tj Blok M\n` +
          `│\n` +
          `├── [2] Cari Nama / ID Halte\n` +
          `│   Format: ${p}tj cari <kata kunci>\n` +
          `│   Contoh: ${p}tj cari Kuningan\n` +
          `│\n` +
          `├── [3] Cek Rute dari Halte\n` +
          `│   Format: ${p}tj rute <nama halte> [tujuan]\n` +
          `│   Contoh: ${p}tj rute "Blok M" Monas\n` +
          `│\n` +
          `└── [4] Detail 1 Armada Bus\n` +
          `    Format: ${p}tj bus <no bodi>\n` +
          `    Contoh: ${p}tj bus TJ-336`
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

      let text =
        `┌── PENCARIAN HALTE TRANSJAKARTA\n` +
        `│ Kata Kunci : ${keyword}\n` +
        `│ Ditemukan  : ${hits.length} halte\n` +
        `└──\n\n`;

      hits.forEach((h, i) => {
        const isLast = i === hits.length - 1;
        const branch = isLast ? "└──" : "├──";
        const subPipe = isLast ? "   " : "│  ";
        const routes = (h.routes || [])
          .slice(0, 4)
          .map((r) => r.route_code)
          .join(", ");

        text += `${branch} [${i + 1}] ${h.stop_name} (${h.stop_id})\n`;
        if (routes) text += `${subPipe} Rute : ${routes}\n`;
        if (!isLast) text += `│\n`;
      });

      text += `\n_Ketik \`${p}tj <nama halte>\` untuk cek jadwal kedatangan bus._`;
      return reply(text);
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
          `┌── RUTE DARI HALTE\n` +
            `│ Halte : ${halte.stop_name} (${halte.stop_id})\n` +
            `└──\n\n` +
            `_Tidak ditemukan bus/rute aktif dari halte ini${tujuanQuery ? ` menuju "${tujuanQuery}"` : ""}_`
        );
      }

      let text =
        `┌── RUTE DARI HALTE\n` +
        `│ Halte       : ${res.stopName || halte.stop_name} (${res.stopId || halte.stop_id})\n` +
        `│ Waktu Acuan : ${timeStr}\n` +
        (tujuanQuery ? `│ Filter Arah : ${tujuanQuery}\n` : "") +
        `└──\n\n`;

      const displayRoutes = res.routes.slice(0, 7);
      displayRoutes.forEach((r, i) => {
        const isLast = i === displayRoutes.length - 1;
        const branch = isLast ? "└──" : "├──";
        const subPipe = isLast ? "   " : "│  ";
        const etaText = r.eta != null ? `${r.eta} mnt` : `Segera`;

        text += `${branch} [${i + 1}] Koridor ${r.route} ➔ ${r.tujuan}\n`;
        text += `${subPipe} Estimasi : ${etaText}\n`;
        text += `${subPipe} Armada   : ${r.jumlahBus} bus terdeteksi\n`;
        if (!isLast) text += `│\n`;
      });

      text += `\n_Menampilkan ${displayRoutes.length} rute aktif. Sumber: tijeapi.transjakarta.co.id_`;
      return reply(text);
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

      let text =
        `┌── DETAIL ARMADA BUS TRANSJAKARTA\n` +
        `│ No Bodi   : ${bus.bus_body_no || bodyNo}\n` +
        `│ Koridor   : ${bus.route_code || "-"} (${bus.route_name || "-"})\n` +
        `│ Arah      : ${bus.trip_headsign || "-"}\n` +
        `│ Kecepatan : ${bus.speed || 0} km/j\n` +
        `│ Stop Lalu : ${bus.prev_stops || "-"}\n` +
        `│ Stop Depan: ${bus.next_stops || "-"}\n` +
        `└──\n\n`;

      if (Array.isArray(bus.stops) && bus.stops.length > 0) {
        text += `HALTE BERIKUTNYA YANG AKAN DILALUI:\n`;
        const upcomingStops = bus.stops.slice(0, 6);
        upcomingStops.forEach((st, idx) => {
          const isLast = idx === upcomingStops.length - 1;
          const branch = isLast ? "└──" : "├──";
          text += `${branch} [${st.stop_sequence || idx + 1}] ${st.parent_stop_name || st.name} (ETA: ${st.eta ?? 0} mnt)\n`;
        });
      }

      return reply(text);
    }

    // 4. DAFTAR RUTE / KORIDOR RESMI
    if (sub === "koridor" || sub === "routes" || sub === "daftar") {
      const filterWord = args.slice(1).join(" ").trim();
      await sendTyping();
      const routes = await tjLive.getRoutesList(filterWord);

      if (!routes || routes.length === 0) {
        return reply(`❌ Tidak ditemukan koridor / rute TransJakarta dengan kata kunci "*${filterWord}*".`);
      }

      let text =
        `┌── KORIDOR TRANSJAKARTA\n` +
        `│ Total Rute : ${routes.length} rute\n` +
        (filterWord ? `│ Filter     : ${filterWord}\n` : "") +
        `└──\n\n`;

      const display = routes.slice(0, 10);
      display.forEach((r, i) => {
        const isLast = i === display.length - 1;
        const branch = isLast ? "└──" : "├──";
        const subPipe = isLast ? "   " : "│  ";
        text += `${branch} [${r.route_short_name}] ${r.route_long_name}\n`;
        text += `${subPipe} Tipe: ${r.route_desc || "BRT"} | Tarif: Rp${r.price || "3.500"}\n`;
        if (!isLast) text += `│\n`;
      });

      if (routes.length > 10) {
        text += `\n_Menampilkan 10 dari ${routes.length} rute. Persempit: \`${p}tj koridor <daerah>\`_`;
      }
      return reply(text);
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
        `┌── TRANSJAKARTA LIVE BUS\n` +
          `│ Halte       : ${halte.stop_name} (${halte.stop_id})\n` +
          `│ Waktu Acuan : ${timeStr}\n` +
          `└──\n\n` +
          `_Saat ini tidak ada bus aktif dalam radius halte atau data GPS sedang diperbarui._\n` +
          `_Coba ketik \`${p}tj rute "${halte.stop_name}"\` untuk melihat rute jalur halte ini._`
      );
    }

    // Tampilkan 5 armada terdekat
    const displayBuses = arrivals.slice(0, 5);

    let text =
      `┌── TRANSJAKARTA LIVE BUS\n` +
      `│ Halte       : ${halte.stop_name} (${halte.stop_id})\n` +
      `│ Waktu Acuan : ${timeStr}\n` +
      `└──\n\n`;

    displayBuses.forEach((b, i) => {
      const isLast = i === displayBuses.length - 1;
      const branch = isLast ? "└──" : "├──";
      const subPipe = isLast ? "   " : "│  ";

      const etaStr = typeof b.eta === "number" && b.eta > 0 ? `${b.eta} mnt lagi` : `Tiba sekarang / Dekat`;
      const distStr = b.jarak != null ? ` (±${Math.round(b.jarak)}m)` : "";

      text += `${branch} [${i + 1}] Koridor ${b.route} ➔ ${b.tujuan}\n`;
      text += `${subPipe} No Bodi   : ${b.body}\n`;
      text += `${subPipe} Estimasi  : ${etaStr}${distStr}\n`;
      text += `${subPipe} Kecepatan : ${b.speed} km/j (Update ${b.umur ?? 0}s lalu)\n`;
    });

    text += `\n_Menampilkan 5 armada terdekat. Sumber: tijeapi.transjakarta.co.id_`;

    return reply(text);
  },
};
