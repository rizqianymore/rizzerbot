import fs from 'fs';
import path from 'path';

export default {
    name: 'addplugin',
    aliases: ['sp', 'saveplugin', 'ap'],
    category: 'Owner',
    description: 'Menulis/membuat file plugin baru langsung dari chat (atau dengan mereply chat kode).',
    usage: '<path/namafile.js> <kode>',
    example: 'plugins/osint/tes.js export default { ... }',
    ownerOnly: true,
    run: async (sock, msg, args, { activePrefix, sendTyping }) => {
        await sendTyping();
        const remoteJid = msg.key.remoteJid;

        let code = args.slice(1).join(' ');
        const targetPathInput = args[0];

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
            code = quoted.conversation || quoted.extendedTextMessage?.text || code;
        }

        if (!targetPathInput || !code) {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ *Format salah!*\n\nContoh: \`${activePrefix}addplugin plugins/downloader/tes.js <kode>\` atau balas/quote pesan teks kode dengan perintah \`${activePrefix}addplugin plugins/downloader/tes.js\``
            }, { quoted: msg });
            return;
        }

        const projectRoot = process.cwd();
        const absolutePath = path.resolve(projectRoot, targetPathInput);

        const isUnderPlugins = absolutePath.startsWith(path.join(projectRoot, 'plugins') + path.sep);
        const isUnderCase = absolutePath.startsWith(path.join(projectRoot, 'case') + path.sep);

        if (!isUnderPlugins && !isUnderCase) {
            await sock.sendMessage(remoteJid, {
                text: '❌ *Akses ditolak:* File harus disimpan di dalam folder `plugins/` atau `case/`!'
            }, { quoted: msg });
            return;
        }

        if (!targetPathInput.endsWith('.js')) {
            await sock.sendMessage(remoteJid, {
                text: '❌ *Tipe tidak valid:* File harus berakhiran `.js`!'
            }, { quoted: msg });
            return;
        }

        try {
            const dir = path.dirname(absolutePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(absolutePath, code, 'utf-8');
            await sock.sendMessage(remoteJid, {
                text: `✅ *Berhasil:* File plugin telah ditulis ke \`${targetPathInput}\` dan siap dimuat otomatis.`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *Error:* Gagal menulis file. \n\n*Pesan:* ${err.message}`
            }, { quoted: msg });
        }
    }
};
