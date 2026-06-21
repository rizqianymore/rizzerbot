import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginsDir = path.join(__dirname, '..', 'plugins');

export const commands = new Map();
const watchers = new Map();


function getFilesRecursive(dir, baseDir = dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of list) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(getFilesRecursive(fullPath, baseDir));
        } else if (file.isFile() && file.name.endsWith('.js')) {
            results.push(path.relative(baseDir, fullPath));
        }
    }
    return results;
}


function getDirectoriesRecursive(dir) {
    let results = [dir];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of list) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(getDirectoriesRecursive(fullPath));
        }
    }
    return results;
}


export async function reloadPluginFile(file) {
    if (!file.endsWith('.js')) return;
    const filePath = path.join(pluginsDir, file);

    
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
        
        
        for (const [key, existingCmd] of commands.entries()) {
            if (existingCmd.filePath === filePath) {
                commands.delete(key);
            }
        }

        for (const cmd of cmds) {
            if (cmd && cmd.name && typeof cmd.run === 'function') {
                cmd.filePath = filePath; 

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


function watchDirectory(dirPath) {
    if (watchers.has(dirPath)) return;
    
    try {
        const watcher = fs.watch(dirPath, async (eventType, filename) => {
            
            updateDirectoryWatchers();

            if (filename && filename.endsWith('.js')) {
                const relativeDir = path.relative(pluginsDir, dirPath);
                const relativeFile = relativeDir ? path.join(relativeDir, filename) : filename;
                
                
                setTimeout(async () => {
                    await reloadPluginFile(relativeFile);
                }, 100);
            }
        });
        watchers.set(dirPath, watcher);
    } catch (err) {
        console.error(`Failed to watch directory ${dirPath}:`, err.message);
    }
}


function updateDirectoryWatchers() {
    try {
        const dirs = getDirectoriesRecursive(pluginsDir);
        for (const dir of dirs) {
            if (!watchers.has(dir)) {
                watchDirectory(dir);
            }
        }
        
        for (const [dir, watcher] of watchers.entries()) {
            if (!fs.existsSync(dir)) {
                watcher.close();
                watchers.delete(dir);
            }
        }
    } catch (err) {
        console.error('Failed to update directory watchers:', err.message);
    }
}

export async function loadPlugins() {
    commands.clear();

    
    for (const watcher of watchers.values()) {
        watcher.close();
    }
    watchers.clear();

    
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
    }

    
    let files = [];
    try {
        files = getFilesRecursive(pluginsDir);
    } catch (err) {
        console.error('Failed to read plugins directory:', err.message);
    }

    for (const file of files) {
        await reloadPluginFile(file);
    }
    console.log(`Loaded ${commands.size} command entries (names + aliases) in total.`);

    
    updateDirectoryWatchers();
    console.log(`Watching plugins directory and subdirectories for automatic hot-reloads.`);
}
