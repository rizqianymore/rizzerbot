#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

const DEFAULT_TARGETS = ['plugins', 'src', 'config', 'scripts', 'bin', 'index.js'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.comment-clean-backup', 'database', 'assets', 'logs', 'tmp', 'temp', 'dist', 'build']);
const DEFAULT_EXTS = ['js', 'mjs', 'cjs'];

function parseArgs(argv) {
  const opts = {
    targets: [],
    exts: [...DEFAULT_EXTS],
    dryRun: false,
    backup: true,
    verify: true,
    collapseBlank: true,
    keepJSDoc: false,
    stripConsole: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--dir':
      case '-d':
        if (next()) opts.targets.push(next());
        break;
      case '--ext':
        if (next()) opts.exts = next().split(',').map((e) => e.replace(/^\./, '').trim()).filter(Boolean);
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--no-backup':
        opts.backup = false;
        break;
      case '--no-verify':
        opts.verify = false;
        break;
      case '--no-collapse':
        opts.collapseBlank = false;
        break;
      case '--keep-jsdoc':
        opts.keepJSDoc = true;
        break;
      case '--strip-console':
        opts.stripConsole = true;
        break;
      case '--force':
        opts.force = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Opsi tidak dikenal: ${arg}`);
          printHelp();
          process.exit(1);
        }
        opts.targets.push(arg);
        break;
    }
  }

  if (opts.targets.length === 0) opts.targets = [...DEFAULT_TARGETS];
  return opts;
}

function printHelp() {
  console.log(`Bersihkan komentar (//, /* */) dari seluruh kode project.

Usage:
  node scripts/clean-comments.js [target...] [opsi]

Target:
  Daftar file/folder yang diproses (default: ${DEFAULT_TARGETS.join(', ')})

Opsi:
  -d, --dir <path>    Tambahkan folder target (bisa diulang)
      --ext <list>    Ekstensi file, pisah koma (default: ${DEFAULT_EXTS.join(',')})
      --dry-run       Hanya tampilkan laporan, tidak menulis file
      --no-backup     Jangan buat backup (default backup aktif)
      --no-verify     Lewati pengecekan sintaks (node --check)
      --no-collapse   Jangan rapikan baris kosong berlebih
      --keep-jsdoc    Pertahankan blok dokumentasi /** ... */
      --strip-console Hapus juga perintah console.*
      --force         Tetap proses file walau sintaks aslinya error
  -h, --help          Tampilkan bantuan`);
}

const IDENT_CHAR = /[A-Za-z0-9_$]/;
const REGEX_PREFIX_CHARS = '(,=:[!&|?{};+-*%~^<>';
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

function stripComments(source, options = {}) {
  const keepJSDoc = !!options.keepJSDoc;
  const n = source.length;
  let out = '';
  let i = 0;

  const stack = [{ type: 'code', expr: false, brace: 0 }];
  let lastCodeChar = '';
  let lastWord = '';

  const regexAllowed = () => {
    if (!lastCodeChar) return true;
    if (REGEX_PREFIX_CHARS.includes(lastCodeChar)) return true;
    if (lastCodeChar === ')' || lastCodeChar === ']' || lastCodeChar === '}') return false;
    if (IDENT_CHAR.test(lastCodeChar) && REGEX_KEYWORDS.has(lastWord)) return true;
    return false;
  };

  while (i < n) {
    const top = stack[stack.length - 1];
    const c = source[i];
    const c2 = source[i + 1];

    if (top.type === 'line') {
      if (c === '\n' || c === '\r') {
        stack.pop();
        out += c;
      }
      i++;
      continue;
    }

    if (top.type === 'block') {
      if (c === '*' && c2 === '/') {
        stack.pop();
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (top.type === 'string') {
      out += c;
      if (c === '\\') {
        if (i + 1 < n) {
          out += source[i + 1];
          i += 2;
          continue;
        }
      } else if (c === top.quote) {
        stack.pop();
      }
      i++;
      continue;
    }

    if (top.type === 'template') {
      if (c === '\\') {
        out += c;
        if (i + 1 < n) {
          out += source[i + 1];
          i += 2;
          continue;
        }
        i++;
        continue;
      }
      if (c === '`') {
        out += c;
        stack.pop();
        i++;
        continue;
      }
      if (c === '$' && c2 === '{') {
        out += '${';
        stack.push({ type: 'code', expr: true, brace: 0 });
        i += 2;
        continue;
      }
      out += c;
      i++;
      continue;
    }

    if (c === '/' && c2 === '/') {
      stack.push({ type: 'line' });
      i += 2;
      continue;
    }

    if (c === '/' && c2 === '*') {
      const isDoc = keepJSDoc && source[i + 2] === '*';
      if (isDoc) {
        out += '/*';
        i += 2;
        while (i < n) {
          if (source[i] === '*' && source[i + 1] === '/') {
            out += '*/';
            i += 2;
            break;
          }
          out += source[i];
          i++;
        }
        continue;
      }

      let j = i + 2;
      while (j < n && !(source[j] === '*' && source[j + 1] === '/')) j++;
      j = Math.min(j + 2, n);

      const before = out.length ? out[out.length - 1] : '';
      let k = j;
      while (k < n && /\s/.test(source[k])) k++;
      const after = k < n ? source[k] : '';
      if (before && after && IDENT_CHAR.test(before) && IDENT_CHAR.test(after)) {
        out += ' ';
      }
      i = j;
      continue;
    }

    if (c === '"' || c === "'") {
      stack.push({ type: 'string', quote: c });
      out += c;
      i++;
      lastCodeChar = c;
      lastWord = '';
      continue;
    }

    if (c === '`') {
      stack.push({ type: 'template' });
      out += c;
      i++;
      lastCodeChar = c;
      lastWord = '';
      continue;
    }

    if (c === '/' && regexAllowed()) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const rc = source[j];
        if (rc === '\\') {
          j += 2;
          continue;
        }
        if (rc === '\n') break;
        if (inClass) {
          if (rc === ']') inClass = false;
        } else if (rc === '[') {
          inClass = true;
        } else if (rc === '/') {
          closed = true;
          j++;
          break;
        }
        j++;
      }
      if (closed) {
        out += source.slice(i, j);
        i = j;
        while (i < n && IDENT_CHAR.test(source[i])) {
          out += source[i];
          i++;
        }
        lastCodeChar = '/';
        lastWord = '';
        continue;
      }
      out += c;
      i++;
      lastCodeChar = c;
      lastWord = '';
      continue;
    }

    if (top.expr && c === '}') {
      out += c;
      if (top.brace > 0) top.brace--;
      else stack.pop();
      i++;
      lastCodeChar = c;
      lastWord = '';
      continue;
    }

    if (top.expr && c === '{') {
      top.brace++;
      out += c;
      i++;
      lastCodeChar = c;
      lastWord = '';
      continue;
    }

    if (/\s/.test(c)) {
      out += c;
      i++;
      continue;
    }

    out += c;
    if (IDENT_CHAR.test(c)) lastWord += c;
    else lastWord = '';
    lastCodeChar = c;
    i++;
  }

  return finalize(out, options);
}

