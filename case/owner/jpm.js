import { settings } from '@/config/settings.js';
import { db } from '@/lib/database.js';
import { broadcastLock, sleep, randomDelay } from '@/lib/utils.js';

export default {
    description: 'Mengirimkan pesan promosi ke banyak grup/channel sekaligus.',
    usage: '<teks>',
    example: 'Info terbaru',
    name: 'jpm',
    aliases: ['bcgc', 'jpmch', 'addjpmch', 'deljpmch', 'listjpmch', 'checkdb',
              'addjpmblacklist', 'addjpmbl', 'deljpmblacklist', 'deljpmbl',
              'listjpmblacklist', 'listjpmbl'],
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args, context) => {
        const { sendTyping, activePrefix, commandName } = context;
        const remoteJid = msg.key.remoteJid;
        const text      = args.join(' ');
        const botJid    = (sock.user?.id || '').replace(/:.*@/, '@');

        
        if (commandName === 'addjpmch') {
            await sendTyping();
            const input = args[0];
            if (!input) {
                await sock.sendMessage(remoteJid, { text: `⚠️ *Penggunaan:* \`${activePrefix}addjpmch [JID/Link Channel]\`` }, { quoted: msg });
                return;
            }

            let targetJid = input;
            if (input.includes('whatsapp.com/channel/')) {
                const match = input.match(/channel\/([a-zA-Z0-9\-]+)/i);
                if (match) {
                    try {
                        const meta = await sock.newsletterMetadata('invite', match[1]);
                        if (meta?.id) { targetJid = meta.id; }
                        else {
                            await sock.sendMessage(remoteJid, { text: '❌ Tidak dapat mengambil JID channel dari tautan tersebut.' }, { quoted: msg });
                            return;
                        }
                    } catch (err) {
                        await sock.sendMessage(remoteJid, { text: `❌ Gagal mengambil metadata channel: ${err.message}` }, { quoted: msg });
                        return;
                    }
                }
            }

            if (!targetJid.endsWith('@newsletter')) {
                await sock.sendMessage(remoteJid, { text: '❌ JID Channel tidak valid. Harus berakhiran @newsletter' }, { quoted: msg });
                return;
            }

            const channels = db.data.settings.jpmChannels || [];
            if (channels.includes(targetJid)) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Channel tersebut sudah ada di daftar JPM!' }, { quoted: msg });
                return;
            }

            channels.push(targetJid);
            db.data.settings.jpmChannels = channels;
            db.save();
            await sock.sendMessage(remoteJid, { text: `✅ Berhasil menambahkan channel ke database JPM:\n\`${targetJid}\`` }, { quoted: msg });
            return;
        }

        
        if (commandName === 'deljpmch') {
            await sendTyping();
            const targetJid = args[0];
            if (!targetJid) {
                await sock.sendMessage(remoteJid, { text: `⚠️ *Penggunaan:* \`${activePrefix}deljpmch [JID Channel]\`` }, { quoted: msg });
                return;
            }

            let channels = db.data.settings.jpmChannels || [];
            if (!channels.includes(targetJid)) {
                await sock.sendMessage(remoteJid, { text: '❌ JID Channel tidak ditemukan di daftar JPM!' }, { quoted: msg });
                return;
            }

            db.data.settings.jpmChannels = channels.filter(id => id !== targetJid);
            db.save();
            await sock.sendMessage(remoteJid, { text: `✅ Berhasil menghapus channel dari database JPM:\n\`${targetJid}\`` }, { quoted: msg });
            return;
        }

        
        if (commandName === 'listjpmch') {
            await sendTyping();
            const channels = db.data.settings.jpmChannels || [];
            if (channels.length === 0) {
                await sock.sendMessage(remoteJid, { text: '📋 *Daftar JPM Channel kosong.*' }, { quoted: msg });
                return;
            }
            const listText = `📋 *Daftar Target JPM Channel* (${channels.length})\n\n` +
                channels.map((jid, i) => `${i + 1}. \`${jid}\``).join('\n');
            await sock.sendMessage(remoteJid, { text: listText }, { quoted: msg });
            return;
        }

        
        if (commandName === 'checkdb') {
            await sendTyping();
            const users       = db.data.users;
            const totalUsers  = Object.keys(users).length;
            const registered  = Object.values(users).filter(u => u.registered).length;
            const premium     = Object.values(users).filter(u => u.premium).length;
            const totalGroups = Object.keys(db.data.groups || {}).length;
            const totalCh     = (db.data.settings.jpmChannels || []).length;
            const totalHits   = db.data.stats.totalCommands || 0;

            const div = '─'.repeat(30);
            await sock.sendMessage(remoteJid, {
                text: `📊 *Statistik Database Kelola* 📊\n${div}\n\n` +
                      `• *Total Kontak/User:* ${totalUsers} pengguna\n` +
                      `• *Terdaftar:* ${registered} pengguna\n` +
                      `• *Premium:* ${premium} pengguna\n` +
                      `• *Total Grup Aktif:* ${totalGroups} grup\n` +
                      `• *Target JPM Channel:* ${totalCh} channel\n` +
                      `• *Total Hits Perintah:* ${totalHits} kali\n\n` +
                      `${div}\n_*${settings.botName} Database Engine*_`
            }, { quoted: msg });
            return;
        }

        
        if (commandName === 'addjpmblacklist' || commandName === 'addjpmbl') {
            await sendTyping();
            let targetJid = '';
            const input = args[0];

            if (input) {
                if (input.includes('chat.whatsapp.com/')) {
                    const code = input.split('chat.whatsapp.com/')[1]?.split(' ')[0];
                    if (code) {
                        try {
                            const meta = await sock.groupGetInviteInfo(code);
                            if (meta?.id) { targetJid = meta.id; }
                            else {
                                await sock.sendMessage(remoteJid, { text: '❌ Tidak dapat mengambil JID grup dari tautan tersebut.' }, { quoted: msg });
                                return;
                            }
                        } catch (err) {
                            await sock.sendMessage(remoteJid, { text: `❌ Gagal mengambil metadata grup: ${err.message}` }, { quoted: msg });
                            return;
                        }
                    }
                } else { targetJid = input; }
            } else if (remoteJid.endsWith('@g.us')) {
                targetJid = remoteJid;
            }

            if (!targetJid || !targetJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: `⚠️ *Penggunaan:* \`${activePrefix}addjpmblacklist [JID/Link Grup]\` atau gunakan langsung di dalam grup.` }, { quoted: msg });
                return;
            }

            const blacklist = db.data.settings.jpmBlacklist || [];
            if (blacklist.includes(targetJid)) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Grup tersebut sudah ada di daftar blacklist JPM!' }, { quoted: msg });
                return;
            }

            blacklist.push(targetJid);
            db.data.settings.jpmBlacklist = blacklist;
            db.save();
            await sock.sendMessage(remoteJid, { text: `✅ Berhasil menambahkan grup ke blacklist JPM:\n\`${targetJid}\`` }, { quoted: msg });
            return;
        }

        
        if (commandName === 'deljpmblacklist' || commandName === 'deljpmbl') {
            await sendTyping();
            const targetJid = args[0] || (remoteJid.endsWith('@g.us') ? remoteJid : '');

            if (!targetJid) {
                await sock.sendMessage(remoteJid, { text: `⚠️ *Penggunaan:* \`${activePrefix}deljpmblacklist [JID Grup]\` atau gunakan langsung di dalam grup.` }, { quoted: msg });
                return;
            }

            let blacklist = db.data.settings.jpmBlacklist || [];
            if (!blacklist.includes(targetJid)) {
                await sock.sendMessage(remoteJid, { text: '❌ JID Grup tidak ditemukan di daftar blacklist JPM!' }, { quoted: msg });
                return;
            }

            db.data.settings.jpmBlacklist = blacklist.filter(id => id !== targetJid);
            db.save();
            await sock.sendMessage(remoteJid, { text: `✅ Berhasil menghapus grup dari blacklist JPM:\n\`${targetJid}\`` }, { quoted: msg });
            return;
        }

        
        if (commandName === 'listjpmblacklist' || commandName === 'listjpmbl') {
            await sendTyping();
            const blacklist = db.data.settings.jpmBlacklist || [];
            if (blacklist.length === 0) {
                await sock.sendMessage(remoteJid, { text: '📋 *Daftar Blacklist JPM kosong.*' }, { quoted: msg });
                return;
            }
            const listText = `📋 *Daftar Blacklist JPM Grup* (${blacklist.length})\n\n` +
                blacklist.map((jid, i) => `${i + 1}. \`${jid}\``).join('\n');
            await sock.sendMessage(remoteJid, { text: listText }, { quoted: msg });
            return;
        }

        
        if (commandName === 'jpmch') {
            if (broadcastLock.has(botJid)) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perangkat ini sedang menjalankan tugas broadcast/push lainnya!' }, { quoted: msg });
                return;
            }

            const targetChannels = db.data.settings.jpmChannels || [];
            if (targetChannels.length === 0) {
                await sock.sendMessage(remoteJid, { text: `❌ Daftar target channel kosong! Silakan tambah dengan \`${activePrefix}addjpmch\` terlebih dahulu.` }, { quoted: msg });
                return;
            }

            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!text && !quotedMsg) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Harap masukkan pesan promosi atau quote media untuk JPM Channel!' }, { quoted: msg });
                return;
            }

            await sendTyping();
            await sock.sendMessage(remoteJid, { text: `⏳ *Memulai JPM ke ${targetChannels.length} Channel Terdaftar...*` }, { quoted: msg });

            broadcastLock.set(botJid, true);
            let success = 0;
            let batchCounter = 0;

            try {
                for (const jid of targetChannels) {
                    try {
                        if (quotedMsg) {
                            await sock.sendMessage(jid, { forward: msg.message.extendedTextMessage.contextInfo.quotedMessage });
                            if (text) await sock.sendMessage(jid, { text });
                        } else {
                            await sock.sendMessage(jid, { text });
                        }
                        success++;
                        batchCounter++;

                        if (batchCounter >= 10) {
                            batchCounter = 0;
                            await sleep(15_000);
                        } else {
                            await randomDelay(4_000, 7_000);
                        }
                    } catch (err) {
                        console.error(`Gagal kirim JPM Channel ke ${jid}:`, err.message);
                    }
                }
                await sock.sendMessage(remoteJid, { text: `✅ *JPM Channel Selesai!*\nBerhasil mengirim ke *${success}/${targetChannels.length}* channel.` }, { quoted: msg });
            } finally {
                broadcastLock.delete(botJid);
            }
            return;
        }

        
        if (commandName === 'jpm' || commandName === 'bcgc') {
            if (broadcastLock.has(botJid)) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perangkat ini sedang menjalankan tugas broadcast/push lainnya!' }, { quoted: msg });
                return;
            }

            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!text && !quotedMsg) {
                await sock.sendMessage(remoteJid, {
                    text: `📢 *JPM Broadcast System*\n\nFormat: \`${activePrefix}jpm [teks]\` atau quote/balas media dengan \`.jpm\``
                }, { quoted: msg });
                return;
            }

            await sendTyping();
            await sock.sendMessage(remoteJid, { text: '⏳ *Memulai JPM ke semua grup...*' }, { quoted: msg });

            broadcastLock.set(botJid, true);
            let success = 0;
            let batchCounter = 0;

            try {
                const allGroups   = await sock.groupFetchAllParticipating();
                const rawJids     = Object.keys(allGroups || {});
                const blacklist   = db.data.settings.jpmBlacklist || [];
                const groupJids   = rawJids.filter(jid => !blacklist.includes(jid));

                if (groupJids.length === 0) {
                    await sock.sendMessage(remoteJid, { text: '❌ Bot tidak bergabung di grup manapun (atau semua grup masuk blacklist).' }, { quoted: msg });
                    return;
                }

                const div = '─'.repeat(30);

                for (const jid of groupJids) {
                    try {
                        if (quotedMsg) {
                            await sock.sendMessage(jid, { forward: msg.message.extendedTextMessage.contextInfo.quotedMessage });
                            if (text) await sock.sendMessage(jid, { text });
                        } else {
                            await sock.sendMessage(jid, {
                                text: `📢 *Informasi Bersama*\n${div}\n\n${text}\n\n${div}\n_*Sent via ${settings.botName}*_`
                            });
                        }
                        success++;
                        batchCounter++;

                        
                        if (batchCounter >= 10) {
                            batchCounter = 0;
                            await sleep(15_000);
                        } else {
                            await randomDelay(4_000, 7_000);
                        }
                    } catch (err) {
                        console.error(`Gagal JPM ke ${jid}:`, err.message);
                    }
                }

                await sock.sendMessage(remoteJid, {
                    text: `✅ *JPM Selesai!*\nBerhasil dikirim ke *${success}/${groupJids.length}* grup.`
                }, { quoted: msg });
            } finally {
                broadcastLock.delete(botJid);
            }
        }
    }
};
