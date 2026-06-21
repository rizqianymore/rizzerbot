export default {
    description: 'Template contoh pengembang plugin baru.',
    usage: '',
    example: '',
    name: 'template',
    aliases: ['temp'],
    category: 'User',
    ownerOnly: false, 
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

        
        await sendTyping();

        
        const query = args.join(' ');
        
        
        let replyText = `👋 *Halo ${senderName}!*\n\n` +
                        `Ini adalah berkas template plugin baru untuk *Kyros-MD*.\n\n` +
                        `ℹ️ *Detail Informasi Konteks:*\n` +
                        `• Prefix Aktif: \`${activePrefix}\`\n` +
                        `• JID Anda: \`${senderJid}\`\n` +
                        `• Apakah Owner: \`${isOwner ? 'Ya' : 'Tidak'}\`\n` +
                        `• Input Argumen: \`${query || '(Kosong)'}\`\n\n` +
                        `Silakan salin file ini untuk membuat fitur/plugin baru Anda sendiri!`;

        
        await sock.sendMessage(msg.key.remoteJid, { 
            text: replyText,
            mentions: [senderJid]
        }, { quoted: msg });
    }
};
