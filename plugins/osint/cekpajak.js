import axios from "axios";
import { fetchJson, getCohesiveHeaders } from "@/src/utils/scraping.js";

const AREA_MAP = {
  // DKI Jakarta
  b: "dki",
  jakarta: "dki",
  dki: "dki",

  // DIY (Yogyakarta)
  ab: "diy",
  jogja: "diy",
  diy: "diy",
  yogyakarta: "diy",

  // Banten
  a: "banten",
  banten: "banten",

  // Jawa Barat
  d: "jabar",
  e: "jabar",
  f: "jabar",
  t: "jabar",
  z: "jabar",
  jabar: "jabar",
  bandung: "jabar",
  cirebon: "jabar",
  bogor: "jabar",

  // Jawa Timur
  l: "jatim",
  m: "jatim",
  n: "jatim",
  p: "jatim",
  s: "jatim",
  w: "jatim",
  ae: "jatim",
  ag: "jatim",
  jatim: "jatim",
  surabaya: "jatim",
  malang: "jatim",
};

function detectArea(nopolInput) {
  const clean = nopolInput.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  
  // Cek prefix 2 huruf (misal AB, AE, AG)
  const prefix2 = clean.substring(0, 2);
  if (AREA_MAP[prefix2]) return AREA_MAP[prefix2];

  // Cek prefix 1 huruf (misal B, A, D, E, F, L, M, N, P, S, T, W, Z)
  const prefix1 = clean.substring(0, 1);
  if (AREA_MAP[prefix1]) return AREA_MAP[prefix1];

  return null;
}

export function parseSamsatDkiHtml(html) {
  const data = {};

  const cleanText = (str) =>
    str
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // 1. Pattern ekstraksi kolom label fw-bold dan value setelahnya (HTML structure)
  const pairRegex = /<div\s+class="[^"]*fw-bold[^"]*">([\s\S]*?)<\/div>\s*<div\s+class="([^"]*)">([\s\S]*?)<\/div>/gi;
  let match;

  while ((match = pairRegex.exec(html)) !== null) {
    const key = cleanText(match[1]).replace(/[*:]/g, "").toLowerCase();
    const val = cleanText(match[3]);
    if (key && val) {
      data[key] = val;
    }
  }

  // 2. Fallback regex untuk format teks/line-based
  if (Object.keys(data).length === 0) {
    const lines = html.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length - 1; i++) {
      const key = lines[i].replace(/[*():]/g, "").trim().toLowerCase();
      const val = lines[i + 1];
      if (
        [
          "nopol",
          "kendaraan ke",
          "nama",
          "nik",
          "alamat",
          "no. rangka / mesin",
          "no bpkb",
          "merek / type",
          "model / pembuatan",
          "warna kendaraan",
          "warna tnkb",
          "bhn bakar / cylinder",
          "masa berlaku stnk",
          "nilai jual",
          "jatuh tempo pajak",
          "pkb pokok",
          "swdkllj",
          "pkb denda",
          "swdkllj denda",
          "total pkb",
          "status",
        ].includes(key)
      ) {
        data[key] = val;
        i++;
      }
    }
  }

  return {
    nopol: data["nopol"] || null,
    kendaraanKe: data["kendaraan ke"] || "-",
    nama: data["nama"] || "-",
    nik: data["nik"] || "-",
    alamat: data["alamat"] || "-",
    noRangkaMesin: data["no. rangka / mesin"] || "-",
    noBpkb: data["no bpkb"] || "-",
    merekType: data["merek / type"] || "-",
    modelPembuatan: data["model / pembuatan"] || "-",
    warna: data["warna kendaraan"] || "-",
    warnaTnkb: data["warna tnkb"] || "-",
    bahanBakar: data["bhn bakar / cylinder"] || "-",
    stnkBerlaku: data["masa berlaku stnk"] || "-",
    nilaiJual: data["nilai jual"] || "-",
    jatuhTempo: data["jatuh tempo pajak"] || "-",
    pkbPokok: data["pkb pokok"] || "Rp. 0",
    swdkllj: data["swdkllj"] || "Rp. 0",
    pkbDenda: data["pkb denda"] || "Rp. 0",
    swdklljDenda: data["swdkllj denda"] || "Rp. 0",
    totalPkb: data["total pkb"] || "Rp. 0",
    status: data["status"] || "Aktif",
  };
}

