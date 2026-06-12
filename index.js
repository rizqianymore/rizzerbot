import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} from 'baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode-terminal';
import { handleMessage } from '@/lib/handler.js';
import { loadPlugins } from '@/lib/plugins.js';
import { settings } from '@/config/settings.js';
import { db } from '@/lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss'
        }
    }
});

let isPluginsLoaded = false;
export const runningBots = new Map();

// Helper to remove directory recursively for delbot
function deleteFolderRecursive(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(dirPath);
    }
}

// Helper to register group guard protection
function registerGroupGuard(sock) {
    sock.ev.on('group-participants.update', async (anu) => {
        try {
            const groupConfig = db.getGroup(anu.id);
            if (!groupConfig || !groupConfig.guard) return;

            const botJid = sock.user?.id ? sock.user.id.replace(/:.*@/, '@') : '';

            if (anu.action === 'demote') {
                for (const participant of anu.participants) {
                    const normalizedParticipant = participant.replace(/:.*@/, '@');
                    const isUserPrivileged = db.isPrivilegedJid(normalizedParticipant);
                    
                    if (isUserPrivileged) {
                        // Promote them back
                        await sock.groupParticipantsUpdate(anu.id, [participant], 'promote');
                        
                        // Demote the demoter (if not the bot itself)
                        if (anu.author && anu.author.replace(/:.*@/, '@') !== botJid) {
                            await sock.groupParticipantsUpdate(anu.id, [anu.author], 'demote').catch(() => {});
                        }

                        // Send alert
                        await sock.sendMessage(anu.id, {
                            text: `🛡️ *[GROUP GUARD ALERT]* 🛡️\n\n` +
                                  `Percobaan demote Admin/Owner oleh @${anu.author.split('@')[0]} telah digagalkan.\n` +
                                  `• Target: @${normalizedParticipant.split('@')[0]}\n` +
                                  `• Sanksi: Pelaku di-demote otomatis oleh sistem.`,
                            mentions: [anu.author, participant]
                        });
                    }
                }
            }
        } catch (err) {
            console.error('[Group Guard Error]', err);
        }
    });
}

export async function addSecondaryBot(phoneNumber) {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanNumber) throw new Error('Nomor telepon tidak valid!');
    
    const authDirName = `session_${cleanNumber}`;
    logger.info(`Starting secondary bot for: ${cleanNumber}`);
    const code = await startSecondaryBot(authDirName, cleanNumber);
    return code;
}

export async function stopSecondaryBot(phoneNumber) {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const authDirName = `session_${cleanNumber}`;
    const sock = runningBots.get(authDirName);
    
    if (sock) {
        try {
            sock.logout();
        } catch (_) {}
        try {
            sock.end();
        } catch (_) {}
        runningBots.delete(authDirName);
    }
    
    const authDir = path.join(__dirname, 'assets', 'sessions', authDirName);
    deleteFolderRecursive(authDir);
    logger.info(`Stopped and deleted secondary bot session for: ${cleanNumber}`);
}

async function startSecondaryBot(authDirName, phoneNumber) {
    const sessionsDir = path.join(__dirname, 'assets', 'sessions');
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }
    
    const authDir = path.join(sessionsDir, authDirName);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: settings.autoOnline
    });

    sock.ev.on('creds.update', saveCreds);
    registerGroupGuard(sock);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            logger.warn(`Secondary bot ${phoneNumber} connection closed. Reconnecting: ${shouldReconnect}`);

            if (shouldReconnect) {
                setTimeout(() => {
                    startSecondaryBot(authDirName, phoneNumber);
                }, 5000);
            } else {
                runningBots.delete(authDirName);
                logger.info(`Secondary bot session ${phoneNumber} logged out and stopped.`);
            }
        } else if (connection === 'open') {
            logger.info(`Secondary bot ${phoneNumber} successfully connected and online!`);
            runningBots.set(authDirName, sock);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                if (!msg.key || !msg.key.remoteJid || !msg.key.id) continue;
                if (settings.autoRead) {
                    await sock.readMessages([msg.key]).catch(() => {});
                }
                await handleMessage(sock, msg, logger);
            } catch (err) {
                logger.error(`Error in secondary bot message handler (${phoneNumber}):`, err);
            }
        }
    });

    if (!sock.authState.creds.registered) {
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                try {
                    logger.info(`Requesting pairing code for secondary bot ${phoneNumber}...`);
                    const code = await sock.requestPairingCode(phoneNumber);
                    runningBots.set(authDirName, sock);
                    resolve(code);
                } catch (err) {
                    reject(err);
                }
            }, 3000);
        });
    } else {
        runningBots.set(authDirName, sock);
        return null;
    }
}

