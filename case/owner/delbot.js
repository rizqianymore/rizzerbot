export default {
    name: 'delbot',
    description: 'Menghentikan dan menghapus bot klon/sekunder.',
    usage: '<nomor>',
    example: '628xxx',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        const targetNumber = args[0]?.replace(/[^0-9]/g, '');
        if (!targetNumber) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan nomor telepon bot sekunder. Contoh: *.delbot 628xxx*' }, { quoted: msg });
            return;
        }
        try {
            const { stopSecondaryBot } = await import('@/index.js');
            await stopSecondaryBot(targetNumber);
            await sock.sendMessage(msg.key.remoteJid, { text: `🗑️ Sesi dan bot sekunder untuk nomor ${targetNumber} berhasil dihentikan dan dihapus.` }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal menghapus bot sekunder: ${err.message}` }, { quoted: msg });
        }
    }
};
