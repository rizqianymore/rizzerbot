import fs from "fs";
import path from "path";

export default {
  name: "nulis",
  aliases: ["tulis", "magernulis"],
  description: "Nulis teks di kertas folio (canvas)",
  usage: "<teks>",
  category: "Tools",
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const text = args.join(" ").trim();
    if (!text) {
      return reply(`Masukkan teks yang ingin ditulis!\nContoh: \`${prefix || "."}nulis Halo dunia, ini tulisan tangan\``);
    }
    if (text.length > 2000) {
      return reply("Teks terlalu panjang (maks 2000 karakter).");
    }

    await sendTyping?.();
    const remoteJid = msg.key?.remoteJid;

    // wrap text by ~40 chars per line, preserve words and explicit newlines
    function wrapText(input, maxChars = 40) {
      const paragraphs = input.split("\n");
      const lines = [];
      for (const para of paragraphs) {
        if (!para.trim()) {
          lines.push("");
          continue;
        }
        const words = para.split(/\s+/);
        let cur = "";
        for (const w of words) {
          if (!w) continue;
          // hard split overly long word
          if (w.length > maxChars) {
            if (cur) {
              lines.push(cur);
              cur = "";
            }
            for (let i = 0; i < w.length; i += maxChars) {
              lines.push(w.slice(i, i + maxChars));
            }
            continue;
          }
          const next = cur ? `${cur} ${w}` : w;
          if (next.length > maxChars) {
            lines.push(cur);
            cur = w;
          } else {
            cur = next;
          }
        }
        if (cur) lines.push(cur);
      }
      return lines.length ? lines : [input.slice(0, maxChars)];
    }

    // try canvas first
    let createCanvas = null;
    let GlobalFonts = null;
    let canvasAvailable = false;

    try {
      const mod = await import("@napi-rs/canvas");
      createCanvas = mod.createCanvas || mod.default?.createCanvas;
      GlobalFonts = mod.GlobalFonts || mod.default?.GlobalFonts || null;
      if (createCanvas) canvasAvailable = true;
    } catch (_) {
      // try via native helper (handles require fallback)
      try {
        const { getCanvas } = await import("@/src/utils/native.js");
        const mod = getCanvas();
        if (mod?.createCanvas) {
          createCanvas = mod.createCanvas;
          GlobalFonts = mod.GlobalFonts || null;
          canvasAvailable = true;
        }
      } catch (_) {}
    }

    // attempt to register handwriting font if available (optional)
    if (GlobalFonts) {
      try {
        const candidates = [
          path.resolve("assets/fonts/handwriting.ttf"),
          path.resolve("assets/fonts/Caveat-Regular.ttf"),
          path.resolve("src/services/fetch/brat/assets/fonts.ttf"),
        ];
        for (const p of candidates) {
          if (fs.existsSync(p)) {
            try {
              GlobalFonts.registerFromPath(p, "Handwriting");
            } catch (_) {}
            break;
          }
        }
      } catch (_) {}
    }

    let buffer = null;

    if (canvasAvailable && createCanvas) {
      try {
        const lines = wrapText(text, 40);
        const lineHeight = 38;
        const paddingTop = 140;
        const paddingBottom = 80;
        const width = 800;
        const height = Math.min(3000, Math.max(600, paddingTop + lines.length * lineHeight + paddingBottom));
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // paper background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // subtle paper border
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, width - 8, height - 8);

        // red margin line (folio style)
        const marginX = 68;
        ctx.strokeStyle = "#e57373";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(marginX, 0);
        ctx.lineTo(marginX, height);
        ctx.stroke();

        // horizontal ruled lines
        ctx.strokeStyle = "#90caf9";
        ctx.lineWidth = 0.9;
        for (let y = paddingTop - 28; y < height - 20; y += lineHeight) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // header line (thicker)
        ctx.strokeStyle = "#ef9a9a";
        ctx.lineWidth = 1;
        const headerY = paddingTop - 28 - lineHeight;
        if (headerY > 10) {
          ctx.beginPath();
          ctx.moveTo(0, headerY);
          ctx.lineTo(width, headerY);
          ctx.stroke();
        }

        // holes for binder (folio)
        ctx.fillStyle = "#f5f5f5";
        ctx.strokeStyle = "#bdbdbd";
        ctx.lineWidth = 1;
        const holeX = 22;
        const holeYs = [height * 0.25, height * 0.5, height * 0.75];
        for (const hy of holeYs) {
          ctx.beginPath();
          ctx.arc(holeX, hy, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // inner shadow
          ctx.beginPath();
          ctx.arc(holeX, hy, 7, 0, Math.PI * 2);
          ctx.fillStyle = "#e0e0e0";
          ctx.fill();
          ctx.fillStyle = "#f5f5f5";
        }

        // write text with handwriting simulation
        const fontFamily = GlobalFonts ? "Handwriting, Courier, monospace" : "Courier, Courier New, monospace";
        ctx.fillStyle = "#1a237e";
        // slight ink color variation: dark blue
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line && lines.length > 1) continue;
          const y = paddingTop + i * lineHeight;
          const x = marginX + 18;

          ctx.save();
          // slight random rotation and offset to simulate handwriting
          const rot = (Math.random() - 0.5) * 0.018; // ~ +/-0.5 deg
          const offY = (Math.random() - 0.5) * 2.2;
          const offX = (Math.random() - 0.5) * 1.2;
          ctx.translate(x + offX, y + offY);
          ctx.rotate(rot);
          ctx.font = `28px ${fontFamily}`;
          // ctx.font = '28px Courier';
          ctx.textBaseline = "alphabetic";
          ctx.fillText(line, 0, 0);
          ctx.restore();
        }

        // encode to buffer
        if (typeof canvas.encode === "function") {
          const encoded = await canvas.encode("png");
          buffer = Buffer.from(encoded);
        } else if (typeof canvas.toBuffer === "function") {
          buffer = canvas.toBuffer("image/png");
          if (buffer instanceof Promise) buffer = await buffer;
        } else if (typeof canvas.encodeSync === "function") {
          buffer = Buffer.from(canvas.encodeSync("png"));
        }
      } catch (err) {
        // canvas failed -> fallback to API
        console.warn(`[nulis] canvas render failed: ${err?.message}`);
        buffer = null;
      }
    }

    // fallback to API if canvas not available or failed
    if (!buffer) {
      try {
        const url = `https://api.siputzx.my.id/api/canvas/nulis?text=${encodeURIComponent(text)}`;
        const res = await fetch(url, { headers: { accept: "image/*" } });
        if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`);
        const ab = await res.arrayBuffer();
        buffer = Buffer.from(ab);
        if (!buffer || buffer.length < 500) throw new Error("buffer kosong dari API");
      } catch (err) {
        return reply(`Gagal membuat tulisan: ${err?.message || err}`);
      }
    }

    try {
      await sock.sendMessage(remoteJid, { image: buffer, caption: "✍️ Nulis selesai" }, { quoted: msg });
    } catch (err) {
      return reply(`Gagal mengirim gambar: ${err?.message || err}`);
    }
  },
};