function finalize(text, options = {}) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const rawLines = text.split(/\r\n|\n/);

  let lines = rawLines.map((line) => {
    if (options.stripConsole && /^\s*console\.(log|debug|info|warn|trace)\s*\(/.test(line)) {
      return '';
    }
    return line.trim() === '' ? '' : line.replace(/[ \t]+$/, '');
  });

  if (options.collapseBlank !== false) {
    const collapsed = [];
    let blankRun = 0;
    for (const line of lines) {
      if (line === '') {
        blankRun++;
        if (blankRun <= 1) collapsed.push('');
      } else {
        blankRun = 0;
        collapsed.push(line);
      }
    }
    lines = collapsed;
  }

  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();

  return lines.join(eol) + eol;
}

function walk(target, exts, results = []) {
  let stat;
  try {
    stat = fs.statSync(target);
  } catch (_) {
    return results;
  }

  if (stat.isFile()) {
    const ext = path.extname(target).replace(/^\./, '');
    if (exts.includes(ext)) results.push(target);
    return results;
  }

  if (stat.isDirectory()) {
    const base = path.basename(target);
    if (SKIP_DIRS.has(base)) return results;
    for (const entry of fs.readdirSync(target)) {
      walk(path.join(target, entry), exts, results);
    }
  }
  return results;
}

