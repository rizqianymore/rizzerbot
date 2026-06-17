import { db } from '../database.js';

export const secureCommands = [
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
    }
];
