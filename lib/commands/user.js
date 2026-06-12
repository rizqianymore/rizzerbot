import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMenu, getPluginsMenu, getUserMenu, getPremiumMenu, getOwnerMenu } from '@/lib/menu.js';
import { db } from '@/lib/database.js';
import { settings } from '@/config/settings.js';
import { commands } from '@/lib/plugins.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const userCommands = [
{
        name: 'checkuser',
        description: 'Menampilkan profil dan detail informasi akun Anda.',
        usage: '',
        example: '',
        aliases: ['profile', 'me'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping, senderJid, userProfile }) => {
            await sendTyping();
            const name = userProfile.name || msg.pushName || 'User';
            const isPrem = userProfile.premium ? 'Ya' : 'Tidak';
            const isReg = userProfile.registered ? 'Ya' : 'Tidak';
            const limit = userProfile.limit !== undefined ? userProfile.limit : 100;
            const joined = userProfile.joinedAt ? new Date(userProfile.joinedAt).toLocaleDateString('id-ID') : 'Tidak Diketahui';
            const text = `👤 *Profil Pengguna*\n\n` +
                         `• *Nama:* ${name}\n` +
                         `• *JID:* @${senderJid.split('@')[0]}\n` +
                         `• *Terdaftar:* ${isReg}\n` +
                         `• *Premium:* ${isPrem}\n` +
                         `• *Limit:* ${limit}\n` +
                         `• *Bergabung:* ${joined}`;
            await sock.sendMessage(msg.key.remoteJid, { 
                text, 
                mentions: [senderJid] 
            }, { quoted: msg });
        }
    },
{
        name: 'follow',
        description: 'Mengikuti saluran/channel WhatsApp.',
        usage: '<link channel/JID>',
        example: 'https://whatsapp.com/channel/xxxx',
        aliases: ['followchannel'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            let input = args[0];
            if (!input) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap masukkan JID Channel atau link undangan channel WhatsApp!' }, { quoted: msg });
                return;
            }

            let targetJid = input;
            if (input.includes('whatsapp.com/channel/')) {
                const match = input.match(/channel\/([a-zA-Z0-9\-]+)/i);
                if (match) {
                    try {
                        const meta = await sock.newsletterMetadata('invite', match[1]);
                        if (meta && meta.id) {
                            targetJid = meta.id;
                        } else {
                            await sock.sendMessage(msg.key.remoteJid, { text: '❌ Tidak dapat menemukan informasi channel dari tautan tersebut.' }, { quoted: msg });
                            return;
                        }
                    } catch (err) {
                        await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal mengambil informasi channel: ${err.message}` }, { quoted: msg });
                        return;
                    }
                }
            }

            if (!targetJid.endsWith('@newsletter')) {
                await sock.sendMessage(msg.key.remoteJid, { text: '❌ Format JID Channel tidak valid. Pastikan berakhiran @newsletter' }, { quoted: msg });
                return;
            }

            try {
                await sock.newsletterFollow(targetJid);
                await sock.sendMessage(msg.key.remoteJid, { text: `✅ Berhasil mengikuti channel/newsletter dengan JID:\n\`${targetJid}\`` }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal mengikuti channel: ${err.message}` }, { quoted: msg });
            }
        }
    },
{
        name: 'getbio',
        description: 'Mengambil status biodata WhatsApp pengguna.',
        usage: '<@tag/reply/nomor>',
        example: '@user',
        aliases: ['bio', 'statusbio'],
        category: 'User',
        run: async (sock, msg, args, { getTargetJid, senderJid, sendTyping }) => {
            await sendTyping();
            const target = getTargetJid(args) || senderJid;
            const targetNum = target.split('@')[0];
            try {
                const statusInfo = await sock.fetchStatus(target);
                if (statusInfo && statusInfo.status) {
                    const bioText = statusInfo.status;
                    const dateStr = statusInfo.setAt ? new Date(statusInfo.setAt).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }) : '-';
                    
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `📝 *Bio Info untuk @${targetNum}*:\n\n` +
                              `• *Bio:* "${bioText}"\n` +
                              `• *Diperbarui:* ${dateStr}`,
                        mentions: [target]
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(msg.key.remoteJid, { text: `❌ Tidak ada status bio yang dapat diakses dari @${targetNum}.` }, { quoted: msg });
                }
            } catch (_) {
                await sock.sendMessage(msg.key.remoteJid, { text: `❌ Status bio @${targetNum} disembunyikan (privasi) atau tidak diatur.` }, { quoted: msg });
            }
        }
    },
{
        name: 'getpp',
        description: 'Mengambil foto profil pengguna WhatsApp.',
        usage: '<@tag/reply/nomor>',
        example: '@user',
        aliases: ['getpfp', 'grabpp'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping, getTargetJid, senderJid }) => {
            await sendTyping();
            
            let target = getTargetJid(args);

            // Cek jika membalas kartu kontak (contactMessage / contactsArrayMessage)
            const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMsg) {
                const { extractMessageContent } = await import('baileys');
                const content = extractMessageContent(quotedMsg);
                if (content?.contactMessage?.vcard) {
                    const match = content.contactMessage.vcard.match(/waid=(\d+)/i);
                    if (match) {
                        target = match[1] + '@s.whatsapp.net';
                    }
                } else if (content?.contactsArrayMessage?.contacts) {
                    const firstContact = content.contactsArrayMessage.contacts[0];
                    if (firstContact?.vcard) {
                        const match = firstContact.vcard.match(/waid=(\d+)/i);
                        if (match) {
                            target = match[1] + '@s.whatsapp.net';
                        }
                    }
                }
            }

            if (!target) target = senderJid;

            try {
                const ppUrl = await sock.profilePictureUrl(target, 'image');
                if (ppUrl) {
                    await sock.sendMessage(msg.key.remoteJid, { 
                        image: { url: ppUrl }, 
                        caption: `Foto profil untuk @${target.split('@')[0]}`,
                        mentions: [target]
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(msg.key.remoteJid, { 
                        text: `❌ Pengguna @${target.split('@')[0]} tidak memiliki foto profil publik.`,
                        mentions: [target]
                    }, { quoted: msg });
                }
            } catch (err) {
                await sock.sendMessage(msg.key.remoteJid, { 
                    text: `❌ Gagal mengambil foto profil. Kemungkinan di-private oleh pengguna.` 
                }, { quoted: msg });
            }
        }
    },
{
        name: 'groupinfo',
        description: 'Menampilkan informasi dan detail statistik grup.',
        usage: '',
        example: '',
        aliases: ['infogrup', 'grupinfo'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            await sendTyping();
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
                const creator = groupMetadata.owner || groupMetadata.subjectOwner || 'Tidak diketahui';
                
                const creationDate = groupMetadata.creation 
                    ? new Date(groupMetadata.creation * 1000).toLocaleDateString('id-ID', {
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })
                    : 'Tidak diketahui';

                const infoText = `*Informasi Grup*\n\n` +
                                 `• *Nama Grup:* ${groupMetadata.subject}\n` +
                                 `• *ID Grup:* \`${groupMetadata.id}\`\n` +
                                 `• *Pembuat:* @${creator.split('@')[0]}\n` +
                                 `• *Dibuat:* ${creationDate}\n` +
                                 `• *Total Anggota:* ${participants.length}\n` +
                                 `• *Total Admin:* ${admins.length}\n\n` +
                                 `*Deskripsi:*\n${groupMetadata.desc?.toString() || '(Tidak ada deskripsi)'}`;
                                 
                await sock.sendMessage(remoteJid, { 
                    text: infoText, 
                    mentions: [creator] 
                }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal mengambil informasi metadata grup.' }, { quoted: msg });
            }
        }
    },
{
        name: 'help',
        description: 'Menampilkan daftar menu utama bot.',
        usage: '',
        example: '',
        aliases: ['menu'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            
            const bannerPath = path.join(__dirname, '..', '..', 'assets', 'menu_banner.png');
            
            let thumbnailBuffer = null;
            if (fs.existsSync(bannerPath)) {
                thumbnailBuffer = fs.readFileSync(bannerPath);
            }
            
            const menuText = getMenu();
            
            const msgOptions = thumbnailBuffer ? { image: thumbnailBuffer, caption: menuText } : { text: menuText };
            await sock.sendMessage(msg.key.remoteJid, msgOptions, { quoted: msg });
        }
    },
{
        name: 'idch',
        description: 'Mengambil ID obrolan saat ini atau metadata channel.',
        usage: '<link channel>',
        example: 'https://whatsapp.com/channel/xxxx',
        aliases: ['getid', 'id', 'checkid'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            let targetJid = msg.key.remoteJid;
            
            let inviteCode = '';
            if (args[0]) {
                const match = args[0].match(/channel\/([a-zA-Z0-9\-]+)/i);
                inviteCode = match ? match[1] : args[0].trim();
            }
            
            if (inviteCode) {
                try {
                    const meta = await sock.newsletterMetadata('invite', inviteCode);
                    if (meta && meta.id) {
                        const infoText = `📢 *Informasi channel (newsletter)*\n\n` +
                                         `• *Nama:* ${meta.name || '-'}\n` +
                                         `• *ID (JID):* \`${meta.id}\`\n` +
                                         `• *Subscribers:* ${meta.subscribers ?? '-'}\n` +
                                         `• *Deskripsi:* ${meta.description || '-'}`;
                        await sock.sendMessage(msg.key.remoteJid, { text: infoText }, { quoted: msg });
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, { text: `❌ Tidak dapat menemukan informasi channel dari kode/link tersebut.` }, { quoted: msg });
                    }
                } catch (err) {
                    await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal mengambil metadata channel: ${err.message}` }, { quoted: msg });
                }
            } else {
                const quoted = msg.message?.extendedTextMessage?.contextInfo;
                if (quoted && (quoted.forwardedNewsletterMessageInfo?.newsletterJid || quoted.participant)) {
                    let infoText = '';
                    if (quoted.forwardedNewsletterMessageInfo?.newsletterJid) {
                        targetJid = quoted.forwardedNewsletterMessageInfo.newsletterJid;
                        infoText = `📢 *ID Channel (Newsletter):* \`${targetJid}\`\n*Nama Channel:* ${quoted.forwardedNewsletterMessageInfo.newsletterName || 'Tidak diketahui'}`;
                    } else if (quoted.participant) {
                        targetJid = quoted.participant;
                        infoText = `👤 *ID Pengirim yang Di-quote:* \`${targetJid}\``;
                    }
                    await sock.sendMessage(msg.key.remoteJid, { text: infoText }, { quoted: msg });
                } else {
                    // Current chat ID + Usage explanation
                    const infoText = `📍 *ID Obrolan Saat Ini:* \`${targetJid}\`\n\n` +
                                     `💡 *Tips:* Anda juga bisa mendapatkan ID Channel WhatsApp (newsletter) menggunakan perintah ini.\n` +
                                     `👉 *Format:* \`.idch <link-channel>\`\n` +
                                     `👉 *Contoh:* \`.idch https://whatsapp.com/channel/xxxx\``;
                    await sock.sendMessage(msg.key.remoteJid, { text: infoText }, { quoted: msg });
                }
            }
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
        name: 'plugins',
        description: 'Menampilkan menu daftar plugin tambahan.',
        usage: '',
        example: '',
        aliases: ['pluginmenu', 'pl'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            
            const bannerPath = path.join(__dirname, '..', '..', 'assets', 'menu_banner.png');
            
            let thumbnailBuffer = null;
            if (fs.existsSync(bannerPath)) {
                thumbnailBuffer = fs.readFileSync(bannerPath);
            }
            
            const menuText = getPluginsMenu();
            
            const msgOptions = thumbnailBuffer ? { image: thumbnailBuffer, caption: menuText } : { text: menuText };
            await sock.sendMessage(msg.key.remoteJid, msgOptions, { quoted: msg });
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
        name: 'rizz',
        description: 'Mengirimkan kalimat gombalan/rayuan acak.',
        usage: '',
        example: '',
        category: 'User',
        run: async (sock, msg, args, { sendTyping, senderName }) => {
            await sendTyping();
            const randomRizz = settings.rizzQuotes[Math.floor(Math.random() * settings.rizzQuotes.length)];
            await sock.sendMessage(msg.key.remoteJid, { text: `😎 *Rayuan Gombal untuk ${senderName}:*\n\n"${randomRizz}"` }, { quoted: msg });
        }
    },
{
        name: 'runtime',
        description: 'Menampilkan durasi aktif/uptime bot.',
        usage: '',
        example: '',
        aliases: ['uptime'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            const uptimeSeconds = Math.floor(process.uptime());
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const seconds = uptimeSeconds % 60;
            let timeString = '';
            if (hours > 0) timeString += `${hours} jam `;
            if (minutes > 0 || hours > 0) timeString += `${minutes} menit `;
            timeString += `${seconds} detik`;
            await sock.sendMessage(msg.key.remoteJid, { 
                text: `⏳ *Waktu Aktif RizzerBot:* ${timeString}` 
            }, { quoted: msg });
        }
    },
{
        name: 'rvo',
        description: 'Mengunduh media sekali lihat (View Once) dengan membalas pesannya.',
        usage: '<balas media view once>',
        example: '',
        aliases: ['retrieve', 'readviewonce'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            const quoted = msg.message?.extendedTextMessage?.contextInfo;
            if (!quoted || !quoted.quotedMessage) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Balas/quote pesan gambar/video 1x lihat (view once) yang ingin diambil!' }, { quoted: msg });
                return;
            }
            
            const { extractMessageContent } = await import('baileys');
            const content = extractMessageContent(quoted.quotedMessage);
            const isViewOnce = quoted.quotedMessage.viewOnceMessage || 
                               quoted.quotedMessage.viewOnceMessageV2 || 
                               quoted.quotedMessage.viewOnceMessageV2Lollipop ||
                               content?.imageMessage?.viewOnce ||
                               content?.videoMessage?.viewOnce;
                               
            if (!isViewOnce) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Pesan yang di-quote bukan pesan 1x lihat (view once)!' }, { quoted: msg });
                return;
            }
            
            try {
                const { downloadMediaMessage } = await import('baileys');
                const mediaType = content.imageMessage ? 'image' : (content.videoMessage ? 'video' : null);
                
                if (!mediaType) {
                    await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Hanya mendukung media gambar atau video 1x lihat!' }, { quoted: msg });
                    return;
                }
                
                const buffer = await downloadMediaMessage(
                    {
                        key: {
                            remoteJid: msg.key.remoteJid,
                            id: quoted.stanzaId,
                            participant: quoted.participant
                        },
                        message: quoted.quotedMessage
                    },
                    'buffer',
                    {},
                    {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
                
                const caption = content[mediaType + 'Message']?.caption || 'RVO Success ✅';
                if (mediaType === 'image') {
                    await sock.sendMessage(msg.key.remoteJid, {
                        image: buffer,
                        caption: caption
                    }, { quoted: msg });
                } else if (mediaType === 'video') {
                    await sock.sendMessage(msg.key.remoteJid, {
                        video: buffer,
                        caption: caption
                    }, { quoted: msg });
                }
            } catch (err) {
                console.error('Error downloading RVO:', err);
                await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal mengunduh media view once.' }, { quoted: msg });
            }
        }
    },
{
        name: 'say',
        description: 'Mengirimkan ulang teks yang Anda ketik.',
        usage: '<teks>',
        example: 'Halo',
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            const text = args.join(' ');
            if (!text) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan teks yang ingin diucapkan.' }, { quoted: msg });
            } else {
                await sendTyping();
                await sock.sendMessage(msg.key.remoteJid, { text });
            }
        }
    },
{
        name: 'testlink',
        description: 'Menampilkan contoh preview tautan embed web.',
        usage: '',
        example: '',
        aliases: ['embed', 'preview'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            
            const bannerPath = path.join(__dirname, '..', '..', 'assets', 'menu_banner.png');
            
            let thumbnailBuffer = null;
            if (fs.existsSync(bannerPath)) {
                thumbnailBuffer = fs.readFileSync(bannerPath);
            }
            
            const linkText = '*RizzerBot Official Website*\nKunjungi situs resmi kami untuk informasi lebih lanjut mengenai bot ini.\n\n👉 https://github.com/rizqianymore/rizzerbot';
            
            await sock.sendMessage(msg.key.remoteJid, {
                text: linkText,
                linkPreview: {
                    title: 'RizzerBot Multi-Device',
                    body: 'Modular & High-Performance WhatsApp Bot',
                    thumbnail: thumbnailBuffer, // Menggunakan buffer gambar lokal
                    sourceUrl: 'https://github.com/rizqianymore/rizzerbot'
                }
            }, { quoted: msg });
        }
    },
{
        name: 'usermenu',
        description: 'Menampilkan menu perintah khusus user.',
        usage: '',
        example: '',
        category: 'User',
        run: async (sock, msg, args, { sendTyping }) => {
            await sendTyping();
            const bannerPath = path.join(__dirname, '..', '..', 'assets', 'menu_banner.png');
            let thumbnailBuffer = null;
            if (fs.existsSync(bannerPath)) { thumbnailBuffer = fs.readFileSync(bannerPath); }
            const menuText = getUserMenu();
            const msgOptions = thumbnailBuffer ? { image: thumbnailBuffer, caption: menuText } : { text: menuText };
            await sock.sendMessage(msg.key.remoteJid, msgOptions, { quoted: msg });
        }
    },
{
        name: 'search',
        description: 'Mencari perintah/plugin bot berdasarkan nama, deskripsi, kategori, atau alias.',
        usage: '<kata kunci>',
        example: 'profil',
        aliases: ['find', 'cari'],
        category: 'User',
        run: async (sock, msg, args, { sendTyping, activePrefix }) => {
            const query = args.join(' ').trim().toLowerCase();
            if (!query) {
                await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Harap masukkan kata kunci pencarian!\nContoh: *${activePrefix || '.'}search profil*` }, { quoted: msg });
                return;
            }

            await sendTyping();

            // Collect unique commands
            const uniqueCommands = new Map();
            for (const [key, cmd] of commands.entries()) {
                uniqueCommands.set(cmd.name.toLowerCase(), cmd);
            }

            const results = [];
            for (const cmd of uniqueCommands.values()) {
                const nameMatch = cmd.name.toLowerCase().includes(query);
                const descMatch = cmd.description ? cmd.description.toLowerCase().includes(query) : false;
                const categoryMatch = cmd.category ? cmd.category.toLowerCase().includes(query) : false;
                const aliasMatch = cmd.aliases ? cmd.aliases.some(alias => alias.toLowerCase().includes(query)) : false;

                if (nameMatch || descMatch || categoryMatch || aliasMatch) {
                    results.push(cmd);
                }
            }

            if (results.length === 0) {
                await sock.sendMessage(msg.key.remoteJid, { text: `🔍 *Hasil Pencarian:* "${query}"\n\n❌ Tidak ditemukan perintah yang cocok.` }, { quoted: msg });
                return;
            }

            const displayPrefix = activePrefix || '.';
            let responseText = `🔍 *Hasil Pencarian:* "${query}" (${results.length} ditemukan)\n\n`;

            results.forEach((cmd, index) => {
                const aliasesStr = cmd.aliases && cmd.aliases.length > 0 ? `\n   • *Alias:* ${cmd.aliases.join(', ')}` : '';
                const categoryStr = cmd.category ? ` [${cmd.category}]` : '';
                responseText += `*${index + 1}. ${displayPrefix}${cmd.name}*${categoryStr}\n`;
                responseText += `   • *Deskripsi:* ${cmd.description || 'Tidak ada deskripsi.'}${aliasesStr}\n\n`;
            });

            responseText += `💡 Gunakan perintah tersebut dengan menambahkan prefix di depannya.`;

            await sock.sendMessage(msg.key.remoteJid, { text: responseText.trim() }, { quoted: msg });
        }
    }
];