async function querySamsatDki(nopol) {
  // Pisahkan angka dan huruf belakang (misal 1717 dan SN dari B 1717 SN atau 1717SN)
  const match = nopol.match(/(\d+)\s*([A-Za-z]+)$/);
  if (!match) {
    throw new Error("Format plat Jakarta harus memiliki angka dan seri huruf (Contoh: B 1717 SN)");
  }

  const nopa = match[1];
  const noph = match[2].toUpperCase();

  const baseUrl = "https://samsat-pkb2.jakarta.go.id/";

  // Header & Cookie Stealth Tunnel sesuai Browser Session Valid
  const defaultCookie = "TS01729ce2=01a67582b87a3708264e0ffd5d03752f4dae1bdc94ecbc74db9f83d7f73a7c7f2d2a662e1d93cbfd89cebf27133417e83efc43c46a";

  let sessionCookies = defaultCookie;

  // Step 1: Pre-flight handshake stealth tunnel untuk mengumpulkan/memperbarui session cookie
  try {
    const initRes = await axios.get(baseUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "sec-ch-ua": '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
      },
      timeout: 5000,
      validateStatus: () => true,
    });

    if (initRes.headers && initRes.headers["set-cookie"]) {
      const captured = (initRes.headers["set-cookie"] || [])
        .map((c) => c.split(";")[0])
        .join("; ");
      if (captured) sessionCookies = captured;
    }
  } catch (handshakeErr) {
    // Gunakan fallback sessionCookie
  }

  const postData = new URLSearchParams({
    nopa,
    noph,
    nik: "",
    "cf-turnstile-response": "",
    flag: "2",
  });

  const postHeaders = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: "https://samsat-pkb2.jakarta.go.id",
    Referer: "https://samsat-pkb2.jakarta.go.id/",
    Cookie: sessionCookies,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "cache-control": "max-age=0",
  };

  const res = await axios.post(baseUrl, postData.toString(), {
    headers: postHeaders,
    timeout: 8000,
    validateStatus: () => true,
  });

  if (res.data && typeof res.data === "string") {
    if (res.data.includes("content_pkb") || res.data.includes("table-responsive") || res.data.includes("informasi data kendaraan")) {
      return parseSamsatDkiHtml(res.data);
    }

    if (res.data.includes("Verifikasi Keamanan Gagal") || res.data.includes("cf-turnstile") || res.data.includes("Just a moment...")) {
      throw new Error("Server Samsat DKI mewajibkan verifikasi Cloudflare Turnstile Captcha.");
    }
  }

  throw new Error("Data kendaraan tidak ditemukan di database Samsat DKI Jakarta.");
}

