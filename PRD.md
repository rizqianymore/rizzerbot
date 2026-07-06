# Product Requirements Document (PRD) — Kyros-MD WhatsApp Bot

## 1. Overview & Vision

**Kyros-MD** is a professional, modular, and high-performance WhatsApp bot built using the Baileys library. The system is designed to provide utility, media creation, downloader, and OSINT (Open Source Intelligence) tools to WhatsApp users with a clear tiered monetization/authorization structure (Basic, Premium, and Owner).

---

## 2. Core Architecture

Kyros-MD is structured to follow a strict modular system:

- **Core Engine (`index.js`)**: Initializes the connection to WhatsApp, handles credentials/auth state, and bootstraps the databases.
- **Handler System (`lib/handler.js`)**: Processes incoming messages, manages user permissions, updates user db status, parses command triggers, and handles error boundaries.
- **Tiered Command Registry**:
  - **Basic User (`lib/commands/user.js`)**: Free and core commands (`help`, `ping`, `register`, `donate`).
  - **Premium Tier (`lib/commands/premium.js`)**: Advanced features requiring registered premium status.
  - **Owner Tier (`lib/commands/owner.js`)**: Full administration tools and bot settings modification.
- **Plugin Architecture (`plugins/`)**: Dynamically loaded plugins (`lib/plugins.js`) for rapid module expansion. All external plugins map to the **Premium** tier.

---

## 3. Key Feature Modules

### 3.1 Media & Customization (plugins/media/)

- **Sticker Maker (`sticker.js`)**: Converts images, videos, GIFs, and document media to WhatsApp webp stickers.
  - **Emoji Metadata**: Dynamically parses input emojis from commands (e.g. `.s 💖`) and assigns them to the sticker EXIF block categories to enable native emoji-sticker association.
  - **Meme overlay**: Overlays meme text dynamically over image stickers while skipping text drawing if the input consists solely of metadata emojis.
- **Brat & Bratvid (`brat.js`, `bratvid.js`)**: Generates text-based stickers in the popular "Brat" style (static and animated video variants) utilizing custom font sizing and twemoji mapping via `lib/emojiHelper.js`.
- **Collage Maker (`collage.js`)**: Glassmorphism-style collage grids from up to 9 added images (`.addkolase` -> `.kolase`).

### 3.2 Downloaders (plugins/downloader/)

- **TikTok Downloader (`tiktok.js`)**: Downloads video, audio, and slideshows from TikTok links.
- **Status Downloader (`statusdownloader.js`, `exportstatus.js`)**: Downloads and saves media from WhatsApp status/stories.

### 3.3 OSINT Tools (plugins/osint/)

- **Lookups**: `whois.js` (domain query), `iplookup.js` (IP info), `github.js` (profile metrics).
- **Indonesian Data Scrapers**: `niklookup.js` (KTP/NIK verification), `ceknpsn.js`/`cekpkl.js` (educational records), `numberlookup.js` (HLR/Operator validation), and `jkt84.js` (school directory searches).

---

## 4. State & Database Management (`lib/database.js`)

- **JSON File Database**: Stored in the `database/` directory.
- **State Handling Rules**:
  - All operations must interact directly with `db.data` to prevent filesystem locks and race conditions.
  - Changes must be saved using the asynchronous `db.save()` method.
  - Direct file reads/writes on raw database files are strictly prohibited.

---

## 5. UI/UX & Formatting Guidelines

- **Typography & Font**: Text generation (like Brat stickers) must resolve fallback typography and handle twemoji characters safely via `lib/emojiHelper.js`.
- **Menu Layouts**: Command menu outputs must follow a strictly clean format without bullet points prefixing commands:
  ```text
  │ .commandname <arg>
  ```
- **Logger**: Pino logger (`pino`) is used to maintain uniform, structured JSON logs.
