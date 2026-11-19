import { parseOperator } from "@/src/services/osint/cekoperator.js";
import {
  searchByPhone,
  searchByNik,
  isDukcapilReady,
  formatTtlWithCurrentAge,
} from "@/src/services/osint/dukcapilService.js";
import { searchSimcardByPhone, isSimcardReady } from "@/src/services/osint/simcardService.js";

export default {
  name: "cekoperator",
  aliases: ["cekhlr", "hlr", "operator", "cekhp", "opnomor", "ceksim", "simcard"],
  description: "Cek operator seluler, registrasi simcard, dan data Dukcapil terhubung",
  usage: "<nomor HP, cth: 081212345678>",
  category: "OSINT",
  premiumOnly: true,
  cooldownMs: 4000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const input = (args[0] || "").trim();

    if (!input) {
      return reply(
        `*OSINT TOOLS*\n` +
          `├── Penggunaan : ${currentPrefix}cekoperator <nomor HP>\n` +
          `├── Format     : 08xx / 628xx / +628xx\n` +
          `│\n` +
          `├── Contoh:\n` +
          `├── • ${currentPrefix}cekoperator 081310321726\n` +
          `├── • ${currentPrefix}cekoperator 081293269631\n` +
          `│\n` +
          `└─ [STATUS: READY]`
      );
    }

    await sendTyping();

    try {
      const op = parseOperator(input);
      if (!op.valid) {
        return reply(
          `*OSINT TOOLS*\n` +
            `├── MSISDN : ${input}\n` +
            `└── Error  : ${op.reason || "Format nomor HP tidak valid"}`
        );
      }

      // 1. Cek data registrasi Simcard (simcard.db)
      let simcardRecords = [];
      if (isSimcardReady()) {
        simcardRecords = searchSimcardByPhone(input);
      }

      // 2. Cek data Dukcapil kependudukan (dukcapil_top.db / dukcapil.db)
      let dukcapilData = { records: [], location: null, simcards: simcardRecords };
      if (isDukcapilReady()) {
        dukcapilData = await searchByPhone(input);

        // Jika nomor tidak langsung ketemu di dukcapil.db tapi ada NIK di simcard.db,
        // lakukan cross-reference (pivot) mencari profil kependudukan via NIK simcard
        if ((!dukcapilData.records || dukcapilData.records.length === 0) && simcardRecords.length > 0) {
          for (const s of simcardRecords) {
            if (s.nik && s.nik.length === 16) {
              const byNik = await searchByNik(s.nik);
              if (byNik?.record) {
                dukcapilData.records.push({
                  ...byNik.record,
                  nikInfo: byNik.nikInfo,
                });
                if (byNik.location && !dukcapilData.location) {
                  dukcapilData.location = byNik.location;
                }
              }
            }
          }
        }
      }

      const records = dukcapilData.records || [];
      const location = dukcapilData.location;
      const allSimcards = dukcapilData.simcards?.length ? dukcapilData.simcards : simcardRecords;

      // FORMAT SIMCARD DETAILS JIKA ADA
      const simLines = [];
      if (allSimcards.length > 0) {
        simLines.push(`│`, `├── [REGISTRASI SIMCARD]`);
        allSimcards.forEach((s, idx) => {
          const regDate = s.date ? String(s.date).split(" ")[0] : "-";
          simLines.push(
            `├── Kartu ${idx + 1}    : ${s.provider || op.operator}`,
            `│   ├── NIK    : \`${s.nik || "-"}\``,
            `│   └── Tgl Reg: ${regDate}`
          );
        });
      }

      // KASUS 1: Data kependudukan ditemukan di database Dukcapil
      if (records.length > 0) {
        if (records.length === 1) {
          const r = records[0];
          const ttlFormatted = formatTtlWithCurrentAge(r.ttl_umur || r.ttl, r.nikInfo);
          const lines = [
            `*OSINT TOOLS*`,
            `├── MSISDN     : \`${r.nohp || op.normalized}\``,
            `├── Operator   : ${op.operator} (${op.brand})`,
            `├── NIK        : \`${r.nik || "-"}\``,
            `├── Nama       : ${r.nama || "-"}`,
            `├── Gender     : ${r.gender || "-"}`,
            `├── TTL        : ${ttlFormatted}`,
          ];

          if (r.nikInfo?.zodiac) {
            lines.push(`├── Zodiak     : ${r.nikInfo.zodiac} (${r.nikInfo.generation || "-"})`);
          }

          lines.push(
            `├── Alamat     : ${r.alamat || "-"}`,
            `├── Kelurahan  : ${r.kelurahan || "-"}`,
            `├── Kecamatan  : ${r.kecamatan || "-"}`,
            `├── Kota/Kab   : ${r.kota_kab || "-"}`
          );

          if (r.nikInfo && (r.nikInfo.province || r.nikInfo.city || r.nikInfo.district)) {
            const origin = [r.nikInfo.province, r.nikInfo.city, r.nikInfo.district].filter(Boolean).join(", ");
            lines.push(`├── Wilayah KTP: ${origin}`);
          }

          if (location?.lat && location?.lon) {
            lines.push(
              `├── Koordinat  : ${location.lat}, ${location.lon}`,
              `├── Maps       : https://www.google.com/maps?q=${location.lat},${location.lon}`
            );
          }

          if (simLines.length > 0) {
            lines.push(...simLines);
          }

          lines.push(`│`, `└─ [STATUS: RECORD VERIFIED]`);
          return reply(lines.join("\n"));
        }

        // Jika terhubung ke beberapa profil kependudukan
        const primary = records[0];
        const lines = [
          `*OSINT TOOLS*`,
          `├── MSISDN     : \`${primary.nohp || op.normalized}\``,
          `├── Operator   : ${op.operator} (${op.brand})`,
          `├── Terhubung  : ${records.length} data kependudukan`,
          `│`,
        ];

        records.forEach((r, idx) => {
          const ttlFormatted = formatTtlWithCurrentAge(r.ttl_umur || r.ttl, r.nikInfo);
          lines.push(
            `├── ${idx + 1}. ${r.nama}`,
            `│   ├── NIK    : \`${r.nik || "-"}\``,
            `│   ├── Gender : ${r.gender || "-"}`,
            `│   ├── TTL    : ${ttlFormatted}`,
            `│   └── Alamat : ${r.alamat || "-"}, ${r.kota_kab || "-"}`,
            `│`
          );
        });

        if (simLines.length > 0) {
          lines.push(...simLines);
        }

        lines.push(`└─ [STATUS: MULTI-RECORD MATCH]`);
        return reply(lines.join("\n"));
      }

      // KASUS 2: Nomor tidak tercatat di dukcapil tapi ada di simcard.db
      if (allSimcards.length > 0) {
        const lines = [
          `*OSINT TOOLS*`,
          `├── MSISDN     : \`${op.normalized}\``,
          `├── Operator   : ${op.operator} (${op.brand})`,
          `├── Terdaftar  : ${allSimcards.length} catatan simcard`,
          ...simLines,
          `│`,
          `└─ [CATATAN: Profil kependudukan belum terdaftar di dukcapil]`,
        ];
        return reply(lines.join("\n"));
      }

      // KASUS 3: Nomor valid tapi tidak tercatat di DB manapun
      const lines = [
        `*OSINT TOOLS*`,
        `├── MSISDN     : \`${op.normalized}\``,
        `├── Prefix     : \`${op.prefix}*\``,
        `├── Operator   : ${op.operator}`,
        `├── Kartu      : ${op.brand}`,
        `│`,
        `└─ [STATUS: BELUM TERDAFTAR DI DATABASE]`,
      ];

      return reply(lines.join("\n"));
    } catch (err) {
      return reply(`Gagal cek operator: ${err?.message || err}`);
    }
  },
};
