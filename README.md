# RizzerBot

RizzerBot is a modular, high-performance WhatsApp bot built using Baileys. The project is designed with a clean architecture, featuring modularized command files and a structured, split database system.

---

## Features

- **Pairing Code Connection**: Connect to WhatsApp securely using a pairing code without requiring a QR code scan.
- **Split Database Architecture**: Modular database storage under the `database/` directory for organized data separation.
- **Clean Command Registry**: Core commands are organized into distinct category modules (`user.js`, `premium.js`, and `owner.js`) under `lib/commands/`.
- **Hot-Reload Plugin Engine**: Add new functionalities dynamically by placing scripts in the `plugins/` directory without restarting the bot process.
- **Media & Sticker Processor**: Utilizes ImageMagick and FFmpeg for real-time media generation, including custom stickers, Bratvid, QC, and collage layouts.
- **Security Protections**: Built-in GitHub Action workflows for dependency audits (Supply Chain Protection) and CodeQL analysis.

---

## Project Structure

```
rizzerbot/
├── index.js                  # Main application entry point
├── install.sh                # System dependency auto-installer script
├── package.json              # NPM package manifest
├── assets/                   # Static assets and menu banners
├── config/
│   └── settings.js           # Global configuration settings
├── database/                 # Structured JSON database storage
├── lib/
│   ├── commands/             # Standard command handlers
│   │   ├── user.js
│   │   ├── premium.js
│   │   └── owner.js
│   ├── database.js           # Database controller with in-memory cache
│   ├── handler.js            # Message router and security validator
│   ├── menu.js               # Menu formatter layouts
│   └── plugins.js            # Plugin loader and watcher
└── plugins/                  # Dynamic custom plugins
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
