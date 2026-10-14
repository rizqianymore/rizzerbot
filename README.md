# Rizzer Bot

Bot WhatsApp modular dan profesional yang dibangun dengan [Baileys](https://github.com/WhiskeySockets/Baileys). Mendukung multi-bot (sub-bot), hot-reload plugin otomatis, dan sistem akses berjenjang (Owner → Admin → Premium → User).

## Fitur Utama

- **Arsitektur plugin** — 170+ perintah yang dimuat otomatis dari folder `plugins/`, dengan hot-reload via `fs.watch` (ubah file, langsung tanpa restart).
- **Multi-bot** — dapat menjalankan beberapa sub-bot sekaligus dari satu instansi utama.
- **Akses berjenjang** — pembatasan per perintah (`ownerOnly`, `adminOnly`, `premiumOnly`, `groupOnly`, dst).
- **Penjagaan pesan** — rate-limit, anti-burst/spam, antilink, antibot, antivirus, dan filter kata.
- **Backup & rotasi otomatis** — snapshot database terjadwal ke `database/backups/` dengan retensi 7 hari.

## Kebutuhan

- Node.js >= 20 (atau Bun >= 1.0.0)
- `ffmpeg` (untuk stiker/video)
- API keys opsional (lihat `.env.example`)

## Instalasi

```bash
# 1. Salin dan isi variabel lingkungan
cp .env.example .env

# 2. Install dependensi
npm install

# 3. Jalankan
npm start          # dengan Bun
npm run start:node # dengan Node
```

### Menjalankan dengan PM2 (produksi)

```bash
npm run pm2:start
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

### Instalasi di Termux (Android)

```bash
# Otomatis (disarankan)
bash scripts/termux-setup.sh

# Lalu jalankan
npm run start:termux
```

Setup Termux memasang `nodejs-lts`, `ffmpeg`, `python`, dan `yt-dlp` via `pkg`,
menginstall dependensi Node tanpa modul opsional berat, dan menjalankan bot
dengan browser dimatikan (`BROWSER_DISABLED=1`) agar hemat RAM.

Catatan Termux:

- `sharp` / `node-webpmux` / `puppeteer` adalah dependensi **opsional**.
  Bila tidak terinstall, bot tetap jalan dengan fallback otomatis:
  konversi gambar via `ffmpeg`, stiker tanpa metadata EXIF, dan error yang
  jelas untuk fitur yang memang butuh browser.
- Binary `bin/yt-dlp` bawaan repo hanya untuk `x86_64` — di Termux (ARM)
  bot otomatis memakai `yt-dlp` dari `pkg`/`pip` atau `python3 -m yt_dlp`.
- Bila butuh fitur browser di Termux: `pkg install chromium`, isi
  `CHROME_PATH=/data/data/com.termux/files/usr/bin/chromium` di `.env`,
  lalu jalankan dengan `npm run start:node`.

## Variabel Lingkungan

Salin `.env.example` menjadi `.env` lalu isi sesuai kebutuhan. Sebagian besar bersifat opsional — hanya isi yang fitur kamu pakai.

## Struktur Direktori

```
index.js            Entry point: inisialisasi, symlink alias @/, .env, ffmpeg
plugins/            Perintah (command) dikelompokkan per kategori
  ai/  bug/  group/  news/  osint/  owner/  premium/
  socialmedia/  sports/  stalker/  sticker/  tools/  user/
src/
  core/             Loader, dispatcher, koneksi, database, proteksi pesan
  services/         Logika bisnis berat per domain (dipakai oleh plugin)
  utils/            Utilitas umum (cleaner, imagePayload, request, dll)
config/             Pengaturan bot
database/           State runtime (ter-gitignore)
assets/             Gambar, sesi, font, cache
```

### Pola Plugin

Setiap file plugin mengekspor objek `default` berupa command (atau array command):

```js
export default {
  name: "ping", // nama perintah (wajib)
  aliases: ["ceklap"], // alias opsional
  description: "Cek waktu respons bot",
  usage: "",
  category: "General",
  premiumOnly: false, // pembatasan akses opsional
  run: async (sock, msg, args, ctx) => {
    const { reply, prefix } = ctx;
    await reply(`🏓 Pong! \`${prefix}ping\``);
  },
};
```

- **File yang diawali `_` (garis bawah) akan dilewati loader** — gunakan untuk helper/modul pendukung di dalam folder plugin.
- Logika berat sebaiknya diletakkan di `src/services/`, bukan di dalam plugin (plugin harus tipis).

## Pengembangan

```bash
npm run lint        # jalankan ESLint
npm run lint:fix    # perbaiki otomatis
npm run format      # format dengan Prettier
npm run format:check# cek format tanpa mengubah
```

## Catatan

Dibangun untuk tujuan otomasi dan pembelajaran arsitektur bot. Gunakan secara bertanggung jawab dan patuhi ketentuan WhatsApp.
