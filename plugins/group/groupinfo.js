export default {
    name: 'groupinfo',
    category: 'Admin',
    description: 'Menampilkan informasi lengkap mengenai grup saat ini.',
    usage: '',
    example: '',
    run: async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
            return;
        }
        try {
            const metadata = await sock.groupMetadata(remoteJid);
            const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            const owner = metadata.owner || metadata.participants.find(p => p.admin === 'superadmin')?.id || 'Tidak diketahui';
            
            const info = `📝 *INFORMASI GRUP:*\n\n` +
                `• *Nama Grup:* ${metadata.subject}\n` +
                `• *ID Grup:* \`${metadata.id}\`\n` +
                `• *Pembuat/Owner:* @${owner.split('@')[0]}\n` +
                `• *Dibuat Pada:* ${new Date(metadata.creation * 1000).toLocaleString('id-ID')}\n` +
                `• *Total Anggota:* ${metadata.participants.length}\n` +
                `• *Total Admin:* ${admins.length}\n` +
                `• *Deskripsi:* \n${metadata.desc || 'Tidak ada deskripsi.'}`;
                
            await sock.sendMessage(remoteJid, { text: info, mentions: [owner] }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(remoteJid, { text: `❌ Gagal mengambil informasi grup: ${err.message}` }, { quoted: msg });
        }
    }
};
