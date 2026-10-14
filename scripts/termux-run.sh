#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/termux-run.log"
LOG_MAX_BYTES=$((5 * 1024 * 1024))
LOG_KEEP=3

rotate_logs() {
  [ -f "$LOG_FILE" ] || return 0
  local size
  size=$(wc -c < "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$size" -ge "$LOG_MAX_BYTES" ]; then
    rm -f "$LOG_FILE.$LOG_KEEP"
    local i=$((LOG_KEEP - 1))
    while [ "$i" -ge 1 ]; do
      [ -f "$LOG_FILE.$i" ] && mv "$LOG_FILE.$i" "$LOG_FILE.$((i + 1))"
      i=$((i - 1))
    done
    mv "$LOG_FILE" "$LOG_FILE.1"
  fi
}

rotate_logs

BOT_CMD="${TERMUX_RUN_CMD:-node index.js}"
export BROWSER_DISABLED="${BROWSER_DISABLED:-1}"

STOP=0
trap 'STOP=1' INT TERM

if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock
  echo "[termux-run] wake-lock aktif (CPU tetap jalan saat layar mati)"
else
  echo "[termux-run] termux-wake-lock tidak ada; install: pkg install termux-api"
fi

log() {
  echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"
}

log "start: $BOT_CMD (BROWSER_DISABLED=$BROWSER_DISABLED)"

fails=0
while [ "$STOP" -eq 0 ]; do
  rotate_logs
  # shellcheck disable=SC2086
  $BOT_CMD 2>&1 | while IFS= read -r line; do
    echo "[$(date '+%F %T')] $line"
  done | tee -a "$LOG_FILE"
  code="${PIPESTATUS[0]:-1}"

  if [ "$STOP" -eq 1 ]; then
    log "dihentikan pengguna."
    break
  fi
  if [ "$code" -eq 0 ]; then
    log "bot keluar normal (kode 0). loop berhenti."
    break
  fi

  fails=$((fails + 1))
  if [ "$fails" -ge 10 ]; then
    log "gagal 10x beruntun (kode $code). menyerah, cek log."
    break
  fi
  log "bot mati (kode $code). restart dalam 5 dtk... (gagal beruntun: $fails/10)"
  sleep 5 &
  wait $! || true
done

if command -v termux-wake-unlock >/dev/null 2>&1; then
  termux-wake-unlock || true
fi
