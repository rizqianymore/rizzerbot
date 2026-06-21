import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'getdb',
    description: 'Mengirimkan file database.json saat ini.',
    usage: '',
    example: '',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        const dbFilePath = path.join(__dirname, '..', '..', 'database', 'users.json');

        if (fs.existsSync(dbFilePath)) {
            const buffer = fs.readFileSync(dbFilePath);
            await sock.sendMessage(msg.key.remoteJid, {
                document: buffer,
                mimetype: 'application/json',
                fileName: 'users.json',
                caption: '📊 users.json saat ini.'
            }, { quoted: msg });
        } else {
            await sock.sendMessage(msg.key.remoteJid, { text: '❌ File database tidak ditemukan.' }, { quoted: msg });
        }
    }
};
