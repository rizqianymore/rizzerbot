export default {
    premiumOnly: true,
    description: 'Memeriksa detail informasi kepemilikan nomor WhatsApp.',
    usage: '<nomor>',
    example: '628xxx',
    name: 'numberlookup',
    aliases: ['lookup', 'checknum'],
    category: 'User',
    ownerOnly: false,
    run: async (sock, msg, args, context) => {
        const { sendTyping, getTargetJid, senderJid } = context;
        await sendTyping();
        
        let targetJid = getTargetJid(args);
        if (!targetJid) {
            let target = args[0];
            if (!target) {
                targetJid = senderJid;
            } else {
                let cleanNum = target.replace(/[^0-9]/g, '');
                if (cleanNum.startsWith('0')) {
                    cleanNum = '62' + cleanNum.slice(1);
                }
                targetJid = cleanNum + '@s.whatsapp.net';
            }
        }
        
        let cleanNum = targetJid.split('@')[0];
        
        try {
            
            let resolvedJid = targetJid;
            let exists = false;

            if (targetJid === senderJid || targetJid === msg.key.remoteJid) {
                exists = true;
            } else {
                const onWa = await sock.onWhatsApp(targetJid);
                if (onWa && onWa.length > 0 && onWa[0].exists) {
                    exists = true;
                    resolvedJid = onWa[0].jid;
                }
            }

            if (!exists) {
                await sock.sendMessage(msg.key.remoteJid, { 
                    text: `❌ Nomor *+${cleanNum}* tidak terdaftar di WhatsApp.` 
                }, { quoted: msg });
                return;
            }
            
            
            let bio = '-';
            let bioTime = '-';
            try {
                const statusInfo = await sock.fetchStatus(resolvedJid);
                if (statusInfo) {
                    bio = statusInfo.status || '-';
                    if (statusInfo.setAt) {
                        bioTime = new Date(statusInfo.setAt).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    }
                }
            } catch (_) {
                bio = '(Privasi / Tidak diatur)';
            }
            
            
            let isBusiness = false;
            let bizInfo = '';
            try {
                const bizProfile = await sock.getBusinessProfile(resolvedJid);
                if (bizProfile) {
                    isBusiness = true;
                    bizInfo = `\n💼 *Profil Bisnis:*\n` +
                              `  • *Kategori:* ${bizProfile.category || '-'}\n` +
                              `  • *Deskripsi:* ${bizProfile.description || '-'}\n` +
                              `  • *Alamat:* ${bizProfile.address || '-'}\n` +
                              `  • *Email:* ${bizProfile.email || '-'}\n` +
                              `  • *Web:* ${bizProfile.website?.join(', ') || '-'}`;
                }
            } catch (_) {
                
            }
            
            
            let pfpUrl = null;
            try {
                pfpUrl = await sock.profilePictureUrl(resolvedJid, 'image');
            } catch (_) {
                
            }
            
            
            let infoText = `📞 *Informasi Nomor WhatsApp*\n\n` +
                           `• *Nomor:* +${cleanNum}\n` +
                           `• *JID:* \`${resolvedJid}\`\n` +
                           `• *Tipe Akun:* ${isBusiness ? 'Akun Bisnis' : 'Akun Personal'}\n` +
                           `• *Bio/Status:* ${bio}\n` +
                           `• *Diperbarui:* ${bioTime}` +
                           `${bizInfo}`;
                           
            if (pfpUrl) {
                await sock.sendMessage(msg.key.remoteJid, { 
                    image: { url: pfpUrl },
                    caption: infoText
                }, { quoted: msg });
            } else {
                await sock.sendMessage(msg.key.remoteJid, { 
                    text: infoText 
                }, { quoted: msg });
            }
            
        } catch (err) {
            console.error('Number Lookup Error:', err);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: `❌ Gagal memproses pencarian nomor: ${err.message}` 
            }, { quoted: msg });
        }
    }
};
