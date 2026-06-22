import { fetchJson } from '@/lib/scraping.js';

export default {
    name: 'github',
    description: 'Mencari detail profil GitHub pengguna.',
    usage: '<username>',
    example: 'github octocat',
    aliases: ['gh', 'git', 'githublookup'],
    category: 'OSINT',
    premiumOnly: true,
    run: async (sock, msg, args, context) => {
        const { sendTyping, activePrefix, senderName } = context;

        await sendTyping();

        const username = args[0];
        if (!username) {
            return sock.sendMessage(msg.key.remoteJid, {
                text: `❌ *Format salah!*\n\nGunakan: \`${activePrefix}github <username>\`\nContoh: \`${activePrefix}github torvalds\``
            }, { quoted: msg });
        }

        try {
            const res = await fetchJson(`https://api.github.com/users/${encodeURIComponent(username)}`);
            if (res.status !== 200) {
                if (res.status === 404) {
                    throw new Error('Username tidak ditemukan.');
                }
                throw new Error(`Gagal mengambil data (HTTP ${res.status})`);
            }

            const data = res.data;
            let replyText = `🔍 *GitHub Profile OSINT*\n\n` +
                            `• *Username:* \`${data.login || '-'}\`\n` +
                            `• *Nama:* ${data.name || '-'}\n` +
                            `• *Bio:* ${data.bio || '-'}\n` +
                            `• *Perusahaan:* ${data.company || '-'}\n` +
                            `• *Lokasi:* ${data.location || '-'}\n` +
                            `• *Blog/Web:* ${data.blog || '-'}\n` +
                            `• *Repo Publik:* ${data.public_repos || 0}\n` +
                            `• *Gist Publik:* ${data.public_gists || 0}\n` +
                            `• *Followers:* ${data.followers || 0}\n` +
                            `• *Following:* ${data.following || 0}\n` +
                            `• *Akun Dibuat:* ${new Date(data.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}\n` +
                            `• *Update Terakhir:* ${new Date(data.updated_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
                            `_Dicari oleh: ${senderName}_`;

            if (data.avatar_url) {
                await sock.sendMessage(msg.key.remoteJid, {
                    image: { url: data.avatar_url },
                    caption: replyText
                }, { quoted: msg });
            } else {
                await sock.sendMessage(msg.key.remoteJid, { text: replyText }, { quoted: msg });
            }

        } catch (error) {
            console.error('Error GitHub lookup:', error);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ *Terjadi kesalahan!*\n\n${error.message || 'Gagal melakukan lookup GitHub.'}`
            }, { quoted: msg });
        }
    }
};
