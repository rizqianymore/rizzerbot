import { fetchJson } from '@/lib/scraping.js';

export default {
    description: 'Cek data wilayah dari NIK.',
    usage: '<NIK>',
    example: '3275012345678901',
    name: 'nik',
    aliases: ['cek-nik', 'ktp'],
    category: 'Tools',
    ownerOnly: false,
    premiumOnly: true,
    run: async (sock, msg, args, context) => {
        const {
            sendTyping,
            senderName,
            senderJid,
            activePrefix
        } = context;

        await sendTyping();

        const nik = args[0];

        if (!nik) {
            return sock.sendMessage(msg.key.remoteJid, {
                text: `❌ *Format salah!*\n\nGunakan: \`${activePrefix}nik <nomor_nik>\`\nContoh: \`${activePrefix}nik 3275012345678901\``
            }, { quoted: msg });
        }

        if (nik.length !== 16 || !/^\d+$/.test(nik)) {
            return sock.sendMessage(msg.key.remoteJid, {
                text: `❌ *NIK tidak valid!*\n\nNIK harus 16 digit angka.`
            }, { quoted: msg });
        }

        try {
            
            const provCode = nik.substring(0, 2);
            const regCode = `${provCode}.${nik.substring(2, 4)}`;
            const distCode = `${regCode}.${nik.substring(4, 6)}`;

            
            const districtRes = await fetchJson(`https://wilayah.id/api/districts/${regCode}.json`);

            if (districtRes.status !== 200) {
                throw new Error('Kode wilayah tidak ditemukan');
            }

            const districtData = districtRes.data;
            const district = districtData.data.find(d => d.code === distCode);

            if (!district) {
                throw new Error('Data wilayah tidak ditemukan');
            }

            
            const regencyRes = await fetchJson(`https://wilayah.id/api/regencies/${provCode}.json`);
            if (regencyRes.status !== 200) {
                throw new Error('Kode kabupaten tidak ditemukan');
            }
            const regencyData = regencyRes.data;
            const regency = regencyData.data.find(r => r.code === regCode);

            
            const provinceRes = await fetchJson('https://wilayah.id/api/provinces.json');
            if (provinceRes.status !== 200) {
                throw new Error('Kode provinsi tidak ditemukan');
            }
            const provinceData = provinceRes.data;
            const province = provinceData.data.find(p => p.code === provCode);

            
            const birthInfo = parseBirthDate(nik.substring(6, 12));

            
            let replyText = `📋 *Hasil Pencarian NIK*\n\n`;
            replyText += `• *NIK:* \`${nik}\`\n`;
            replyText += `• *Provinsi:* ${province?.name || '-'}\n`;
            replyText += `• *Kabupaten/Kota:* ${regency?.name || '-'}\n`;
            replyText += `• *Kecamatan:* ${district.name}\n`;
            replyText += `• *Tanggal Lahir:* ${birthInfo.date}\n`;
            replyText += `• *Jenis Kelamin:* ${birthInfo.gender}\n`;
            replyText += `• *No. Registrasi:* ${nik.substring(12, 16)}\n\n`;
            replyText += `_Dicari oleh: ${senderName}_`;

            await sock.sendMessage(msg.key.remoteJid, {
                text: replyText
            }, { quoted: msg });

        } catch (error) {
            console.error('Error NIK lookup:', error);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ *Terjadi kesalahan!*\n\n${error.message || 'Gagal mengambil data NIK.'}`
            }, { quoted: msg });
        }
    }
};


function parseBirthDate(tgl) {
    const day = parseInt(tgl.substring(0, 2));
    let month = parseInt(tgl.substring(2, 4));
    const year = parseInt(tgl.substring(4, 6));

    let gender = 'Laki-laki';
    if (month > 40) {
        month -= 40;
        gender = 'Perempuan';
    }

    const fullYear = year >= 70 ? 1900 + year : 2000 + year;

    return {
        date: `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${fullYear}`,
        gender
    };
}