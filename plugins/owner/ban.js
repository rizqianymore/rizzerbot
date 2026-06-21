import { db } from '@/lib/database.js';

export default {
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
};
