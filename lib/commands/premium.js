import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMenu, getPluginsMenu, getUserMenu, getPremiumMenu, getOwnerMenu } from '@/lib/menu.js';
import { db } from '@/lib/database.js';
import { settings } from '@/config/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const premiumCommands = [
{
        name: 'delete',
        description: 'Menghapus pesan bot dengan membalas pesannya.',
        usage: '<balas pesan bot>',
        example: '',
        aliases: ['del'],
        category: 'Media',
        run: async (sock, msg, args) => {
            const quotedCtx = msg.message.extendedTextMessage?.contextInfo;
            if (!quotedCtx?.stanzaId) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Balas pesan bot untuk menghapusnya.' }, { quoted: msg });
                return;
            }

            const normalizeJid = (jid) => jid ? jid.replace(/:.*@/, '@') : '';
            const botJid = normalizeJid(sock.user?.id || '');
            const quotedParticipant = quotedCtx.participant ? normalizeJid(quotedCtx.participant) : '';
            const isFromBot = !quotedCtx.participant || quotedParticipant === botJid;

            await sock.sendMessage(msg.key.remoteJid, {
                delete: {
                    remoteJid: msg.key.remoteJid,
                    fromMe: isFromBot,
                    id: quotedCtx.stanzaId,
                    participant: quotedCtx.participant
                }
            });
        }
    },
{
        name: 'edit',
        description: 'Mengedit pesan teks yang dikirim oleh bot.',
        usage: '<teks baru>',
        example: 'Halo Dunia',
        category: 'Media',
        run: async (sock, msg, args) => {
            const quotedCtx = msg.message.extendedTextMessage?.contextInfo;
            const newText = args.join(' ');
            if (!quotedCtx?.stanzaId || !newText) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Balas pesan bot dan tentukan teks baru. Contoh: *.edit Teks Baru*' }, { quoted: msg });
                return;
            }
            await sock.sendMessage(msg.key.remoteJid, {
                text: newText,
                edit: {
                    remoteJid: msg.key.remoteJid,
                    fromMe: true,
                    id: quotedCtx.stanzaId,
                    participant: quotedCtx.participant
                }
            });
        }
    },
{
        name: 'premiummenu',
        description: 'Menampilkan menu perintah khusus premium.',
        usage: '',
        example: '',
        category: 'Premium',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            const bannerPath = path.join(__dirname, '..', '..', 'assets', 'menu_banner.png');
            let thumbnailBuffer = null;
            if (fs.existsSync(bannerPath)) { thumbnailBuffer = fs.readFileSync(bannerPath); }
            const menuText = getPremiumMenu();
            const msgOptions = thumbnailBuffer ? { image: thumbnailBuffer, caption: menuText } : { text: menuText };
            await sock.sendMessage(msg.key.remoteJid, msgOptions, { quoted: msg });
        }
    },
{
        name: 'react',
        description: 'Mengirimkan reaksi emoji ke suatu pesan.',
        usage: '<emoji>',
        example: '🔥',
        category: 'Media',
        run: async (sock, msg, args) => {
            const emoji = args[0] || '🔥';
            await sock.sendMessage(msg.key.remoteJid, {
                react: { text: emoji, key: msg.key }
            });
        }
    },
{
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
                
                // Handle viewOnce wrappers
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

                // Add EXIF Sticker Information Metadata locally
                try {
                    const { addStickerMetadata } = await import('@/lib/stickerMetadata.js');
                    buffer = await addStickerMetadata(buffer, settings.botName, settings.ownerName);
                } catch (metaErr) {
                    console.error('Failed to add metadata:', metaErr);
                }

                await sock.sendMessage(msg.key.remoteJid, { sticker: buffer }, { quoted: msg });
            } catch (err) {
                console.error('Sticker Error:', err);
                await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal mengonversi media menjadi stiker.' }, { quoted: msg });
            }
        }
    }
];
