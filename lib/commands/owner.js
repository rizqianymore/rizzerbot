import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMenu, getPluginsMenu, getUserMenu, getPremiumMenu, getOwnerMenu } from '@/lib/menu.js';
import { db } from '@/lib/database.js';
import { settings } from '@/config/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ownerCommands = [
    {
        name: 'add',
        category: 'Admin',
        description: 'Menambahkan anggota baru ke dalam grup.',
        usage: '<nomor>',
        example: '628xxx',
        run: async (sock, msg, args, { isOwner, senderJid, sendUsage }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                let targetNumber = args[0]?.replace(/[^0-9]/g, '');
                if (!targetNumber) {
                    await sendUsage();
                    return;
                }
                const target = targetNumber + '@s.whatsapp.net';

                await sock.groupParticipantsUpdate(remoteJid, [target], 'add');
                await sock.sendMessage(remoteJid, { text: `✅ Berhasil menambahkan @${targetNumber}`, mentions: [target] }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal menambahkan anggota. Pastikan nomor valid atau setelan privasi mereka mengizinkan.' }, { quoted: msg });
            }
        }
    },
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
        name: 'antibot',
        description: 'Mengaktifkan atau menonaktifkan fitur anti-bot spammer.',
        usage: '<on/off>',
        example: 'on',
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }

            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal memeriksa metadata grup.' }, { quoted: msg });
                return;
            }

            const option = args[0]?.toLowerCase();
            if (option === 'on' || option === '1' || option === 'aktif') {
                db.updateGroup(remoteJid, { antibot: true });
                await sock.sendMessage(remoteJid, { text: '✅ *Anti-Bot diaktifkan!* Bot lain yang mengirim pesan akan dikeluarkan otomatis.' }, { quoted: msg });
            } else if (option === 'off' || option === '0' || option === 'nonaktif') {
                db.updateGroup(remoteJid, { antibot: false });
                await sock.sendMessage(remoteJid, { text: '🚫 *Anti-Bot dinonaktifkan!*' }, { quoted: msg });
            } else {
                const groupConfig = db.getGroup(remoteJid);
                await sock.sendMessage(remoteJid, { text: `⚠️ Penggunaan: *.antibot on/off*\nStatus saat ini: *${groupConfig.antibot ? 'AKTIF' : 'NONAKTIF'}*` }, { quoted: msg });
            }
        }
    },
    {
        name: 'antilink',
        description: 'Mengaktifkan atau menonaktifkan fitur anti-link grup.',
        usage: '<on/off>',
        example: 'on',
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }

            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal memeriksa metadata grup.' }, { quoted: msg });
                return;
            }

            const option = args[0]?.toLowerCase();
            if (option === 'on' || option === '1' || option === 'aktif') {
                db.updateGroup(remoteJid, { antilink: true });
                await sock.sendMessage(remoteJid, { text: '✅ *Anti-Link diaktifkan!* Semua pesan berisi tautan/link dari non-admin akan dihapus otomatis.' }, { quoted: msg });
            } else if (option === 'off' || option === '0' || option === 'nonaktif') {
                db.updateGroup(remoteJid, { antilink: false });
                await sock.sendMessage(remoteJid, { text: '🚫 *Anti-Link dinonaktifkan!*' }, { quoted: msg });
            } else {
                const groupConfig = db.getGroup(remoteJid);
                await sock.sendMessage(remoteJid, { text: `⚠️ Penggunaan: *.antilink on/off*\nStatus saat ini: *${groupConfig.antilink ? 'AKTIF' : 'NONAKTIF'}*` }, { quoted: msg });
            }
        }
    },
    {
        name: 'ban',
        description: 'Memblokir akses pengguna dari penggunaan bot.',
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
            db.updateUser(target, { banned: true });
            await sock.sendMessage(msg.key.remoteJid, { text: `🚫 Akses bot untuk @${target.split('@')[0]} telah diblokir`, mentions: [target] }, { quoted: msg });
        }
    },
    {
        name: 'block',
        description: 'Memblokir kontak WhatsApp.',
        usage: '<@tag/reply/nomor>',
        example: '@user',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { getTargetJid }) => {
            const target = getTargetJid(args);
            if (!target) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tag, balas pesan, atau masukkan nomor telepon.' }, { quoted: msg });
                return;
            }
            await sock.updateBlockStatus(target, 'block');
            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Berhasil memblokir @${target.split('@')[0]}`, mentions: [target] }, { quoted: msg });
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
        name: 'delmember',
        aliases: ['kick'],
        category: 'Admin',
        description: 'Perintah ini digunakan untuk mengeluarkan anggota dari grup.',
        usage: '<@tag/nomor/reply>',
        example: '@user atau 628xxx',
        run: async (sock, msg, args, { isOwner, senderJid, getTargetJid, sendUsage }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const target = getTargetJid(args);
                if (!target) {
                    await sendUsage();
                    return;
                }

                await sock.groupParticipantsUpdate(remoteJid, [target], 'remove');
                await sock.sendMessage(remoteJid, { text: `✅ Berhasil mengeluarkan @${target.split('@')[0]}`, mentions: [target] }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal mengeluarkan anggota.' }, { quoted: msg });
            }
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
                // 1. Try finding by number matching (suffix/ends-with)
                if (args && args[0]) {
                    const cleanArgNum = args[0].replace(/[^0-9]/g, '');
                    if (cleanArgNum) {
                        foundKey = Object.keys(db.data.users).find(key => {
                            const keyNum = key.split('@')[0].replace(/[^0-9]/g, '');
                            return keyNum === cleanArgNum || keyNum.endsWith(cleanArgNum) || cleanArgNum.endsWith(keyNum);
                        });
                    }
                }

                // 2. Try finding by name (case-insensitive)
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
        name: 'demote',
        category: 'Admin',
        description: 'Menurunkan jabatan admin grup kembali menjadi anggota biasa.',
        usage: '<@tag/reply>',
        example: '@user',
        run: async (sock, msg, args, { isOwner, senderJid, getTargetJid, sendUsage }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const target = getTargetJid(args);
                if (!target) {
                    await sendUsage();
                    return;
                }

                await sock.groupParticipantsUpdate(remoteJid, [target], 'demote');
                await sock.sendMessage(remoteJid, { text: `💔 Jabatan admin @${target.split('@')[0]} berhasil dicabut.`, mentions: [target] }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal menurunkan jabatan admin.' }, { quoted: msg });
            }
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
        name: 'group',
        description: 'Membuka atau menutup gerbang chat grup.',
        usage: '<open/close>',
        example: 'open',
        aliases: ['grup'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const option = args[0]?.toLowerCase();
                if (option === 'open' || option === 'buka') {
                    await sock.groupSettingUpdate(remoteJid, 'not_announcement');
                    await sock.sendMessage(remoteJid, { text: '🔓 Setelan grup berhasil diubah: *Semua anggota sekarang dapat mengirim pesan!*' }, { quoted: msg });
                } else if (option === 'close' || option === 'tutup') {
                    await sock.groupSettingUpdate(remoteJid, 'announcement');
                    await sock.sendMessage(remoteJid, { text: '🔒 Setelan grup berhasil diubah: *Hanya admin yang dapat mengirim pesan!*' }, { quoted: msg });
                } else {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Penggunaan: *.group open* / *.group close*' }, { quoted: msg });
                }
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal mengubah setelan grup.' }, { quoted: msg });
            }
        }
    },
    {
        name: 'hidetag',
        description: 'Mentag seluruh anggota grup secara senyap.',
        usage: '<teks>',
        example: 'Pengumuman',
        aliases: ['ht'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const targetJids = participants.map(p => p.id);
                const text = args.join(' ') || '';
                await sock.sendMessage(remoteJid, { text, mentions: targetJids });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal mengirim hidetag.' }, { quoted: msg });
            }
        }
    },
    {
        name: 'jagagrup',
        description: 'Mengaktifkan penjaga grup dari demote admin ilegal.',
        usage: '<on/off>',
        example: 'on',
        aliases: ['guard', 'protect'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }

            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal memeriksa metadata grup.' }, { quoted: msg });
                return;
            }

            const option = args[0]?.toLowerCase();
            if (option === 'on' || option === 'aktif' || option === '1') {
                db.updateGroup(remoteJid, { guard: true });
                await sock.sendMessage(remoteJid, { text: '✅ *Penjaga Grup (Group Guard) AKTIF!*\nBot akan otomatis melindungi posisi Admin Owner dari demote tidak sah.' }, { quoted: msg });
            } else if (option === 'off' || option === 'nonaktif' || option === '0') {
                db.updateGroup(remoteJid, { guard: false });
                await sock.sendMessage(remoteJid, { text: '🚫 *Penjaga Grup (Group Guard) NONAKTIF!*' }, { quoted: msg });
            } else {
                const groupConfig = db.getGroup(remoteJid);
                await sock.sendMessage(remoteJid, { text: `⚠️ Penggunaan: *.jagagrup on/off*\nStatus saat ini: *${groupConfig.guard ? 'AKTIF' : 'NONAKTIF'}*` }, { quoted: msg });
            }
        }
    },
    {
        name: 'kickall',
        description: 'Mengeluarkan seluruh anggota grup kecuali bot dan owner.',
        usage: '',
        example: '',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const botJid = sock.user.id.replace(/:.*@/, '@');
                const targets = participants.map(p => p.id).filter(id => id.replace(/:.*@/, '@') !== botJid && !db.isPrivilegedJid(id));

                if (targets.length === 0) {
                    await sock.sendMessage(remoteJid, { text: '❌ Tidak ada anggota yang dapat dikeluarkan (selain Owner/Bot).' }, { quoted: msg });
                    return;
                }

                await sock.sendMessage(remoteJid, { text: `⏳ Mengeluarkan ${targets.length} anggota grup...` }, { quoted: msg });
                for (const t of targets) {
                    await sock.groupParticipantsUpdate(remoteJid, [t], 'remove');
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
                await sock.sendMessage(remoteJid, { text: '✅ Bersih! Semua anggota telah dikeluarkan.' }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: `❌ Gagal: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'linkgc',
        description: 'Mengambil tautan undangan grup WhatsApp.',
        usage: '',
        example: '',
        aliases: ['gclink', 'grouplink'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const code = await sock.groupInviteCode(remoteJid);
                await sock.sendMessage(remoteJid, { text: `🔗 *Link Undangan Grup:*\nhttps://chat.whatsapp.com/${code}` }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: `❌ Gagal mengambil link grup: ${err.message}` }, { quoted: msg });
            }
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
        name: 'maintenance',
        description: 'Mengaktifkan atau menonaktifkan mode pemeliharaan bot.',
        usage: '',
        example: '',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            db.data.settings.maintenance = !db.data.settings.maintenance;
            db.save();
            await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *Pemeliharaan:* ${db.data.settings.maintenance ? 'AKTIF' : 'NONAKTIF'}` }, { quoted: msg });
        }
    },
    {
        name: 'ownermenu',
        description: 'Menampilkan menu perintah khusus owner.',
        usage: '',
        example: '',
        category: 'Owner',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            const bannerPath = path.join(__dirname, '..', '..', settings.linkImage);
            let thumbnailBuffer = null;
            if (fs.existsSync(bannerPath)) { thumbnailBuffer = fs.readFileSync(bannerPath); }
            const menuText = getOwnerMenu();
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
                    externalAdReply: {
                        title: settings.linkTitle,
                        body: settings.linkBody,
                        thumbnail: thumbnailBuffer,
                        sourceUrl: settings.linkUrl,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            };
            await sock.sendMessage(msg.key.remoteJid, msgOptions, { quoted: msg });
        }
    },
    {
        name: 'promote',
        category: 'Admin',
        description: 'Mempromosikan anggota grup menjadi admin.',
        usage: '<@tag/reply>',
        example: '@user',
        run: async (sock, msg, args, { isOwner, senderJid, getTargetJid, sendUsage }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const target = getTargetJid(args);
                if (!target) {
                    await sendUsage();
                    return;
                }

                await sock.groupParticipantsUpdate(remoteJid, [target], 'promote');
                await sock.sendMessage(remoteJid, { text: `👑 @${target.split('@')[0]} sekarang adalah Admin Grup.`, mentions: [target] }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal mempromosikan anggota.' }, { quoted: msg });
            }
        }
    },
    {
        name: 'public',
        description: 'Mengubah bot ke mode umum (merespon semua user).',
        usage: '',
        example: '',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            db.data.settings.selfMode = false;
            db.save();
            await sock.sendMessage(msg.key.remoteJid, { text: `🔓 *Mode Umum:* AKTIF\nSemua pengguna dapat menggunakan bot.` }, { quoted: msg });
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
        name: 'revoke',
        description: 'Mereset atau menarik kembali tautan undangan grup.',
        usage: '',
        example: '',
        aliases: ['resetlink', 'resetgclink'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const code = await sock.groupRevokeInvite(remoteJid);
                await sock.sendMessage(remoteJid, { text: `🔄 Link undangan grup berhasil di-reset.\n\n*Link Baru:*\nhttps://chat.whatsapp.com/${code}` }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: `❌ Gagal me-reset link grup: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'self',
        description: 'Mengubah bot ke mode mandiri (hanya merespon owner).',
        usage: '',
        example: '',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args) => {
            db.data.settings.selfMode = true;
            db.save();
            await sock.sendMessage(msg.key.remoteJid, { text: `👤 *Mode Mandiri:* AKTIF\nBot hanya menerima perintah dari Owner.` }, { quoted: msg });
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
        name: 'setdesc',
        description: 'Mengubah deskripsi grup.',
        usage: '<deskripsi baru>',
        example: 'Aturan grup',
        aliases: ['setgroupdesc'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            const newDesc = args.join(' ');
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                await sock.groupUpdateDescription(remoteJid, newDesc);
                await sock.sendMessage(remoteJid, { text: '✅ Deskripsi grup berhasil diubah!' }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: `❌ Gagal mengubah deskripsi grup: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'setname',
        description: 'Mengubah nama judul grup.',
        usage: '<nama baru>',
        example: 'Grup Keren',
        aliases: ['setgcupname', 'setgroupname'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            const newName = args.join(' ');
            if (!newName) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Harap masukkan nama grup yang baru!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                await sock.groupUpdateSubject(remoteJid, newName);
                await sock.sendMessage(remoteJid, { text: `✅ Nama grup berhasil diubah menjadi: *${newName}*` }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: `❌ Gagal mengubah nama grup: ${err.message}` }, { quoted: msg });
            }
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
        name: 'tagall',
        description: 'Mentag seluruh anggota grup secara terbuka.',
        usage: '<teks>',
        example: 'Ada apa',
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const messageText = args.join(' ') || 'Halo semua!';
                let tagText = `📢 *Tag All*\n\n*Pesan:* ${messageText}\n\n`;
                const targetJids = participants.map(p => p.id);
                targetJids.forEach((jid, idx) => {
                    tagText += `${idx + 1}. @${jid.split('@')[0]}\n`;
                });

                await sock.sendMessage(remoteJid, { text: tagText, mentions: targetJids }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal melakukan tagall.' }, { quoted: msg });
            }
        }
    },
    {
        name: 'unban',
        description: 'Membuka blokir akses pengguna bot.',
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
            db.updateUser(target, { banned: false });
            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Akses bot untuk @${target.split('@')[0]} telah dipulihkan`, mentions: [target] }, { quoted: msg });
        }
    },
    {
        name: 'unblock',
        description: 'Membuka blokir kontak WhatsApp.',
        usage: '<@tag/reply/nomor>',
        example: '@user',
        category: 'Owner',
        ownerOnly: true,
        run: async (sock, msg, args, { getTargetJid }) => {
            const target = getTargetJid(args);
            if (!target) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tag, balas pesan, atau masukkan nomor telepon.' }, { quoted: msg });
                return;
            }
            await sock.updateBlockStatus(target, 'unblock');
            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Berhasil membuka blokir @${target.split('@')[0]}`, mentions: [target] }, { quoted: msg });
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
    }
];