function cleanSessionCache() {
    try {
        const pathsToClean = [
            path.join(__dirname, 'assets', 'sessions', 'primary_bot'),
            path.join(__dirname, 'assets', 'sessions')
        ];

        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        let deletedCount = 0;

        for (const basePath of pathsToClean) {
            if (!fs.existsSync(basePath)) continue;

            const items = fs.readdirSync(basePath);
            for (const item of items) {
                const itemPath = path.join(basePath, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory() && item.startsWith('session_')) {
                    const subFiles = fs.readdirSync(itemPath);
                    for (const subFile of subFiles) {
                        if (subFile.startsWith('pre-key-') && subFile.endsWith('.json')) {
                            const filePath = path.join(itemPath, subFile);
                            const fileStat = fs.statSync(filePath);
                            if (now - fileStat.mtimeMs > maxAge) {
                                fs.unlinkSync(filePath);
                                deletedCount++;
                            }
                        }
                    }
                } else if (item.startsWith('pre-key-') && item.endsWith('.json')) {
                    if (now - stat.mtimeMs > maxAge) {
                        fs.unlinkSync(itemPath);
                        deletedCount++;
                    }
                }
            }
        }
        if (deletedCount > 0) {
            logger.info(`Auto-clean session cache: Deleted ${deletedCount} old pre-key files.`);
        }
    } catch (err) {
        logger.error('Error during auto-clean session cache task:', err.message);
    }
}

async function startBot() {
    if (!isPluginsLoaded) {
        await loadPlugins();
        isPluginsLoaded = true;
        db.ensurePrivilegedUsers();
    }

    // Start session cache cleaner (runs on boot and every 6 hours)
    cleanSessionCache();
    setInterval(cleanSessionCache, 6 * 60 * 60 * 1000);

    // 1. Connect primary bot
    const authDir = path.join(__dirname, 'assets', 'sessions', 'primary_bot');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    logger.info('Initializing primary Rizzerbot connection...');

    const usePairingCode = settings.usePairingCode;

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !usePairingCode,
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: settings.autoOnline
    });

    sock.ev.on('creds.update', saveCreds);
    registerGroupGuard(sock);

    if (usePairingCode && !sock.authState.creds.registered) {
        const phoneNumber = settings.pairingNumber?.replace(/[^0-9]/g, '');
        if (!phoneNumber) {
            logger.error('Pairing phone number is missing or invalid in settings.js!');
        } else {
            setTimeout(async () => {
                try {
                    logger.info(`Requesting pairing code for primary bot: ${phoneNumber}...`);
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(`\n\x1b[36m====================================\x1b[0m`);
                    console.log(`🔑 \x1b[1m\x1b[32mYOUR WHATSAPP PAIRING CODE:\x1b[0m \x1b[1m\x1b[4m\x1b[33m${code}\x1b[0m 🔑`);
                    console.log(`\x1b[36m====================================\x1b[0m\n`);
                } catch (err) {
                    logger.error('Failed to request pairing code:', err);
                }
            }, 3000);
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !usePairingCode) {
            logger.info('New QR Code generated. Scan the code below to pair your WhatsApp account:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            logger.warn(`Primary connection closed. Reason: ${lastDisconnect?.error?.message || 'Unknown'}. Reconnecting: ${shouldReconnect}`);

            if (shouldReconnect) {
                logger.info('Attempting to reconnect primary in 5 seconds...');
                setTimeout(() => {
                    startBot();
                }, 5000);
            } else {
                logger.error('Log out detected. Please delete the auth_info folder to generate a new QR code / pairing code.');
            }
        } else if (connection === 'open') {
            logger.info('Primary Rizzerbot successfully connected and is now online!');
            
            let targetJid = settings.watchdogNumber || settings.ownerNumber;
            if (targetJid) {
                if (!targetJid.includes('@')) {
                    targetJid += '@s.whatsapp.net';
                }
                const bannerPath = path.join(__dirname, 'assets', 'menu_banner.png');
                let thumbnailBuffer = null;
                if (fs.existsSync(bannerPath)) {
                    thumbnailBuffer = fs.readFileSync(bannerPath);
                }

                sock.sendMessage(targetJid, { 
                    text: `🤖 *${settings.botName}* is now *Online* and active!\n\nKetik *.help* untuk melihat daftar menu.`,
                    linkPreview: {
                        title: `${settings.botName} — Active`,
                        body: 'WhatsApp bot is now online and active.',
                        thumbnail: thumbnailBuffer,
                        sourceUrl: 'https://whatsapp.com'
                    }
                }).catch(err => {
                    logger.error('Failed to send startup notification to watchdog:', err);
                });
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                if (!msg.key || !msg.key.remoteJid || !msg.key.id) continue;

                if (settings.autoRead) {
                    await sock.readMessages([msg.key]).catch(() => {});
                }
                await handleMessage(sock, msg, logger);
            } catch (err) {
                logger.error('Error in primary message handler middleware:', err);
            }
        }
    });

    // 2. Scan and load secondary bots from filesystem
    const sessionsParentDir = path.join(__dirname, 'assets', 'sessions');
    if (fs.existsSync(sessionsParentDir)) {
        const folders = fs.readdirSync(sessionsParentDir);
        for (const folder of folders) {
            const match = folder.match(/^session_([0-9]+)$/);
            if (match) {
                const secNumber = match[1];
                logger.info(`Restoring secondary bot session for number: ${secNumber}...`);
                startSecondaryBot(folder, secNumber).catch(err => {
                    logger.error(`Failed to restore secondary session ${secNumber}:`, err);
                });
            }
        }
    }
}

startBot().catch(err => {
    logger.error('Fatal initialization error:', err);
});

export default startBot;
