import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '@/lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(process.cwd());

/**
 * Validasi apakah path berada di dalam direktori kerja project untuk mencegah Path Traversal.
 */
function isSafePath(targetPath) {
    const resolvedPath = path.resolve(targetPath);
    return resolvedPath.startsWith(projectRoot + path.sep) || resolvedPath === projectRoot;
}

export default {
    description: 'Sistem pemeliharaan bot: Mengatur mode pemeliharaan, memformat ulang database, merekonstruksi skema data, serta menghapus cache dan log.',
    usage: '[toggle/cleanup]',
    example: 'cleanup',
    name: 'maintenance',
    aliases: ['maint', 'mt', 'cleanup'],
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args, context) => {
        const { sendTyping } = context;
        await sendTyping();

        const remoteJid = msg.key.remoteJid;
        const subCommand = args[0]?.toLowerCase();

        // Jika tidak ada argumen atau argumennya adalah toggle mode pemeliharaan
        if (!subCommand || subCommand === 'toggle' || subCommand === 'on' || subCommand === 'off') {
            let nextState = !db.data.settings.maintenance;
            if (subCommand === 'on') nextState = true;
            if (subCommand === 'off') nextState = false;

            db.data.settings.maintenance = nextState;
            db.save();

            const statusText = nextState ? 'AKTIF' : 'NONAKTIF';
            await sock.sendMessage(remoteJid, {
                text: `🛠️ *Mode Pemeliharaan:* ${statusText}\n\n` +
                      `Status bot berhasil diubah. ${nextState ? 'Sekarang bot hanya merespons Owner Utama dan Admin.' : 'Semua pengguna sekarang dapat menggunakan bot kembali.'}`
            }, { quoted: msg });
            return;
        }

        if (subCommand !== 'cleanup' && subCommand !== 'bersih') {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ *Format Perintah Salah!*\n\n` +
                      `Gunakan:\n` +
                      `• *.maintenance* (Untuk menyalakan/mematikan pemeliharaan)\n` +
                      `• *.maintenance cleanup* (Untuk membersihkan database & file sampah)`
            }, { quoted: msg });
            return;
        }

        let logOutput = '🛠️ *PROSES PEMELIHARAAN SISTEM DAN PEMBERSIHAN*\n\n';

        try {
            // 1. Rekonstruksi & Auto-format Database
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
                            // File rusak atau kosong, set default berdasarkan nama file
                            parsed = file === 'users.json' || file === 'groups.json' ? {} : [];
                        }

                        // Terapkan format rapi (auto-format)
                        fs.writeFileSync(filePath, JSON.stringify(parsed, null, 4), 'utf8');
                        logOutput += `   ✅ \`${file}\` berhasil diformat ulang.\n`;
                    } catch (e) {
                        logOutput += `   ❌ Gagal memproses \`${file}\`: ${e.message}\n`;
                    }
                }
                // Reload database ke memori bot
                db.load();
                db.ensurePrivilegedUsers();
                logOutput += '   🔄 Database berhasil dimuat ulang ke memori.\n\n';
            } else {
                logOutput += '   ⚠️ Direktori database tidak ditemukan.\n\n';
            }

            // 2. Penghapusan Cache & File Sementara
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

            // Cari file bertipe *.log atau *.tmp.* di root secara dinamis
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

            logOutput += '✨ *Pemeliharaan Selesai!* Bot sekarang berjalan dengan optimal.';
        } catch (err) {
            logOutput += `\n❌ *Terjadi Kesalahan saat Pemeliharaan:* ${err.message}`;
        }

        await sock.sendMessage(remoteJid, { text: logOutput }, { quoted: msg });
    }
};
