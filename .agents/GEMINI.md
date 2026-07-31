# Gemini Developer Guide — Kyros-MD

Panduan resmi, aturan arsitektur, dan konvensi pengembangan untuk AI coding agents yang bekerja pada proyek **Kyros-MD**.

---

## 1. Arsitektur Proyek (Enterprise Modular Structure)

Proyek ini menggunakan arsitektur **Clean Enterprise Pipeline** dengan pemisahan modul yang terisolasi secara ketat:

- **Entry Point (`index.js`)**: Entry point minimalis (< 20 baris) yang memanggil koneksi utama Baileys dari `src/core/connection.js`.
- **Core Engine (`src/core/`)**:
  - `connection.js`: Siklus koneksi utama Baileys, pairing code, & auto-reconnect.
  - `dispatcher.js`: Router dispatcher utama yang mengalirkan pesan melalui pipeline middleware.
  - `loader.js`: Engine pemuat plugin dinamis & *hot-reloader* otomatis (`plugins/`).
  - `secondary.js`: Engine manajemen bot sekunder (*multi-session sub-bots*).
  - `database.js`: Adapter JSON database terpisahkan dengan penulisan aman (*atomic write*).
- **Middleware Pipeline (`src/middleware/`)**:
  - `auth.js`: Validator hak akses (Owner, Admin, Premium, Registration, Maintenance).
  - `antispam.js`: Proteksi spam, rate limiting, burst guard, & pembersihan memori otomatis.
  - `groupSecurity.js`: Penanganan otomatis Anti-Link & Anti-Bot pada grup.
  - `groupGuard.js`: Proteksi otomatis posisi Admin/Owner di dalam grup dari demote tidak sah.
  - `statusSaver.js`: Pengunduh otomatis media status WhatsApp.
- **Dynamic Micro-Plugins (`plugins/`)**:
  - Terbagi secara rapi ke dalam subfolder: `user/`, `owner/`, `downloader/`, `media/`, dan `osint/`.
  - Dimuat secara otomatis saat runtime dengan dukungan *hot-reload*.

---

## 2. Aturan Plugin & Tiered Command Registry

1. **Schema Plugin (`plugins/*/*.js`)**:
   Setiap plugin harus meng-export default object dengan format:
   ```javascript
   export default {
     name: "namaperintah",
     description: "Deskripsi singkat fungsi perintah.",
     usage: "<argumen>",
     example: "namaperintah contoh",
     aliases: ["alias1"],
     category: "Media", // Kategori tampilan pada menu (.plugins)
     premiumOnly: true, // Safeguard khusus akses premium
     ownerOnly: false,  // Safeguard khusus akses owner
     run: async (sock, msg, args, context) => {
       // Logika eksekusi utama
     },
   };
   ```
2. **Aturan Hak Akses Plugin**:
   - Perintah publik/dasar diletakkan di `plugins/user/`.
   - Seluruh plugin fitur eksternal di `plugins/downloader/`, `plugins/media/`, `plugins/osint/`, dan `plugins/owner/` **wajib** menyertakan `premiumOnly: true` atau `ownerOnly: true`.

---

## 3. Aturan Database State (`src/core/database.js`)

- **Larangan Keras**: Dilarang melakukan pembacaan/penulisan langsung file JSON database (misal `fs.writeFileSync("database/users.json")`) di luar `src/core/database.js` untuk mencegah *race condition* dan korupsi data.
- **Cara Akses**: Selalu gunakan `db.data` untuk membaca/menulis data state dan panggil `db.save()` atau helper method terkait (`db.getUser()`, `db.updateUser()`, `db.updateGroup()`).

---

## 4. Estetika Tampilan & Logging

- Gunakan logger terstruktur `pino` untuk output konsol.
- Seluruh daftar menu perintah wajib diformat secara bersih dengan format berikut:
  ```text
  │ .commandname <arg>
  ```
- Dilarang menambahkan bullet prefix dekoratif seperti `➩` di depan prefix perintah agar menu tetap konsisten dan rapi.

---

## 5. Pemrosesan Media & Emoji

- Saat merender teks atau gambar pada Canvas (misal meme, collage, photobooth), selalu gunakan `src/utils/emoji.js` untuk merender emoji Twemoji secara presisi.
- Sematkan emoji yang diekstrak sebagai array ke dalam `addStickerMetadata` (`src/services/sticker.js`) untuk binding metadata Exif stiker WhatsApp.
