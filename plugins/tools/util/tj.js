import { resolveHalte, searchHalte, getLiveBuses } from "@/src/services/transport/transjakarta.js";

export default {
  name: "transjakarta",
  aliases: ["tj", "tije", "busway", "halte"],
  description: "Cek bus TransJakarta live & ETA kedatangan halte (data real-time TIJE)",
  usage: "<nama halte> | cari <kata kunci>",
  category: "Info",
  cooldownMs: 5000,

  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const p = prefix || ".";
    if (!args[0]) {
      return reply(
        `🚌 *TRANSJAKARTA LIVE TRACKER (TIJE)*\n\n` +
          `Cek posisi live bus TransJakarta dan estimasi kedatangan (ETA) di halte.\n\n` +
          `*Cara Penggunaan:*\n` +
          `• \`${p}tj <nama halte>\` : Cek bus yang akan tiba di halte\n` +
          `• \`${p}tj cari <kata kunci>\` : Cari nama & ID halte di Jakarta\n\n` +
          `*Contoh:*\n` +
          `│ \`${p}tj Blok M\`\n` +
          `│ \`${p}tj Monas\`\n` +
          `│ \`${p}tj Bundaran HI\`\n` +
          `│ \`${p}tj Harmoni\`\n` +
          `│ \`${p}tj cari Tebet\``
      );
    }

    const first = args[0].toLowerCase();

    // Mode 1: Cari halte
    if (first === "cari" || first === "search") {
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
        if (routes) text += `${subPipe} Rute: ${routes}\n`;
        if (!isLast) text += `│\n`;
      });

      text += `\n_Ketik \`${p}tj <nama halte>\` untuk cek kedatangan bus._`;
      return reply(text);
    }

    // Mode 2: Live arrival di halte
    const query = args.join(" ").trim();
    await sendTyping();

    const halte = resolveHalte(query);
    if (!halte) {
      return reply(
        `❌ Halte *"${query}"* tidak ditemukan di database TransJakarta.\n\n` +
          `_Coba cari nama resminya terlebih dahulu dengan ketik: \`${p}tj cari ${query}\`_`
      );
    }

    const buses = await getLiveBuses(halte.stop_lat, halte.stop_lon, {
      radius: 1200,
      stopId: halte.stop_id,
      maxAge: 120,
    });

    const now = new Date();
    const wibHours = (now.getUTCHours() + 7) % 24;
    const wibMinutes = now.getUTCMinutes();
    const timeStr = `${String(wibHours).padStart(2, "0")}:${String(wibMinutes).padStart(2, "0")} WIB`;

    if (!buses || buses.length === 0) {
      return reply(
        `┌── TRANSJAKARTA LIVE BUS\n` +
          `│ Halte       : ${halte.stop_name} (${halte.stop_id})\n` +
          `│ Waktu Acuan : ${timeStr}\n` +
          `└──\n\n` +
          `_Saat ini tidak ada bus aktif dalam radius halte atau data GPS sedang diperbarui._\n` +
          `_Coba lagi dalam beberapa saat._`
      );
    }

    // Limit to 5 nearest approaching buses (Clean Linux Tree Layout)
    const displayBuses = buses.slice(0, 5);

    let text =
      `┌── TRANSJAKARTA LIVE BUS\n` +
      `│ Halte       : ${halte.stop_name} (${halte.stop_id})\n` +
      `│ Waktu Acuan : ${timeStr}\n` +
      `└──\n\n`;

    displayBuses.forEach((b, i) => {
      const isLast = i === displayBuses.length - 1;
      const branch = isLast ? "└──" : "├──";
      const subPipe = isLast ? "   " : "│  ";

      const etaStr = b.eta > 0 ? `${b.eta} menit` : `Tiba sekarang / Dekat`;

      text += `${branch} [${i + 1}] Koridor ${b.routeCode} ➔ ${b.headsign}\n`;
      text += `${subPipe} No Bodi   : ${b.bodyNo}\n`;
      text += `${subPipe} Estimasi  : ${etaStr} (±${b.distance} m)\n`;
      text += `${subPipe} Kecepatan : ${b.speed} km/j (Update ${b.ageSeconds}s lalu)\n`;
      if (!isLast) text += `│\n`;
    });

    text += `\n_Menampilkan 5 armada terdekat. Sumber: tijeapi.transjakarta.co.id_`;

    return reply(text);
  },
};
