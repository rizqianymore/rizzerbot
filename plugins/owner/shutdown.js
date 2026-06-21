export default {
    name: 'shutdown',
    description: 'Mematikan proses server bot.',
    usage: '',
    example: '',
    aliases: ['offbot'],
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        await sock.sendMessage(msg.key.remoteJid, { text: '💤 Menghidupkan mode tidur/Mematikan proses bot...' }, { quoted: msg });
        await new Promise(resolve => setTimeout(resolve, 2000));
        process.exit(0);
    }
};
