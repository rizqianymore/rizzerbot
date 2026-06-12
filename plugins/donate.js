import fs from 'fs';
import { settings } from '@/config/settings.js';

export default {
    description: 'Menampilkan informasi donasi untuk mendukung bot.',
    usage: '',
    example: '',
    name: 'donate',
    aliases: ['donasi', 'sawer'],
    category: 'User',
    run: async (sock, msg, args, { sendTyping }) => {
        await sendTyping();

        const donationText = `💖 *Donasi PalantirBots* 💖\n\n` +
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
                // Mengirim gambar QRIS beserta caption teks donasi
                await sock.sendMessage(msg.key.remoteJid, {
                    image: { url: qrisPath },
                    caption: donationText
                }, { quoted: msg });
            } else {
                // Jika gambar QRIS tidak ada, kirim berupa teks saja
                await sock.sendMessage(msg.key.remoteJid, {
                    text: donationText
                }, { quoted: msg });
            }
        } catch (err) {
            console.error('Donation command error:', err.message);
            // Fallback mengirim teks saja
            await sock.sendMessage(msg.key.remoteJid, {
                text: donationText
            }, { quoted: msg });
        }
    }
};
