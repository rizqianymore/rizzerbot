import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '@/lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    description: 'Sistem Pemeliharaan Bot: Auto format ulang database, rekonstruksi skema data, dan hapus cache/logs.',
    usage: '',
    example: '',
    name: 'maintenance_run',
    aliases: ['maint', 'mt', 'cleanup'],
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args, context) => {
        const { sendTyping } = context;
        await sendTyping();

        const remoteJid = msg.key.remoteJid;
        let logOutput = '🛠️ *PROSES PEMELIHARAAN SYSTEM DAN CLEANUP*\n\n';

        try {
            // 1. Rekonstruksi & Auto-format Database
            logOutput += '📂 *1. Restrukturisasi & Format Database:*\n';
            const dbDir = path.join(__dirname, '..', 'database');
            if (fs.existsSync(dbDir)) {
                const dbFiles = fs.readdirSync(dbDir).filter(f => f.endsWith('.json'));
                for (const file of dbFiles) {
                    const filePath = path.join(dbDir, file);
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
                        logOutput += `   ✅ \`${file}\` berhasil di-format ulang.\n`;
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
                { dir: path.join(process.cwd(), 'statuses'), ext: /.*\.(jpg|mp4)$/ },
                { dir: path.join(process.cwd(), 'tmp'), ext: /.*/ },
                { dir: path.join(process.cwd(), 'temp'), ext: /.*/ },
                { dir: path.join(process.cwd(), '.cache'), ext: /.*/ },
                { dir: process.cwd(), ext: /.*\.(log|tmp\..*)$/ }
            ];

            for (const target of targets) {
                if (fs.existsSync(target.dir)) {
                    const stat = fs.statSync(target.dir);
                    if (stat.isDirectory()) {
                        const files = fs.readdirSync(target.dir);
                        for (const file of files) {
                            const filePath = path.join(target.dir, file);
                            if (target.ext.test(file)) {
                                try {
                                    const fileStat = fs.statSync(filePath);
                                    if (fileStat.isFile()) {
                                        clearedBytes += fileStat.size;
                                        fs.unlinkSync(filePath);
                                        clearedFilesCount++;
                                    }
                                } catch (_) {}
                            }
                        }
                    } else if (stat.isFile() && target.ext.test(path.basename(target.dir))) {
                        // File target tunggal (misal *.log di root)
                        try {
                            clearedBytes += stat.size;
                            fs.unlinkSync(target.dir);
                            clearedFilesCount++;
                        } catch (_) {}
                    }
                }
            }

            // Cari file bertipe *.log atau *.tmp.* di root workspace secara dinamis
            try {
                const rootFiles = fs.readdirSync(process.cwd());
                for (const file of rootFiles) {
                    if (file.endsWith('.log') || /.*\.tmp\.(mp4|gif|png|jpg)$/.test(file)) {
                        const filePath = path.join(process.cwd(), file);
                        try {
                            const stat = fs.statSync(filePath);
                            if (stat.isFile()) {
                                clearedBytes += stat.size;
                                fs.unlinkSync(filePath);
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
