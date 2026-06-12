import { settings } from '@/config/settings.js';
import { db } from '@/lib/database.js';

const activeBroadcasts = new Map();

export default {
    description: 'Mengirimkan pesan promosi ke banyak grup sekaligus.',
    usage: '<teks>',
    example: 'Info terbaru',
    name: 'jpm',
    aliases: ['bcgc', 'jpmch', 'addjpmch', 'deljpmch', 'listjpmch', 'checkdb'],
    category: 'Premium',
    premiumOnly: true,
    run: async (sock, msg, args, context) => {
        const { sendTyping, activePrefix } = context;
        const text = args.join(' ');
        const botJid = (sock.user?.id || '').replace(/:.*@/, '@');
        
        // Find which command name was invoked
        let messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        let cmdUsed = 'jpm';
        if (messageContent.startsWith(activePrefix)) {
            const firstWord = messageContent.slice(activePrefix.length).trim().split(/ +/)[0]?.toLowerCase();
            if (firstWord) cmdUsed = firstWord;
        } else {
            // Handle prefixless
            const firstWord = messageContent.trim().split(/ +/)[0]?.toLowerCase();
            if (firstWord) cmdUsed = firstWord;
        }

        // --- COMMAND 1: addjpmch (Add JPM Channel) ---
        if (cmdUsed === 'addjpmch') {
            await sendTyping();
            let input = args[0];
            if (!input) {
                await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ *Penggunaan:* \`${activePrefix}addjpmch [JID/Link Channel]\`` }, { quoted: msg });
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
                            await sock.sendMessage(msg.key.remoteJid, { text: '❌ Tidak dapat mengambil JID channel dari tautan tersebut.' }, { quoted: msg });
                            return;
                        }
                    } catch (err) {
                        await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal mengambil metadata channel: ${err.message}` }, { quoted: msg });
                        return;
                    }
                }
            }

            if (!targetJid.endsWith('@newsletter')) {
                await sock.sendMessage(msg.key.remoteJid, { text: '❌ JID Channel tidak valid. Harus berakhiran @newsletter' }, { quoted: msg });
                return;
            }

            const channels = db.data.settings.jpmChannels || [];
            if (channels.includes(targetJid)) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Channel tersebut sudah ada di daftar JPM!' }, { quoted: msg });
                return;
            }

            channels.push(targetJid);
            db.data.settings.jpmChannels = channels;
            db.save();

            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Berhasil menambahkan channel ke database JPM:\n\`${targetJid}\`` }, { quoted: msg });
            return;
        }

        // --- COMMAND 2: deljpmch (Delete JPM Channel) ---
        if (cmdUsed === 'deljpmch') {
            await sendTyping();
            const targetJid = args[0];
            if (!targetJid) {
                await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ *Penggunaan:* \`${activePrefix}deljpmch [JID Channel]\`` }, { quoted: msg });
                return;
            }

            let channels = db.data.settings.jpmChannels || [];
            if (!channels.includes(targetJid)) {
                await sock.sendMessage(msg.key.remoteJid, { text: '❌ JID Channel tidak ditemukan di daftar JPM!' }, { quoted: msg });
                return;
            }

            channels = channels.filter(id => id !== targetJid);
            db.data.settings.jpmChannels = channels;
            db.save();

            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Berhasil menghapus channel dari database JPM:\n\`${targetJid}\`` }, { quoted: msg });
            return;
        }

        // --- COMMAND 3: listjpmch (List JPM Channels) ---
        if (cmdUsed === 'listjpmch') {
            await sendTyping();
            const channels = db.data.settings.jpmChannels || [];
            if (channels.length === 0) {
                await sock.sendMessage(msg.key.remoteJid, { text: '📋 *Daftar JPM Channel kosong.*' }, { quoted: msg });
                return;
            }

            let listText = `📋 *Daftar Target JPM Channel* (${channels.length})\n\n`;
            channels.forEach((jid, idx) => {
                listText += `${idx + 1}. \`${jid}\`\n`;
            });

            await sock.sendMessage(msg.key.remoteJid, { text: listText.trim() }, { quoted: msg });
            return;
        }

        // --- COMMAND 4: checkdb (Check Database Stats) ---
        if (cmdUsed === 'checkdb') {
            await sendTyping();
            const totalUsers = Object.keys(db.data.users).length;
            const registeredUsers = Object.keys(db.data.users).filter(k => db.data.users[k].registered).length;
            const premiumUsers = Object.keys(db.data.users).filter(k => db.data.users[k].premium).length;
            const totalGroups = Object.keys(db.data.groups || {}).length;
            const totalChannels = (db.data.settings.jpmChannels || []).length;
            const totalHits = db.data.stats.totalCommands || 0;

            const divider = '─'.repeat(30);
            const reportText = `📊 *Statistik Database Kelola* 📊\n${divider}\n\n` +
                               `• *Total Kontak/User:* ${totalUsers} pengguna\n` +
                               `• *Terdaftar:* ${registeredUsers} pengguna\n` +
                               `• *Premium:* ${premiumUsers} pengguna\n` +
                               `• *Total Grup Aktif:* ${totalGroups} grup\n` +
                               `• *Target JPM Channel:* ${totalChannels} channel\n` +
                               `• *Total Hits Perintah:* ${totalHits} kali\n\n` +
                               `${divider}\n_*${settings.botName} Database Engine*_`;

            await sock.sendMessage(msg.key.remoteJid, { text: reportText }, { quoted: msg });
            return;
        }

        // --- COMMAND 5: jpmch (Channel Broadcast) ---
        if (cmdUsed === 'jpmch') {
            if (activeBroadcasts.has(botJid)) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Perangkat ini sedang menjalankan tugas broadcast/push lainnya!' }, { quoted: msg });
                return;
            }

            const targetChannels = db.data.settings.jpmChannels || [];
            if (targetChannels.length === 0) {
                await sock.sendMessage(msg.key.remoteJid, { text: `❌ Daftar target channel kosong! Silakan tambah dengan \`${activePrefix}addjpmch\` terlebih dahulu.` }, { quoted: msg });
                return;
            }

            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!text && !quotedMsg) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap masukkan pesan promosi atau quote media untuk JPM Channel!' }, { quoted: msg });
                return;
            }

            await sendTyping();
            await sock.sendMessage(msg.key.remoteJid, { text: `⏳ *Memulai JPM ke ${targetChannels.length} Channel Terdaftar...*` }, { quoted: msg });

            activeBroadcasts.set(botJid, true);

            try {
                let success = 0;
                for (const jid of targetChannels) {
                    try {
                        if (quotedMsg) {
                            await sock.sendMessage(jid, { forward: msg.message.extendedTextMessage.contextInfo.quotedMessage });
                            if (text) await sock.sendMessage(jid, { text: text });
                        } else {
                            await sock.sendMessage(jid, { text: text });
                        }
                        success++;
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    } catch (err) {
                        console.error(`Gagal kirim JPM Channel ke ${jid}:`, err.message);
                    }
                }

                await sock.sendMessage(msg.key.remoteJid, { text: `✅ *JPM Channel Selesai!*\nBerhasil mengirim ke *${success}/${targetChannels.length}* channel.` }, { quoted: msg });
            } finally {
                activeBroadcasts.delete(botJid);
            }
            return;
        }

        // --- COMMAND 6: jpm (Group Broadcast) ---
        if (cmdUsed === 'jpm') {
            if (activeBroadcasts.has(botJid)) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Perangkat ini sedang menjalankan tugas broadcast/push lainnya!' }, { quoted: msg });
                return;
            }

            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!text && !quotedMsg) {
                const guideText = `📢 *JPM Broadcast System*\n\n` +
                                  `Format: \`${activePrefix}jpm [teks]\` atau quote/balas media dengan \`.jpm\``;
                await sock.sendMessage(msg.key.remoteJid, { text: guideText }, { quoted: msg });
                return;
            }

            await sendTyping();
            await sock.sendMessage(msg.key.remoteJid, { text: '⏳ *Memulai JPM ke semua grup...*' }, { quoted: msg });

            activeBroadcasts.set(botJid, true);

            try {
                const getGroups = await sock.groupFetchAllParticipating();
                const groupJids = Object.keys(getGroups || {});

                if (groupJids.length === 0) {
                    await sock.sendMessage(msg.key.remoteJid, { text: '❌ Bot tidak bergabung di grup manapun.' }, { quoted: msg });
                    return;
                }

                const divider = '─'.repeat(30);
                let success = 0;

                for (const jid of groupJids) {
                    try {
                        if (quotedMsg) {
                            await sock.sendMessage(jid, { forward: msg.message.extendedTextMessage.contextInfo.quotedMessage });
                            if (text) await sock.sendMessage(jid, { text: text });
                        } else {
                            const formattedText = `📢 *Informasi Bersama*\n${divider}\n\n${text}\n\n${divider}\n_*Sent via ${settings.botName}*_`;
                            await sock.sendMessage(jid, { text: formattedText });
                        }
                        success++;
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    } catch (err) {
                        console.error(`Gagal JPM ke ${jid}:`, err.message);
                    }
                }

                await sock.sendMessage(msg.key.remoteJid, { text: `✅ *JPM Selesai!*\nBerhasil dikirim ke *${success}/${groupJids.length}* grup.` }, { quoted: msg });
            } finally {
                activeBroadcasts.delete(botJid);
            }
        }
    }
};
