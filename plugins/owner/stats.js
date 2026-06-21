import { db } from '@/lib/database.js';

export default {
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
};