function verifySyntax(code) {
  const tmpFile = path.join(os.tmpdir(), `clean-comments-${process.pid}-${Date.now()}.mjs`);
  try {
    fs.writeFileSync(tmpFile, code);
    const res = spawnSync(process.execPath, ['--check', tmpFile], { encoding: 'utf-8' });
    return { ok: res.status === 0, error: (res.stderr || '').split('\n').slice(0, 4).join('\n').trim() };
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch (_) {}
  }
}

function createBackup(filePath, backupRoot) {
  const rel = path.relative(process.cwd(), filePath);
  const dest = path.join(backupRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(filePath, dest);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const backupRoot = path.join(cwd, '.comment-clean-backup', new Date().toISOString().replace(/[:.]/g, '-'));

  const files = [];
  for (const target of opts.targets) {
    walk(path.resolve(cwd, target), opts.exts, files);
  }
  const unique = [...new Set(files)];

  console.log('='.repeat(64));
  console.log('CODE COMMENT CLEANER');
  console.log('='.repeat(64));
  console.log(`Mode       : ${opts.dryRun ? 'DRY-RUN (tidak menulis)' : 'WRITE'}`);
  console.log(`Target     : ${unique.length} file .${opts.exts.join('/.')}`);
  console.log(`Backup     : ${opts.backup && !opts.dryRun ? path.relative(cwd, backupRoot) : 'nonaktif'}`);
  console.log(`Verify     : ${opts.verify ? 'aktif (node --check)' : 'nonaktif'}`);
  console.log('='.repeat(64));

  let scanned = 0;
  let modified = 0;
  let skipped = 0;
  let removedChars = 0;
  let failed = 0;

  for (const filePath of unique) {
    scanned++;
    const rel = path.relative(cwd, filePath);
    let original;
    try {
      original = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      failed++;
      console.log(`[ERROR] ${rel} -> ${err.message}`);
      continue;
    }

    const cleaned = stripComments(original, opts);
    if (cleaned === original) continue;

    if (opts.verify) {
      const check = verifySyntax(cleaned);
      if (!check.ok) {
        const originalCheck = verifySyntax(original);
        if (originalCheck.ok || !opts.force) {
          skipped++;
          console.log(`[SKIP]  ${rel} -> sintaks hasil tidak valid, file dibiarkan utuh`);
          if (check.error) console.log(`        ${check.error.replace(/\n/g, '\n        ')}`);
          continue;
        }
      }
    }

    const diff = original.length - cleaned.length;
    modified++;
    removedChars += Math.max(0, diff);

    if (opts.dryRun) {
      console.log(`[DRY]   ${rel} -> -${diff} karakter`);
      continue;
    }

    if (opts.backup) createBackup(filePath, backupRoot);
    try {
      fs.writeFileSync(filePath, cleaned);
      console.log(`[OK]    ${rel} -> -${diff} karakter`);
    } catch (err) {
      failed++;
      console.log(`[ERROR] ${rel} -> ${err.message}`);
    }
  }

  console.log('='.repeat(64));
  console.log('RINGKASAN');
  console.log(`- File diperiksa   : ${scanned}`);
  console.log(`- File diubah      : ${modified}`);
  console.log(`- File dilewati    : ${skipped}`);
  console.log(`- Gagal            : ${failed}`);
  console.log(`- Karakter dibuang : ${removedChars.toLocaleString('id-ID')}`);
  if (opts.backup && !opts.dryRun && modified > 0) {
    console.log(`- Backup tersimpan : ${path.relative(cwd, backupRoot)}`);
  }
  console.log('='.repeat(64));
}

main();
