import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '@/lib/database.js';
import { settings } from '@/config/settings.js';
import { getUptimeString } from '@/lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'help',
    description: 'Menampilkan daftar menu utama bot.',
    usage: '',
    example: '',
    aliases: ['menu'],
    category: 'User',
    run: async (sock, msg, args, { sendTyping }) => {
        await sendTyping();
        const activePrefix = db.data.settings.prefix || settings.prefix;
        const userCount = Object.keys(db.data.users).filter(k => db.data.users[k].registered).length;
        const totalHits = db.data.stats.totalCommands || 0;

        const bodyText = `🤖 *Halo, ${msg.pushName || 'User'}!*\nSelamat datang di *${settings.botName}*.\n\n` +
            `📊 *Statistik Bot:*\n` +
            `• *Uptime:* ${getUptimeString()}\n` +
            `• *Pengguna:* ${userCount} terdaftar\n` +
            `• *Total Hits:* ${totalHits} kali dipanggil\n\n` +
            `Silakan klik tombol di bawah untuk melihat menu utama atau pintasan cepat.`;

        const buttons = [
            {
                name: "single_select",
                buttonParamsJson: JSON.stringify({
                    title: "📂 Buka Menu",
                    sections: [
                        {
                            title: "Navigasi Menu Utama",
                            rows: [
                                {
                                    header: "User Menu",
                                    title: "Daftar Perintah Umum",
                                    description: "Melihat menu commands umum/basic user.",
                                    id: `${activePrefix}usermenu`
                                },
                                {
                                    header: "Premium Menu",
                                    title: "Fitur Premium & Downloader",
                                    description: "Akses AI, downloader media, push kontak, dsb.",
                                    id: `${activePrefix}premiummenu`
                                },
                                {
                                    header: "Owner Menu",
                                    title: "Panel Kontrol Owner/Admin",
                                    description: "Manajemen database, self/public, maintenance, dsb.",
                                    id: `${activePrefix}ownermenu`
                                },
                                {
                                    header: "Plugins Menu",
                                    title: "Plugin Eksternal",
                                    description: "Melihat perintah dari modul plugin dinamis.",
                                    id: `${activePrefix}plugins`
                                }
                            ]
                        }
                    ]
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "⚡ Ping",
                    id: `${activePrefix}ping`
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "💖 Donasi",
                    id: `${activePrefix}donate`
                })
            }
        ];

        const interactiveMessage = {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        header: {
                            title: `*${settings.botName}*`,
                            hasMediaAttachment: false
                        },
                        body: {
                            text: bodyText
                        },
                        footer: {
                            text: `Kyros-MD • Owner: ${settings.ownerName}`
                        },
                        nativeFlowMessage: {
                            buttons: buttons
                        }
                    }
                }
            }
        };

        await sock.sendMessage(msg.key.remoteJid, interactiveMessage, { quoted: msg });
    }
};
