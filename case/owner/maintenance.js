import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '@/lib/database.js';
import { settings } from '@/config/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(process.cwd());


function isSafePath(targetPath) {
    const resolvedPath = path.resolve(targetPath);
    return resolvedPath.startsWith(projectRoot + path.sep) || resolvedPath === projectRoot;
}

export default {
    premiumOnly: true,
    description: 'Sistem pemeliharaan bot: Mengatur mode pemeliharaan, memformat ulang database, merekonstruksi skema data, menghapus cache/log, serta menghapus bersih database.',
    usage: '[on/off/wipe]',
    example: 'on',
    name: 'maintenance',
    aliases: ['maint', 'mt', 'cleanup', 'wipedatabase', 'wipe'],
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args, context) => {
        const { sendTyping } = context;
        await sendTyping();

        const remoteJid = msg.key.remoteJid;
        const subCommand = args[0]?.toLowerCase();

        
        if (subCommand === 'wipe' || subCommand === 'wipedatabase') {
            db.data.users = {};
            db.data.stats = {
                totalCommands: 0,
                commands: {}
            };
            db.data.groups = {};
            db.data.settings.jpmChannels = [];
            
            
            const botJid = db.normalizeJid(sock.user?.id);
            const ownerJid = db.normalizeJid(settings.ownerNumber);
            const pairingJid = db.normalizeJid(settings.pairingNumber);
            const adminJids = (db.data.settings.admins || []).map(a => db.normalizeJid(a));

            const defaultPrivileged = Array.from(new Set([botJid, ownerJid, pairingJid, ...adminJids])).filter(Boolean);

            for (const jid of defaultPrivileged) {
                db.data.users[jid] = {
                    registered: true,
                    name: (jid === ownerJid || jid === pairingJid) ? settings.ownerName : (jid === botJid ? settings.botName : 'Admin'),
                    banned: false,
                    premium: true,
                    limit: 100,
                    joinedAt: new Date().toISOString()
                };
            }
            db.save();

            await sock.sendMessage(remoteJid, {
                text: '🗑️ *Wipe Database:* BERHASIL\n\nSeluruh data pengguna, statistik, dan grup telah dihapus bersih dari database. Nomor bot, owner, dan admin telah didaftarkan secara otomatis sebagai pengguna Premium.\n\nMemulai ulang bot dalam 3 detik untuk menerapkan perubahan...'
            }, { quoted: msg });

            setTimeout(() => {
                process.exit(0);
            }, 3000);
            return;
        }

        
        let targetState = !db.data.settings.maintenance; 
        if (subCommand === 'on') targetState = true;
        if (subCommand === 'off') targetState = false;

        
        if (!targetState) {
            db.data.settings.maintenance = false;
            db.save();
            await sock.sendMessage(remoteJid, {
                text: '🛠️ *Mode Pemeliharaan:* NONAKTIF\n\nBot telah kembali ke mode normal. Semua pengguna sekarang dapat menggunakannya kembali.'
            }, { quoted: msg });
            return;
        }

        
        db.data.settings.maintenance = true;
        db.save();

        await sock.sendMessage(remoteJid, {
            text: '🛠️ *Mode Pemeliharaan:* AKTIF\n\nSistem pemeliharaan sedang berjalan. Memulai restrukturisasi database dan pembersihan cache/log...'
        }, { quoted: msg });

        let logOutput = '🛠️ *Proses Pemeliharaan Sistem dan Pembersihan*\n\n';
        let success = true;

        try {
            
            logOutput += '📂 *1. Restrukturisasi & Format Database:*\n';
            const dbDir = path.join(projectRoot, 'database');
            if (fs.existsSync(dbDir)) {
                const dbFiles = fs.readdirSync(dbDir).filter(f => f.endsWith('.json'));
                for (const file of dbFiles) {
                    const filePath = path.join(dbDir, file);
                    if (!isSafePath(filePath)) continue;

                    try {
                        const raw = fs.readFileSync(filePath, 'utf8');
                        let parsed = {};
                        try {
                            parsed = JSON.parse(raw);
                        } catch (_) {
                            
                            parsed = file === 'users.json' || file === 'groups.json' ? {} : [];
                        }

                        
                        fs.writeFileSync(filePath, JSON.stringify(parsed, null, 4), 'utf8');
                        logOutput += `   ✅ \`${file}\` berhasil diformat ulang.\n`;
                    } catch (e) {
                        logOutput += `   ❌ Gagal memproses \`${file}\`: ${e.message}\n`;
                        success = false;
                    }
                }
                
                db.load();
                db.ensurePrivilegedUsers();
                logOutput += '   🔄 Database berhasil dimuat ulang ke memori.\n\n';
            } else {
                logOutput += '   ⚠️ Direktori database tidak ditemukan.\n\n';
                success = false;
            }

            
            logOutput += '🧹 *2. Pembersihan Cache & File Sementara:*\n';
            let clearedFilesCount = 0;
            let clearedBytes = 0;

            const targets = [
                path.join(projectRoot, 'statuses'),
                path.join(projectRoot, 'tmp'),
                path.join(projectRoot, 'temp'),
                path.join(projectRoot, '.cache')
            ];

            for (const dirPath of targets) {
                if (fs.existsSync(dirPath)) {
                    const resolved = path.resolve(dirPath);
                    if (!isSafePath(resolved)) continue;

                    const stat = fs.statSync(resolved);
                    if (stat.isDirectory()) {
                        const files = fs.readdirSync(resolved);
                        for (const file of files) {
                            const filePath = path.join(resolved, file);
                            const fileResolved = path.resolve(filePath);
                            if (!isSafePath(fileResolved)) continue;

                            try {
                                const fileStat = fs.statSync(fileResolved);
                                if (fileStat.isFile()) {
                                    clearedBytes += fileStat.size;
                                    fs.unlinkSync(fileResolved);
                                    clearedFilesCount++;
                                } else if (fileStat.isDirectory()) {
                                    fs.rmSync(fileResolved, { recursive: true, force: true });
                                    clearedFilesCount++;
                                }
                            } catch (_) {}
                        }
                    }
                }
            }

            
            try {
                const rootFiles = fs.readdirSync(projectRoot);
                for (const file of rootFiles) {
                    if (file.endsWith('.log') || /.*\.tmp\.(mp4|gif|png|jpg)$/.test(file)) {
                        const filePath = path.join(projectRoot, file);
                        const fileResolved = path.resolve(filePath);
                        if (!isSafePath(fileResolved)) continue;

                        try {
                            const stat = fs.statSync(fileResolved);
                            if (stat.isFile()) {
                                clearedBytes += stat.size;
                                fs.unlinkSync(fileResolved);
                                clearedFilesCount++;
                            }
                        } catch (_) {}
                    }
                }
            } catch (_) {}

            const sizeMb = (clearedBytes / (1024 * 1024)).toFixed(2);
            logOutput += `   ✅ Berhasil menghapus *${clearedFilesCount}* file sampah.\n`;
            logOutput += `   💾 Total penyimpanan dibebaskan: *${sizeMb} MB*.\n\n`;

            logOutput += '✨ *Pemeliharaan Selesai!* Bot sekarang berjalan dengan optimal.\n\n🔄 *Memulai ulang bot* dalam 3 detik untuk menerapkan perubahan secara menyeluruh...';
        } catch (err) {
            logOutput += `\n❌ *Terjadi Kesalahan saat Pemeliharaan:* ${err.message}`;
            success = false;
        }

        
        db.data.settings.maintenance = false;
        db.save();

        await sock.sendMessage(remoteJid, { text: logOutput }, { quoted: msg });

        if (success) {
            setTimeout(() => {
                process.exit(0);
            }, 3000);
        }
    }
};
