import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginsDir = path.join(__dirname, '..', 'plugins');

export const commands = new Map();

// Helper to load or reload a single plugin file
export async function reloadPluginFile(file) {
    if (!file.endsWith('.js')) return;
    const filePath = path.join(pluginsDir, file);

    // If file is deleted, remove its commands
    if (!fs.existsSync(filePath)) {
        for (const [key, cmd] of commands.entries()) {
            if (cmd.filePath === filePath) {
                commands.delete(key);
            }
        }
        console.log(`  ✗ Removed plugin: ${file} (file deleted)`);
        return;
    }

    try {
        const fileUrl = pathToFileURL(filePath).href + '?update=' + Date.now();
        const module = await import(fileUrl);
        const exports = module.default || module;
        const cmds = Array.isArray(exports) ? exports : [exports];

        let loadedAny = false;
        
        // Remove previous commands mapped to this file first
        for (const [key, existingCmd] of commands.entries()) {
            if (existingCmd.filePath === filePath) {
                commands.delete(key);
            }
        }

        for (const cmd of cmds) {
            if (cmd && cmd.name && typeof cmd.run === 'function') {
                cmd.filePath = filePath; // Attach metadata for deletion identification

                commands.set(cmd.name.toLowerCase(), cmd);
                if (Array.isArray(cmd.aliases)) {
                    for (const alias of cmd.aliases) {
                        commands.set(alias.toLowerCase(), cmd);
                    }
                }
                console.log(`  ✓ Plugin loaded/updated: ${cmd.name} (${file})`);
                loadedAny = true;
            }
        }
        
        if (!loadedAny) {
            console.log(`  ! Plugin file ${file} did not export any valid commands.`);
        }
    } catch (err) {
        console.error(`  ✗ Failed to load/reload plugin ${file}: ${err.message}`);
    }
}

import { userCommands } from '@/lib/commands/user.js';
import { premiumCommands } from '@/lib/commands/premium.js';
import { ownerCommands } from '@/lib/commands/owner.js';

export async function loadPlugins() {
    commands.clear();

    // 1. Load default commands from split category files
    const allCoreCmds = [...userCommands, ...premiumCommands, ...ownerCommands];
    for (const cmd of allCoreCmds) {
        if (cmd && cmd.name && typeof cmd.run === 'function') {
            commands.set(cmd.name.toLowerCase(), cmd);
            if (Array.isArray(cmd.aliases)) {
                for (const alias of cmd.aliases) {
                    commands.set(alias.toLowerCase(), cmd);
                }
            }
        }
    }

    // 2. Ensure plugins dir exists
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
    }

    // 3. Load initial plugins
    let files;
    try {
        files = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    } catch (err) {
        console.error('Failed to read plugins directory:', err.message);
        files = [];
    }

    for (const file of files) {
        await reloadPluginFile(file);
    }
    console.log(`Loaded ${commands.size} command entries (names + aliases) in total.`);

    // 4. Start watching plugins folder for hot-reload
    fs.watch(pluginsDir, async (eventType, filename) => {
        if (filename && filename.endsWith('.js')) {
            // Add a small delay to ensure file write is finished on the filesystem
            setTimeout(async () => {
                await reloadPluginFile(filename);
            }, 100);
        }
    });
    console.log(`Watching plugins directory [${pluginsDir}] for automatic hot-reloads.`);
}
