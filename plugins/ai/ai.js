import axios from 'axios';

export default {
    name: 'ai',
    aliases: ['openai', 'chatgpt', 'gpt'],
    category: 'Premium',
    premiumOnly: true,
    description: 'Tanya jawab kecerdasan buatan (AI) berbasis GPT-4.',
    usage: '<pertanyaan Anda>',
    example: 'Jelaskan apa itu WhatsApp Bot',
    run: async (sock, msg, args, context) => {
        const { sendTyping, sendUsage } = context;
        const query = args.join(' ');
        
        if (!query) {
            await sendUsage();
            return;
        }

        await sendTyping();

        try {
            const res = await axios.get(`https://widipe.com/gpt4?text=${encodeURIComponent(query)}`, { timeout: 20000 });
            const result = res.data?.result;
            if (result) {
                await sock.sendMessage(msg.key.remoteJid, { text: result }, { quoted: msg });
            } else {
                throw new Error('Respons kosong dari server.');
            }
        } catch (err) {
            console.error('AI API Error:', err.message);
            try {
                
                const res = await axios.get(`https://widipe.com/openai?text=${encodeURIComponent(query)}`, { timeout: 20000 });
                const result = res.data?.result;
                if (result) {
                    await sock.sendMessage(msg.key.remoteJid, { text: result }, { quoted: msg });
                } else {
                    throw new Error('Backup API also failed.');
                }
            } catch (backupErr) {
                await sock.sendMessage(msg.key.remoteJid, {
                    text: `❌ Gagal memproses pertanyaan Anda: ${backupErr.message}`
                }, { quoted: msg });
            }
        }
    }
};
