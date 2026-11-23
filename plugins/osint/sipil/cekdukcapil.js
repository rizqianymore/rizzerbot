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

function formatSingleRecord(record, nikInfo, operatorInfo, location, simcards = []) {
  const ttlFormatted = formatTtlWithCurrentAge(record.ttl_umur || record.ttl, nikInfo);

  const lines = [
    `*OSINT TOOLS*`,
    `├─ NIK        : ${record.nik}`,
    `├─ Nama       : ${record.nama || "-"}`,
    `├─ Gender     : ${record.gender || "-"}`,
    `└─ TTL        : ${ttlFormatted}`,
  ];

  if (nikInfo?.zodiac) {
    lines.push(`└─ Zodiak     : ${nikInfo.zodiac} (${nikInfo.generation || "-"})`);
  }

  const phoneStr = record.nohp
    ? `\`${record.nohp}\`${operatorInfo ? ` (${operatorInfo.operator} - ${operatorInfo.brand})` : ""}`
    : "-";
  lines.push(
    `├─ No. HP     : ${phoneStr}`,
    `├─ Alamat     : ${record.alamat || "-"}`,
    `├─ Kelurahan  : ${record.kelurahan || "-"}`,
    `├─ Kecamatan  : ${record.kecamatan || "-"}`,
    `└─ Kota/Kab   : ${record.kota_kab || "-"}`
  );

  if (nikInfo && (nikInfo.province || nikInfo.city || nikInfo.district)) {
    const origin = [nikInfo.province, nikInfo.city, nikInfo.district].filter(Boolean).join(", ");
    lines.push(`└─ Wilayah KTP: ${origin}`);
  }

  if (location?.lat && location?.lon) {
    lines.push(
      `├─ Koordinat  : ${location.lat}, ${location.lon}`,
      `└─ Maps       : https://www.google.com/maps?q=${location.lat},${location.lon}`
    );
  }

  if (Array.isArray(simcards) && simcards.length > 0) {
    lines.push(`│`, `└─ [SIMCARD TERDAFTAR]`);
    simcards.forEach((s, idx) => {
      const regDate = s.date ? String(s.date).split(" ")[0] : "-";
      lines.push(`└─ ${idx + 1}. ${s.phone || "-"} (${s.provider || "GSM"}) [${regDate}]`);
    });
  }

  lines.push(`│`, `└─ [STATUS: RECORD VERIFIED]`);
  return lines.join("\n");
}

function formatNameResults(records, query, prefix = ".") {
  const lines = [`*OSINT TOOLS*`, `├─ Query      : "${query}"`, `└─ Ditemukan  : ${records.length} data`, `│`];

  records.forEach((rec, idx) => {
    lines.push(
      `├─ ${idx + 1}. ${rec.nama}`,
      `│   ├─ NIK    : ${rec.nik}`,
      `│   └─ No. HP : ${rec.nohp || "-"}`,
      `│   └─ Lokasi : ${rec.kelurahan || "-"}, ${rec.kota_kab || "-"}`,
      `│`
    );
  });

  lines.push(`Gunakan ${prefix}cekdukcapil <NIK> untuk melihat profil lengkap`);
  return lines.join("\n");
}

function formatPhoneMultiRecords(records, operatorInfo, rawQuery, simcards = []) {
  const lines = [
    `*OSINT TOOLS*`,
    `├─ MSISDN     : ${rawQuery}`,
    operatorInfo ? `├─ Operator   : ${operatorInfo.operator} (${operatorInfo.brand})` : null,
    `└─ Terhubung  : ${records.length} data kependudukan`,
    `│`,
  ].filter(Boolean);

  records.forEach((rec, idx) => {
    const ttlFormatted = formatTtlWithCurrentAge(rec.ttl_umur || rec.ttl, rec.nikInfo);
    lines.push(
      `├─ ${idx + 1}. ${rec.nama}`,
      `│   ├─ NIK    : ${rec.nik}`,
      `│   ├─ Gender : ${rec.gender || "-"}`,
      `│   └─ TTL    : ${ttlFormatted}`,
      `│   └─ Alamat : ${rec.alamat || "-"}, ${rec.kota_kab || "-"}`,
      `│`
    );
  });

  if (Array.isArray(simcards) && simcards.length > 0) {
    lines.push(`└─ [SIMCARD TERDAFTAR]`);
    simcards.forEach((s, idx) => {
      const regDate = s.date ? String(s.date).split(" ")[0] : "-";
      lines.push(`└─ ${idx + 1}. ${s.phone || "-"} (${s.provider || "GSM"}) [${regDate}]`);
    });
    lines.push(`│`);
  }

  lines.push(`└─ [STATUS: MULTI-RECORD MATCH]`);
  return lines.join("\n");
}

