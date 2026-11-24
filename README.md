# Rizzer Bot

Bot WhatsApp modular berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) dengan sistem plugin hot-reload, multi-bot (sub-bot), dan manajemen hak akses (Owner → Admin → Premium → User).

---

## ⚡ Fitur Utama

- **170+ Plugin Perintah** (`plugins/`): Dimuat otomatis dan mendukung hot-reload tanpa restart server.
- **Sistem Multi-Bot**: Menjalankan sub-bot mandiri dari satu proses utama.
- **Role & Access Control**: Pembatasan per command (`ownerOnly`, `adminOnly`, `premiumOnly`, `groupOnly`, dll).
- **Proteksi Chat**: Rate-limit, anti-spam, antilink, antibot, antivirus, dan sensor kata.
- **Media & Downloader**: Terintegrasi engine download video/audio (TikTok, IG, YouTube, Pinterest, FB, dll), stiker Brat/animasi, dan konversi FFmpeg lokal.
- **Auto-Cleaner & Cache**: Pembersihan otomatis file temporary media dan pencadangan database terjadwal.

---

## 🚀 Kebutuhan & Instalasi

### Persyaratan
- Node.js >= 20 atau Bun >= 1.0.0
- `ffmpeg` terpasang di sistem

### Cara Pasang & Jalankan

```bash
# 1. Clone & install dependencies
git clone https://github.com/rizqianymore/rizzerbot.git
cd rizzerbot
npm install

# 2. Setup konfigurasi
cp .env.example .env

# 3. Jalankan bot
npm start           # via Bun
npm run start:node  # via Node.js
```

### Jalankan di Latar Belakang (PM2)

```bash
npm run pm2:start    # Menjalankan bot
npm run pm2:logs     # Melihat log
npm run pm2:restart  # Restart bot
npm run pm2:stop     # Menghentikan bot
```

### Jalankan di Termux (Android)

```bash
# Setup otomatis
bash scripts/termux-setup.sh

# Jalankan bot
npm run termux:run
```

---

## 📁 Struktur Folder

```text
├── index.js          # Entry point utama bot
├── config/           # Konfigurasi bot (settings.js)
├── plugins/          # Kumpulan perintah bot (per kategori)
├── src/
│   ├── core/         # Koneksi WhatsApp, dispatcher, database, dan security
│   ├── services/     # Logika bisnis (downloader, AI, scraper, stiker)
│   └── utils/        # Helper, network client, dan cleaner
├── assets/           # Font, sesi WhatsApp, dan cache gambar
└── database/         # Penyimpanan lokal (SQLite / JSON)
```

---

## 💡 Membuat Plugin Baru

Buat file baru di dalam subfolder `plugins/<kategori>/<nama>.js`:

```javascript
export default {
  name: "ping",
  aliases: ["p"],
  description: "Cek respons bot",
  category: "General",
  run: async (sock, msg, args, { reply }) => {
    await reply("Pong! 🏓");
  },
};
```
*Catatan: Nama file yang diawali tanda `_` (underscore) akan diabaikan oleh plugin loader.*

---

## 🧪 Pengujian & Diagnostik

```bash
npm run smoke        # Verifikasi integritas modul & plugin
npm run doctor       # Cek kesiapan dependensi sistem (ffmpeg, chrome, dll)
```
