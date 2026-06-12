# 🤖 RizzerBot

RizzerBot adalah WhatsApp bot modular, cepat, dan berperforma tinggi yang dibangun di atas **Baileys v7**. Proyek ini menggunakan arsitektur kode bersih (*clean code*) dengan pembagian berkas perintah berbasis menu dan pemisahan database terstruktur.

---

## 🌟 Fitur Utama

- **Pairing Code & QR Code Connection** — Hubungkan bot dengan mudah ke nomor WhatsApp Anda tanpa pemindaian kamera.
- **Split Database Architecture** — Data dipisahkan secara modular di folder `database/` untuk integrasi yang lebih teratur.
- **Clean Command Registry** — Perintah inti dipisah menjadi 3 berkas kategori: `user.js`, `premium.js`, dan `owner.js` di dalam folder `lib/commands/`.
- **Hot Reload Plugin Engine** — Tambahkan fitur baru secara instan dengan membuat file baru di dalam direktori `plugins/` tanpa harus merestart bot.
- **Media & Sticker Processing** — Menggunakan ImageMagick & FFmpeg untuk rendering stiker, stiker video, brat, bratvid, QC, dan kolase secara real-time.

---

## 📂 Struktur Proyek

```
rizzerbot/
├── index.js                  # Entry point utama bot
├── install.sh                # Skrip bash instalasi otomatis (Node 22 LTS + Tools)
├── package.json              # File manifes npm
├── assets/                   # Aset gambar & banner menu
│   └── menu_banner.png
├── config/
│   └── settings.js           # Pengaturan konfigurasi utama bot
├── database/                 # Folder database split (JSON)
│   ├── users.json            # Profil & pendaftaran pengguna
│   ├── premium.json          # Daftar nomor Premium
│   ├── owner.json            # Pengaturan Owner, Admin, dan Prefix
│   ├── command.json          # Statistik hits perintah
│   ├── channels.json         # Target JID Saluran JPM
│   └── groups.json           # Pengaturan Anti-Link & Anti-Bot grup
├── lib/
│   ├── commands/             # Berkas pemisah perintah utama
│   │   ├── user.js
│   │   ├── premium.js
│   │   └── owner.js
│   ├── database.js           # Controller database split
│   ├── handler.js            # Router & parser pesan WhatsApp masuk
│   ├── menu.js               # Formatter tampilan menu utama bot
│   └── plugins.js            # Loader plugin dinamis
└── plugins/                  # Plugin tambahan buatan komunitas
```

---

## 🛠️ Instalasi & Setup (Linux)

Kami menyediakan skrip bash instalasi otomatis untuk menyiapkan seluruh lingkungan sistem yang dibutuhkan (Node.js 22 LTS, npm, ffmpeg, imagemagick, libwebp, dan build-essential).

### 1. Jalankan Auto-Installer

Jalankan perintah ini di dalam direktori bot dengan akses root/sudo:

```bash
sudo bash install.sh
```

Skrip ini akan otomatis:
1. Memperbarui dependensi apt sistem.
2. Memasang repositori Node.js 22 LTS dari NodeSource.
3. Memasang `ffmpeg`, `imagemagick`, `libwebp-dev`, `wget`, `git`, dan `build-essential`.
4. Menginstal semua paket npm (node_modules) yang diperlukan secara otomatis.

### 2. Konfigurasi Pengaturan

Buka berkas [config/settings.js](file:///home/pentagon/package/rizzerbot/config/settings.js) dan sesuaikan pengaturannya:

```javascript
export const settings = {
    botName: "RizzerBot",
    ownerName: "Pentagon",
    ownerNumber: "628xxx",        // Nomor HP Anda (tanpa akhiran @s.whatsapp.net)
    pairingNumber: "628xxx",      // Nomor HP bot untuk pairing code
    watchdogNumber: "62811111111", // Nomor penerima notifikasi startup (agar tidak spam self)
    usePairingCode: true,
    public: true,
    prefix: "."
};
```

### 3. Jalankan Bot

Jalankan bot menggunakan perintah:

```bash
npm start
```

---

## 🔌 Cara Membuat Plugin Baru

Cukup buat berkas `.js` baru di dalam folder `plugins/`. File tersebut akan langsung dimuat secara otomatis oleh *hot reload engine*:

```javascript
export default {
    name: 'ping',
    aliases: ['p'],
    description: 'Mengirimkan pesan balasan pong.',
    usage: '',
    example: '',
    category: 'User',
    run: async (sock, msg, args, { sendTyping }) => {
        await sendTyping();
        await sock.sendMessage(msg.key.remoteJid, { text: 'Pong! 🏓' }, { quoted: msg });
    }
};
```

---

## ⚠️ Peringatan Keamanan

> [!CAUTION]
> **JANGAN PERNAH** membagikan atau mem-push berkas/direktori berikut ke publik/GitHub:
> - `assets/sessions/` — Berisi data kunci otentikasi & sesi WhatsApp Anda (setara password!).
> - `database/` — Berisi data nomor telepon pengguna terdaftar & premium.
