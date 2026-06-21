import { db } from '@/lib/database.js';

export default {
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

        let listText = `📊 *Statistik Pengguna Kyros-MD*\n\n` +
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
};
