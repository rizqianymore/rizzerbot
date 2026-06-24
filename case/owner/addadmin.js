import { db } from '@/lib/database.js';
import { settings } from '@/config/settings.js';

export default {
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
        db.updatePrivilegedCache();
        db.save();
        await sock.sendMessage(msg.key.remoteJid, { text: `👑 Berhasil menambahkan @${target.split('@')[0]} sebagai Admin Bot.`, mentions: [target] }, { quoted: msg });
    }
};
