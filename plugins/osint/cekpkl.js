import { fetchJson } from '@/lib/scraping.js';

export default {
    name: 'cekpkl',
    description: 'Memeriksa detail status PKL siswa berdasarkan NIS.',
    usage: '<NIS>',
    example: '539241013',
    aliases: ['pkl', 'cek-pkl'],
    category: 'OSINT',
    premiumOnly: true,
    run: async (sock, msg, args, context) => {
        const { sendTyping, activePrefix, senderName } = context;

        await sendTyping();

        const nis = args[0];
        if (!nis) {
            return sock.sendMessage(msg.key.remoteJid, {
                text: `❌ *Format salah!*\n\nGunakan: \`${activePrefix}cekpkl <NIS>\`\nContoh: \`${activePrefix}cekpkl 539241013\``
            }, { quoted: msg });
        }

        try {
            const response = await fetchJson(`https://cek-pkl.rakarizqi-cv.workers.dev/check?nis=${encodeURIComponent(nis)}`);
            
            if (response.status !== 200) {
                throw new Error(`Gagal menghubungi server (HTTP ${response.status})`);
            }

            const body = response.data;
            if (!body || body.status !== 'success' || !body.data) {
                return sock.sendMessage(msg.key.remoteJid, {
                    text: `❌ *Data tidak ditemukan!*\n\nNIS \`${nis}\` tidak terdaftar atau tidak ditemukan dalam sistem PKL.`
                }, { quoted: msg });
            }

            const data = body.data;

            let replyText = `🔍 *Hasil Pencarian PKL*\n\n` +
                            `• *Nama Peserta Didik:* ${data['NAMA PESERTA DIDIK'] || '-'}\n` +
                            `• *NIS:* \`${data['NIS'] || '-'}\`\n` +
                            `• *NISN:* \`${data['NISN'] || '-'}\`\n` +
                            `• *Jenis Kelamin:* ${data['JK'] || '-'}\n` +
                            `• *Kelas XI:* ${data['Kelas XI'] || '-'}\n` +
                            `• *Kelas XII:* ${data['KELAS XII'] || '-'}\n` +
                            `• *Perusahaan:* ${data['PERUSAHAAN'] || '-'}\n` +
                            `• *Status:* *${data['STATUS'] || '-'}*\n` +
                            `• *Tanggal Mulai PKL:* ${data['TANGGAL MULAI PKL'] || '-'}\n` +
                            `• *Alamat Perusahaan:* ${data['ALAMAT PERUSAHAAN'] || '-'}\n` +
                            `• *Kota Perusahaan:* ${data['KOTA PERUSAHAAN'] || '-'}\n` +
                            `• *Guru Pendamping:* ${data['GURU PENDAMPING'] || '-'}${data['NO HP GURU'] ? ` (+${data['NO HP GURU']})` : ''}\n` +
                            `• *Guru Pembimbing:* ${data['GURU PEMBIMBING'] || '-'}\n\n` +
                            `_Dicari oleh: ${senderName}_`;

            await sock.sendMessage(msg.key.remoteJid, { text: replyText }, { quoted: msg });

        } catch (error) {
            console.error('Error Cek PKL:', error);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ *Terjadi kesalahan!*\n\n${error.message || 'Gagal memproses pengecekan PKL.'}`
            }, { quoted: msg });
        }
    }
};
