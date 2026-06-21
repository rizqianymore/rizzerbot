export default {
    name: 'getbio',
    category: 'Admin',
    description: 'Mendapatkan bio/status profil pengguna.',
    usage: '<@tag/reply>',
    example: '@user',
    run: async (sock, msg, args, { getTargetJid, sendUsage }) => {
        const target = getTargetJid(args);
        if (!target) {
            await sendUsage();
            return;
        }
        try {
            const status = await sock.fetchStatus(target);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `👤 *Status Profil @${target.split('@')[0]}*\n\n*Bio:* ${status?.status || 'Tidak ada bio'}\n*Terakhir Diperbarui:* ${status?.setAt ? new Date(status.setAt).toLocaleString('id-ID') : 'Tidak diketahui'}`,
                mentions: [target]
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal mengambil bio pengguna: ${err.message}` }, { quoted: msg });
        }
    }
};
