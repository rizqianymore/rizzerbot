import { db } from '@/lib/database.js';

export default {
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
};
