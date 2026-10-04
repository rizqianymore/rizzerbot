#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const PLUGINS_DIR = path.resolve('plugins');

const SEPARATOR_REGEX = /([━─═\-_~*=]{5,})/g;

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu;

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walkDir(PLUGINS_DIR);
const report = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = path.relative(process.cwd(), filePath);

  const fileIssues = {
    file: relPath,
    separators: [],
    excessiveEmojiLines: [],
    totalEmojis: 0
  };

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    const sepMatches = line.match(SEPARATOR_REGEX);
    if (sepMatches) {

      const isCommentOnly = /^\s*(\/\/|\/\*|\*)/.test(line);
      if (!isCommentOnly) {
        fileIssues.separators.push({
          line: lineNum,
          match: sepMatches[0],
          text: line.trim()
        });
      }
    }

    const emojis = line.match(EMOJI_REGEX) || [];
    if (emojis.length > 0) {
      fileIssues.totalEmojis += emojis.length;

      if (emojis.length >= 2) {
        fileIssues.excessiveEmojiLines.push({
          line: lineNum,
          count: emojis.length,
          emojis: emojis.join(' '),
          text: line.trim().slice(0, 100)
        });
      }
    }
  });

  if (fileIssues.separators.length > 0 || fileIssues.excessiveEmojiLines.length > 0 || fileIssues.totalEmojis >= 4) {
    report.push(fileIssues);
  }
}

console.log('='.repeat(60));
console.log('HASIL ANALISIS FORMAT TEKS & EMOJI DI SELURUH PLUGINS');
console.log('='.repeat(60));

if (report.length === 0) {
  console.log('Semua plugin sudah bersih dan rapi! Tidak ditemukan separator panjang atau emoji berlebih.');
  process.exit(0);
}

let countSep = 0;
let countEmoji = 0;

for (const item of report) {
  console.log(`\n📄 [${item.file}] (Total Emoji: ${item.totalEmojis})`);

  if (item.separators.length > 0) {
    countSep += item.separators.length;
    console.log('  ⚠️  SEPARATOR PANJANG DITEMUKAN:');
    item.separators.forEach(s => {
      console.log(`     - Baris ${s.line}: "${s.match}" -> ${s.text}`);
    });
  }

  if (item.excessiveEmojiLines.length > 0) {
    countEmoji += item.excessiveEmojiLines.length;
    console.log('  ⚠️  BARIS DENGAN BANYAK EMOJI:');
    item.excessiveEmojiLines.forEach(e => {
      console.log(`     - Baris ${e.line} (${e.count} emoji [${e.emojis}]): ${e.text}`);
    });
  }
}

console.log('\n' + '='.repeat(60));
console.log(`RINGKASAN:`);
console.log(`- Total File Bermasalah : ${report.length} file`);
console.log(`- Kasus Separator Panjang: ${countSep}`);
console.log(`- Baris Ber-emoji Padat   : ${countEmoji}`);
console.log('='.repeat(60));