export default {
  name: "cekdukcapil",
  aliases: ["cekduku", "dukcapil", "cek-nik", "nikcapil"],
  description: "Cek data penduduk Dukcapil mandiri (NIK, No. HP, atau Nama)",
  category: "OSINT",
  usage: "<NIK | nama | nohp>",
  ownerOnly: true,
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const rawQuery = args.join(" ").trim();
    const currentPrefix = prefix || ".";

    if (!rawQuery) {
      return reply(
        `*OSINT TOOLS*\n` +
          `├─ Format Perintah:\n` +
          `├─ • ${currentPrefix}cekdukcapil <NIK 16 digit>\n` +
          `├─ • ${currentPrefix}cekdukcapil <No. HP>\n` +
          `└─ • ${currentPrefix}cekdukcapil <Nama Penduduk>\n` +
          `│\n` +
          `├─ Contoh:\n` +
          `├─ • ${currentPrefix}cekdukcapil 3171072604880003\n` +
          `├─ • ${currentPrefix}cekdukcapil 081310321726\n` +
          `└─ • ${currentPrefix}cekdukcapil PARILAH\n` +
          `│\n` +
          `└─ [STATUS: READY]`
      );
    }

    if (!isDukcapilReady()) {
      return reply(
        `*OSINT TOOLS*\n` + `└─ Status: Database tidak tersedia\n` + `└─ Periksa file database kependudukan`
      );
    }

    await sendTyping();

    const cacheKey = `dukcapil:${rawQuery.toLowerCase()}`;
    const cachedResponse = getCachedResult(cacheKey);
    if (cachedResponse) {
      return reply(cachedResponse);
    }

    try {
      const classification = classifyQuery(rawQuery);

      if (classification.type === "nik") {
        const { record, nikInfo, operatorInfo, location, simcards } = await searchByNik(classification.value);

        if (record) {
          const text = formatSingleRecord(record, nikInfo, operatorInfo, location, simcards);
          setCachedResult(cacheKey, text);
          return reply(text);
        }

        if (nikInfo && nikInfo.valid) {
          const ttlFormatted = formatTtlWithCurrentAge(null, nikInfo);
          const origin = [nikInfo.province, nikInfo.city, nikInfo.district].filter(Boolean).join(", ");
          const fallbackLines = [
            `*OSINT TOOLS*`,
            `├─ NIK        : ${nikInfo.nik}`,
            `├─ Gender     : ${nikInfo.gender}`,
            `├─ TTL        : ${ttlFormatted}`,
            `├─ Zodiak     : ${nikInfo.zodiac} (${nikInfo.generation})`,
            `├─ Wilayah KTP: ${origin || "-"}`,
            `└─ No. Urut   : ${nikInfo.sequence}`,
          ];

          if (Array.isArray(simcards) && simcards.length > 0) {
            fallbackLines.push(`│`, `└─ [SIMCARD TERDAFTAR]`);
            simcards.forEach((s, idx) => {
              const regDate = s.date ? String(s.date).split(" ")[0] : "-";
              fallbackLines.push(`└─ ${idx + 1}. ${s.phone || "-"} (${s.provider || "GSM"}) [${regDate}]`);
            });
          }

          fallbackLines.push(`│`, `└─ [CATATAN: NIK valid nasional (belum terindeks dukcapil daerah)]`);
          const fallbackText = fallbackLines.join("\n");
          setCachedResult(cacheKey, fallbackText);
          return reply(fallbackText);
        }

        return reply(`*OSINT TOOLS*\n` + `└─ NIK    : ${rawQuery}\n` + `└─ Status : Data tidak ditemukan`);
      }

      if (classification.type === "phone") {
        const { records, operatorInfo, location, simcards } = await searchByPhone(rawQuery);

        if (records.length === 0) {
          const lines = [
            `*OSINT TOOLS*`,
            `├─ MSISDN     : ${rawQuery}`,
            operatorInfo ? `└─ Operator   : ${operatorInfo.operator} (${operatorInfo.brand})` : null,
          ].filter(Boolean);

          if (Array.isArray(simcards) && simcards.length > 0) {
            lines.push(`│`, `└─ [SIMCARD TERDAFTAR]`);
            simcards.forEach((s, idx) => {
              const regDate = s.date ? String(s.date).split(" ")[0] : "-";
              lines.push(
                `├─ ${idx + 1}. ${s.phone || "-"} (${s.provider || "GSM"})`,
                `│   └─ NIK Terdaftar : ${s.nik || "-"}`,
                `│   └─ Tgl Registrasi: ${regDate}`
              );
            });
          }

          lines.push(`└─ Status Dukcapil: Tidak ditemukan di database`);
          return reply(lines.join("\n"));
        }

        if (records.length === 1) {
          const rec = records[0];
          const text = formatSingleRecord(rec, rec.nikInfo, operatorInfo, location, simcards);
          setCachedResult(cacheKey, text);
          return reply(text);
        }

        const resultString = formatPhoneMultiRecords(records, operatorInfo, rawQuery, simcards);
        setCachedResult(cacheKey, resultString);
        return reply(resultString);
      }

      const records = await searchByName(rawQuery, 5);

      if (records.length === 0) {
        return reply(`*OSINT TOOLS*\n` + `└─ Nama   : "${rawQuery}"\n` + `└─ Status : Data tidak ditemukan`);
      }

      if (records.length === 1) {
        const { record, nikInfo, operatorInfo, location, simcards } = await searchByNik(records[0].nik);
        const text = formatSingleRecord(record || records[0], nikInfo, operatorInfo, location, simcards);
        setCachedResult(cacheKey, text);
        return reply(text);
      }

      const resultString = formatNameResults(records, rawQuery, currentPrefix);
      setCachedResult(cacheKey, resultString);
      return reply(resultString);
    } catch (err) {
      console.error("[CekDukcapil Error]:", err);
      return reply(`*OSINT TOOLS*\nGagal cek Dukcapil: ${err.message || err}`);
    }
  },
};
