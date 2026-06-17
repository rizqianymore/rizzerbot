# Palantir Bots

Palantir Bots is a modular, high-performance WhatsApp bot built using Baileys. The project is designed with a clean, tiered architecture, featuring modularized command files, a dynamic plugin engine, and a structured, split database system.

---

## Tiered Features

### 1. Basic User Tier
Streamlined basic commands for security, performance, and simplicity:
- **`help`** (aliases: `menu`): View the main menu.
- **`ping`**: Test bot response speed and latency.
- **`register`** (aliases: `daftar`): Register your account.
- **`donate`** (aliases: `donasi`, `sawer`): Show donation info.

### 2. Premium Tier
Advanced features and plugins reserved for premium users:
- **Media Generators**: Custom stickers, Brat text overlays, Bratvid animated text, and Quotation Chat (QC) bubbles.
- **Downloaders**: TikTok, Instagram, YouTube (MP3/MP4), Spotify, Twitter/X, and Web screenshots.
- **Dynamic Plugins**: Custom plugins placed in `plugins/` automatically run under the Premium category.

### 3. Owner Tier
Full administrative control over the bot instance:
- Broadcast tools, maintenance mode toggles, user database controls, block/unblock, and bot name configurations.

---

## Project Structure

```
palantir-bots/
├── index.js                  # Main application entry point
├── install.sh                # System dependency auto-installer script
├── package.json              # NPM package manifest
├── assets/                   # Static assets and menu banners
├── config/
│   └── settings.js           # Global configuration settings
├── database/                 # Structured JSON database storage
├── lib/
│   ├── commands/             # Standard command handlers
│   │   ├── user.js           # Basic user commands (3 commands)
│   │   ├── premium.js        # Premium commands & plugins menu
│   │   └── owner.js          # Owner commands
│   ├── database.js           # Database controller with in-memory cache
│   ├── handler.js            # Message router and security validator
│   ├── menu.js               # Menu formatter layouts
│   └── plugins.js            # Plugin loader and watcher
└── plugins/                  # Dynamic custom plugins (Premium)
```

---

## Installation & Setup

An automated installer script is provided to set up Node.js 22 LTS, npm, FFmpeg, ImageMagick, libwebp, and other required system tools.

### 1. Run the Auto-Installer
Execute the installation script in the root directory:
```bash
sudo bash install.sh
```

### 2. Configure Settings
Update the variables in `config/settings.js` to match your preferences (e.g., bot name, owner number, pairing configurations).

### 3. Run the Bot
To start the bot in development mode, run:
```bash
npm start
```

---

## Security Policy
Please refer to `SECURITY.md` for information on how to report vulnerabilities privately.
