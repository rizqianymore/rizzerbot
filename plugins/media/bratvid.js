import GIFEncoder from 'gif-encoder-2';
import { createCanvas } from 'canvas';
import { tokenize, loadEmojiImages, measureTokensWidth, drawTokens, wrapTextEmoji, drawTokensJustified } from '@/lib/emojiHelper.js';

export default {
    premiumOnly: true,
    description: 'Membuat stiker video teks Brat bergerak.',
    usage: '<teks>',
    example: 'Kyros-MD',
    name: 'bratvid',
    aliases: ['bratgif', 'bratanim', 'bratvideo'],
    category: 'Media',
    cooldown: 8000,
    run: async (sock, msg, args, { sendTyping }) => {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan teks. Contoh: *.bratvid apel*' }, { quoted: msg });
            return;
        }

        if (text.length > 50) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Maksimal 50 karakter diperbolehkan untuk animasi.' }, { quoted: msg });
            return;
        }

        await sendTyping();

        try {
            // Setup GIF Encoder for 512x512 animation
            const encoder = new GIFEncoder(512, 512, 'octree', false);
            encoder.start();
            encoder.setDelay(400); // 400ms per frame (smoother, more gradual reading speed)
            encoder.setRepeat(0);  // Loop infinitely

            // We will render frames on a temporary 256x256 canvas for the authentic lofi pixelated/blurry look
            const tempCanvas = createCanvas(256, 256);
            const tempCtx = tempCanvas.getContext('2d');

            const canvas = createCanvas(512, 512);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true; // default smoothing makes it slightly blurry when upscaling

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

            let fontSize = 50; // start with max font size (50) instead of 180
            const paddingLeft = 14;
            const paddingTop = 18;
            const maxTextWidth = 256 - (paddingLeft * 2); // 228
            const maxTextHeight = 256 - paddingTop - 18; // 220

            // Compute the target font size once based on the FULL text to keep it consistent
            let finalLines = [];
            let finalLineHeight = 0;
            while (fontSize > 10) {
                tempCtx.font = `${fontSize}px "Arial Narrow", Arial, sans-serif`;
                finalLineHeight = fontSize * 1.05;
                finalLines = wrapTextEmoji(tempCtx, text, maxTextWidth, fontSize);
                const totalHeight = finalLines.length * finalLineHeight;
                
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

            let accumulatedText = "";
            const fixedStartY = paddingTop; // Start from top padding instead of center

            for (let i = 0; i < words.length; i++) {
                accumulatedText += (i === 0 ? "" : " ") + words[i];

                // Render frame on the temporary canvas
                tempCtx.fillStyle = '#ffffff'; // White background
                tempCtx.fillRect(0, 0, 256, 256);

                tempCtx.fillStyle = '#000000'; // Black text
                tempCtx.textBaseline = 'top';
                tempCtx.font = `${fontSize}px "Arial Narrow", Arial, sans-serif`;

                const currentLines = wrapTextEmoji(tempCtx, accumulatedText, maxTextWidth, fontSize);
                let startY = fixedStartY;

                for (let j = 0; j < currentLines.length; j++) {
                    const line = currentLines[j];
                    const isLastLine = (j === currentLines.length - 1);
                    drawTokensJustified(tempCtx, line, paddingLeft, startY, maxTextWidth, fontSize, emojiImages, isLastLine);
                    startY += finalLineHeight;
                }

                // Copy from the temporary canvas to the final 512x512 canvas to get the blurry effect
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, 512, 512);
                ctx.drawImage(tempCanvas, 0, 0, 512, 512);

                encoder.addFrame(ctx);
            }

            encoder.finish();
            let gifBuffer = encoder.out.getData();

            // Add EXIF Sticker Information Metadata locally
            try {
                const { addStickerMetadata } = await import('@/lib/stickerMetadata.js');
                const { settings } = await import('@/config/settings.js');
                gifBuffer = await addStickerMetadata(gifBuffer, settings.botName, settings.ownerName);
            } catch (metaErr) {
                console.error('Failed to add metadata for bratvid sticker:', metaErr);
            }

            await sock.sendMessage(msg.key.remoteJid, { sticker: gifBuffer, mimetype: 'image/webp' }, { quoted: msg });
        } catch (err) {
            console.error('Local Bratvid generator error:', err);
            await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal membuat stiker animasi Brat lokal.' }, { quoted: msg });
        }
    }
};
