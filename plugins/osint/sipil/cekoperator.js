import { parseOperator } from "@/src/services/osint/cekoperator.js";
import { searchByPhone, isDukcapilReady } from "@/src/services/osint/dukcapilService.js";

export default {
  name: "cekoperator",
  aliases: ["cekhlr", "hlr", "operator", "cekhp", "opnomor"],
  description: "Cek operator seluler dan data Dukcapil terhubung (MSISDN, NIK, Nama, Alamat, Koordinat)",
  usage: "<nomor HP, cth: 081212345678>",
  category: "OSINT",
  premiumOnly: true,
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const input = (args[0] || "").trim();

    if (!input) {
      return reply(
        `*CEK OPERATOR*\n\n` +
        `Masukkan nomor HP Indonesia (format 08xx / 628xx / +628xx).\n\n` +
        `*Contoh:*\n` +
        `• \`${currentPrefix}cekoperator 081317464364\`\n` +
        `• \`${currentPrefix}cekoperator 6281293269631\``
      );
    }

    await sendTyping();

    try {
      const op = parseOperator(input);
      if (!op.valid) {
        return reply(`Nomor tidak valid: ${op.reason || "periksa kembali nomor HP"}`);
      }

      let dukcapilData = { records: [] };
      if (isDukcapilReady()) {
        dukcapilData = await searchByPhone(input);
      }

      const records = dukcapilData.records || [];

      // Jika data ditemukan di database Dukcapil
      if (records.length > 0) {
        if (records.length === 1) {
          const r = records[0];
          const lines = [
            `*INFO OPERATOR & DUKCAPIL*`,
            `• MSISDN: \`${r.nohp || op.normalized}\``,
            `• Operator: ${op.operator} (${op.brand})`,
            `• NIK: \`${r.nik || "-"}\``,
            `• Nama: ${r.nama || "-"}`,
            `• Gender: ${r.gender || "-"}`,
            `• TTL: ${r.ttl_umur || r.ttl || "-"}`,
            `• Alamat: ${r.alamat || "-"}`,
            `• Kelurahan: ${r.kelurahan || "-"}`,
            `• Kecamatan: ${r.kecamatan || "-"}`,
            `• Kota/Kab: ${r.kota_kab || "-"}`,
          ];

          if (r.location?.lat && r.location?.lon) {
            lines.push(
              `• Latitude: \`${r.location.lat}\``,
              `• Longitude: \`${r.location.lon}\``,
              `• Maps: https://www.google.com/maps?q=${r.location.lat},${r.location.lon}`
            );

            // Kirim lokasi pin peta WhatsApp jika memungkinkan
            if (sock && msg?.key?.remoteJid) {
              try {
                await sock.sendMessage(
                  msg.key.remoteJid,
                  {
                    location: {
                      degreesLatitude: r.location.lat,
                      degreesLongitude: r.location.lon,
                      name: r.nama || "Lokasi Dukcapil",
                      address: `${r.kelurahan || ""}, ${r.kecamatan || ""}, ${r.kota_kab || ""}`,
                    },
                  },
                  { quoted: msg }
                );
              } catch (_) { }
            }
          }

          return reply(lines.join("\n"));
        }

        // Jika terhubung ke beberapa profil di Dukcapil
        const lines = [
          `*INFO OPERATOR & DUKCAPIL*`,
          `• MSISDN: \`${op.normalized}\``,
          `• Operator: ${op.operator} (${op.brand})`,
          `• Terhubung: ${records.length} data Dukcapil`,
          ``,
        ];

        records.forEach((r, idx) => {
          lines.push(
            `${idx + 1}. *${r.nama}*`,
            `• NIK: \`${r.nik || "-"}\``,
            `• Alamat: ${r.alamat || "-"}`,
            `• Wilayah: ${r.kelurahan || "-"}, ${r.kota_kab || "-"}`,
            r.location?.lat ? `• Latitude: \`${r.location.lat}\`` : null,
            r.location?.lon ? `• Longitude: \`${r.location.lon}\`` : null,
            r.location?.lat ? `• Maps: https://www.google.com/maps?q=${r.location.lat},${r.location.lon}` : null,
            ``
          );
        });

        // Kirim pin untuk record pertama jika ada koordinat
        const firstWithLoc = records.find((x) => x.location?.lat);
        if (firstWithLoc && sock && msg?.key?.remoteJid) {
          try {
            await sock.sendMessage(
              msg.key.remoteJid,
              {
                location: {
                  degreesLatitude: firstWithLoc.location.lat,
                  degreesLongitude: firstWithLoc.location.lon,
                  name: firstWithLoc.nama,
                  address: `${firstWithLoc.kelurahan || ""}, ${firstWithLoc.kota_kab || ""}`,
                },
              },
              { quoted: msg }
            );
          } catch (_) { }
        }

        return reply(lines.filter((l) => l !== null).join("\n"));
      }

      // Jika nomor valid tetapi tidak ada dalam database Dukcapil
      const lines = [
        `*INFO OPERATOR*`,
        `• MSISDN: \`${op.normalized}\``,
        `• Prefix: \`${op.prefix}*\``,
        `• Operator: ${op.operator}`,
        `• Kartu: ${op.brand}`,
        `• Data Dukcapil: Tidak terdaftar di database`,
      ];

      return reply(lines.join("\n"));
    } catch (err) {
      return reply(`Gagal cek operator: ${err?.message || err}`);
    }
  },
};
