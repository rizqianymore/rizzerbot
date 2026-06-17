import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMenu } from '@/lib/menu.js';
import { db } from '@/lib/database.js';
import { settings } from '@/config/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const userCommands = [
    {
        name: 'help',
        description: 'Menampilkan daftar menu utama bot.',
        usage: '',
        example: '',
        aliases: ['menu'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            const menuText = getMenu();
            
            const msgOptions = {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: {
                    body: {
                        text: menuText
                    },
                    contextInfo: {
                        externalAdReply: {
                            title: settings.linkTitle,
                            body: settings.linkBody,
                            thumbnailUrl: settings.linkImage,
                            sourceUrl: settings.linkUrl,
                            mediaType: 1,
                            renderLargerThumbnail: true,
                            showAdAttribution: true
                        }
                    },
                    footer: {
                        text: "© " + settings.botName
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "single_select",
                                buttonParamsJson: JSON.stringify({
                                    title: "Show Fitur",
                                    sections: [
                                        {
                                            title: "Pilih Kategori Menu",
                                            rows: [
                                                {
                                                    title: "User Menu",
                                                    description: "Menampilkan perintah user",
                                                    id: ".usermenu"
                                                },
                                                {
                                                    title: "Premium Menu",
                                                    description: "Menampilkan perintah premium",
                                                    id: ".premiummenu"
                                                },
                                                {
                                                    title: "Owner Menu",
                                                    description: "Menampilkan perintah owner",
                                                    id: ".ownermenu"
                                                },
                                                {
                                                    title: "Plugins Menu",
                                                    description: "Menampilkan perintah plugin tambahan",
                                                    id: ".plugins"
                                                }
                                            ]
                                        }
                                    ]
                                })
                            }
                        ],
                        messageVersion: 1
                    }
                }
            };
            const { generateWAMessageFromContent } = await import('baileys');
            const message = generateWAMessageFromContent(msg.key.remoteJid, msgOptions, { quoted: msg });
            await sock.relayMessage(msg.key.remoteJid, message.message, { messageId: message.key.id });
        }
    },
    {
        name: 'ping',
        description: 'Memeriksa kecepatan respon atau latency bot.',
        usage: '',
        example: '',
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            const start = Date.now();
            const pingMsg = await sock.sendMessage(msg.key.remoteJid, { text: 'Pinging...' }, { quoted: msg });
            const end = Date.now();
            await sock.sendMessage(msg.key.remoteJid, {
                text: `Pong! 🏓\nKecepatan respon: ${end - start}ms`,
                edit: pingMsg.key
            });
        }
    },
    {
        name: 'register',
        description: 'Mendaftarkan nama pengguna ke database bot.',
        usage: '<nama>',
        example: 'Riz',
        aliases: ['daftar'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping, senderJid, userProfile, activePrefix, isOwner }) => {
            // Check if registration is closed
            const isRegOpen = db.data.settings.registrationOpen !== false;
            if (!isRegOpen && !isOwner) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Pendaftaran pengguna baru sedang ditutup sementara oleh Owner!' }, { quoted: msg });
                return;
            }

            const quotedJid = msg.message.extendedTextMessage?.contextInfo?.participant;
            const targetJid = quotedJid || senderJid;
            
            if (quotedJid && !isOwner) {
                const remoteJid = msg.key.remoteJid;
                let isSenderAdmin = false;
                if (remoteJid.endsWith('@g.us')) {
                    try {
                        const groupMetadata = await sock.groupMetadata(remoteJid);
                        const participants = groupMetadata.participants || [];
                        const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                        isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin';
                    } catch (_) {}
                }
                if (!isSenderAdmin) {
                    await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat mendaftarkan orang lain!' }, { quoted: msg });
                    return;
                }
            }

            const targetProfile = db.getUser(targetJid);
            if (targetProfile.registered) {
                await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ @${targetJid.split('@')[0]} sudah terdaftar!`, mentions: [targetJid] }, { quoted: msg });
                return;
            }

            let regName = args.join(' ');
            if (!regName) {
                if (quotedJid) {
                    regName = targetJid.split('@')[0];
                } else {
                    regName = msg.pushName || senderJid.split('@')[0];
                }
            }

            if (regName.length > 20) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap masukkan nama yang valid (maksimal 20 karakter).' }, { quoted: msg });
                return;
            }

            await sendTyping();
            db.updateUser(targetJid, { registered: true, name: regName });
            await sock.sendMessage(msg.key.remoteJid, {
                text: `✅ *Pendaftaran Berhasil!*\n\n*Nama:* ${regName}\n*User JID:* @${targetJid.split('@')[0]}\n\nAnda sekarang dapat menggunakan perintah bot. Ketik *${activePrefix}help* untuk melihat daftar perintah!`,
                mentions: [targetJid]
            }, { quoted: msg });
        }
    },
    {
        name: 'donate',
        description: 'Menampilkan informasi donasi untuk mendukung bot.',
        usage: '',
        example: '',
        aliases: ['donasi', 'sawer'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();

            const donationText = `💖 *Donasi Palantir Bots* 💖\n\n` +
                `Terima kasih telah menggunakan bot kami! Jika Anda menyukai layanan bot ini dan ingin membantu agar bot tetap aktif online 24 jam, Anda dapat menyisihkan donasi melalui metode berikut:\n\n` +
                `• *Dana:* [Masukkan Nomor Dana]\n` +
                `• *Gopay:* [Masukkan Nomor Gopay]\n` +
                `• *OVO:* [Masukkan Nomor OVO]\n` +
                `• *Saweria:* https://saweria.co/example\n\n` +
                `📝 *Catatan:* Jika Anda sudah berdonasi, harap kirimkan bukti transfer/pembayaran Anda ke Owner bot agar dapat kami proses atau sekadar mengucapkan terima kasih!\n\n` +
                `Terima kasih banyak atas segala dukungan Anda. Setiap donasi sangat berarti untuk kelangsungan server bot agar selalu stabil!\n\n` +
                `Owner Bot: *${settings.ownerName}*`;

            const qrisPath = './assets/qris.png';

            try {
                if (fs.existsSync(qrisPath)) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        image: { url: qrisPath },
                        caption: donationText
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: donationText
                    }, { quoted: msg });
                }
            } catch (err) {
                console.error('Donation command error:', err.message);
                await sock.sendMessage(msg.key.remoteJid, {
                    text: donationText
                }, { quoted: msg });
            }
        }
    }
];
