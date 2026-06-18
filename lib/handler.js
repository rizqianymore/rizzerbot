import { extractMessageContent } from 'baileys';
import { settings } from '@/config/settings.js';
import { db } from '@/lib/database.js';
import { commands } from '@/lib/plugins.js';

const cooldowns = new Map();

// Levenshtein distance algorithm to find typos/similar commands
function getLevenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}


// Commands accessible to unregistered users
const PUBLIC_COMMANDS = new Set([
    'register', 'daftar',
    'help', 'menu',
    'ping',
    'donate', 'donasi', 'sawer'
]);

function normalizeJid(jid) {
    return db.normalizeJid(jid);
}

export async function handleMessage(sock, msg, logger) {
    if (!msg.message) return;

    // Unwrap viewOnce and other message wrappers for uniform parsing
    msg.message = extractMessageContent(msg.message);
    if (!msg.message) return;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) return;

    if (remoteJid === 'status@broadcast') {
        try {
            const keys = Object.keys(msg.message);
            const hasMedia = keys.includes('imageMessage') || keys.includes('videoMessage');
            if (hasMedia) {
                const { downloadMediaMessage } = await import('baileys');
                const fs = await import('fs');
                const path = await import('path');
                
                const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
                    logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, child: () => ({ info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {} }) },
                    reuploadRequest: sock.updateMediaMessage
                });
                
                const statusesDir = path.join(process.cwd(), 'statuses');
                if (!fs.existsSync(statusesDir)) {
                    fs.mkdirSync(statusesDir, { recursive: true });
                }
                
                const participant = msg.key.participant ? msg.key.participant.split('@')[0] : 'unknown';
                const extension = keys.includes('imageMessage') ? 'jpg' : 'mp4';
                const filename = `status_${participant}_${Date.now()}.${extension}`;
                
                fs.writeFileSync(path.join(statusesDir, filename), buffer);
                console.log(`[Status Saver] Saved status from ${participant} as ${filename}`);
            }
        } catch (err) {
            console.error('[Status Saver Error]', err);
        }
        return; // Jangan lanjutkan pemrosesan perintah untuk status
    }

    const senderJid = normalizeJid(msg.key.participant || remoteJid);
    const senderName = msg.pushName || 'User';

    const botJid = sock.user?.id ? normalizeJid(sock.user.id) : '';
    const normalizedSender = senderJid;
    const normalizedOwner = normalizeJid(settings.ownerNumber);
    const normalizedPairing = normalizeJid(settings.pairingNumber);

    const isBotAdmin = db.data.settings.admins?.map(a => normalizeJid(a)).includes(normalizedSender) || false;
    const isOwner = msg.key.fromMe ||
                    (normalizedOwner && normalizedSender.split('@')[0] === normalizedOwner.split('@')[0]) ||
                    (normalizedPairing && normalizedSender.split('@')[0] === normalizedPairing.split('@')[0]) ||
                    (botJid && normalizedSender.split('@')[0] === botJid.split('@')[0]) ||
                    isBotAdmin;

    // If the message is fromMe, we automatically allow it. Otherwise check.
    if (msg.key.fromMe) {
        // Ensure self-messages are handled properly
    }

    const userProfile = db.getUser(senderJid);
    // Note: getUser() automatically ensures owner & bot admins always have registered+premium flags

    if (userProfile.banned && !isOwner) return;
    if (db.data.settings.selfMode && !isOwner) return;

    let messageContent = msg.message.conversation ||
                         msg.message.extendedTextMessage?.text ||
                         msg.message.imageMessage?.caption ||
                         msg.message.videoMessage?.caption ||
                         msg.message.buttonsResponseMessage?.selectedButtonId ||
                         msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
                         msg.message.templateButtonReplyMessage?.selectedId ||
                         '';

    if (!messageContent && msg.message.interactiveResponseMessage) {
        try {
            const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
            messageContent = params.id || msg.message.interactiveResponseMessage.nativeFlowResponseMessage.id || '';
        } catch (_) {}
    }

    // Anti-link check for groups
    if (remoteJid.endsWith('@g.us') && !isOwner && !msg.key.fromMe) {
        const groupConfig = db.getGroup(remoteJid);
        if (groupConfig && groupConfig.antilink) {
            const hasLink = /https?:\/\/\S+/i.test(messageContent) || /chat\.whatsapp\.com/i.test(messageContent);
            if (hasLink) {
                try {
                    const groupMetadata = await sock.groupMetadata(remoteJid);
                    const participants = groupMetadata.participants || [];
                    const sender = participants.find(p => normalizeJid(p.id) === normalizedSender);
                    const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin';
                    
                    if (!isSenderAdmin) {
                        console.log(`[Anti-Link] Deleting message with link from ${senderJid} in ${remoteJid}`);
                        await sock.sendMessage(remoteJid, { delete: msg.key });
                        
                        // Smart warning system
                        groupConfig.warnings = groupConfig.warnings || {};
                        const currentWarnings = (groupConfig.warnings[senderJid] || 0) + 1;
                        groupConfig.warnings[senderJid] = currentWarnings;
                        db.updateGroup(remoteJid, { warnings: groupConfig.warnings });

                        if (currentWarnings >= 3) {
                            delete groupConfig.warnings[senderJid];
                            db.updateGroup(remoteJid, { warnings: groupConfig.warnings });
                            
                            await sock.groupParticipantsUpdate(remoteJid, [senderJid], 'remove');
                            await sock.sendMessage(remoteJid, {
                                text: `🚫 *[KICKED - ANTILINK]*\n\n@${senderJid.split('@')[0]} telah dikeluarkan dari grup karena mengabaikan peringatan antilink (3/3).`,
                                mentions: [senderJid]
                            });
                        } else {
                            await sock.sendMessage(remoteJid, {
                                text: `⚠️ *[PERINGATAN ANTILINK]*\n\n@${senderJid.split('@')[0]}, dilarang keras membagikan link di grup ini!\n\n• Peringatan: *${currentWarnings}/3*\n• Sanksi: Jika melanggar lagi sampai 3 kali, Anda akan dikeluarkan otomatis oleh sistem.`,
                                mentions: [senderJid]
                            });
                        }
                        return; // Stop message processing
                    }
                } catch (err) {
                    console.error('[Anti-Link Check Error]', err);
                }
            }
        }
    }

    // Antibot check for groups
    if (remoteJid.endsWith('@g.us') && !isOwner && !msg.key.fromMe) {
        const groupConfig = db.getGroup(remoteJid);
        if (groupConfig && groupConfig.antibot) {
            const isBotMsg = msg.key.id.startsWith('BAE5') || msg.key.id.startsWith('3EB0') || (msg.key.id.startsWith('WA') && msg.key.id.length === 12);
            if (isBotMsg) {
                try {
                    const groupMetadata = await sock.groupMetadata(remoteJid);
                    const participants = groupMetadata.participants || [];
                    const sender = participants.find(p => normalizeJid(p.id) === normalizedSender);
                    const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin';
                    
                    if (!isSenderAdmin) {
                        console.log(`[Antibot] Deleting bot message and kicking bot sender ${senderJid} in ${remoteJid}`);
                        await sock.sendMessage(remoteJid, { delete: msg.key });
                        await sock.groupParticipantsUpdate(remoteJid, [senderJid], 'remove');
                        await sock.sendMessage(remoteJid, {
                            text: `🛡️ *[ANTIBOT ACTION]*\n\nBot lain terdeteksi mengirimkan pesan di grup ini!\n\n• Target: @${senderJid.split('@')[0]}\n• Tindakan: Pesan dihapus & pelaku dikeluarkan otomatis.`,
                            mentions: [senderJid]
                        });
                        return; // Stop message processing
                    }
                } catch (err) {
                    console.error('[Antibot Check Error]', err);
                }
            }
        }
    }

    const activePrefix = '.';
    const prefixes = ['.'];

    // Cek apakah pesan diawali dengan salah satu prefix yang terdaftar
    let prefixUsed = null;
    for (const p of prefixes) {
        if (messageContent.startsWith(p)) {
            if (!prefixUsed || p.length > prefixUsed.length) {
                prefixUsed = p;
            }
        }
    }

    if (prefixUsed === null) return;

    const args = messageContent.slice(prefixUsed.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase() || '';

    console.log(`[Incoming Msg] From: ${senderJid}, Content: "${messageContent}", Prefix Used: "${prefixUsed}", fromMe: ${msg.key.fromMe}, isOwner: ${isOwner}`);
    console.log(`[Command Parse] name: "${commandName}", args:`, args);

    if (!commandName) return;

    const cmd = commands.get(commandName);
    if (!cmd) {
        if (prefixUsed !== null) {
            const allCommands = Array.from(commands.keys());
            let closest = null;
            let minDistance = Infinity;

            for (const name of allCommands) {
                let distance = getLevenshteinDistance(commandName, name);
                
                // Berikan bonus prioritas jika memiliki huruf pertama yang sama
                if (name.startsWith(commandName[0])) {
                    distance -= 0.6;
                }
                // Berikan bonus besar jika nama perintah mengandung kata yang diketik
                if (name.includes(commandName)) {
                    distance -= 1.5;
                }

                if (distance < minDistance) {
                    minDistance = distance;
                    closest = name;
                }
            }

            // Batasan threshold agar saran tetap relevan
            const threshold = Math.max(2, Math.floor(commandName.length * 0.5));
            if (closest && minDistance <= threshold) {
                const displayPrefix = prefixUsed || activePrefix || '.';
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ Perintah *${displayPrefix}${commandName}* tidak ditemukan.\n\nMungkin maksud Anda: *${displayPrefix}${closest}* ?`
                }, { quoted: msg });
            }
        }
        return;
    }

    const isRegistered = userProfile.registered || isOwner;
    const isPublicCmd = PUBLIC_COMMANDS.has(commandName);

    if (!isRegistered && !isPublicCmd) {
        const senderNumber = senderJid.split('@')[0];
        const displayPrefix = prefixUsed || activePrefix || '.';
        const registerCmd = `${displayPrefix}register`;

        const promptText =
            `⚠️ *Akses Ditolak*\n\n` +
            `Anda belum terdaftar. Silakan daftar terlebih dahulu untuk menggunakan perintah bot.\n\n` +
            `📝 *Cara Daftar:*\n` +
            `Ketik: *${registerCmd}*\n\n` +
            `_${settings.botName}_`;

        await sock.sendMessage(remoteJid, { text: promptText }, { quoted: msg });
        return;
    }

    if (db.data.settings.maintenance && !isOwner) {
        await sock.sendMessage(remoteJid, { text: '⚠️ *Palantir Bots sedang dalam pemeliharaan (maintenance).*' }, { quoted: msg });
        return;
    }

    if (cmd.ownerOnly && !isOwner) return;
    // Only block if the command itself is marked as premium-only
    if (cmd.premiumOnly && !isOwner && !userProfile.premium) {
        await sock.sendMessage(remoteJid, { text: '👑 *Khusus Premium:* Perintah ini memerlukan status Premium.' }, { quoted: msg });
        return;
    }

    if (!isOwner) {
        const now = Date.now();
        const userCooldown = cooldowns.get(senderJid) || 0;
        
        let cooldownTime = cmd.cooldown || settings.cooldownTime || 3000;
        if (userProfile.premium) {
            cooldownTime = Math.max(1000, Math.floor(cooldownTime / 2)); // Premium gets 50% discount, min 1s
        }

        if (now - userCooldown < cooldownTime) {
            const timeLeft = ((cooldownTime - (now - userCooldown)) / 1000).toFixed(1);
            await sock.sendMessage(remoteJid, { text: `⏳ *Anti-Spam:* Harap tunggu *${timeLeft}s*.` }, { quoted: msg });
            return;
        }
        cooldowns.set(senderJid, now);
    }

    logger.info(`[Command] ${cmd.name} by ${senderName} (${senderJid})`);

    const context = {
        logger,
        senderName,
        senderJid,
        isOwner,
        userProfile,
        activePrefix,
        commandName,
        getTargetJid: (args) => {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentioned && mentioned.length > 0) {
                return normalizeJid(mentioned[0]);
            }
            const quoted = msg.message.extendedTextMessage?.contextInfo?.participant;
            if (quoted) return normalizeJid(quoted);
            if (args && args[0]) {
                const cleaned = args[0].replace(/[^0-9]/g, '');
                if (cleaned.length >= 7) {
                    return cleaned + '@s.whatsapp.net';
                }
            }
            return null;
        },
        sendTyping: async () => {
            try {
                await sock.sendPresenceUpdate('composing', remoteJid);
            } catch (_) {}
        },
        sendUsage: async () => {
            const displayPrefix = prefixUsed || activePrefix || '.';
            const descText = cmd.description ? `📝 *Deskripsi:* ${cmd.description}\n\n` : '';
            const usageText = cmd.usage ? `👉 *Format:* \`${displayPrefix}${commandName} ${cmd.usage}\`\n` : '';
            const exampleText = cmd.example ? `👉 *Contoh:* \`${displayPrefix}${commandName} ${cmd.example}\`` : '';
            
            const promptText = `⚠️ *Cara Penggunaan Perintah ${displayPrefix}${commandName}*\n\n` +
                               descText +
                               usageText +
                               exampleText;
            
            await sock.sendMessage(remoteJid, { text: promptText.trim() }, { quoted: msg });
        }
    };

    db.recordCommand(cmd.name);

    try {
        await cmd.run(sock, msg, args, context);
    } catch (err) {
        logger.error(`[Command Error] ${cmd.name}:`, err);
        try {
            const errorMessage = `❌ *Terjadi kesalahan pada perintah ${cmd.name}:*\n\n` +
                                 `*Pesan:* ${err.message || err}\n\n` +
                                 `*Stack Trace:*\n\`\`\`\n${err.stack || 'Tidak ada stack trace.'}\n\`\`\``;
            await sock.sendMessage(remoteJid, { text: errorMessage }, { quoted: msg });
        } catch (_) {}
    }
}
