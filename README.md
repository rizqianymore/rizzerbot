# Rizzer Bot

Bot WhatsApp modular dan profesional yang dibangun dengan [Baileys](https://github.com/WhiskeySockets/Baileys). Mendukung multi-bot (sub-bot), hot-reload plugin otomatis, dan sistem akses berjenjang (Owner → Admin → Premium → User).

## Fitur Utama

- **Arsitektur plugin** — 170+ perintah yang dimuat otomatis dari folder `plugins/`, dengan hot-reload via `fs.watch` (ubah file, langsung tanpa restart).
- **Multi-bot** — dapat menjalankan beberapa sub-bot sekaligus dari satu instansi utama.
- **Akses berjenjang** — pembatasan per perintah (`ownerOnly`, `adminOnly`, `premiumOnly`, `groupOnly`, dst).
- **Owner berlapis** — SuperOwner (Primary Owner) mengatur owner global, owner tiap sub-bot dikelola terpisah, dan tiap perubahan hak tercatat di `database/privilege-audit.json` lengkap dengan pelaku.
- **Penjagaan pesan** — rate-limit, anti-burst/spam, antilink, antibot, antivirus, dan filter kata.
- **Backup & rotasi otomatis** — snapshot database terjadwal ke `database/backups/` dengan retensi 7 hari.
- **Presensi Telkom Schools** — cek & submit presensi siswa berbasis NIS dengan whitelist consent, vault kredensial, dan session in-memory (lihat [Presensi Telkom Schools](#presensi-telkom-schools)).

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

## Downloader & Proteksi (Bright Data)

Semua plugin di `plugins/downloader/` (dan `request.*` di service lain) memakai
**rantai anti-protection** yang sama. Kalau situs target memproteksi akses
(Cloudflare, DataDome, Incapsula, Akamai, SafeLine, Sucuri, DDoS-Guard, ...),
request otomatis naik ke jalur yang lebih andal:

```
direct -> Web Unlocker (REST) -> native proxy -> browser stealth -> Scraping Browser
```

| Jalur | Kebutuhan | Keterangan |
| --- | --- | --- |
| `direct` | — | Request biasa, paling murah. Dipakai duluan. |
| `unlocker` | `BRIGHTDATA_API_KEY` | Bright Data Web Unlocker via REST API. |
| `proxy` | `BRIGHTDATA_CUSTOMER` + `BRIGHTDATA_PROXY_PASSWORD` | Web Unlocker lewat native proxy `brd.superproxy.io:44445`. |
| `browser` | Chromium/Chrome | Browser stealth (puppeteer) di mesin sendiri. |
| `scraping-browser` | `BRIGHTDATA_CUSTOMER` + password zone remote | Browser asli di DC BrightData (WS). Paling kuat, paling mahal. |

Aturan penting:

- **404/410 tidak pernah di-eskalasi** — supaya kuota Bright Data tidak terbuang
  untuk file yang memang tidak ada.
- **Jalur unlocker hanya dipakai bila ada indikasi proteksi**, jadi request
  normal tetap gratis.
- Plugin menampilkan penanda `🛡️ Diambil via ...` kalau sempat naik ke jalur
  unlocker/browser.

Engine **yt-dlp** punya tangga-nya sendiri:

```
direct -> Web Unlocker (native proxy) -> cookie clearance (browser / Scraping Browser)
```

Cookie clearance diambil dari browser yang berhasil melewati challenge, lalu
dikasih ke yt-dlp lewat `--cookies`.

Perintah tambahan:

- `.webunlock <url>` (alias `.wu`) — downloader media sosial dengan solving
  proteksi otomatis: SocialDownloader API → rantai unlocker → yt-dlp.

Konfigurasi ada di `.env.example` bagian `BRIGHTDATA_*`.

## Presensi Telkom Schools

Bot bantu siswa **absen otomatis** di gateway Telkom Schools (DigitS).

### Cara pakai (1 perintah)

```
.telkom 539241099
```

Selesai — bot otomatis: login (pola password / vault) → cek presensi →
kirim absen (Datang/Pulang) → balas hasilnya. **Tidak perlu** kirim foto QR,
tidak perlu Share Location, tidak perlu whitelist, tidak perlu setting endpoint.

Live test: **4,9 detik** → `✅ Datang tercatat (08:51 WIB)`.

<details>
<summary>Mode lain (kalau perlu)</summary>

| Perintah                   | Fungsi                                  |
| -------------------------- | --------------------------------------- |
| `.telkom <nis> <password>` | Kalau password belum tersimpan di vault |
| `.telkom status <nis>`     | Cek status saja (tanpa absen)           |
| `.telkom <nis> <kode>`     | Lanjutkan login 2FA                     |
| `.telkom resend <nis>`     | Kirim ulang kode 2FA                    |
| `.telkom link`             | Link aplikasi resmi                     |

Absen dari **foto QR guru** + **Share Location asli** juga didukung (lebih
akurat): kirim fotonya ke bot, lalu Share Location.

</details>

### Konfigurasi (semua opsional)

```bash
# password siswa: pola sekolah (default aktif kalau diisi)
TELKOM_PASSWORD_PATTERN=dummy@{nis}
# atau per siswa:
TELKOM_STUDENT_PASSWORDS={"539241099":"password-asli-siswa"}

# id sesi QR guru (sama dengan plugin .absensi)
TELKOM_QR_ID=3919
TELKOM_QR_LEMDIK_ID=47

# auto-absen (default 1): bot buat sendiri payload QR guru
TELKOM_AUTO_QR=1
# auto-absen: pakai koordinat sekolah sebagai lokasi (default 1)
TELKOM_USE_SCHOOL_LOCATION=1
```

> **Catatan jujur:** dengan `TELKOM_AUTO_QR=1` + `TELKOM_USE_SCHOOL_LOCATION=1`,
> bot mengirim QR guru & koordinat sekolah — artinya **pemeriksaan radius
> lokasi di server dimatikan** (absen dianggap di sekolah). Ini jalan karena
> sekolah sendiri yang memegang `.absensi` (QR guru). Kalau sekolah mau lokasi
> asli siswa yang divalidasi: set `TELKOM_USE_SCHOOL_LOCATION=0` lalu minta
> siswa kirim Share Location.

### Data sekolah

```bash
TELKOM_SCHOOL_NAME=SMK Telkom Jakarta
TELKOM_SCHOOL_LAT=-6.1544783
TELKOM_SCHOOL_LNG=106.7507579
TELKOM_SCHOOL_RADIUS_M=150
```

### Setup (opsional)

Semua opsional — bot jalan tanpa konfigurasi apa pun.

```bash
# 1. Daftarkan NIS + consent (opsional: biar siswa tidak perlu ketik password)
.telkomconsent add 539241249 628xxxxxxxx

# 2. Simpan password siswa di vault (opsional, lebih aman daripada chat)
TELKOM_STUDENT_PASSWORDS={"539241249":"password-asli-siswa"}
# alternatif per siswa: TELKOM_PW_539241249=password-asli-siswa
# alternatif file vault di luar repo: TELKOM_VAULT_FILE=/path/vault.json
# alternatif: pola password bawaan sekolah (default NONAKTIF)
# TELKOM_PASSWORD_PATTERN=dummy@{nis}

# 3. Endpoint/hash API & proteksi Cloudflare — terdeteksi otomatis, tanpa setting.
#    Jendela absen & kuota (opsional, ada default):
TELKOM_WINDOW_DATANG=05:30-08:00
TELKOM_WINDOW_PULANG=14:30-16:30
TELKOM_DAILY_LIMIT=3
```

### Cara kerja (auto-detect)

1. **Discovery** — bot mengunduh runtime config + bundle aplikasi resmi
   (`presensi.telkomschools.sch.id`) untuk menemukan base URL API
   (`presensi-read`, `presensi-write`, `read`, `issueauth`) dan hash endpoint.
   Setiap hash divalidasi dengan probe ringan (404 = route salah, 401 = route ada).
   Hasil di-cache di `database/telkom/endpoints.json` (TTL 24 jam).
2. **Login** — `POST {issueauth}/telkomschool/student/issueauth/web` (multipart
   username/password). Bila gateway meminta 2FA, bot meminta kode OTP ke siswa
   dan melanjutkan pada perintah berikutnya.
3. **Profil** — `GET {read}/{hash}` untuk menemukan **studentId internal**
   (bukan asumsi NIS) + nama siswa.
4. **Status** — `GET {presensi-read}/{hash}/{studentId}` lalu diparse:
   Datang/Pulang (waktu), mapel, guru, dan status absen.
5. **Submit** — `POST {presensi-write}/{hash}` dengan body
   `{ studentId, qrType, ...isi QR }`; hanya jalan bila consent auto-submit aktif,
   masih di dalam jendela absen, dan belum absen hari ini.
6. **Cleanup** — token & cookie di-null-kan di `finally` + log `session cleared`.

Proteksi yang ditangani otomatis:

- **Session bootstrap** — server app balas `403` + stub redirect JS lalu memberi
  cookie sesi; bot mengulang request dengan cookie tersebut.
- **Bright Data Scraping Browser** (remote, WS) — browser sungguhan di DC
  BrightData (IP bersih, tanpa challenge). Request API dilakukan dari dalam
  browser itu, jadi header `Authorization` siswa tetap terpakai.
- **Bright Data Web Unlocker** (REST) — lebih murah, untuk ambil halaman yang
  di-challenge.
- **Cloudflare challenge** ("Just a moment...") — retry pakai clearance cookie,
  lalu eskalasi ke browser stealth (headless lokal), terakhir request dari
  dalam browser.

Urutan eskalasi (otomatis, kelihatan di log):

```
direct -> cookie jar -> Scraping Browser (remote) -> Web Unlocker (REST) -> browser stealth -> in-page fetch
```

```bash
# .env — remote browser (jalur terbaik)
BRIGHTDATA_SCRAPING_BROWSER_WS=wss://brd-customer-<CUSTOMER>-zone-scraping_browser1:<PASSWORD>@brd.superproxy.io:9222
# atau 3 baris terpisah:
BRIGHTDATA_CUSTOMER=<CUSTOMER>
BRIGHTDATA_PROXY_PASSWORD=<PASSWORD>
BRIGHTDATA_SCRAPING_BROWSER_ZONE=scraping_browser1
```

> Submit memakai token & akun siswa sendiri. Bila server menolak (mis. QR guru
> tidak tersedia / lokasi tidak dikirim), jawaban **tidak dipalsukan** — user
> diarahkan absen lewat aplikasi resmi.

### Pengamanan

- Password hanya dibaca dari vault, tidak ada password default/fallback di kode.
- Token & cookie di-null-kan di `finally` block + log `session cleared`; tidak ada file cache/temp.
- Rate limit per NIS per hari (default 3x) dan audit log dengan NIS tersamar (`53*****49`).
- Detail error internal (HTTP, payload server) hanya masuk logger, tidak dibalas ke user.

Uji cepat: `npm run test:telkom`

## Pengembangan

```bash
npm run lint        # jalankan ESLint
npm run lint:fix    # perbaiki otomatis
npm run format      # format dengan Prettier
npm run format:check# cek format tanpa mengubah
```

## Catatan

Dibangun untuk tujuan otomasi dan pembelajaran arsitektur bot. Gunakan secara bertanggung jawab dan patuhi ketentuan WhatsApp.
