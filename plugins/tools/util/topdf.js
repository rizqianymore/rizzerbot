import { getMediaBuffer, findDownloadableTarget, getQuotedMessage } from "@/src/services/fetch/media.js";

function escapePdfText(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text, maxLen = 85) {
  const lines = [];
  const paras = String(text).split("\n");
  for (const para of paras) {
    if (para.length === 0) {
      lines.push("");
      continue;
    }
    // also handle very long word without spaces
    let remaining = para;
    while (remaining.length > maxLen) {
      let cut = remaining.lastIndexOf(" ", maxLen);
      if (cut === -1) cut = maxLen;
      lines.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trimStart();
      // avoid infinite loop
      if (remaining.length === 0) break;
    }
    if (remaining.length > 0 || para.length <= maxLen) {
      // when para exactly consumed, remaining already pushed
      if (remaining.length > 0) lines.push(remaining);
      else if (para.length <= maxLen) lines.push(para);
    }
  }
  return lines;
}

function buildPdfFromStreams(streams) {
  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const totalPages = streams.length;
  const totalObjects = 3 + totalPages * 2;
  // object numbers:
  // 1 catalog, 2 pages, 3 font, then per page: page, content
  let pdf = header;
  const offsets = new Array(totalObjects + 1).fill(0);

  function addObj(num, content) {
    offsets[num] = Buffer.byteLength(pdf, "latin1");
    pdf += `${num} 0 obj\n${content}\nendobj\n`;
  }

  // 1 catalog
  addObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  // 2 pages
  const kids = [];
  for (let i = 0; i < totalPages; i++) {
    const pageNum = 4 + i * 2;
    kids.push(`${pageNum} 0 R`);
  }
  addObj(2, `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${totalPages} >>`);
  // 3 font Helvetica
  addObj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (let i = 0; i < totalPages; i++) {
    const pageNum = 4 + i * 2;
    const contentNum = 5 + i * 2;
    const stream = streams[i];
    const length = Buffer.byteLength(stream, "latin1");
    addObj(pageNum, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNum} 0 R >>`);
    addObj(contentNum, `<< /Length ${length} >>\nstream\n${stream}\nendstream`);
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  let xref = `xref\n0 ${totalObjects + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 1; i <= totalObjects; i++) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  pdf += xref + trailer;
  return Buffer.from(pdf, "latin1");
}

function createSimplePdf(text) {
  const clean = String(text).replace(/\r/g, "");
  // limit to avoid huge PDF (max ~5000 chars per spec, but allow more with pagination)
  const truncated = clean.length > 8000 ? clean.slice(0, 8000) + "\n... (truncated)" : clean;
  const lines = wrapText(truncated, 82);
  const linesPerPage = 46;
  const streams = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    const chunk = lines.slice(i, i + linesPerPage);
    let stream = "BT\n/F1 12 Tf\n50 800 Td\n";
    for (let j = 0; j < chunk.length; j++) {
      const escaped = escapePdfText(chunk[j]);
      if (j === 0) {
        stream += `(${escaped}) Tj\n`;
      } else {
        stream += `0 -14 Td\n(${escaped}) Tj\n`;
      }
    }
    stream += "ET";
    streams.push(stream);
  }
  if (streams.length === 0) streams.push("BT\n/F1 12 Tf\n50 800 Td\n() Tj\nET");
  return buildPdfFromStreams(streams);
}

function isJpeg(buf) {
  return buf && buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}
