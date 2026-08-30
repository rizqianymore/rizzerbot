# 🤖 Kyros-MD

WhatsApp Bot berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) dengan sistem modular plugin dan database JSON.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
sudo bash install.sh
```

### 2. Konfigurasi
Sesuaikan konfigurasi bot di [config/settings.js](file:///home/fbi/another/rizzerbot/config/settings.js).

### 3. Jalankan Bot
```bash
npm start
```

## 📁 Struktur Singkat

- `src/` — Core engine, middleware, dan utilitas.
- `plugins/` — Plugin dinamis (`user/`, `owner/`, `downloader/`, `media/`, `osint/`).
- `config/` — Konfigurasi bot.
- `database/` — Penyimpanan data JSON.

## 🔌 Membuat Plugin

Simpan file `.js` di dalam folder `plugins/<kategori>/`:

```javascript
export default {
  name: "contoh",
  description: "Deskripsi plugin",
  usage: "<argumen>",
  example: "contoh tes",
  category: "User",
  run: async (sock, msg, args, context) => {
    await sock.sendMessage(msg.key.remoteJid, { text: "Hello World!" }, { quoted: msg });
  },
};
```
