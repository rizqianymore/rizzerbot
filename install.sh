#!/bin/bash

# Kyros-MD Auto Installer Script
# Using NVM (Node Version Manager) for Node.js 22 LTS

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0;0m' # No Color

# Check if script is run as root (NVM should not be installed as root)
if [ "$EUID" -eq 0 ]; then
  echo -e "${RED}[-]${NC} Harap jalankan script ini sebagai user biasa (bukan root/sudo)."
  echo -e "    Script akan meminta password sudo otomatis saat menginstal dependensi sistem."
  exit 1
fi

echo -e "${YELLOW}[*]${NC} Memperbarui daftar paket sistem..."
sudo apt-get update -y

echo -e "${YELLOW}[*]${NC} Menginstal dependensi dasar (curl, wget, git, build-essential, ffmpeg, imagemagick, libwebp, python, pip)..."
sudo apt-get install -y curl wget git build-essential ffmpeg imagemagick libwebp-dev python3 python3-pip

echo -e "${YELLOW}[*]${NC} Mengunduh dan menginstal NVM (Node Version Manager)..."
# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash

# in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"

echo -e "${YELLOW}[*]${NC} Menginstal Node.js..."
# Download and install Node.js:
nvm install 22

echo -e "${GREEN}[+]${NC} Verifikasi Versi:"
# Verify the Node.js version:
node -v # Should print "v22.22.3".

# Verify npm version:
npm -v # Should print "10.9.8".

ffmpeg -version | head -n 1 | xargs echo -e " • FFmpeg:"
convert -version | head -n 1 | xargs echo -e " • ImageMagick:"
python3 --version | xargs echo -e " • Python:"
pip3 --version | head -n 1 | xargs echo -e " • Pip:"

echo -e "${YELLOW}[*]${NC} Menginstal modul dependensi npm proyek..."
npm install
npm install -g pm2

echo -e "${GREEN}[+]${NC} Kyros-MD siap dijalankan!"
echo -e " 1. Konfigurasikan bot Anda di: config/settings.js"
echo -e " 2. Jalankan bot menggunakan perintah: npm start atau node index.js"
echo -e " 3. Jalankan bot di latar belakang menggunakan PM2: pm2 start index.js --name \"kyros-md\""
