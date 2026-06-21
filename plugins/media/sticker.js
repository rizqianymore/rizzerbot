import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { settings } from '@/config/settings.js';
import { createCanvas, loadImage, registerFont } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    const fontPath = path.join(__dirname, '..', '..', 'assets', 'Anton-Regular.ttf');
    if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: 'Anton' });
    }
} catch (err) {
    console.error('Failed to register Anton font:', err);
}

export default {
    name: 'sticker',
    description: 'Mengubah media (gambar/video/GIF) menjadi stiker WhatsApp.',
    usage: '<balas media>',
    example: '',
    aliases: ['s', 'stiker'],
    category: 'Media',
    run: async (sock, msg, args, { sendTyping }) => {
        const { extractMessageContent } = await import('baileys');
        
        const getMediaNode = (m) => {
            if (!m) return null;
            const content = extractMessageContent(m);
            if (!content) return null;
            const keys = Object.keys(content);
            const hasMedia = keys.includes('imageMessage') || 
                             keys.includes('videoMessage') || 
                             keys.includes('stickerMessage') ||
                             (keys.includes('documentMessage') && (content.documentMessage.mimetype?.startsWith('image/') || content.documentMessage.mimetype?.startsWith('video/')));
            
            if (hasMedia) return content;
            
            
            if (keys.includes('viewOnceMessage')) return getMediaNode(content.viewOnceMessage.message);
            if (keys.includes('viewOnceMessageV2')) return getMediaNode(content.viewOnceMessageV2.message);
            
            return null;
        };

        const directMedia = getMediaNode(msg.message);
        const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedMedia = getMediaNode(quotedMsg);

        if (!directMedia && !quotedMedia) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Silakan kirim atau balas gambar/video/stiker/dokumen media dengan perintah *.sticker*' }, { quoted: msg });
            return;
        }

        await sendTyping();
        try {
            const { downloadMediaMessage } = await import('baileys');

            let mediaMessage;
            if (directMedia) {
                mediaMessage = msg;
            } else {
                const quotedInfo = msg.message.extendedTextMessage?.contextInfo;
                mediaMessage = {
                    key: {
                        remoteJid: msg.key.remoteJid,
                        id: quotedInfo?.stanzaId,
                        participant: quotedInfo?.participant,
                        fromMe: false
                    },
                    message: quotedMedia
                };
            }

            let buffer = await downloadMediaMessage(mediaMessage, 'buffer', {}, {
                logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, child: () => ({ info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {} }) },
                reuploadRequest: sock.updateMediaMessage
            });

            
            const text = args.join(' ');
            const mediaNode = directMedia || quotedMedia;
            const isImage = mediaNode.imageMessage || 
                            mediaNode.stickerMessage || 
                            (mediaNode.documentMessage && mediaNode.documentMessage.mimetype?.startsWith('image/'));

            
            try {
                const isWebP = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
                if (isWebP) {
                    const sharp = (await import('sharp')).default;
                    buffer = await sharp(buffer).png().toBuffer();
                }
            } catch (webpErr) {
                console.error('Failed to pre-convert WebP to PNG:', webpErr);
            }

            if (isImage && text.trim()) {
                try {
                    const img = await loadImage(buffer);
                    const canvas = createCanvas(img.width, img.height);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, img.width, img.height);

                    let topText = '';
                    let bottomText = '';
                    if (text.includes('|')) {
                        const parts = text.split('|');
                        topText = parts[0].trim();
                        bottomText = parts[1].trim();
                    } else if (text.includes(',')) {
                        const parts = text.split(',');
                        topText = parts[0].trim();
                        bottomText = parts[1].trim();
                    } else {
                        topText = text.trim();
                    }

                    const drawMemeText = (txt, isTop) => {
                        if (!txt) return;
                        txt = txt.toUpperCase();

                        const padding = img.width * 0.04;
                        const maxWidth = img.width - (padding * 2);
                        const maxHeight = img.height * 0.25; 
                        
                        let fontSize = Math.floor(img.width * 0.075); 
                        let lines = [];
                        let lineHeight = 0;
                        
                        
                        while (fontSize > 12) {
                            ctx.font = `bold ${fontSize}px "Anton", Impact, "Arial Black", sans-serif`;
                            lineHeight = fontSize * 1.05; 
                            
                            const words = txt.split(' ');
                            lines = [];
                            let currentLine = words[0] || '';
                            
                            for (let i = 1; i < words.length; i++) {
                                const testLine = currentLine + ' ' + words[i];
                                if (ctx.measureText(testLine).width <= maxWidth) {
                                    currentLine = testLine;
                                } else {
                                    lines.push(currentLine);
                                    currentLine = words[i];
                                }
                            }
                            if (currentLine) lines.push(currentLine);
                            
                            const totalHeight = lines.length * lineHeight;
                            
                            
                            let overflows = false;
                            for (const line of lines) {
                                if (ctx.measureText(line).width > maxWidth) {
                                    overflows = true;
                                    break;
                                }
                            }
                            
                            if (totalHeight <= maxHeight && !overflows) {
                                break;
                            }
                            fontSize -= 2;
                        }

                        ctx.fillStyle = '#ffffff';
                        ctx.strokeStyle = '#000000';
                        ctx.lineWidth = Math.max(2.5, fontSize * 0.12);
                        ctx.lineJoin = 'round';
                        ctx.textAlign = 'center';
                        
                        let startY;
                        if (isTop) {
                            ctx.textBaseline = 'top';
                            startY = img.height * 0.04;
                            for (let i = 0; i < lines.length; i++) {
                                ctx.strokeText(lines[i], img.width / 2, startY + (i * lineHeight));
                                ctx.fillText(lines[i], img.width / 2, startY + (i * lineHeight));
                            }
                        } else {
                            ctx.textBaseline = 'bottom';
                            startY = img.height - (img.height * 0.04);
                            const totalHeight = (lines.length - 1) * lineHeight;
                            const baseHeight = startY - totalHeight;
                            for (let i = 0; i < lines.length; i++) {
                                ctx.strokeText(lines[i], img.width / 2, baseHeight + (i * lineHeight));
                                ctx.fillText(lines[i], img.width / 2, baseHeight + (i * lineHeight));
                            }
                        }
                    };

                    drawMemeText(topText, true);
                    drawMemeText(bottomText, false);

                    buffer = canvas.toBuffer('image/png');
                } catch (drawErr) {
                    console.error('Failed to draw text on image:', drawErr);
                }
            }

            
            try {
                const { addStickerMetadata } = await import('@/lib/stickerMetadata.js');
                buffer = await addStickerMetadata(buffer, settings.botName, settings.ownerName);
            } catch (metaErr) {
                console.error('Failed to add metadata:', metaErr);
            }

            await sock.sendMessage(msg.key.remoteJid, { sticker: buffer, mimetype: 'image/webp' }, { quoted: msg });
        } catch (err) {
            console.error('Sticker Error:', err);
            await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal mengonversi media menjadi stiker.' }, { quoted: msg });
        }
    }
};
