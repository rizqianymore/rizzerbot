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

Agar log PM2 tidak membengkak, pasang rotasi sekali saja:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 5
```

### Instalasi di Termux (Android)

```bash
# Otomatis (disarankan)
bash scripts/termux-setup.sh

# Lalu jalankan (tetap hidup + auto-restart bila crash)
npm run termux:run
# Sekali jalan saja (tanpa loop): npm run start:termux
# Cek kesehatan lingkungan: npm run doctor
# Update bot: npm run update
```

Setup Termux memasang `nodejs-lts`, `ffmpeg`, `python`, dan `yt-dlp` via `pkg`,
menginstall dependensi Node tanpa modul opsional berat, dan menjalankan bot
dengan browser dimatikan (`BROWSER_DISABLED=1`) agar hemat RAM.

Catatan Termux:

- `sharp` / `puppeteer` adalah dependensi **opsional**.
  Bila tidak terinstall, bot tetap jalan dengan fallback otomatis:
  konversi gambar via `ffmpeg`, stiker tanpa metadata EXIF, dan error yang
  jelas untuk fitur yang memang butuh browser.
- Binary `bin/yt-dlp` bawaan repo hanya untuk `x86_64` — di Termux (ARM)
  bot otomatis memakai `yt-dlp` dari `pkg`/`pip` atau `python3 -m yt_dlp`.
- Emoji di stiker (brat & meme) butuh font Noto Color Emoji (~25 MB,
  diunduh otomatis sekali ke `assets/fonts/` yang tidak ikut git).
- Bila butuh fitur browser di Termux: `pkg install chromium`, isi
  `CHROME_PATH=/data/data/com.termux/files/usr/bin/chromium` di `.env`,
  lalu jalankan dengan `npm run start:node`.

### Agar bot tidak mati di Termux

Android membunuh aplikasi background saat layar mati. Lakukan ini:

1. `pkg install termux-api` (untuk `termux-wake-lock`; `npm run termux:run`
   otomatis mengaktifkannya bila tersedia).
2. Matikan optimasi baterai untuk Termux: Settings → Apps → Termux →
   Battery → Unrestricted. Kunci Termux di recent-apps agar tidak di-swipe.
3. Opsional autostart saat HP reboot: install `Termux:Boot` (F-Droid),
   lalu buat `~/.termux/boot/rizzerbot.sh` berisi:
   ```sh
   #!/data/data/com.termux/files/usr/bin/sh
   cd /path/ke/rizzerbot
   bash scripts/termux-run.sh
   ```

## Variabel Lingkungan

Salin `.env.example` menjadi `.env` lalu isi sesuai kebutuhan. Sebagian besar bersifat opsional — hanya isi yang fitur kamu pakai.

Fitur sistem opt-in (default mati, lihat `.env.example`):

- `BACKUP_TO_OWNER=1` — kirim arsip backup (sesi + database) ke chat owner tiap `BACKUP_INTERVAL_HOURS` (default 24 jam).
- `HEALTH_PORT=3001` — endpoint `GET /health` (JSON: uptime, plugin, RAM) untuk UptimeRobot. Hanya listen di `HEALTH_HOST` (default localhost).

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
