import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { parseTLV, calculateCRC16 } from "@/src/services/finance/qris.js";

function extractQrisInfo(rawText) {
  const tlvList = parseTLV(rawText);
  if (!tlvList || tlvList.length === 0) return null;

  const dataMap = {};
  for (const item of tlvList) {
    dataMap[item.tag] = item;
  }

  // Tag 00 wajib '01' untuk QRIS EMVCo
  if (!dataMap["00"] || dataMap["00"].value !== "01") return null;

  const merchantName = dataMap["59"]?.value || "-";
  const merchantCity = dataMap["60"]?.value || "-";
  const postalCode = dataMap["61"]?.value || "-";
  const amount = dataMap["54"]?.value ? `Rp ${Number(dataMap["54"].value).toLocaleString("id-ID")}` : "Dinamis / Input Manual";
  const poi = dataMap["01"]?.value === "12" ? "Dinamis" : "Statis";

  // Check CRC16
  let crcStatus = "Tidak ada CRC";
  if (dataMap["63"] && rawText.length >= 4) {
    const payloadWithoutCRC = rawText.slice(0, -4);
    const expectedCRC = calculateCRC16(payloadWithoutCRC);
    const actualCRC = dataMap["63"].value.toUpperCase();
    crcStatus = actualCRC === expectedCRC ? `Valid (${actualCRC})` : `Invalid (Actual: ${actualCRC}, Expected: ${expectedCRC})`;
  }

  // Acquirer / Operator list from tag 26-51
  const acquirers = [];
  for (let i = 26; i <= 51; i++) {
    const tagStr = String(i).padStart(2, "0");
    if (dataMap[tagStr] && dataMap[tagStr].children?.length) {
      const sub00 = dataMap[tagStr].children.find((c) => c.tag === "00")?.value;
      const sub01 = dataMap[tagStr].children.find((c) => c.tag === "01")?.value;
      const sub02 = dataMap[tagStr].children.find((c) => c.tag === "02")?.value;
      if (sub00 || sub01 || sub02) {
        acquirers.push(`${sub00 || "NMID"}: ${sub01 || sub02 || "-"}`);
      }
    }
  }

  return {
    raw: rawText,
    merchantName,
    merchantCity,
    postalCode,
    amount,
    poi,
    crcStatus,
    acquirers: acquirers.length ? acquirers.join("\n  - ") : "Standar Nasional (QRIS)",
  };
}

export default {
  name: "cekqris",
  aliases: ["qrisinfo", "parseqris"],
  description: "Bedah payload QRIS (Merchant, Kota, NMID, Jenis) via EMVCo TLV parser murni",
  usage: "<string-qris> ATAU reply gambar QRIS",
  category: "Tools & Media",
  cooldownMs: 5000,
  run: async (sock, msg, args, context) => {
    let rawQris = args.join(" ").trim();
    const targetMedia = findDownloadableTarget(msg);

    if (targetMedia) {
      await context.sendTyping();
      try {
        const buffer = await getMediaBuffer(sock, targetMedia, { maxBytes: 8 * 1024 * 1024 });
        if (!buffer || buffer.length === 0) {
          return context.reply("Gagal mengunduh gambar QRIS.");
        }

        const form = new FormData();
        form.append("file", new Blob([buffer]), "qr.png");
        const res = await fetch("https://api.qrserver.com/v1/read-qr-code/", {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json();
        const decoded = data?.[0]?.symbol?.[0]?.data;
        if (decoded) {
          rawQris = decoded;
        } else {
          return context.reply("Gambar tidak terdeteksi memiliki kode QRIS yang terbaca.");
        }
      } catch (err) {
        return context.reply(`Gagal membaca QR dari gambar: ${err.message}`);
      }
    }

    if (!rawQris) {
      return context.reply(
        `Gunakan format:\n` +
        `${context.prefix || "."}cekqris <string-qris>\n` +
        `Atau reply gambar QRIS dengan perintah:\n` +
        `${context.prefix || "."}cekqris`
      );
    }

    const info = extractQrisInfo(rawQris);
    if (!info) {
      return context.reply("Teks atau QR yang diberikan bukan format QRIS EMVCo standar yang valid.");
    }

    const out = [
      `*INFORMASI DETAIL QRIS (EMVCo)*`,
      `Merchant Name : ${info.merchantName}`,
      `Kota          : ${info.merchantCity}`,
      `Kode Pos      : ${info.postalCode}`,
      `Tipe QRIS     : ${info.poi}`,
      `Nominal       : ${info.amount}`,
      `Integritas CRC: ${info.crcStatus}`,
      ``,
      `*Acquirer / Account:*`,
      `  - ${info.acquirers}`,
      ``,
      `*Raw Payload:*`,
      `\`${info.raw.length > 100 ? info.raw.slice(0, 100) + "..." : info.raw}\``,
    ].join("\n");

    return context.reply(out);
  },
};
