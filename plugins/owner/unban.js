import { db } from '@/lib/database.js';

export default {
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
};
