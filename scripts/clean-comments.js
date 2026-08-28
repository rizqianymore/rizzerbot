#!/usr/bin/env node

/**
 * Clean Comments CLI Tool
 * 
 * Tool untuk menghapus seluruh komentar (line comment // & block comment /* *\/)
 * dari file JavaScript/TypeScript/CSS/JSONC secara presisi tanpa merusak
 * string literal (URL, template string, regex, escape quotes).
 * 
 * Usage:
 *   node scripts/clean-comments.js <file_atau_folder> [options]
 * 
 * Options:
 *   --dry-run, -d       Cek perubahan tanpa mengubah file asli
 *   --ext <extensions>  Filter ekstensi file (default: .js,.mjs,.cjs,.ts,.jsx,.tsx,.css)
 *   --help, -h          Tampilkan panduan bantuan
 */

import fs from "fs";
import path from "path";

const DEFAULT_EXTS = new Set([".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx", ".css"]);
const IGNORED_DIRS = new Set(["node_modules", ".git", "assets", "bin/ffmpeg", ".node_modules-1C8ussVS", "package"]);

/**
 * State machine untuk menghapus komentar tanpa merusak string literal, regex, & template string.
 */
export function stripComments(code) {
  if (typeof code !== "string") return "";

  let result = "";
  let i = 0;
  const len = code.length;

  let state = "CODE"; // CODE, SINGLE_QUOTE, DOUBLE_QUOTE, TEMPLATE_LITERAL, REGEX, LINE_COMMENT, BLOCK_COMMENT
  let templateDepth = 0;
  const templateStack = [];

  // Pertahankan shebang line jika ada di awal file
  if (code.startsWith("#!")) {
    const firstNewline = code.indexOf("\n");
    if (firstNewline !== -1) {
      result += code.slice(0, firstNewline + 1);
      i = firstNewline + 1;
    }
  }

  while (i < len) {
    const char = code[i];
    const next = i + 1 < len ? code[i + 1] : "";

    switch (state) {
      case "CODE":
        if (char === "'" ) {
          state = "SINGLE_QUOTE";
          result += char;
          i++;
        } else if (char === '"') {
          state = "DOUBLE_QUOTE";
          result += char;
          i++;
        } else if (char === "`") {
          state = "TEMPLATE_LITERAL";
          templateStack.push(0);
          result += char;
          i++;
        } else if (char === "/" && next === "/") {
          state = "LINE_COMMENT";
          i += 2;
        } else if (char === "/" && next === "*") {
          state = "BLOCK_COMMENT";
          i += 2;
        } else if (char === "/" && isRegexStart(code, i)) {
          state = "REGEX";
          result += char;
          i++;
        } else {
          result += char;
          i++;
        }
        break;

      case "SINGLE_QUOTE":
        result += char;
        if (char === "\\") {
          if (next) {
            result += next;
            i += 2;
          } else {
            i++;
          }
        } else if (char === "'") {
          state = "CODE";
          i++;
        } else {
          i++;
        }
        break;

      case "DOUBLE_QUOTE":
        result += char;
        if (char === "\\") {
          if (next) {
            result += next;
            i += 2;
          } else {
            i++;
          }
        } else if (char === '"') {
          state = "CODE";
          i++;
        } else {
          i++;
        }
        break;

      case "TEMPLATE_LITERAL":
        if (char === "\\") {
          result += char;
          if (next) {
            result += next;
            i += 2;
          } else {
            i++;
          }
        } else if (char === "$" && next === "{") {
          result += "${";
          templateStack[templateStack.length - 1]++;
          state = "CODE";
          i += 2;
        } else if (char === "`") {
          result += char;
          templateStack.pop();
          state = "CODE";
          i++;
        } else {
          result += char;
          i++;
        }
        break;

      case "REGEX":
        result += char;
        if (char === "\\") {
          if (next) {
            result += next;
            i += 2;
          } else {
            i++;
          }
        } else if (char === "[") {
          state = "REGEX_CLASS";
          i++;
        } else if (char === "/") {
          state = "CODE";
          i++;
        } else {
          i++;
        }
        break;

      case "REGEX_CLASS":
        result += char;
        if (char === "\\") {
          if (next) {
            result += next;
            i += 2;
          } else {
            i++;
          }
        } else if (char === "]") {
          state = "REGEX";
          i++;
        } else {
          i++;
        }
        break;

      case "LINE_COMMENT":
        if (char === "\n" || char === "\r") {
          state = "CODE";
          result += char; // Pertahankan baris baru
        }
        i++;
        break;

      case "BLOCK_COMMENT":
        if (char === "*" && next === "/") {
          state = "CODE";
          i += 2;
        } else {
          if (char === "\n") result += "\n"; // Pertahankan struktur baris jika ada
          i++;
        }
        break;
    }
  }

  // Pembersihan baris kosong yang berlebihan (maksimal 2 baris kosong berturut-turut)
  return result.replace(/\n{3,}/g, "\n\n");
}

