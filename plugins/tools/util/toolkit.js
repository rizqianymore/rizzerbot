import crypto from "crypto";
import QRCode from "qrcode";

const qr = {
  name: "qr",
  aliases: ["qrcode", "buatqr"],
  description: "Buat QR code dari teks (100% lokal, tanpa API)",
  usage: "<teks, maks 2000 karakter>",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const text = args.join(" ").trim();
    if (!text) {
      return reply(`Masukkan teks untuk QR!\nContoh: \`${prefix}qr https://contoh.com\``);
    }
    if (text.length > 2000) return reply("Teks terlalu panjang (maks 2000 karakter).");
    await sendTyping();
    try {
      const buf = await QRCode.toBuffer(text, { type: "png", errorCorrectionLevel: "M", margin: 2, scale: 8 });
      await sock.sendMessage(
        msg.key.remoteJid,
        { image: buf, caption: `QR untuk:\n${text.slice(0, 300)}` },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal membuat QR: ${err.message}`);
    }
  },
};

const ALGOS = ["md5", "sha1", "sha256", "sha512"];

const hash = {
  name: "hash",
  aliases: ["hashteks", "checksum"],
  description: "Hitung hash MD5/SHA1/SHA256/SHA512 dari teks (100% lokal)",
  usage: "<algo> <teks> | <teks> (semua algo)",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const first = String(args[0] || "").toLowerCase();
    let algos = ALGOS;
    let text = args.join(" ").trim();
    if (ALGOS.includes(first)) {
      algos = [first];
      text = args.slice(1).join(" ").trim();
    }
    if (!text) {
      return reply(`Masukkan teks!\nContoh: \`${prefix}hash hello\` (semua algo) atau \`${prefix}hash sha256 hello\``);
    }
    try {
      const lines = [`*HASH*`, ``, `Teks: \`${text.slice(0, 200)}\``, ``];
      for (const a of algos) {
        lines.push(`${a.toUpperCase()}:`, `\`${crypto.createHash(a).update(text, "utf8").digest("hex")}\``, ``);
      }
      return reply(lines.join("\n").trim());
    } catch (err) {
      return reply(`Gagal menghitung hash: ${err.message}`);
    }
  },
};

const DIGITS = "0123456789";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?";

const password = {
  name: "password",
  aliases: ["passgen", "sandi", "genpass"],
  description: "Generator password acak kriptografis (100% lokal)",
  usage: "[panjang 4-128] [--pin] [--no-symbol], cth: 20 | --pin 6",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const flags = args.filter((a) => a.startsWith("--")).map((a) => a.toLowerCase());
    const nums = args.filter((a) => !a.startsWith("--"));
    let len = parseInt(nums[0], 10);
    if (!Number.isFinite(len)) len = 16;
    if (len < 4 || len > 128) return reply(`Panjang 4-128. Contoh: \`${prefix}password 20\`.`);
    const pin = flags.includes("--pin");
    const noSymbol = flags.includes("--no-symbol") || flags.includes("--nosymbol");
    const pool = pin ? DIGITS : LOWER + UPPER + DIGITS + (noSymbol ? "" : SYMBOLS);
    try {
      const arr = Array.from({ length: len }, () => pool[crypto.randomInt(pool.length)]);
      if (!pin) {
        const need = [LOWER, UPPER, DIGITS, ...(noSymbol ? [] : [SYMBOLS])];
        const pos = new Set();
        while (pos.size < Math.min(need.length, len)) pos.add(crypto.randomInt(len));
        [...pos].forEach((p, k) => {
          const set = need[k % need.length];
          arr[p] = set[crypto.randomInt(set.length)];
        });
      }
      const out = arr.join("");
      return reply(`Password (${len} karakter):\n\`${out}\`\n\nJangan bagikan ke siapa pun.`);
    } catch (err) {
      return reply(`Gagal membuat password: ${err.message}`);
    }
  },
};

const base64 = {
  name: "base64",
  aliases: ["b64", "encode64"],
  description: "Encode/decode Base64 (100% lokal)",
  usage: "<enc|dec> <teks>",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const mode = String(args[0] || "").toLowerCase();
    const text = args.slice(1).join(" ");
    if ((mode !== "enc" && mode !== "dec") || !text) {
      return reply(`Gunakan: \`${prefix}base64 enc <teks>\` atau \`${prefix}base64 dec <base64>\``);
    }
    try {
      if (mode === "enc") {
        return reply(`\`${Buffer.from(text, "utf8").toString("base64")}\``);
      }
      const clean = text.replace(/\s+/g, "");
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 !== 0) {
        return reply("Input bukan Base64 valid.");
      }
      return reply(Buffer.from(clean, "base64").toString("utf8") || "(hasil kosong)");
    } catch (err) {
      return reply(`Gagal: ${err.message}`);
    }
  },
};

const uuid = {
  name: "uuid",
  aliases: ["uuidgen", "guid"],
  description: "Generator UUID v4 (100% lokal)",
  usage: "[jumlah 1-10]",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    let n = parseInt(args[0], 10);
    if (!Number.isFinite(n)) n = 1;
    if (n < 1 || n > 10) return reply("Jumlah 1-10.");
    try {
      const ids = Array.from({ length: n }, () => crypto.randomUUID());
      return reply(ids.map((id) => `\`${id}\``).join("\n"));
    } catch (err) {
      return reply(`Gagal: ${err.message}`);
    }
  },
};

export default [qr, hash, password, base64, uuid];
