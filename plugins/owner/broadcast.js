import { db } from '@/lib/database.js';

export default {
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
};
