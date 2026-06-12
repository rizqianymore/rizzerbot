import { settings } from '@/config/settings.js';

const activeBroadcasts = new Map();

export default {
    description: 'Mengirimkan PM beruntun aman (anti-banned delay) ke semua anggota grup.',
    usage: '<teks>',
    example: 'Halo kak',
    name: 'pushkontak',
    aliases: ['pushcontact', 'pcgc'],
    category: 'Premium',
    premiumOnly: true,
    run: async (sock, msg, args, context) => {
        const { sendTyping, activePrefix } = context;
        const botJid = (sock.user?.id || '').replace(/:.*@/, '@');
        
        if (activeBroadcasts.has(botJid)) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Perangkat ini sedang menjalankan tugas broadcast/push kontak lainnya. Harap tunggu!' }, { quoted: msg });
            return;
        }

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini harus dijalankan di dalam grup target!' }, { quoted: msg });
            return;
        }

        const text = args.join(' ');
        if (!text) {
            const guideText = `👥 *Push Kontak System*\n\n` +
                              `Mengirimkan pesan pribadi secara beruntun ke seluruh anggota grup target.\n\n` +
                              `• *Format:* \`${activePrefix}pushkontak [pesan promosi/salam]\``;
            await sock.sendMessage(remoteJid, { text: guideText }, { quoted: msg });
            return;
        }

        await sendTyping();
        await sock.sendMessage(remoteJid, { text: '⏳ Memulai proses push kontak dengan konfigurasi anti-ban (delay acak + jeda kelompok sedang aktif)...' }, { quoted: msg });

        activeBroadcasts.set(botJid, true);

        try {
            const groupMetadata = await sock.groupMetadata(remoteJid);
            const participants = groupMetadata.participants || [];

            // Filter agar tidak mengirim ke diri sendiri (bot)
            const targets = participants
                .map(p => p.id)
                .filter(jid => jid.replace(/:.*@/, '@') !== botJid);

            if (targets.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Tidak ada anggota grup target lainnya.' }, { quoted: msg });
                return;
            }

            let success = 0;
            let batchCounter = 0;

            for (const targetJid of targets) {
                if (!activeBroadcasts.has(botJid)) break; // Cancelled if deleted

                try {
                    await sock.sendMessage(targetJid, { text: text });
                    success++;
                    batchCounter++;

                    // 1. Jeda Kelompok (Batch Break): Setiap 10 pesan terkirim, beri jeda lebih lama (12 detik) untuk mensimulasikan jeda manusia mengetik
                    if (batchCounter >= 10) {
                        batchCounter = 0;
                        console.log(`[Push Kontak] Jeda batch aktif (12s) setelah mengirim ke 10 kontak.`);
                        await new Promise(resolve => setTimeout(resolve, 12000));
                    } else {
                        // 2. Delay Acak (Randomized Human Delay): jeda acak berkisar 3000ms - 5500ms agar polanya tidak terdeteksi bot spammer
                        const randomDelay = Math.floor(3000 + Math.random() * 2500);
                        await new Promise(resolve => setTimeout(resolve, randomDelay));
                    }
                } catch (err) {
                    console.error(`Gagal mengirim PM ke ${targetJid}:`, err.message);
                }
            }

            const reportText = `✅ *Push Kontak Selesai!*\n\n` +
                               `👥 *Laporan Transmisi:*\n` +
                               `• Status: Sukses\n` +
                               `• Terkirim: *${success}/${targets.length}* anggota secara pribadi.\n\n` +
                               `🛡️ _Proses pengiriman diselesaikan dengan aman menggunakan Anti-Spam humanized patterns._`;

            await sock.sendMessage(remoteJid, { text: reportText }, { quoted: msg });

        } catch (err) {
            await sock.sendMessage(remoteJid, { text: `❌ Gagal memproses push kontak: ${err.message}` }, { quoted: msg });
        } finally {
            activeBroadcasts.delete(botJid);
        }
    }
};
