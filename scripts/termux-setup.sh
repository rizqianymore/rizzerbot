#!/usr/bin/env bash
set -euo pipefail

if [ -z "${TERMUX_VERSION:-}" ] && [ ! -d "/data/data/com.termux/files/usr" ]; then
  echo "[termux-setup] Script ini ditujukan untuk Termux (Android)."
  echo "Di VPS/PC cukup jalankan: npm install"
  exit 1
fi

echo "[1/6] Update paket Termux..."
pkg update -y

echo "[2/6] Install dependensi sistem..."
pkg install -y nodejs-lts ffmpeg python git tar libvips

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "[termux-setup] Node.js versi $(node -v 2>/dev/null || echo '?') terlalu lama, butuh >= 20."
  echo "Coba: pkg update && pkg upgrade nodejs-lts"
  exit 1
fi
echo "  node $(node -v) OK"

echo "[3/6] Install yt-dlp (pilih yang tersedia)..."
if ! command -v yt-dlp >/dev/null 2>&1 && ! python3 -m yt_dlp --version >/dev/null 2>&1; then
  if ! pkg install -y yt-dlp 2>/dev/null; then
    pip install -U yt-dlp
  fi
fi

echo "[4/6] Siapkan .env..."
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "  .env dibuat dari .env.example (isi API key bila perlu)"
fi

echo "[5/6] Install dependensi Node (tanpa modul opsional berat)..."
export PUPPETEER_SKIP_DOWNLOAD=1
npm install --omit=optional

echo "[6/6] Coba pasang modul gambar ringan..."
npm install @napi-rs/canvas --include=optional || echo "  (canvas dilewati: fitur gambar dinonaktifkan sebagian, bot tetap jalan)"

echo ""
echo "--- hasil cek lingkungan ---"
npm run doctor || true

echo ""
echo "Selesai. Jalankan bot dengan:"
echo "  npm run start:termux"
echo ""
echo "Catatan:"
echo "  - BROWSER_DISABLED=1 aktif (scraping via browser dimatikan agar hemat RAM)."
echo "  - Bila butuh browser: pkg install chromium, lalu set CHROME_PATH di .env"
echo "    dan jalankan dengan: npm run start:node"
