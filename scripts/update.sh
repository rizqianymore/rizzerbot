#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[update] Bukan repo git, batal."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "[update] Ada perubahan lokal yang belum di-commit:"
  git status --short | head -n 10
  echo "Commit/stash dulu, atau jalankan: git stash -u && bash scripts/update.sh"
  exit 1
fi

echo "[update] Menarik perubahan terbaru..."
git pull --ff-only

if [ -n "${TERMUX_VERSION:-}" ] || [ -d "/data/data/com.termux/files/usr" ]; then
  echo "[update] Mode Termux: install tanpa modul opsional berat..."
  export PUPPETEER_SKIP_DOWNLOAD=1
  npm install --omit=optional
else
  npm install
fi

echo "[update] Cek lingkungan..."
npm run doctor || true
echo "[update] Selesai."
