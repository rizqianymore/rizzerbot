export default {
    description: 'Template contoh pengembang plugin baru.',
    usage: '',
    example: '',
    name: 'template',
    aliases: ['temp'],
    category: 'User',
    ownerOnly: false, // Set true jika perintah hanya boleh dijalankan oleh owner/admin bot
    run: async (sock, msg, args, context) => {
        const { 
            sendTyping, 
            senderName, 
            senderJid, 
            isOwner, 
            userProfile, 
            activePrefix, 
            getTargetJid 
        } = context;

        // 1. Kirim status sedang mengetik
        await sendTyping();

        // 2. Argument parsing
        const query = args.join(' ');
        
        // 3. Logika utama perintah
        let replyText = `👋 *Halo ${senderName}!*\n\n` +
                        `Ini adalah berkas template plugin baru untuk *Palantir Bots*.\n\n` +
                        `ℹ️ *Detail Informasi Konteks:*\n` +
                        `• Prefix Aktif: \`${activePrefix}\`\n` +
                        `• JID Anda: \`${senderJid}\`\n` +
                        `• Apakah Owner: \`${isOwner ? 'Ya' : 'Tidak'}\`\n` +
                        `• Input Argumen: \`${query || '(Kosong)'}\`\n\n` +
                        `Silakan salin file ini untuk membuat fitur/plugin baru Anda sendiri!`;

        // 4. Kirim balasan ke pengguna
        await sock.sendMessage(msg.key.remoteJid, { 
            text: replyText,
            mentions: [senderJid]
        }, { quoted: msg });
    }
};
