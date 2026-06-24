import axios from 'axios';

export default {
    premiumOnly: false,
    description: 'Cek data sekolah berdasarkan NPSN (Kemendikdasmen).',
    usage: '<npsn>',
    example: '20104462',
    name: 'cek-npsn',
    aliases: ['npsn', 'sekolah'],
    category: 'Education',
    ownerOnly: false,
    run: async (sock, msg, args, context) => {
        const { sendTyping } = context;
        await sendTyping();

        const npsn = args[0]?.replace(/[^0-9]/g, '');
        if (!npsn || npsn.length < 6) {
            return sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Format salah! Gunakan: *!cek-npsn <nomor_npsn>*\nContoh: !cek-npsn 20104462'
            }, { quoted: msg });
        }

        try {
            const response = await axios.post(
                'https://sekolah.data.kemendikdasmen.go.id/v1/sekolah-service/sekolah/cari-sekolah',
                {
                    page: 0,
                    size: 1,
                    keyword: npsn,
                    kabupaten_kota: '',
                    bentuk_pendidikan: '',
                    status_sekolah: ''
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Origin': 'https://sekolah.data.kemendikdasmen.go.id',
                        'Referer': 'https://sekolah.data.kemendikdasmen.go.id/sekolah',
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/149.0.0.0 Mobile Safari/537.36'
                    },
                    timeout: 10000
                }
            );

            const result = response.data;
            if (!result.data || result.data.length === 0) {
                return sock.sendMessage(msg.key.remoteJid, {
                    text: `❌ NPSN *${npsn}* tidak ditemukan di database Kemendikdasmen.`
                }, { quoted: msg });
            }

            const s = result.data[0];
            const caption = `🏫 *Data Sekolah (NPSN: ${s.npsn})*\n\n` +
                `• *Nama:* ${s.nama}\n` +
                `• *Jenjang:* ${s.bentuk_pendidikan}\n` +
                `• *Status:* ${s.status_sekolah}\n` +
                `• *Akreditasi:* ${s.akreditasi || '-'}\n` +
                `• *Alamat:* ${s.alamat_jalan}, ${s.nama_dusun || ''}\n` +
                `• *RT/RW:* ${s.rt}/${s.rw}\n` +
                `• *Kecamatan:* ${s.kecamatan}\n` +
                `• *Kab/Kota:* ${s.kabupaten}\n` +
                `• *Provinsi:* ${s.provinsi}\n` +
                `• *Kode Pos:* ${s.kode_pos}\n` +
                `• *Koordinat:* ${s.lintang}, ${s.bujur}`;

            // Kirim foto sekolah jika tersedia, fallback ke teks
            if (s.path_file) {
                await sock.sendMessage(msg.key.remoteJid, {
                    image: { url: s.path_file },
                    caption
                }, { quoted: msg });
            } else {
                await sock.sendMessage(msg.key.remoteJid, { text: caption }, { quoted: msg });
            }

        } catch (err) {
            console.error('Cek NPSN Error:', err.message);
            let errMsg = '❌ Gagal mengambil data sekolah.';
            if (err.response?.status === 429) errMsg = '⚠️ Rate limit tercapai. Coba lagi dalam 1 menit.';
            else if (err.code === 'ECONNABORTED') errMsg = '⚠️ Request timeout. Server Kemendikdasmen sedang lambat.';
            
            await sock.sendMessage(msg.key.remoteJid, { text: errMsg }, { quoted: msg });
        }
    }
};