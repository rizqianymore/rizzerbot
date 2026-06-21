import { createCanvas } from 'canvas';
import { tokenize, loadEmojiImages, measureTokensWidth, drawTokens, wrapTextEmoji, drawTokensJustified } from '@/lib/emojiHelper.js';

export default {
    premiumOnly: true,
    description: 'Membuat stiker teks bergaya Brat.',
    usage: '<teks>',
    example: 'Kyros-MD',
    name: 'brat',
    aliases: ['bratmaker', 'brats'],
    category: 'Media',
    cooldown: 5000,
    run: async (sock, msg, args, { sendTyping }) => {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan teks. Contoh: *.brat apel*' }, { quoted: msg });
            return;
        }

        if (text.length > 100) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Maksimal 100 karakter diperbolehkan.' }, { quoted: msg });
            return;
        }

        await sendTyping();

        try {
            // Create a smaller 256x256 canvas for the authentic lofi pixel-blurry brat look
            const tempCanvas = createCanvas(256, 256);
            const tempCtx = tempCanvas.getContext('2d');

            // 1. Draw solid white background
            tempCtx.fillStyle = '#ffffff'; 
            tempCtx.fillRect(0, 0, 256, 256);

            // 2. Setup text style
            const words = text.split(' ');

            // Find all emojis in the text to preload
            const allEmojis = [];
            for (const word of words) {
                const tokens = tokenize(word);
                for (const t of tokens) {
                    if (t.type === 'emoji') {
                        allEmojis.push(t.value);
                    }
                }
            }
            const emojiImages = await loadEmojiImages(allEmojis);

            tempCtx.fillStyle = '#000000';
            tempCtx.textBaseline = 'top';
            let fontSize = 50; // Max font size in 256x256 canvas (corresponds to ~100px on 512x512)
            const paddingLeft = 14;
            const paddingTop = 18;
            const maxTextWidth = 256 - (paddingLeft * 2); // 228
            const maxTextHeight = 256 - paddingTop - 18; // 220

            // Dynamically calculate the best fitting font size
            let lines = [];
            let lineHeight = 0;
            while (fontSize > 10) {
                tempCtx.font = `${fontSize}px "Arial Narrow", Arial, sans-serif`;
                lineHeight = fontSize * 1.05;
                lines = wrapTextEmoji(tempCtx, text, maxTextWidth, fontSize);
                const totalHeight = lines.length * lineHeight;
                
                // Ensure no single word is wider than maxTextWidth
                let wordFits = true;
                for (const word of words) {
                    const wordTokens = tokenize(word);
                    const wordWidth = measureTokensWidth(tempCtx, wordTokens, fontSize);
                    if (wordWidth > maxTextWidth) {
                        wordFits = false;
                        break;
                    }
                }
                
                if (wordFits && totalHeight <= maxTextHeight) {
                    break;
                }
                fontSize -= 1;
            }

            tempCtx.font = `${fontSize}px "Arial Narrow", Arial, sans-serif`;

            // Start drawing from the top (top-left aligned), not centered vertically
            let startY = paddingTop;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const isLastLine = i === lines.length - 1;
                drawTokensJustified(tempCtx, line, paddingLeft, startY, maxTextWidth, fontSize, emojiImages, isLastLine);
                startY += lineHeight;
            }


            // 3. Draw the 256x256 canvas onto the final 512x512 canvas to get the pixelated/blurry effect
            const canvas = createCanvas(512, 512);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true; // default smoothing makes it slightly blurry when upscaling
            ctx.drawImage(tempCanvas, 0, 0, 512, 512);

            // Export to PNG buffer
            let buffer = canvas.toBuffer('image/png');

            // Add EXIF Sticker Information Metadata locally
            try {
                const { addStickerMetadata } = await import('@/lib/stickerMetadata.js');
                const { settings } = await import('@/config/settings.js');
                buffer = await addStickerMetadata(buffer, settings.botName, settings.ownerName);
            } catch (metaErr) {
                console.error('Failed to add metadata for brat sticker:', metaErr);
            }

            await sock.sendMessage(msg.key.remoteJid, { sticker: buffer, mimetype: 'image/webp' }, { quoted: msg });
        } catch (err) {
            console.error('Local Brat generator error:', err);
            await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal membuat stiker Brat lokal.' }, { quoted: msg });
        }
    }
};
