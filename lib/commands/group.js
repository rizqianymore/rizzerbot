import { db } from '../database.js';

export const groupCommands = [
    {
        name: 'add',
        category: 'Admin',
        description: 'Menambahkan anggota baru ke dalam grup.',
        usage: '<nomor>',
        example: '628xxx',
        run: async (sock, msg, args, { isOwner, senderJid, sendUsage }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                let targetNumber = args[0]?.replace(/[^0-9]/g, '');
                if (!targetNumber) {
                    await sendUsage();
                    return;
                }
                const target = targetNumber + '@s.whatsapp.net';

                await sock.groupParticipantsUpdate(remoteJid, [target], 'add');
                await sock.sendMessage(remoteJid, { text: `✅ Berhasil menambahkan @${targetNumber}`, mentions: [target] }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal menambahkan anggota. Pastikan nomor valid atau setelan privasi mereka mengizinkan.' }, { quoted: msg });
            }
        }
    },
    {
        name: 'delmember',
        aliases: ['kick'],
        category: 'Admin',
        description: 'Perintah ini digunakan untuk mengeluarkan anggota dari grup.',
        usage: '<@tag/nomor/reply>',
        example: '@user atau 628xxx',
        run: async (sock, msg, args, { isOwner, senderJid, getTargetJid, sendUsage }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const target = getTargetJid(args);
                if (!target) {
                    await sendUsage();
                    return;
                }

                await sock.groupParticipantsUpdate(remoteJid, [target], 'remove');
                await sock.sendMessage(remoteJid, { text: `✅ Berhasil mengeluarkan @${target.split('@')[0]}`, mentions: [target] }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal mengeluarkan anggota.' }, { quoted: msg });
            }
        }
    },
    {
        name: 'promote',
        category: 'Admin',
        description: 'Mempromosikan anggota grup menjadi admin.',
        usage: '<@tag/reply>',
        example: '@user',
        run: async (sock, msg, args, { isOwner, senderJid, getTargetJid, sendUsage }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const target = getTargetJid(args);
                if (!target) {
                    await sendUsage();
                    return;
                }

                await sock.groupParticipantsUpdate(remoteJid, [target], 'promote');
                await sock.sendMessage(remoteJid, { text: `👑 @${target.split('@')[0]} sekarang adalah Admin Grup.`, mentions: [target] }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal mempromosikan anggota.' }, { quoted: msg });
            }
        }
    },
    {
        name: 'demote',
        category: 'Admin',
        description: 'Menurunkan jabatan admin grup kembali menjadi anggota biasa.',
        usage: '<@tag/reply>',
        example: '@user',
        run: async (sock, msg, args, { isOwner, senderJid, getTargetJid, sendUsage }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const target = getTargetJid(args);
                if (!target) {
                    await sendUsage();
                    return;
                }

                await sock.groupParticipantsUpdate(remoteJid, [target], 'demote');
                await sock.sendMessage(remoteJid, { text: `💔 Jabatan admin @${target.split('@')[0]} berhasil dicabut.`, mentions: [target] }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal menurunkan jabatan admin.' }, { quoted: msg });
            }
        }
    },
    {
        name: 'group',
        description: 'Membuka atau menutup gerbang chat grup.',
        usage: '<open/close>',
        example: 'open',
        aliases: ['grup'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const option = args[0]?.toLowerCase();
                if (option === 'open' || option === 'buka') {
                    await sock.groupSettingUpdate(remoteJid, 'not_announcement');
                    await sock.sendMessage(remoteJid, { text: '🔓 Setelan grup berhasil diubah: *Semua anggota sekarang dapat mengirim pesan!*' }, { quoted: msg });
                } else if (option === 'close' || option === 'tutup') {
                    await sock.groupSettingUpdate(remoteJid, 'announcement');
                    await sock.sendMessage(remoteJid, { text: '🔒 Setelan grup berhasil diubah: *Hanya admin yang dapat mengirim pesan!*' }, { quoted: msg });
                } else {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Penggunaan: *.group open* / *.group close*' }, { quoted: msg });
                }
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal mengubah setelan grup.' }, { quoted: msg });
            }
        }
    },
    {
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
    },
    {
        name: 'linkgc',
        description: 'Mengambil tautan undangan grup WhatsApp.',
        usage: '',
        example: '',
        aliases: ['gclink', 'grouplink'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const code = await sock.groupInviteCode(remoteJid);
                await sock.sendMessage(remoteJid, { text: `🔗 *Link Undangan Grup:*\nhttps://chat.whatsapp.com/${code}` }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: `❌ Gagal mengambil link grup: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'revoke',
        description: 'Mereset atau menarik kembali tautan undangan grup.',
        usage: '',
        example: '',
        aliases: ['resetlink', 'resetgclink'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                const code = await sock.groupRevokeInvite(remoteJid);
                await sock.sendMessage(remoteJid, { text: `🔄 Link undangan grup berhasil di-reset.\n\n*Link Baru:*\nhttps://chat.whatsapp.com/${code}` }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: `❌ Gagal me-reset link grup: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'setname',
        description: 'Mengubah nama judul grup.',
        usage: '<nama baru>',
        example: 'Grup Keren',
        aliases: ['setgcupname', 'setgroupname'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            const newName = args.join(' ');
            if (!newName) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Harap masukkan nama grup yang baru!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                await sock.groupUpdateSubject(remoteJid, newName);
                await sock.sendMessage(remoteJid, { text: `✅ Nama grup berhasil diubah menjadi: *${newName}*` }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: `❌ Gagal mengubah nama grup: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'setdesc',
        description: 'Mengubah deskripsi grup.',
        usage: '<deskripsi baru>',
        example: 'Aturan grup',
        aliases: ['setgroupdesc'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            const newDesc = args.join(' ');
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const botJid = sock.user.id.replace(/:.*@/, '@');
                const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                if (!isBotAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                    return;
                }

                await sock.groupUpdateDescription(remoteJid, newDesc);
                await sock.sendMessage(remoteJid, { text: '✅ Deskripsi grup berhasil diubah!' }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: `❌ Gagal mengubah deskripsi grup: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'tagall',
        description: 'Mentag seluruh anggota grup secara terbuka.',
        usage: '<teks>',
        example: 'Ada apa',
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const messageText = args.join(' ') || 'Halo semua!';
                let tagText = `📢 *Tag All*\n\n*Pesan:* ${messageText}\n\n`;
                const targetJids = participants.map(p => p.id);
                targetJids.forEach((jid, idx) => {
                    tagText += `${idx + 1}. @${jid.split('@')[0]}\n`;
                });

                await sock.sendMessage(remoteJid, { text: tagText, mentions: targetJids }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal melakukan tagall.' }, { quoted: msg });
            }
        }
    },
    {
        name: 'hidetag',
        description: 'Mentag seluruh anggota grup secara senyap.',
        usage: '<teks>',
        example: 'Pengumuman',
        aliases: ['ht'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }

                const targetJids = participants.map(p => p.id);
                const text = args.join(' ') || '';
                await sock.sendMessage(remoteJid, { text, mentions: targetJids });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal mengirim hidetag.' }, { quoted: msg });
            }
        }
    },
    {
        name: 'antilink',
        description: 'Mengaktifkan atau menonaktifkan fitur anti-link grup.',
        usage: '<on/off>',
        example: 'on',
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }

            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal memeriksa metadata grup.' }, { quoted: msg });
                return;
            }

            const option = args[0]?.toLowerCase();
            if (option === 'on' || option === '1' || option === 'aktif') {
                db.updateGroup(remoteJid, { antilink: true });
                await sock.sendMessage(remoteJid, { text: '✅ *Anti-Link diaktifkan!* Semua pesan berisi tautan/link dari non-admin akan dihapus otomatis.' }, { quoted: msg });
            } else if (option === 'off' || option === '0' || option === 'nonaktif') {
                db.updateGroup(remoteJid, { antilink: false });
                await sock.sendMessage(remoteJid, { text: '🚫 *Anti-Link dinonaktifkan!*' }, { quoted: msg });
            } else {
                const groupConfig = db.getGroup(remoteJid);
                await sock.sendMessage(remoteJid, { text: `⚠️ Penggunaan: *.antilink on/off*\nStatus saat ini: *${groupConfig.antilink ? 'AKTIF' : 'NONAKTIF'}*` }, { quoted: msg });
            }
        }
    },
    {
        name: 'antibot',
        description: 'Mengaktifkan atau menonaktifkan fitur anti-bot spammer.',
        usage: '<on/off>',
        example: 'on',
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }

            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal memeriksa metadata grup.' }, { quoted: msg });
                return;
            }

            const option = args[0]?.toLowerCase();
            if (option === 'on' || option === '1' || option === 'aktif') {
                db.updateGroup(remoteJid, { antibot: true });
                await sock.sendMessage(remoteJid, { text: '✅ *Anti-Bot diaktifkan!* Bot lain yang mengirim pesan akan dikeluarkan otomatis.' }, { quoted: msg });
            } else if (option === 'off' || option === '0' || option === 'nonaktif') {
                db.updateGroup(remoteJid, { antibot: false });
                await sock.sendMessage(remoteJid, { text: '🚫 *Anti-Bot dinonaktifkan!*' }, { quoted: msg });
            } else {
                const groupConfig = db.getGroup(remoteJid);
                await sock.sendMessage(remoteJid, { text: `⚠️ Penggunaan: *.antibot on/off*\nStatus saat ini: *${groupConfig.antibot ? 'AKTIF' : 'NONAKTIF'}*` }, { quoted: msg });
            }
        }
    },
    {
        name: 'jagagrup',
        description: 'Mengaktifkan penjaga grup dari demote admin ilegal.',
        usage: '<on/off>',
        example: 'on',
        aliases: ['guard', 'protect'],
        category: 'Admin',
        run: async (sock, msg, args, { isOwner, senderJid }) => {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
                return;
            }

            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
                const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

                if (!isSenderAdmin) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                    return;
                }
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ Gagal memeriksa metadata grup.' }, { quoted: msg });
                return;
            }

            const option = args[0]?.toLowerCase();
            if (option === 'on' || option === 'aktif' || option === '1') {
                db.updateGroup(remoteJid, { guard: true });
                await sock.sendMessage(remoteJid, { text: '✅ *Penjaga Grup (Group Guard) AKTIF!*\nBot akan otomatis melindungi posisi Admin Owner dari demote tidak sah.' }, { quoted: msg });
            } else if (option === 'off' || option === 'nonaktif' || option === '0') {
                db.updateGroup(remoteJid, { guard: false });
                await sock.sendMessage(remoteJid, { text: '🚫 *Penjaga Grup (Group Guard) NONAKTIF!*' }, { quoted: msg });
            } else {
                const groupConfig = db.getGroup(remoteJid);
                await sock.sendMessage(remoteJid, { text: `⚠️ Penggunaan: *.jagagrup on/off*\nStatus saat ini: *${groupConfig.guard ? 'AKTIF' : 'NONAKTIF'}*` }, { quoted: msg });
            }
        }
    }
];