function isPng(buf) {
  return buf && buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

async function getImageDimensions(buf) {
  // try sharp
  try {
    const sharpMod = await import("sharp").then((m) => m.default || m).catch(() => null);
    if (sharpMod) {
      const meta = await sharpMod(buf).metadata();
      if (meta?.width && meta?.height) return { width: meta.width, height: meta.height };
    }
  } catch {}
  // fallback: parse PNG IHDR
  try {
    if (isPng(buf) && buf.length >= 24) {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (w > 0 && h > 0 && w < 10000 && h < 10000) return { width: w, height: h };
    }
  } catch {}
  // fallback: parse JPEG SOF
  try {
    if (isJpeg(buf)) {
      let offset = 2;
      while (offset < buf.length - 9) {
        if (buf[offset] !== 0xff) break;
        const marker = buf[offset + 1];
        const len = buf.readUInt16BE(offset + 2);
        if (marker >= 0xc0 && marker <= 0xc3) {
          const h = buf.readUInt16BE(offset + 5);
          const w = buf.readUInt16BE(offset + 7);
          if (w && h) return { width: w, height: h };
        }
        offset += 2 + len;
      }
    }
  } catch {}
  return { width: 595, height: 842 };
}

async function createImagePdf(imageBuffer) {
  let buf = imageBuffer;
  let width;
  let height;

  // normalize to JPEG via sharp if png
  if (isPng(buf)) {
    try {
      const sharpMod = await import("sharp").then((m) => m.default || m).catch(() => null);
      if (sharpMod) {
        const meta = await sharpMod(buf).metadata();
        width = meta?.width;
        height = meta?.height;
        buf = await sharpMod(buf).jpeg({ quality: 85 }).toBuffer();
      }
    } catch {}
  }

  if (!buf || !isJpeg(buf)) {
    // if still not jpeg and not png converted, check if jpeg directly
    if (!isJpeg(buf) && !isPng(buf)) {
      throw new Error("Format gambar tidak didukung (hanya JPG/PNG)");
    }
    // if png without sharp, can't embed directly with DCTDecode; throw
    if (isPng(buf)) {
      throw new Error("PNG tanpa sharp tidak dapat dibuat PDF, kirim sebagai JPG.");
    }
  }

  const dim = await getImageDimensions(buf);
  width = width || dim.width;
  height = height || dim.height;

  // scale to fit A4 with margin 20
  const maxW = 555;
  const maxH = 802;
  const scale = Math.min(maxW / width, maxH / height, 1);
  const drawW = Math.round(width * scale);
  const drawH = Math.round(height * scale);
  const x = Math.round((595 - drawW) / 2);
  const y = Math.round((842 - drawH) / 2);

  // Build PDF with image XObject (jpeg DCTDecode)
  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  let pdfParts = [];
  let pdfStr = header;
  const offsets = {};

  function addStrObj(num, content) {
    offsets[num] = Buffer.byteLength(pdfStr, "latin1") + pdfParts.reduce((a, b) => a + b.length, 0);
    // offsets calculation with Buffers is tricky; easier to build sequential Buffers
    pdfStr += `${num} 0 obj\n${content}\nendobj\n`;
  }

  // We will build header+objects as strings, but image stream needs binary.
  // Simpler: build all as Buffers concatenated.
  // Define objects as Buffers.

  // We'll create objects array and then join with offset tracking.
  const objs = [];

  function objToBuf(num, contentBuf) {
    const head = Buffer.from(`${num} 0 obj\n`, "latin1");
    const tail = Buffer.from(`\nendobj\n`, "latin1");
    return Buffer.concat([head, contentBuf, tail]);
  }

  // Prepare content strings
  const catalog = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1");
  const pages = Buffer.from("<< /Type /Pages /Kids [4 0 R] /Count 1 >>", "latin1");
  const font = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1");
  const page = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 6 0 R >> /Font << /F1 3 0 R >> >> /Contents 5 0 R >>`, "latin1");
  const contentStreamStr = `q\n${drawW} 0 0 ${drawH} ${x} ${y} cm\n/Im0 Do\nQ`;
  const contentStream = Buffer.from(`<< /Length ${Buffer.byteLength(contentStreamStr, "latin1")} >>\nstream\n${contentStreamStr}\nendstream`, "latin1");
  const imageHeader = Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${buf.length} >>\nstream\n`, "latin1");
  const imageFooter = Buffer.from(`\nendstream`, "latin1");
  const imageObjContent = Buffer.concat([imageHeader, buf, imageFooter]);

  const headerBuf = Buffer.from(header, "latin1");
  const obj1 = objToBuf(1, catalog);
  const obj2 = objToBuf(2, pages);
  const obj3 = objToBuf(3, font);
  const obj4 = objToBuf(4, page);
  const obj5 = objToBuf(5, contentStream);
  const obj6 = objToBuf(6, imageObjContent);

  const allObjs = [obj1, obj2, obj3, obj4, obj5, obj6];
  // compute offsets
  let offset = headerBuf.length;
  const xrefOffsets = [0];
  for (let i = 0; i < allObjs.length; i++) {
    xrefOffsets[i + 1] = offset;
    offset += allObjs[i].length;
  }
  const xrefOffset = offset;
  let xref = `xref\n0 7\n0000000000 65535 f \n`;
  for (let i = 1; i <= 6; i++) {
    xref += String(xrefOffsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const xrefBuf = Buffer.from(xref + trailer, "latin1");

  return Buffer.concat([headerBuf, ...allObjs, xrefBuf]);
}

function getQuotedText(msg) {
  try {
    const { quotedMsg } = getQuotedMessage(msg);
    if (!quotedMsg) return "";
    const u = quotedMsg;
    return (
      u.conversation ||
      u.extendedTextMessage?.text ||
      u.imageMessage?.caption ||
      u.videoMessage?.caption ||
      u.documentMessage?.caption ||
      ""
    );
  } catch {
    return "";
  }
}

export default {
  name: "topdf",
  aliases: ["pdf", "text2pdf"],
  description: "Ubah teks / gambar ke PDF",
  usage: "<teks> | reply gambar/teks",
  category: "Tools",
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping?.();
    const remoteJid = msg.key?.remoteJid;

    // Try image first via findDownloadableTarget
    const target = findDownloadableTarget(msg);
    if (target) {
      const isImageTarget =
        !!target.message?.imageMessage ||
        !!target.message?.stickerMessage ||
        !!target.message?.documentMessage;
      // also check mimetype if available
      const mimetype =
        target.message?.imageMessage?.mimetype ||
        target.message?.documentMessage?.mimetype ||
        target.message?.stickerMessage?.mimetype ||
        "";
      const looksImage = mimetype.startsWith("image/") || !!target.message?.imageMessage;

      if (looksImage || isImageTarget) {
        let buffer;
        try {
          buffer = await getMediaBuffer(sock, target, { maxBytes: 10 * 1024 * 1024 });
        } catch (err) {
          return reply(`Gagal ambil gambar: ${err?.message || err}`);
        }
        if (buffer?.length) {
          // Detect if really image by magic bytes
          const headerIsImage = isJpeg(buffer) || isPng(buffer);
          // sticker webp -> try convert via sharp to jpeg
          if (!headerIsImage) {
            try {
              const sharpMod = await import("sharp").then((m) => m.default || m).catch(() => null);
              if (sharpMod) {
                // try convert webp -> jpeg
                const jpegBuf = await sharpMod(buffer).jpeg({ quality: 85 }).toBuffer();
                if (jpegBuf?.length) buffer = jpegBuf;
              }
            } catch {}
          }
          if (isJpeg(buffer) || isPng(buffer) || buffer.length > 100) {
            try {
              const pdfBuf = await createImagePdf(buffer);
              await sock.sendMessage(
                remoteJid,
                { document: pdfBuf, fileName: `rizzer-${Date.now()}.pdf`, mimetype: "application/pdf" },
                { quoted: msg }
              );
              return;
            } catch (err) {
              // fallback to text placeholder PDF if image pdf fails
              // try API fallback if available
              try {
                const apiUrl = `https://api.siputzx.my.id/api/convert/txt2pdf?text=${encodeURIComponent("Image PDF - " + (err?.message || ""))}`;
                const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
                if (res.ok) {
                  const ab = await res.arrayBuffer();
                  if (ab.byteLength > 100) {
                    const pdfBuf = Buffer.from(ab);
                    await sock.sendMessage(
                      remoteJid,
                      { document: pdfBuf, fileName: `rizzer-${Date.now()}.pdf`, mimetype: "application/pdf" },
                      { quoted: msg }
                    );
                    return;
                  }
                }
              } catch {}
              return reply(`Gagal buat PDF dari gambar: ${err?.message || err}`);
            }
          }
        }
      }
    }

    // Text case: get text from args or quoted
    const quotedText = getQuotedText(msg);
    let text = args.join(" ").trim() || quotedText.trim();

    // also try extendedTextMessage direct fallback
    if (!text) {
      const direct =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        "";
      if (direct.trim()) text = direct.trim();
    }

    if (!text) {
      return reply(
        `Kirim teks untuk dijadikan PDF.\nContoh: \`${prefix || "."}topdf Halo dunia\`\nAtau reply pesan/gambar lalu ketik \`${prefix || "."}topdf\``
      );
    }

    if (text.length > 8000) {
      text = text.slice(0, 8000);
    }

    try {
      const pdfBuffer = createSimplePdf(text);
      await sock.sendMessage(
        remoteJid,
        { document: pdfBuffer, fileName: `rizzer-${Date.now()}.pdf`, mimetype: "application/pdf" },
        { quoted: msg }
      );
    } catch (err) {
      // API fallback
      try {
        const res = await fetch(`https://api.siputzx.my.id/api/convert/txt2pdf?text=${encodeURIComponent(text)}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          if (ab.byteLength > 100) {
            const pdfBuf = Buffer.from(ab);
            await sock.sendMessage(
              remoteJid,
              { document: pdfBuf, fileName: `rizzer-${Date.now()}.pdf`, mimetype: "application/pdf" },
              { quoted: msg }
            );
            return;
          }
        }
      } catch {}
      return reply(`Gagal buat PDF: ${err?.message || err}`);
    }
  },
};
