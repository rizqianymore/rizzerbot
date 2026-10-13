import {
  searchNakes,
  getDetail,
  getProfesi,
  resolveProfesi,
  formatResults,
  formatProfesiList,
} from "@/src/services/osint/kki.js";

const JENIS = { medis: "1", nakes: "2" };

// Heuristic: does this look like a STR number? (letters+digits, has digits, len>=6)
function looksLikeStr(s) {
  const t = s.trim();
  if (t.length < 6) return false;
  return /[0-9]/.test(t) && /^[A-Za-z0-9-]+$/.test(t);
}

export default {
  name: "ceknakes",
  aliases: ["nakes", "cekkki", "kki", "ceknakeskonsil", "cekstr"],
  description: "Cek data Tenaga Kesehatan/Medis teregistrasi di Konsil Kesehatan Indonesia (KKI)",
  usage: "<nama|no STR> [profesi] | [medis <nama> <profesi>] | profesi",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const rawArgs = (args || []).join(" ").trim();

    const helpText =
      `🩺 *CEK NAKES — KONSIL KESEHATAN INDONESIA*\n\n` +
      `Cek apakah seseorang terdaftar sebagai Tenaga Kesehatan atau Tenaga Medis (STR aktif).\n\n` +
      `*Format:*\n` +
      `\`${currentPrefix}ceknakes <nama>\` — cari nakes (nama persis)\n` +
      `\`${currentPrefix}ceknakes <no STR>\` — cari No. STR\n` +
      `\`${currentPrefix}ceknakes <nama> <profesi>\` — filter profesi nakes\n` +
      `\`${currentPrefix}ceknakes medis <nama> <profesi>\` — cari tenaga medis (dokter/drg/spesialis)\n` +
      `\`${currentPrefix}ceknakes profesi\` — daftar profesi nakes\n` +
      `\`${currentPrefix}ceknakes profesi medis\` — daftar profesi medis\n\n` +
      `*Catatan:*\n` +
      `• Nakes: pencarian nama *persis* (exact)\n` +
      `• Medis: nama *sebagian* tapi wajib ada profesi\n\n` +
      `*Contoh:*\n` +
      `• \`${currentPrefix}ceknakes BUDI\`\n` +
      `• \`${currentPrefix}ceknakes NM00002106357370\`\n` +
      `• \`${currentPrefix}ceknakes BUDI perawat\`\n` +
      `• \`${currentPrefix}ceknakes medis YUDI dokter\`\n\n` +
      `_Sumber: kki.go.id (Konsil Kesehatan Indonesia)_`;

    if (!rawArgs) {
      return reply(helpText);
    }

    await sendTyping();
    const _startTime = Date.now();

    try {
      const parts = rawArgs.split(/\s+/);
      const first = parts[0].toLowerCase();

      // ---- List profesi ----
      if (first === "profesi") {
        const jenisTerm = (parts[1] || "").toLowerCase();
        const jenis = ["medis", "dokter", "named", "1"].includes(jenisTerm) ? JENIS.medis : JENIS.nakes;
        const list = await getProfesi(jenis);
        return reply(formatProfesiList(list, jenis));
      }

      // ---- Medis mode ----
      if (["medis", "dokter", "named"].includes(first)) {
        const rest = parts.slice(1);
        if (rest.length < 2) {
          return reply(
            `❌ *Tenaga Medis* membutuhkan *nama* dan *profesi*.\n\n` +
              `*Format:* \`${currentPrefix}ceknakes medis <nama> <profesi>\`\n` +
              `*Contoh:* \`${currentPrefix}ceknakes medis yudi dokter\`\n\n` +
              `Lihat daftar profesi: \`${currentPrefix}ceknakes profesi medis\``
          );
        }
        const profesiTerm = rest[rest.length - 1];
        const nama = rest.slice(0, -1).join(" ");
        const profesiCode = await resolveProfesi(JENIS.medis, profesiTerm);
        if (!profesiCode) {
          return reply(
            `❌ Profesi *"${profesiTerm}"* tidak ditemukan.\n` +
              `Lihat daftar: \`${currentPrefix}ceknakes profesi medis\``
          );
        }
        const result = await searchNakes(nama, {
          jenis: JENIS.medis,
          profesi: profesiCode,
          length: 10,
        });
        const details = await fetchDetails(result.data.slice(0, 3), JENIS.medis);
        return reply(formatResults(nama, result, details, { jenis: JENIS.medis, tipe: "nama" }));
      }

      // ---- Nakes mode (default): nama or STR ----
      // Split optional profesi (last token if it resolves to a profesi)
      let query = rawArgs;
      let profesiCode = "";

      // Try to detect profesi as the last token (if more than one word)
      if (parts.length >= 2) {
        const maybeProfesi = parts[parts.length - 1];
        const resolved = await resolveProfesi(JENIS.nakes, maybeProfesi);
        // Only treat as profesi filter if it resolves AND the remaining query is still meaningful
        if (resolved && parts.length - 1 >= 1) {
          // Heuristic: if last token is a known profesi AND not the entire query, use as filter
          const candidateQuery = parts.slice(0, -1).join(" ");
          if (candidateQuery.length >= 2) {
            profesiCode = resolved;
            query = candidateQuery;
          }
        }
      }

      const isStr = looksLikeStr(query) && !profesiCode;
      const tipe = isStr ? "str" : "nama";

      const result = await searchNakes(query, {
        jenis: JENIS.nakes,
        tipe,
        profesi: profesiCode,
        length: 10,
      });

      const details = await fetchDetails(result.data.slice(0, 3), JENIS.nakes);
      return reply(formatResults(query, result, details, { jenis: JENIS.nakes, tipe }));
    } catch (err) {
      return reply(`❌ Gagal memeriksa: ${err.message}`);
    }
  },
};

// Fetch detail for a limited number of rows (with delay to avoid hammering)
async function fetchDetails(rows, jenis) {
  const details = [];
  for (const row of rows) {
    if (!row.id) continue;
    try {
      const d = await getDetail(row.id, jenis);
      details.push(d);
    } catch {
      // skip failed detail, still show name
      details.push({
        nama: row.nama,
        kualifikasi: "-",
        nomorStr: "-",
        masaBerlaku: "-",
        status: "-",
        sdmkUrl: "-",
      });
    }
    // small delay between detail requests
    await new Promise((r) => setTimeout(r, 700));
  }
  return details;
}
