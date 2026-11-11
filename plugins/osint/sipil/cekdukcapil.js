import {
  classifyQuery,
  searchByNik,
  searchByPhone,
  searchByName,
  isDukcapilReady,
  formatTtlWithCurrentAge,
} from "@/src/services/osint/dukcapilService.js";

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedResult(key) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return cached.data;
}

function setCachedResult(key, data) {
  if (cache.size > 200) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

function formatSingleRecord(record, nikInfo, operatorInfo, location) {
  const ttlFormatted = formatTtlWithCurrentAge(record.ttl_umur || record.ttl, nikInfo);

  const lines = [
    `*DATA DUKCAPIL*`,
    `NIK: \`${record.nik}\``,
    `Nama: ${record.nama || "-"}`,
    `Gender: ${record.gender || "-"}`,
    `TTL: ${ttlFormatted}`,
  ];

  if (nikInfo?.zodiac) {
    lines.push(`Zodiak: ${nikInfo.zodiac} (${nikInfo.generation || "-"})`);
  }

  lines.push(
    `No. HP: \`${record.nohp || "-"}\`${
      operatorInfo ? ` (${operatorInfo.operator} - ${operatorInfo.brand})` : ""
    }`,
    `Alamat: ${record.alamat || "-"}`,
    `Kelurahan: ${record.kelurahan || "-"}`,
    `Kecamatan: ${record.kecamatan || "-"}`,
    `Kota/Kab: ${record.kota_kab || "-"}`
  );

  if (nikInfo && (nikInfo.province || nikInfo.city || nikInfo.district)) {
    const origin = [nikInfo.province, nikInfo.city, nikInfo.district].filter(Boolean).join(", ");
    lines.push(`Wilayah KTP: ${origin}`);
  }

  if (location?.lat && location?.lon) {
    lines.push(
      `Latitude: \`${location.lat}\``,
      `Longitude: \`${location.lon}\``,
      `Maps: https://www.google.com/maps?q=${location.lat},${location.lon}`
    );
  }

  return lines.join("\n");
}

export default {
  name: "cekdukcapil",
  aliases: ["cekduku", "dukcapil", "cek-nik", "nikcapil"],
  description: "Cek data penduduk Dukcapil mandiri (NIK, No. HP, atau Nama)",
  category: "OSINT",
  usage: "<NIK | nama | nohp>",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const rawQuery = args.join(" ").trim();
    const currentPrefix = prefix || ".";

    if (!rawQuery) {
      return reply(
        `*CEK DUKCAPIL*\n\n` +
          `Penggunaan:\n` +
          `${currentPrefix}cekdukcapil <NIK 16 digit>\n` +
          `${currentPrefix}cekdukcapil <No. HP>\n` +
          `${currentPrefix}cekdukcapil <Nama>\n\n` +
          `Contoh:\n` +
          `${currentPrefix}cekdukcapil 3171072604880003\n` +
          `${currentPrefix}cekdukcapil 081310321726\n` +
          `${currentPrefix}cekdukcapil APDANIEL ALAMSYAH`
      );
    }

    if (!isDukcapilReady()) {
      return reply(`Database Dukcapil tidak tersedia.`);
    }

    await sendTyping();

    const cacheKey = `dukcapil:${rawQuery.toLowerCase()}`;
    const cachedResponse = getCachedResult(cacheKey);
    if (cachedResponse) {
      return reply(cachedResponse);
    }

    try {
      const classification = classifyQuery(rawQuery);

      // KASUS 1: NIK
      if (classification.type === "nik") {
        const { record, nikInfo, operatorInfo, location } = await searchByNik(classification.value);

        if (record) {
          const text = formatSingleRecord(record, nikInfo, operatorInfo, location);
          setCachedResult(cacheKey, text);
          return reply(text);
        }

        if (nikInfo && nikInfo.valid) {
          const ttlFormatted = formatTtlWithCurrentAge(null, nikInfo);
          const origin = [nikInfo.province, nikInfo.city, nikInfo.district].filter(Boolean).join(", ");
          const fallbackText = [
            `*INFO NIK (DI LUAR DATABASE JAKARTA)*`,
            `NIK: \`${nikInfo.nik}\``,
            `Gender: ${nikInfo.gender}`,
            `TTL: ${ttlFormatted}`,
            `Zodiak: ${nikInfo.zodiac} (${nikInfo.generation})`,
            `Wilayah KTP: ${origin || "-"}`,
            `No. Urut: ${nikInfo.sequence}`,
            `\n_Catatan: NIK valid tetapi tidak ada dalam database kependudukan DKI Jakarta._`,
          ].join("\n");

          setCachedResult(cacheKey, fallbackText);
          return reply(fallbackText);
        }

        return reply(`Data NIK \`${rawQuery}\` tidak ditemukan.`);
      }

      // KASUS 2: PHONE
      if (classification.type === "phone") {
        const { records, operatorInfo, location } = await searchByPhone(rawQuery);

        if (records.length === 0) {
          const msgOut = [
            `*INFO NO. HP*`,
            `MSISDN: \`${rawQuery}\``,
            operatorInfo ? `Operator: ${operatorInfo.operator} (${operatorInfo.brand})` : null,
            `Status Dukcapil: Tidak ditemukan di database`,
          ]
            .filter(Boolean)
            .join("\n");
          return reply(msgOut);
        }

        if (records.length === 1) {
          const rec = records[0];
          const text = formatSingleRecord(rec, rec.nikInfo, operatorInfo, location);
          setCachedResult(cacheKey, text);
          return reply(text);
        }

        const primary = records[0];
        const listText = [
          `*INFO OPERATOR & DUKCAPIL*`,
          `MSISDN: \`${primary.nohp || rawQuery}\``,
          operatorInfo ? `Operator: ${operatorInfo.operator} (${operatorInfo.brand})` : null,
          `Terhubung: ${records.length} data Dukcapil`,
          ``,
        ];

        records.forEach((rec, idx) => {
          const ttlFormatted = formatTtlWithCurrentAge(rec.ttl_umur || rec.ttl, rec.nikInfo);
          listText.push(
            `${idx + 1}. *${rec.nama}*`,
            `NIK: \`${rec.nik}\``,
            `Gender: ${rec.gender || "-"}`,
            `TTL: ${ttlFormatted}`,
            ``
          );
        });

        listText.push(
          `*LOKASI & DOMISILI*`,
          `Alamat: ${primary.alamat || "-"}`,
          `Kelurahan: ${primary.kelurahan || "-"}`,
          `Kecamatan: ${primary.kecamatan || "-"}`,
          `Kota/Kab: ${primary.kota_kab || "-"}`
        );

        if (location?.lat && location?.lon) {
          listText.push(
            `Latitude: \`${location.lat}\``,
            `Longitude: \`${location.lon}\``,
            `Maps: https://www.google.com/maps?q=${location.lat},${location.lon}`
          );
        }

        const resultString = listText.filter((line) => line !== null).join("\n");
        setCachedResult(cacheKey, resultString);
        return reply(resultString);
      }

      // KASUS 3: NAMA
      const records = await searchByName(rawQuery, 5);

      if (records.length === 0) {
        return reply(`Data dengan nama "${rawQuery}" tidak ditemukan.`);
      }

      if (records.length === 1) {
        const { record, nikInfo, operatorInfo, location } = await searchByNik(records[0].nik);
        const text = formatSingleRecord(record || records[0], nikInfo, operatorInfo, location);
        setCachedResult(cacheKey, text);
        return reply(text);
      }

      const listText = [
        `*HASIL PENCARIAN NAMA*`,
        `Ditemukan ${records.length} data untuk "${rawQuery}":`,
        ``,
      ];

      records.forEach((rec, idx) => {
        listText.push(
          `${idx + 1}. *${rec.nama}*`,
          `NIK: \`${rec.nik}\``,
          `No. HP: \`${rec.nohp || "-"}\``,
          `Lokasi: ${rec.kelurahan || "-"}, ${rec.kota_kab || "-"}`,
          ``
        );
      });

      listText.push(`Gunakan \`${currentPrefix}cekdukcapil <NIK>\` untuk melihat detail.`);
      const resultString = listText.join("\n");
      setCachedResult(cacheKey, resultString);
      return reply(resultString);
    } catch (err) {
      console.error("[CekDukcapil Error]:", err);
      return reply(`Gagal cek Dukcapil: ${err.message || err}`);
    }
  },
};
