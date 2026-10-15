import axios from "axios";

export default {
  name: "gempa",
  aliases: ["infogempa", "bmkg"],
  description: "Gempa terkini dari BMKG + peta guncangan",
  usage: "",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    let g = null;
    try {
      const res = await axios.get("https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json", { timeout: 15000 });
      g = res?.data?.Infogempa?.gempa || null;
    } catch (err) {
      return reply(`Gagal memuat data BMKG: ${err?.message || "network error"}`);
    }
    if (!g) return reply("Data gempa BMKG kosong, coba lagi nanti.");
    const text =
      `*GEMPA TERKINI — BMKG*\n\n` +
      `• Waktu : ${g.Tanggal || "-"} ${g.Jam || ""}\n` +
      `• Magnitudo : ${g.Magnitude || "-"} SR\n` +
      `• Kedalaman : ${g.Kedalaman || "-"}\n` +
      `• Lokasi : ${g.Lintang || "-"}, ${g.Bujur || "-"}\n` +
      `• Wilayah : ${g.Wilayah || "-"}\n` +
      (g.Dirasakan ? `• Dirasakan : ${g.Dirasakan}\n` : "") +
      (g.Potensi ? `• Potensi : ${g.Potensi}` : "");
    if (g.Shakemap) {
      try {
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: { url: `https://data.bmkg.go.id/DataMKG/TEWS/${g.Shakemap}` }, caption: text.trim() },
          { quoted: msg }
        );
        return;
      } catch (_) {}
    }
    return reply(text.trim());
  },
};
