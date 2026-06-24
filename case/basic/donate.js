import fs from 'fs';
import { settings } from '@/config/settings.js';

export default {
    name: 'donate',
    description: 'Menampilkan informasi donasi untuk mendukung bot.',
    usage: '',
    example: '',
    aliases: ['donasi', 'sawer'],
    category: 'User',
    run: async (sock, msg, args, { sendTyping }) => {
        await sendTyping();

        const donationText = `💖 *Donasi Kyros-MD*\n\n` +
            `Terima kasih telah menggunakan bot kami! Jika Anda menyukai layanan bot ini dan ingin membantu agar bot tetap aktif online 24 jam, Anda dapat menyisihkan donasi melalui metode berikut:\n\n` +
            `• *Dana:* ${settings.danaNumber}\n` +
            `• *Gopay:* ${settings.gopayNumber}\n` +
            `• *OVO:* ${settings.ovoNumber}\n` +
            `• *Saweria:* ${settings.saweriaUrl}\n\n` +
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
};
