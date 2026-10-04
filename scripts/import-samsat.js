import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { DatabaseSync } from 'node:sqlite';

const CSV_PATH = path.resolve('plat-nomor.csv');
const DB_DIR = path.resolve('database');
const DB_PATH = path.join(DB_DIR, 'samsat.db');

if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ File CSV tidak ditemukan di: ${CSV_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

if (fs.existsSync(DB_PATH)) {
  console.log(`Menghapus database lama: ${DB_PATH}`);
  fs.unlinkSync(DB_PATH);
}

console.log(`🚀 Menyiapkan SQLite database di: ${DB_PATH}`);
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = OFF;');
db.exec('PRAGMA synchronous = 0;');
db.exec('PRAGMA temp_store = MEMORY;');
db.exec('PRAGMA cache_size = -64000;');

db.exec(`
  CREATE TABLE IF NOT EXISTS samsat (
    number TEXT PRIMARY KEY,
    bpkb TEXT,
    name TEXT,
    nik TEXT,
    address TEXT,
    brand TEXT,
    type TEXT,
    vin TEXT,
    engine TEXT,
    color TEXT,
    year TEXT
  );
`);

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO samsat (
    number, bpkb, name, nik, address, brand, type, vin, engine, color, year
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

console.log(`⏳ Membaca dan mengimpor data dari ${CSV_PATH}...`);
const fileStream = fs.createReadStream(CSV_PATH, { encoding: 'utf-8' });
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity,
});

let isHeader = true;
let count = 0;
let batchCount = 0;
const BATCH_SIZE = 10000;

console.time('Import Selesai');
db.exec('BEGIN TRANSACTION;');

function parseCsvLine(text) {
  const result = [];
  let curr = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(curr.trim());
      curr = '';
    } else {
      curr += char;
    }
  }
  result.push(curr.trim());
  return result;
}

rl.on('line', (line) => {
  if (isHeader) {
    isHeader = false;
    return;
  }
  if (!line || !line.trim()) return;

  const cols = parseCsvLine(line);

  const rawNumber = cols[0] || '';
  const cleanNumber = rawNumber.replace(/\s+/g, '').toUpperCase();
  if (!cleanNumber) return;

  const bpkb = cols[1] || '';
  const name = cols[2] || '';
  const nik = cols[3] || '';
  const address = cols[4] || '';
  const brand = cols[5] || '';
  const type = cols[6] || '';
  const vin = cols[7] || '';
  const engine = cols[8] || '';
  const color = cols[9] || '';
  const year = cols[10] || '';

  insertStmt.run(
    cleanNumber,
    bpkb,
    name,
    nik,
    address,
    brand,
    type,
    vin,
    engine,
    color,
    year
  );

  count++;
  batchCount++;

  if (batchCount >= BATCH_SIZE) {
    db.exec('COMMIT;');
    db.exec('BEGIN TRANSACTION;');
    batchCount = 0;
    process.stdout.write(`\r✅ Terimpor: ${count.toLocaleString('id-ID')} baris...`);
  }
});

rl.on('close', () => {
  if (batchCount > 0) {
    db.exec('COMMIT;');
  }

  console.log(`\n🔍 Membuat Index B-Tree untuk pencarian super cepat...`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_samsat_nik ON samsat(nik);');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.close();

  console.timeEnd('Import Selesai');
  const stats = fs.statSync(DB_PATH);
  console.log(`🎉 Sukses! Total ${count.toLocaleString('id-ID')} data tersimpan di ${DB_PATH} (${(stats.size / 1024 / 1024).toFixed(2)} MB).`);
});
