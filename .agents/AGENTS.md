# Kyros-MD Agent Guidelines

This file defines the project-specific rules, design patterns, and constraints for AI coding agents working on Kyros-MD.

---

## 1. Project Directory Structure
- `/plugins/`: Dynamic command modules loaded at runtime by `lib/plugins.js`.
- `/lib/`: Main utility libraries, helper classes, and custom wrappers.
- `/database/`: JSON state files handled asynchronously by `lib/database.js`.
- `/config/`: Core static configuration files.

---

## 2. Command Tiers & Registry Rules
When implementing or modifying commands, always respect the registry architecture:
1. **Basic Tier (`lib/commands/user.js`)**: Keep commands simple and accessible.
2. **Premium Tier (`lib/commands/premium.js` / `/plugins/`)**: All external plugins must be marked `premiumOnly: true` to prevent unauthorized access.
3. **Owner Tier (`lib/commands/owner.js`)**: Administrative features and global configurations.

---

## 3. Database State Management
- Never use direct filesystem reads or writes (e.g., `fs.writeFileSync`) on database files.
- Always use `db.data` for reading/writing and call `db.save()` or specific helper functions.

---

## 4. UI & Output Aesthetics
- Avoid bullet points or prefix emojis like `➩` inside the command lists in help menus.
- Follow the clean formatting style:
  ```text
  │ .commandname <arg>
  ```
- Use the standard `pino` logger for structured and readable console outputs.

---

## 5. Media & Emoji Processing
- When building media generation tools or drawing text (e.g., sticker makers, brat, collages), ensure custom emojis are parsed correctly using `lib/emojiHelper.js` to draw Twemoji resources.
- Pass custom/extracted emojis as an array to `addStickerMetadata` to bind them to the sticker metadata.