/**
 * Heuristik deteksi apakah '/' merupakan awal Regular Expression literal atau operator pembagian.
 */
function isRegexStart(code, index) {
  let prevIndex = index - 1;
  while (prevIndex >= 0 && /\s/.test(code[prevIndex])) {
    prevIndex--;
  }

  if (prevIndex < 0) return true;

  const prevChar = code[prevIndex];
  // Karakter sebelum regex biasanya adalah operator, tanda kurung, koma, titik koma, titik dua
  if (/[=([{,;!?:&|~^+\-*%<>]/.test(prevChar)) {
    return true;
  }

  // Cek kata kunci sebelum regex seperti return, typeof, in, of, case, yield, await
  let wordStart = prevIndex;
  while (wordStart >= 0 && /[a-zA-Z0-9_$]/.test(code[wordStart])) {
    wordStart--;
  }
  const prevWord = code.slice(wordStart + 1, prevIndex + 1);
  const regexKeywords = new Set(["return", "typeof", "in", "of", "case", "yield", "await", "throw", "delete", "void", "else"]);
  if (regexKeywords.has(prevWord)) {
    return true;
  }

  return false;
}

/**
 * Proses file
 */
export function processFile(filePath, dryRun = false) {
  try {
    const original = fs.readFileSync(filePath, "utf-8");
    const cleaned = stripComments(original);

    if (original === cleaned) {
      return { filePath, changed: false, bytesReduced: 0 };
    }

    const bytesReduced = Buffer.byteLength(original, "utf-8") - Buffer.byteLength(cleaned, "utf-8");

    if (!dryRun) {
      fs.writeFileSync(filePath, cleaned, "utf-8");
    }

    return { filePath, changed: true, bytesReduced };
  } catch (err) {
    return { filePath, changed: false, error: err.message };
  }
}

/**
 * Rekursif traversal direktori
 */
export function processDirectory(dirPath, allowedExts, dryRun = false) {
  const results = [];

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedExts.has(ext)) {
          results.push(processFile(fullPath, dryRun));
        }
      }
    }
  }

  walk(dirPath);
  return results;
}

// ─── CLI Entrypoint ────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
🧹 *Clean Comments CLI Tool*
=================================
Menghapus komentar (// dan /* */) secara aman dan presisi dari file source code.

👉 Cara Penggunaan:
   node bin/clean-comments.js <target_path> [options]

📌 Argumen & Opsi:
   <target_path>       Path ke file atau direktori target (contoh: src/, plugins/, index.js)
   --dry-run, -d       Simulasi pengecekan tanpa mengubah file langsung
   --ext <ekstensi>    Daftar ekstensi dipisah koma (contoh: --ext .js,.ts)
   --help, -h          Tampilkan panduan ini

💡 Contoh:
   node bin/clean-comments.js src/
   node bin/clean-comments.js plugins/ --dry-run
   node bin/clean-comments.js index.js
`);
    return;
  }

  let dryRun = false;
  let targetPath = null;
  let allowedExts = new Set(DEFAULT_EXTS);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run" || arg === "-d") {
      dryRun = true;
    } else if (arg === "--ext" && i + 1 < args.length) {
      allowedExts = new Set(args[++i].split(",").map((e) => (e.startsWith(".") ? e.trim() : "." + e.trim())));
    } else if (!arg.startsWith("-")) {
      targetPath = arg;
    }
  }

  if (!targetPath) {
    console.error("❌ Masukkan file atau direktori target. Jalankan dengan --help untuk bantuan.");
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), targetPath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌ Target tidak ditemukan: ${resolved}`);
    process.exit(1);
  }

  console.log(`\n🚀 Memulai pembersihan komentar pada: ${targetPath} ${dryRun ? "(DRY-RUN MODE)" : ""}`);

  const stat = fs.statSync(resolved);
  let results = [];

  if (stat.isDirectory()) {
    results = processDirectory(resolved, allowedExts, dryRun);
  } else if (stat.isFile()) {
    results = [processFile(resolved, dryRun)];
  }

  let totalChanged = 0;
  let totalSavedBytes = 0;

  for (const res of results) {
    const rel = path.relative(process.cwd(), res.filePath);
    if (res.error) {
      console.log(`❌ ${rel} - Error: ${res.error}`);
    } else if (res.changed) {
      totalChanged++;
      totalSavedBytes += res.bytesReduced;
      const kb = (res.bytesReduced / 1024).toFixed(2);
      console.log(`✨ ${rel} -> ${dryRun ? "Ditemukan komentar" : "Dibersihkan"} (${kb} KB dihemat)`);
    }
  }

  console.log("\n=================================");
  console.log(`📊 Ringkasan:`);
  console.log(`• Total File Diproses : ${results.length}`);
  console.log(`• File yang Berubah   : ${totalChanged}`);
  console.log(`• Total Ukuran Dihemat: ${(totalSavedBytes / 1024).toFixed(2)} KB`);
  console.log(`=================================\n`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main();
}
