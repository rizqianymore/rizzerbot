# 🤖 Kyros-MD

**Kyros-MD** is a modular, high-performance WhatsApp bot built using Baileys. Designed with a clean, tiered architecture, it features modularized command categories, a hot-reloading dynamic plugin engine, and a structured split JSON database.

---

## 🌟 Key Features

### 1. Tiered Command Registry

To maintain a secure and clean codebase, commands are strictly categorized into three tiers:

- **Basic User (`lib/commands/user.js`)**: Fundamental commands available to all registered users (`help`, `ping`, `register`, `donate`).
- **Premium Tier (`lib/commands/premium.js`)**: Access-controlled features for premium members (media editors, video downloaders, dynamic plugins list).
- **Owner Tier (`lib/commands/owner.js`)**: Admin controls such as maintenance mode, user status management, broadcasts, and pairing controls.

### 2. Dynamic Plugin Engine (`plugins/`)

Plugins are loaded on-the-fly and hot-reloaded automatically when files are modified. All custom plugins in the `plugins/` directory default to the **Premium** access level.

- **Example Plugin: `trx.js`**: Generates transaction success/receipt proof images via a Cloudflare Worker API screenshot. Supports custom product names, prices, payment methods, and buyer details separated by either pipes (`|`) or commas (`,`).

---

## 📁 Project Structure

```text
kyros-md/
├── index.js                  # Main application entry point
├── install.sh                # System dependency auto-installer script
├── package.json              # NPM package manifest
├── GEMINI.md                 # Developer reference guide
├── assets/                   # Static resources, fonts, and assets
├── config/
│   └── settings.js           # Global configuration settings
├── database/                 # Structured JSON database storage
├── lib/
│   ├── commands/             # Standard core commands
│   │   ├── user.js           # Basic user command list
│   │   ├── premium.js        # Premium commands list
│   │   └── owner.js          # Administrative/Owner commands
│   ├── database.js           # Atomic JSON database manager with cache
│   ├── handler.js            # Message router & security validator
│   ├── menu.js               # Dynamic menu layout formatter
│   └── plugins.js            # Hot-reloading plugin loader
└── plugins/                  # Directory for custom dynamic plugins
```

---

## 🛠️ Installation & Setup

An installer script is provided to set up Node.js 22 LTS, npm, FFmpeg, ImageMagick, libwebp, and other required system utilities.

### 1. Run the Auto-Installer

Execute the installation script in the root directory:

```bash
sudo bash install.sh
```

### 2. Configure Settings

Open `config/settings.js` and update configuration details:

- `botName`: Name of the bot.
- `ownerName`: Name of the bot owner.
- `ownerNumber`: Primary owner WhatsApp number (with country code, e.g. `6281xxx`).

### 3. Run the Bot

To initialize and start the bot:

```bash
npm start
```

---

## 🔌 Writing Plugins

To extend the bot, create a `.js` file in the `plugins/` directory. Use the following ES Module template:

```javascript
export default {
  name: "myplugin",
  description: "A brief description of what it does.",
  usage: "<arguments>",
  example: "myplugin test",
  aliases: ["myalias"],
  category: "Utilities", // Appears in this category under getPluginsMenu()
  premiumOnly: true, // Protect premium features
  run: async (sock, msg, args, context) => {
    const { sendTyping } = context;
    await sendTyping();

    // Main execution logic here
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: "Hello World!" },
      { quoted: msg },
    );
  },
};
```

---

## 💾 Database State Management (`lib/database.js`)

- All user profiles and group settings are cached in memory and saved to files inside the `database/` directory.
- Disk writes are atomically debounced (written every 3 seconds max) to prevent file corruption.
- Use helper methods like `db.getUser(jid)` and `db.updateUser(jid, props)` instead of modifying files directly to avoid race conditions.

---

## 🎨 Code Aesthetics & Formatting Rules

- In menus, all command lists must be formatted with the vertical pipe format:
  ```
  │ .commandname <arg>
  ```
  _No prefix bullets or custom characters are allowed before the command prefix._
- Keep log output clean and structured using the `pino` logger.
