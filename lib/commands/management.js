import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../database.js';
import { settings } from '../../config/settings.js';
import { getOwnerMenu } from '../menu.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const managementCommands = [
    {
        name: 'addadmin',
        description: 'Menambahkan admin bot baru.',
        usage: '<@tag/reply/nomor>',
        example: '@user',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { getTargetJid }) => {
            const normalizedSender = msg.key.participant || msg.key.remoteJid;
            const normalizedOwner = settings.ownerNumber.replace(/:.*@/, '@');
            const isMainOwner = msg.key.fromMe || normalizedSender.replace(/:.*@/, '@').split('@')[0] === normalizedOwner.split('@')[0];
            if (!isMainOwner) {
                await sock.sendMessage(msg.key.remoteJid, { text: '👑 Perintah ini hanya dapat digunakan oleh Owner Utama!' }, { quoted: msg });
                return;
            }

            const target = getTargetJid(args);
            if (!target) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna.' }, { quoted: msg });
                return;
            }

            if (!db.data.settings.admins) {
                db.data.settings.admins = [];
            }
            if (db.data.settings.admins.includes(target)) {
                await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ @${target.split('@')[0]} sudah menjadi Admin Bot.`, mentions: [target] }, { quoted: msg });
                return;
            }

            db.data.settings.admins.push(target);
            db.save();
            await sock.sendMessage(msg.key.remoteJid, { text: `👑 Berhasil menambahkan @${target.split('@')[0]} sebagai Admin Bot.`, mentions: [target] }, { quoted: msg });
        }
    },
    {
        name: 'deladmin',
        description: 'Menghapus admin bot.',
        usage: '<@tag/reply/nomor>',
        example: '@user',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { getTargetJid }) => {
            const normalizedSender = msg.key.participant || msg.key.remoteJid;
            const normalizedOwner = settings.ownerNumber.replace(/:.*@/, '@');
            const isMainOwner = msg.key.fromMe || normalizedSender.replace(/:.*@/, '@').split('@')[0] === normalizedOwner.split('@')[0];
            if (!isMainOwner) {
                await sock.sendMessage(msg.key.remoteJid, { text: '👑 Perintah ini hanya dapat digunakan oleh Owner Utama!' }, { quoted: msg });
                return;
            }

            const target = getTargetJid(args);
            if (!target) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna.' }, { quoted: msg });
                return;
            }

            if (!db.data.settings.admins || !db.data.settings.admins.includes(target)) {
                await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ @${target.split('@')[0]} tidak terdaftar sebagai Admin Bot.`, mentions: [target] }, { quoted: msg });
                return;
            }

            db.data.settings.admins = db.data.settings.admins.filter(a => a !== target);
            db.save();
            await sock.sendMessage(msg.key.remoteJid, { text: `💔 Berhasil menghapus @${target.split('@')[0]} dari daftar Admin Bot.`, mentions: [target] }, { quoted: msg });
        }
    },
    {
        name: 'listadmin',
        description: 'Menampilkan daftar seluruh admin bot saat ini.',
        usage: '',
        example: '',
        aliases: ['admins'],
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            const admins = db.data.settings.admins || [];
            if (admins.length === 0) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'ℹ️ Tidak ada admin bot tambahan yang terdaftar.' }, { quoted: msg });
                return;
            }

            const list = admins.map((jid, idx) => `${idx + 1}. @${jid.split('@')[0]}`).join('\n');
            await sock.sendMessage(msg.key.remoteJid, {
                text: `👥 *DAFTAR ADMIN BOT:*\n\n${list}`,
                mentions: admins
            }, { quoted: msg });
        }
    },
    {
        name: 'addprem',
        description: 'Menambahkan status premium ke pengguna.',
        usage: '<@tag/reply/nomor>',
        example: '@user',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { getTargetJid }) => {
            const target = getTargetJid(args);
            if (!target) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna.' }, { quoted: msg });
                return;
            }
            const targetProfile = db.getUser(target);
            const defaultName = targetProfile.name || target.split('@')[0];
            db.updateUser(target, { premium: true, registered: true, name: defaultName });
            await sock.sendMessage(msg.key.remoteJid, { text: `👑 Berhasil menambahkan @${target.split('@')[0]} ke daftar Premium & otomatis Terdaftar`, mentions: [target] }, { quoted: msg });
        }
    },
    {
        name: 'delprem',
        description: 'Menghapus status premium dari pengguna.',
        usage: '<@tag/reply/nomor>',
        example: '@user',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { getTargetJid }) => {
            const target = getTargetJid(args);
            if (!target) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna.' }, { quoted: msg });
                return;
            }
            db.updateUser(target, { premium: false });
            await sock.sendMessage(msg.key.remoteJid, { text: `💔 Berhasil menghapus akses premium untuk @${target.split('@')[0]}`, mentions: [target] }, { quoted: msg });
        }
    },
    {
        name: 'deluser',
        aliases: ['deleteuser', 'hapususer'],
        description: 'Menghapus pengguna dari database.',
        usage: '<@tag/reply/nomor>',
        example: '@user',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { getTargetJid }) => {
            let target = getTargetJid(args);
            let normalizedJid = target ? db.normalizeJid(target) : null;
            let foundKey = null;

            if (normalizedJid && db.data.users[normalizedJid]) {
                foundKey = normalizedJid;
            } else {
                if (args && args[0]) {
                    const cleanArgNum = args[0].replace(/[^0-9]/g, '');
                    if (cleanArgNum) {
                        foundKey = Object.keys(db.data.users).find(key => {
                            const keyNum = key.split('@')[0].replace(/[^0-9]/g, '');
                            return keyNum === cleanArgNum || keyNum.endsWith(cleanArgNum) || cleanArgNum.endsWith(keyNum);
                        });
                    }
                }

                if (!foundKey && args && args.length > 0) {
                    const searchName = args.join(' ').toLowerCase();
                    foundKey = Object.keys(db.data.users).find(key => {
                        const name = db.data.users[key].name || '';
                        return name.toLowerCase() === searchName || name.toLowerCase().includes(searchName);
                    });
                }
            }

            if (!foundKey) {
                const queryDisplay = args && args[0] ? args.join(' ') : 'pengguna';
                await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Pengguna "${queryDisplay}" tidak ditemukan di database.` }, { quoted: msg });
                return;
            }

            if (db.isPrivilegedJid(foundKey)) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Tidak dapat menghapus Owner Utama atau Admin Bot dari database!' }, { quoted: msg });
                return;
            }

            const deletedName = db.data.users[foundKey].name || foundKey.split('@')[0];
            delete db.data.users[foundKey];
            db.save();
            await sock.sendMessage(msg.key.remoteJid, { text: `🗑️ Berhasil menghapus ${deletedName} (@${foundKey.split('@')[0]}) dari database.`, mentions: [foundKey] }, { quoted: msg });
        }
    },
    {
        name: 'addbot',
        description: 'Menambahkan bot klon/sekunder baru via pairing code.',
        usage: '<nomor>',
        example: '628xxx',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { sendTyping }) => {
            const targetNumber = args[0]?.replace(/[^0-9]/g, '');
            if (!targetNumber) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan nomor telepon bot sekunder. Contoh: *.addbot 628xxx*' }, { quoted: msg });
                return;
            }
            await sendTyping();
            await sock.sendMessage(msg.key.remoteJid, { text: `⏳ Sedang menginisialisasi sesi baru untuk ${targetNumber}...` }, { quoted: msg });
            try {
                const { addSecondaryBot } = await import('../../index.js');
                const code = await addSecondaryBot(targetNumber);
                if (code) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `🔑 *PAIRING CODE BOT BARU (${targetNumber}):*\n\n*Code:* \`${code}\`\n\nMasukkan kode di atas pada WhatsApp di nomor tersebut (Perangkat Tertaut > Tautkan dengan nomor telepon).`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(msg.key.remoteJid, { text: `✅ Sesi untuk nomor ${targetNumber} sudah terhubung sebelumnya dan aktif!` }, { quoted: msg });
                }
            } catch (err) {
                await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal menambahkan bot sekunder: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'delbot',
        description: 'Menghentikan dan menghapus bot klon/sekunder.',
        usage: '<nomor>',
        example: '628xxx',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            const targetNumber = args[0]?.replace(/[^0-9]/g, '');
            if (!targetNumber) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan nomor telepon bot sekunder. Contoh: *.delbot 628xxx*' }, { quoted: msg });
                return;
            }
            try {
                const { stopSecondaryBot } = await import('../../index.js');
                await stopSecondaryBot(targetNumber);
                await sock.sendMessage(msg.key.remoteJid, { text: `🗑️ Sesi dan bot sekunder untuk nomor ${targetNumber} berhasil dihentikan dan dihapus.` }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal menghapus bot sekunder: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'listbot',
        description: 'Menampilkan daftar seluruh bot klon yang aktif.',
        usage: '',
        example: '',
        aliases: ['listbots'],
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            try {
                const { runningBots } = await import('../../index.js');
                if (runningBots.size === 0) {
                    await sock.sendMessage(msg.key.remoteJid, { text: 'ℹ️ Tidak ada bot sekunder yang sedang berjalan.' }, { quoted: msg });
                    return;
                }
                let listText = `🤖 *Daftar bot sekunder aktif (${runningBots.size}):*\n\n`;
                let idx = 1;
                for (const key of runningBots.keys()) {
                    const phoneNumber = key.replace('session_', '');
                    listText += `${idx++}. @${phoneNumber} (Aktif & Terhubung)\n`;
                }
                await sock.sendMessage(msg.key.remoteJid, {
                    text: listText,
                    mentions: Array.from(runningBots.keys()).map(k => k.replace('session_', '') + '@s.whatsapp.net')
                }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal mengambil daftar bot: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'broadcast',
        description: 'Mengirimkan pesan siaran ke semua pengguna terdaftar.',
        usage: '<teks>',
        example: 'Info terbaru',
        aliases: ['bc'],
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { sendTyping }) => {
            const text = args.join(' ');
            if (!text) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan teks.' }, { quoted: msg });
                return;
            }
            await sendTyping();
            const users = Object.keys(db.data.users);
            let success = 0;
            for (const user of users) {
                try {
                    await sock.sendMessage(user, { text: `📢 *Broadcast*\n\n${text}` });
                    success++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (_) { }
            }
            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Berhasil dikirim ke ${success}/${users.length} pengguna.` }, { quoted: msg });
        }
    },
    {
        name: 'getdb',
        description: 'Mengirimkan file database.json saat ini.',
        usage: '',
        example: '',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            const dbFilePath = path.join(__dirname, '..', '..', 'database', 'users.json');

            if (fs.existsSync(dbFilePath)) {
                const buffer = fs.readFileSync(dbFilePath);
                await sock.sendMessage(msg.key.remoteJid, {
                    document: buffer,
                    mimetype: 'application/json',
                    fileName: 'users.json',
                    caption: '📊 users.json saat ini.'
                }, { quoted: msg });
            } else {
                await sock.sendMessage(msg.key.remoteJid, { text: '❌ File database tidak ditemukan.' }, { quoted: msg });
            }
        }
    },
    {
        name: 'resetdb',
        description: 'Mereset data seluruh statistik dan pengguna.',
        usage: '',
        example: '',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            db.data.users = {};
            db.data.stats = { totalCommands: 0, commands: {} };
            db.ensurePrivilegedUsers();
            db.save();
            await sock.sendMessage(msg.key.remoteJid, { text: '✅ Database statistik dan pengguna telah di-reset.' }, { quoted: msg });
        }
    },
    {
        name: 'setbotname',
        description: 'Mengubah konfigurasi nama bot.',
        usage: '<nama baru>',
        example: 'Palantir Bots V2',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            const name = args.join(' ');
            if (!name) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan nama bot baru.' }, { quoted: msg });
                return;
            }
            settings.botName = name;
            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Nama bot diubah menjadi: *${name}*` }, { quoted: msg });
        }
    },
    {
        name: 'setownername',
        description: 'Mengubah nama owner bot.',
        usage: '<nama baru>',
        example: 'Pentagon Owner',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            const name = args.join(' ');
            if (!name) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan nama owner baru.' }, { quoted: msg });
                return;
            }
            settings.ownerName = name;
            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Nama owner diubah menjadi: *${name}*` }, { quoted: msg });
        }
    },
    {
        name: 'setprefix',
        description: 'Mengubah prefix/karakter pemicu perintah bot.',
        usage: '<prefix baru>',
        example: '#',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            const newPrefix = args[0];
            if (!newPrefix || newPrefix.length > 3) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan karakter prefix (1-3 karakter).' }, { quoted: msg });
                return;
            }
            db.data.settings.prefix = newPrefix;
            db.save();
            await sock.sendMessage(msg.key.remoteJid, { text: `🎯 Prefix perintah bot berhasil diubah ke: "${newPrefix}"` }, { quoted: msg });
        }
    },
    {
        name: 'shutdown',
        description: 'Mematikan proses server bot.',
        usage: '',
        example: '',
        aliases: ['offbot'],
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            await sock.sendMessage(msg.key.remoteJid, { text: '💤 Menghidupkan mode tidur/Mematikan proses bot...' }, { quoted: msg });
            await new Promise(resolve => setTimeout(resolve, 2000));
            process.exit(0);
        }
    },
    {
        name: 'stats',
        description: 'Menampilkan statistik penggunaan perintah bot.',
        usage: '',
        example: '',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { activePrefix }) => {
            const total = db.data.stats.totalCommands;
            const userCount = Object.keys(db.data.users).length;
            const entries = Object.entries(db.data.stats.commands);
            let topCommands = entries.length > 0
                ? entries
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([cmd, count], idx) => `${idx + 1}. *${activePrefix}${cmd}* : ${count}`)
                    .join('\n')
                : 'Belum ada data.';
            await sock.sendMessage(msg.key.remoteJid, {
                text: `📊 *Statistik Bot*\nTotal Penggunaan Perintah: ${total}\nPengguna Terdaftar: ${userCount}\n\n🔥 *Top 5 Perintah*:\n${topCommands}`
            }, { quoted: msg });
        }
    },
    {
        name: 'listuser',
        description: 'Menampilkan daftar seluruh pengguna terdaftar di database.',
        usage: '',
        example: '',
        aliases: ['listusers', 'daftaruser'],
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();

            const users = Object.entries(db.data.users);
            if (users.length === 0) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'ℹ️ Belum ada pengguna terdaftar di database.' }, { quoted: msg });
                return;
            }

            const totalUsers = users.length;
            const registeredUsers = users.filter(([_, u]) => u.registered).length;
            const premiumUsers = users.filter(([_, u]) => u.premium).length;
            const bannedUsers = users.filter(([_, u]) => u.banned).length;

            let listText = `📊 *Statistik Pengguna PalantirBots*\n\n` +
                `• *Total Pengguna:* ${totalUsers}\n` +
                `• *Terdaftar:* ${registeredUsers}\n` +
                `• *Premium:* ${premiumUsers}\n` +
                `• *Diblokir (Banned):* ${bannedUsers}\n\n` +
                `📝 *Daftar Pengguna Terdaftar:*\n\n`;

            users.forEach(([jid, u], index) => {
                const num = jid.split('@')[0];
                const name = u.name || 'Tanpa Nama';
                const premStatus = u.premium ? ' [👑]' : '';
                const banStatus = u.banned ? ' [🚫]' : '';
                listText += `${index + 1}. *${name}* (@${num})${premStatus}${banStatus}\n`;
            });

            const mentions = users.map(([jid]) => jid);

            await sock.sendMessage(msg.key.remoteJid, {
                text: listText.trim(),
                mentions: mentions
            }, { quoted: msg });
        }
    },
    {
        name: 'tutupdaftar',
        description: 'Menutup pendaftaran pengguna baru.',
        usage: '',
        example: '',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            db.data.settings.registrationOpen = false;
            db.save();
            await sock.sendMessage(msg.key.remoteJid, { text: '📴 Pendaftaran pengguna baru berhasil *DITUTUP*.' }, { quoted: msg });
        }
    },
    {
        name: 'bukadaftar',
        description: 'Membuka pendaftaran pengguna baru.',
        usage: '',
        example: '',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            db.data.settings.registrationOpen = true;
            db.save();
            await sock.sendMessage(msg.key.remoteJid, { text: '📲 Pendaftaran pengguna baru berhasil *DIBUKA*.' }, { quoted: msg });
        }
    },
    {
        name: 'getbio',
        category: 'Admin',
        description: 'Mendapatkan bio/status profil pengguna.',
        usage: '<@tag/reply>',
        example: '@user',
        run: async (sock, msg, args, { getTargetJid, sendUsage }) => {
            const target = getTargetJid(args);
            if (!target) {
                await sendUsage();
                return;
            }
            try {
                const status = await sock.fetchStatus(target);
                await sock.sendMessage(msg.key.remoteJid, {
                    text: `👤 *Status Profil @${target.split('@')[0]}*\n\n*Bio:* ${status?.status || 'Tidak ada bio'}\n*Terakhir Diperbarui:* ${status?.setAt ? new Date(status.setAt).toLocaleString('id-ID') : 'Tidak diketahui'}`,
                    mentions: [target]
                }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal mengambil bio pengguna: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'ownermenu',
        description: 'Menampilkan menu perintah khusus owner.',
        usage: '',
        example: '',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            const activePrefix = db.data.settings.prefix || settings.prefix;
            const uptimeSeconds = Math.floor(process.uptime());
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const seconds = uptimeSeconds % 60;
            let uptimeString = '';
            if (hours > 0) uptimeString += `${hours}j `;
            if (minutes > 0 || hours > 0) uptimeString += `${minutes}m `;
            uptimeString += `${seconds}s`;

            const userCount = Object.keys(db.data.users).filter(k => db.data.users[k].registered).length;
            const totalHits = db.data.stats.totalCommands || 0;

            const statsBody = `Owner: ${settings.ownerName} | Prefix: [ ${activePrefix} ] | Uptime: ${uptimeString} | User: ${userCount} | Hits: ${totalHits}`;

            const menuText = getOwnerMenu();
            const adReplyOptions = {
                title: settings.linkTitle,
                body: statsBody,
                sourceUrl: settings.linkUrl,
                mediaType: 1,
                renderLargerThumbnail: true
            };

            if (settings.linkImage && (settings.linkImage.startsWith('http://') || settings.linkImage.startsWith('https://'))) {
                adReplyOptions.thumbnailUrl = settings.linkImage;
            } else if (settings.linkImage) {
                const bannerPath = path.join(__dirname, '..', '..', settings.linkImage);
                if (fs.existsSync(bannerPath)) {
                    adReplyOptions.thumbnail = fs.readFileSync(bannerPath);
                }
            }

            const msgOptions = {
                text: menuText,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: settings.newsletterJid,
                        newsletterName: settings.newsletterName,
                        serverMessageId: -1
                    },
                    externalAdReply: adReplyOptions
                }
            };
            await sock.sendMessage(msg.key.remoteJid, msgOptions, { quoted: msg });
        }
    }
];
