import { db } from '@/lib/database.js';

export default {
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
};
