# Gemini Developer Guide — Kyros-MD

Welcome to the development guide for **Kyros-MD**. This file contains crucial context for AI coding agents and human developers on how the codebase operates, how data is managed, and how to safely extend the bot.

---

## Core Guidelines

### 1. Tiered Command Registry
Kyros-MD uses a strict, tiered command registry:
- **Basic User (`lib/commands/user.js`)**: Contains only the core basic commands (`help`, `ping`, `register`, `donate`). Any advanced features or plugins must go to the Premium/Owner tier.
- **Premium Tier (`lib/commands/premium.js`)**: Houses commands that require registration and premium status.
- **Owner Tier (`lib/commands/owner.js`)**: Houses administrative actions that require owner privileges.

### 2. Plugin Architecture (`plugins/`)
- All files in the `plugins/` directory are loaded dynamically by the plugin engine (`lib/plugins.js`).
- **Access Rule**: Because all external plugins are mapped to the **Premium** tier, the dynamic plugins list (`plugins` command) is restricted to premium users.
- To create a new plugin, simply create a `.js` file in `plugins/` export a default object following this schema:
  ```javascript
  export default {
      name: 'myplugin',
      description: 'A brief description.',
      usage: '<arguments>',
      example: 'myplugin test',
      aliases: ['myalias'],
      category: 'Utilities', // Appears in this category under getPluginsMenu()
      premiumOnly: true, // Safeguard premium-only check
      run: async (sock, msg, args, context) => {
          // main execution logic
      }
  };
  ```

### 3. Database State Management (`lib/database.js`)
- The bot uses an asynchronous JSON database stored at `database/`.
- Always read and write through `db.data` and call `db.save()` or appropriate update methods to commit changes.
- Do not bypass `db` helper methods to read/write JSON files directly to avoid race conditions.

### 4. Code Aesthetics & Formatting
- Keep log messages clean and use `pino` logger.
- In menus, all command lists must be cleanly formatted using the format:
  ```
  │ .commandname <arg>
  ```
  No prefix bullets (like `➩`) are allowed before the command prefix to keep the layout extremely clean.
