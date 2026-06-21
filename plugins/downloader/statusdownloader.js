export default {
    premiumOnly: true,
    description: 'Mengunduh media status WhatsApp milik kontak Anda.',
    usage: '<balas status>',
    example: '',
    name: 'sw',
    aliases: ['downloadsw', 'download', 'save'],
    category: 'Utilities',
    run: async (sock, msg, args, { sendTyping }) => {
        const { extractMessageContent, downloadMediaMessage } = await import('baileys');

        const getMediaNode = (m) => {
            if (!m) return null;
            const content = extractMessageContent(m);
            if (!content) return null;
            const keys = Object.keys(content);
            const hasMedia = keys.includes('imageMessage') || 
                             keys.includes('videoMessage') || 
                             keys.includes('audioMessage') ||
                             keys.includes('documentMessage');
            if (hasMedia) return content;
            if (keys.includes('viewOnceMessage')) return getMediaNode(content.viewOnceMessage.message);
            if (keys.includes('viewOnceMessageV2')) return getMediaNode(content.viewOnceMessageV2.message);
            return null;
        };

        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedMedia = getMediaNode(quotedMsg);

        if (!quotedMedia) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Balas pesan status (gambar/video/audio) yang ingin didownload dengan perintah ini.' }, { quoted: msg });
            return;
        }

        await sendTyping();
        try {
            const quotedInfo = msg.message.extendedTextMessage.contextInfo;
            const mediaMessage = {
                key: {
                    remoteJid: msg.key.remoteJid, // Usually status is in broadcast, but we use the remoteJid of the current chat for sending back
                    id: quotedInfo.stanzaId,
                    participant: quotedInfo.participant, // The original sender of the status
                    fromMe: false
                },
                message: quotedMedia
            };

            const buffer = await downloadMediaMessage(mediaMessage, 'buffer', {}, {
                logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, child: () => ({ info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {} }) },
                reuploadRequest: sock.updateMediaMessage
            });

            let messageContent = {};
            if (quotedMedia.imageMessage) {
                messageContent = { document: buffer, mimetype: 'image/jpeg', fileName: `Status_HD_${Date.now()}.jpg`, caption: '✅ Berhasil didownload (Resolusi Asli/HD)!\n⚡ _Via Kyros-MD API_' };
            } else if (quotedMedia.videoMessage) {
                messageContent = { document: buffer, mimetype: 'video/mp4', fileName: `Status_Video_HD_${Date.now()}.mp4`, caption: '✅ Berhasil didownload (Resolusi Asli/HD)!\n⚡ _Via Kyros-MD API_' };
            } else if (quotedMedia.audioMessage) {
                messageContent = { document: buffer, mimetype: 'audio/mp4', fileName: `Status_Audio_${Date.now()}.m4a`, caption: '✅ Audio berhasil didownload\n⚡ _Via Kyros-MD API_' };
            } else if (quotedMedia.documentMessage) {
                messageContent = { document: buffer, mimetype: quotedMedia.documentMessage.mimetype, fileName: quotedMedia.documentMessage.title || 'document', caption: '✅ Berhasil didownload\n⚡ _Via Kyros-MD API_' };
            }

            await sock.sendMessage(msg.key.remoteJid, messageContent, { quoted: msg });
        } catch (err) {
            console.error('Status Downloader Error:', err);
            await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal mendownload status. Pastikan media belum kedaluwarsa atau sudah diunduh di HP.' }, { quoted: msg });
        }
    }
};