export default {
  name: "cekpajak",
  aliases: ["pajak", "pkb", "nopol", "ceknopol"],
  description: "Cek data kepemilikan, spesifikasi kendaraan & tagihan pajak (DKI Jakarta, DIY, Jabar, Jatim, Banten).",
  usage: "[area] <nomor_polisi>",
  example: "cekpajak B 1717 SN",
  category: "OSINT",
  premiumOnly: false,
  ownerOnly: true,
  run: async (sock, msg, args, context) => {
    const { sendTyping, activePrefix, senderName } = context;
    const remoteJid = msg.key.remoteJid;
    await sendTyping();

    if (!args || args.length === 0) {
      return sock.sendMessage(
        remoteJid,
        {
          text:
            `🚗 *Panduan Cek Pajak Kendaraan OSINT*\n\n` +
            `*Format:* \`${activePrefix}cekpajak <nopol>\` atau \`${activePrefix}cekpajak <area> <nopol>\`\n` +
            `*Contoh:* \`${activePrefix}cekpajak B 1717 SN\`\n` +
            `*Contoh Area:* \`${activePrefix}cekpajak dki B1717SN\`\n\n` +
            `📌 *Area Didukung:*\n` +
            `• *DKI Jakarta:* Plat B\n` +
            `• *DIY Yogyakarta:* Plat AB\n` +
            `• *Jawa Barat:* Plat D, E, F, T, Z\n` +
            `• *Jawa Timur:* Plat L, M, N, P, S, W, AE, AG\n` +
            `• *Banten:* Plat A\n\n` +
            `⚡ _Kyros-MD Vehicle Intelligence_`,
        },
        { quoted: msg }
      );
    }

    let area = null;
    let rawNopol = "";

    const combinedInput = args.join("").trim();
    const firstArg = args[0].toLowerCase();

    if (["dki", "jakarta", "diy", "jabar", "banten", "jatim"].includes(firstArg)) {
      area = firstArg === "jakarta" ? "dki" : firstArg;
      rawNopol = args.slice(1).join("").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    } else {
      rawNopol = combinedInput.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      area = detectArea(rawNopol);
    }

    if (!rawNopol) {
      return sock.sendMessage(
        remoteJid,
        { text: `⚠️ Harap masukkan nomor polisi yang ingin diperiksa!` },
        { quoted: msg }
      );
    }

    if (!area) {
      return sock.sendMessage(
        remoteJid,
        {
          text:
            `❌ *Area plat nomor tidak terdeteksi!*\n\n` +
            `Sertakan kode area secara eksplisit jika plat Anda di luar deteksi otomatis:\n` +
            `• \`${activePrefix}cekpajak dki ${rawNopol}\`\n` +
            `• \`${activePrefix}cekpajak diy ${rawNopol}\`\n` +
            `• \`${activePrefix}cekpajak jabar ${rawNopol}\`\n` +
            `• \`${activePrefix}cekpajak jatim ${rawNopol}\`\n` +
            `• \`${activePrefix}cekpajak banten ${rawNopol}\``,
        },
        { quoted: msg }
      );
    }

    // 1. Khusus DKI Jakarta (samsat-pkb2.jakarta.go.id)
    if (area === "dki") {
      try {
        const dkiData = await querySamsatDki(rawNopol);
        let text = `🚗 *HASIL CEK PAJAK KENDARAAN (DKI JAKARTA)*\n\n`;
        text += `• *Nomor Polisi:* \`${dkiData.nopol || rawNopol}\`\n`;
        text += `• *Merek / Tipe:* ${dkiData.merekType}\n`;
        text += `• *Model / Pembuatan:* ${dkiData.modelPembuatan}\n`;
        text += `• *Warna Kendaraan:* ${dkiData.warna} (TNKB: ${dkiData.warnaTnkb})\n`;
        text += `• *Bahan Bakar:* ${dkiData.bahanBakar}\n`;
        if (dkiData.noRangkaMesin && dkiData.noRangkaMesin !== "-") {
          text += `• *No. Rangka / Mesin:* ${dkiData.noRangkaMesin}\n`;
        }
        if (dkiData.noBpkb && dkiData.noBpkb !== "-") {
          text += `• *No. BPKB:* ${dkiData.noBpkb}\n`;
        }
        text += `• *Nilai Jual:* ${dkiData.nilaiJual}\n`;
        text += `• *Masa Berlaku STNK:* ${dkiData.stnkBerlaku}\n`;
        text += `• *Jatuh Tempo Pajak:* ${dkiData.jatuhTempo}\n`;
        text += `• *Status Pajak:* ${dkiData.status}\n\n`;
        text += `💰 *Rincian Biaya & Tagihan:*\n`;
        text += `  ├─ PKB Pokok: ${dkiData.pkbPokok}\n`;
        text += `  ├─ PKB Denda: ${dkiData.pkbDenda}\n`;
        text += `  ├─ SWDKLLJ Pokok: ${dkiData.swdkllj}\n`;
        text += `  ├─ SWDKLLJ Denda: ${dkiData.swdklljDenda}\n`;
        text += `  ╰─ *TOTAL TAGIHAN:* *${dkiData.totalPkb}*\n\n`;
        text += `_Dicari oleh: ${senderName}_\n⚡ _Via Kyros-MD Vehicle Intelligence_`;

        return sock.sendMessage(remoteJid, { text: text.trim() }, { quoted: msg });
      } catch (dkiErr) {
        return sock.sendMessage(
          remoteJid,
          {
            text:
              `⚠️ *Informasi Samsat DKI Jakarta (Plat B)*\n\n` +
              `Server resmi Samsat DKI Jakarta (\`samsat-pkb2.jakarta.go.id\`) saat ini mewajibkan verifikasi Cloudflare Turnstile Captcha secara real-time.\n\n` +
              `🔗 *Cek Manual DKI:* https://samsat-pkb2.jakarta.go.id/\n\n` +
              `💡 *Wilayah Lain yang Aktif Otomatis Tanpa Captcha:*\n` +
              `• *DIY Yogyakarta (Plat AB)* — Contoh: \`${activePrefix}cekpajak ab1230jc\`\n` +
              `• *Jawa Barat (Plat D, E, F, T, Z)* — Contoh: \`${activePrefix}cekpajak d1234abc\`\n` +
              `• *Jawa Timur (Plat L, M, N, P, S, W, AE, AG)* — Contoh: \`${activePrefix}cekpajak l1111xx\`\n` +
              `• *Banten (Plat A)* — Contoh: \`${activePrefix}cekpajak a1234xx\``,
          },
          { quoted: msg }
        );
      }
    }

    // 2. Wilayah DIY, Jabar, Jatim, Banten
    const apiUrl = `https://cekpajak.bystpn.web.id/api/v1/${area}/${encodeURIComponent(rawNopol)}`;

    try {
      const res = await fetchJson(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
      });

      const resData = res.data;

      if (!resData || resData.status === false) {
        return sock.sendMessage(
          remoteJid,
          {
            text: `❌ ${resData?.message || `Data kendaraan *${rawNopol}* tidak ditemukan di database Samsat ${area.toUpperCase()}.`}`,
          },
          { quoted: msg }
        );
      }

      const info = resData.data || resData;
      const pajak = info.pajak || {};

      const formatRupiah = (num) =>
        num !== undefined && num !== null
          ? `Rp ${Number(num).toLocaleString("id-ID")}`
          : "Rp 0";

      const isLunas = Number(pajak.totalPajak || 0) === 0;
      const statusPajak = pajak.aktif ? "🟢 Aktif (Lunas)" : "🔴 Belum Bayar / Nonaktif";

      let text = `🚗 *HASIL CEK PAJAK KENDARAAN (${info.area || area.toUpperCase()})*\n\n`;
      text += `• *Nomor Polisi:* \`${info.nopol || rawNopol}\`\n`;
      text += `• *Merek / Tipe:* ${info.merk || "-"} ${info.model || ""}\n`;
      text += `• *Tahun Pembuatan:* ${info.tahun || "-"}\n`;
      text += `• *Status Pajak:* ${statusPajak}\n`;
      text += `• *Jatuh Tempo PKB:* ${pajak.tglAkhirPkb || "-"}\n`;
      if (pajak.tglAkhirStnk) {
        text += `• *Masa Berlaku STNK:* ${pajak.tglAkhirStnk}\n`;
      }
      text += `\n💰 *Rincian Biaya & Tagihan:*\n`;
      text += `  ├─ PKB Pokok: ${formatRupiah(pajak.pkbPokok)}\n`;
      if (pajak.pkbDenda > 0) {
        text += `  ├─ PKB Denda: ${formatRupiah(pajak.pkbDenda)}\n`;
      }
      text += `  ├─ SWDKLLJ Pokok: ${formatRupiah(pajak.swdklljPokok)}\n`;
      if (pajak.swdklljDenda > 0) {
        text += `  ├─ SWDKLLJ Denda: ${formatRupiah(pajak.swdklljDenda)}\n`;
      }
      if (pajak.opsenPokok > 0) {
        text += `  ├─ Opsen Pokok: ${formatRupiah(pajak.opsenPokok)}\n`;
      }
      if (pajak.opsenDenda > 0) {
        text += `  ├─ Opsen Denda: ${formatRupiah(pajak.opsenDenda)}\n`;
      }
      text += `  ╰─ *TOTAL TAGIHAN:* *${formatRupiah(pajak.totalPajak)}* ${isLunas ? "✅" : "⚠️"}\n\n`;
      text += `_Dicari oleh: ${senderName}_\n⚡ _Via Kyros-MD Vehicle Intelligence_`;

      await sock.sendMessage(remoteJid, { text: text.trim() }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `❌ *Gagal mengambil data Samsat:* ${err.message || "Server API sedang tidak dapat diakses."}`,
        },
        { quoted: msg }
      );
    }
  },
};
