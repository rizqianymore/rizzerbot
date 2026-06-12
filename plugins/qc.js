import { createCanvas, loadImage } from 'canvas';
import { tokenize, loadEmojiImages, measureTokensWidth, drawTokens, wrapTextEmoji } from '@/lib/emojiHelper.js';

function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}


export default {
    description: 'Membuat gelembung chat stiker bergaya kutipan (Quotation Chat).',
    usage: '<teks>',
    example: 'Halo',
    name: 'qc',
    aliases: ['quotechat', 'bubble'],
    category: 'Media',
    cooldown: 5000,
    run: async (sock, msg, args, { sendTyping }) => {
        let text = args.join(' ');
        if (!text) {
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMsg) {
                text = quotedMsg.conversation ||
                    quotedMsg.extendedTextMessage?.text ||
                    quotedMsg.imageMessage?.caption ||
                    quotedMsg.videoMessage?.caption ||
                    '';
            }
        }

        if (!text) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan teks atau balas pesan untuk dikutip. Contoh: *.qc Halo dunia*' }, { quoted: msg });
            return;
        }

        if (text.length > 200) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Maksimal 200 karakter diperbolehkan.' }, { quoted: msg });
            return;
        }

        await sendTyping();

        try {
            const canvasWidth = 380;
            const tempCanvas = createCanvas(canvasWidth, 100);
            const tempCtx = tempCanvas.getContext('2d');

            // Find all emojis in the text to preload
            const words = text.split(' ');
            const allEmojis = [];
            for (const word of words) {
                const tokens = tokenize(word);
                for (const t of tokens) {
                    if (t.type === 'emoji') {
                        allEmojis.push(t.value);
                    }
                }
            }
            const bubbleEmojiImages = await loadEmojiImages(allEmojis);

            const maxBubbleWidth = 300; // Increased width slightly for better text fitting
            const bubblePadding = 18; // Increased padding
            const maxTextWidth = maxBubbleWidth - (bubblePadding * 2);
            
            // Dynamic font sizing
            let fontSize = 32;
            const minFontSize = 14;
            let lines = [];
            let fontStyle = '';
            
            while (fontSize >= minFontSize) {
                fontStyle = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
                tempCtx.font = fontStyle;
                lines = wrapTextEmoji(tempCtx, text, maxTextWidth, fontSize);
                if (lines.length <= 10 || fontSize === minFontSize) {
                    break;
                }
                fontSize -= 2;
            }

            // Format timestamp from messageTimestamp or current time
            const timestampEpoch = msg.messageTimestamp ? (msg.messageTimestamp * 1000) : Date.now();
            const dateObj = new Date(timestampEpoch);
            let hours = dateObj.getHours();
            const minutes = dateObj.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            const timestamp = `${hours}.${minutes} ${ampm}`;

            tempCtx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            const timestampWidth = tempCtx.measureText(timestamp).width;

            tempCtx.font = fontStyle;
            const lineCount = lines.length;
            const lineHeight = fontSize * 1.35;

            // Calculate dynamic bubble width based on the longest text line
            let maxLineWidth = 0;
            lines.forEach(line => {
                const w = measureTokensWidth(tempCtx, tokenize(line), fontSize);
                if (w > maxLineWidth) maxLineWidth = w;
            });

            // If we have multiple lines and are trying to justify, we should force bubbleWidth to be wider
            // so text has room to justify properly.
            if (lineCount > 1) {
                maxLineWidth = maxTextWidth; 
            }

            const lastLine = lines[lines.length - 1];
            const lastLineWidth = measureTokensWidth(tempCtx, tokenize(lastLine), fontSize);

            // Determine if timestamp fits on the last line
            const timeSpacing = 15;
            const fitsOnLastLine = (lastLineWidth + timeSpacing + timestampWidth) <= maxTextWidth;

            let bubbleWidth;
            let bubbleHeight;

            if (lineCount === 1) {
                if (fitsOnLastLine) {
                    bubbleWidth = lastLineWidth + timeSpacing + timestampWidth + (bubblePadding * 2);
                    bubbleHeight = lineHeight + (bubblePadding * 2) + 6;
                } else {
                    bubbleWidth = Math.max(lastLineWidth, timestampWidth) + (bubblePadding * 2);
                    bubbleHeight = (lineHeight * 2) + (bubblePadding * 2) + 6;
                }
            } else {
                if (fitsOnLastLine) {
                    bubbleWidth = Math.max(maxLineWidth, lastLineWidth + timeSpacing + timestampWidth) + (bubblePadding * 2);
                    bubbleHeight = (lineCount * lineHeight) + (bubblePadding * 2) + 6;
                } else {
                    bubbleWidth = Math.max(maxLineWidth, timestampWidth) + (bubblePadding * 2);
                    bubbleHeight = ((lineCount + 1) * lineHeight) + (bubblePadding * 2) + 6;
                }
            }

            bubbleWidth = Math.max(bubbleWidth, 130);
            bubbleWidth = Math.min(bubbleWidth, maxBubbleWidth);

            // Canvas sizes based on bubbleHeight
            const scaleFactor = 3; // Super HD resolution (3x)
            const finalCanvasHeight = 85 + bubbleHeight + 330;
            const canvas = createCanvas(canvasWidth * scaleFactor, finalCanvasHeight * scaleFactor);
            const ctx = canvas.getContext('2d');
            ctx.scale(scaleFactor, scaleFactor);

            // 1. Draw solid dark background matching iOS dark mode focus
            ctx.fillStyle = '#09090b';
            ctx.fillRect(0, 0, canvasWidth, finalCanvasHeight);

            // 2. Draw Reaction Bar (Top)
            const rxX = 35;
            const rxY = 25;
            const rxWidth = 295;
            const rxHeight = 46;
            drawRoundRect(ctx, rxX, rxY, rxWidth, rxHeight, 23, '#1c1c1e', null);

            // Load emojis from Twemoji CDN for high quality color rendering on Linux/Docker
            const twemojiUrls = [
                'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f44d.png', // 👍
                'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2764.png',  // ❤️
                'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f602.png', // 😂
                'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f62e.png', // 😮
                'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f622.png', // 😢
                'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f64f.png'  // 🙏
            ];

            const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
            const emojiImages = await Promise.all(
                twemojiUrls.map(url => loadImage(url).catch(() => null))
            );

            // Render emojis inside Reaction Bar
            const emojiSpacing = rxWidth / 7;
            for (let idx = 0; idx < 6; idx++) {
                const emX = rxX + (emojiSpacing * idx) + (emojiSpacing / 2);
                const emY = rxY + (rxHeight / 2);
                const img = emojiImages[idx];

                if (img) {
                    ctx.drawImage(img, emX - 13, emY - 13, 26, 26);
                } else {
                    ctx.font = '20px Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(emojis[idx], emX, emY);
                }
            }

            // Draw Plus Circle Icon inside Reaction Bar
            const plusX = rxX + (emojiSpacing * 6) + (emojiSpacing / 2);
            const plusY = rxY + (rxHeight / 2);
            ctx.fillStyle = '#2c2c2e';
            ctx.beginPath();
            ctx.arc(plusX, plusY, 13, 0, Math.PI * 2);
            ctx.fill();

            // ctx.strokeStyle = '#8e8e93';
            ctx.strokeStyle = '#8e8e93';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(plusX - 5, plusY);
            ctx.lineTo(plusX + 5, plusY);
            // Vertical line
            ctx.moveTo(plusX, plusY - 5);
            ctx.lineTo(plusX, plusY + 5);
            ctx.stroke();

            // 3. Draw Message Bubble (Middle)
            const bbX = 35;
            const bbY = rxY + rxHeight + 14;
            drawRoundRect(ctx, bbX, bbY, bubbleWidth, bubbleHeight, 18, '#1c1c1e', null);

            // Draw Message Text
            ctx.fillStyle = '#ffffff';
            ctx.font = fontStyle;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            const textRenderWidth = bubbleWidth - (bubblePadding * 2);

            lines.forEach((line, index) => {
                const isLastLine = index === lines.length - 1;
                drawTokensJustified(ctx, line, bbX + bubblePadding, bbY + bubblePadding + (index * lineHeight), textRenderWidth, fontSize, bubbleEmojiImages, isLastLine);
            });

            // Draw Timestamp (bottom right of the bubble)
            ctx.fillStyle = '#8e8e93';
            ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(timestamp, bbX + bubbleWidth - bubblePadding, bbY + bubbleHeight - bubblePadding + 4);

            // 4. Draw Action Menu (Bottom)
            const menuX = 35;
            const menuY = bbY + bubbleHeight + 14;
            const menuWidth = 205;
            const menuItemHeight = 38;
            const menuItems = [
                { name: 'Balas', type: 'reply', color: '#ffffff' },
                { name: 'Teruskan', type: 'forward', color: '#ffffff' },
                { name: 'Salin', type: 'copy', color: '#ffffff' },
                { name: 'Beri Bintang', type: 'star', color: '#ffffff' },
                { name: 'Sematkan', type: 'pin', color: '#ffffff' },
                { name: 'Laporkan', type: 'alert', color: '#ff453a' },
                { name: 'Hapus', type: 'trash', color: '#ff453a' }
            ];

            const menuHeight = menuItems.length * menuItemHeight;
            drawRoundRect(ctx, menuX, menuY, menuWidth, menuHeight, 12, '#1c1c1e', null);

            // Render menu items & custom geometry icons
            menuItems.forEach((item, idx) => {
                const itemY = menuY + (idx * menuItemHeight);

                // Draw Separator Line
                if (idx > 0) {
                    ctx.strokeStyle = '#2c2c2e';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(menuX, itemY);
                    ctx.lineTo(menuX + menuWidth, itemY);
                    ctx.stroke();
                }

                // Draw Text
                ctx.fillStyle = item.color;
                ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.name, menuX + 14, itemY + (menuItemHeight / 2));

                // Draw Icons on the right side
                const iconX = menuX + menuWidth - 24;
                const iconY = itemY + (menuItemHeight / 2);
                ctx.strokeStyle = item.color;
                ctx.lineWidth = 1.7;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                if (item.type === 'reply') {
                    // Reply Icon (curved arrow pointing left)
                    ctx.beginPath();
                    ctx.arc(iconX + 4, iconY + 1, 4, Math.PI * 1.5, Math.PI, true);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(iconX, iconY - 3);
                    ctx.lineTo(iconX - 3, iconY + 0.5);
                    ctx.lineTo(iconX, iconY + 4);
                    ctx.stroke();
                } else if (item.type === 'forward') {
                    // Forward Icon (curved arrow pointing right)
                    ctx.beginPath();
                    ctx.arc(iconX - 4, iconY + 1, 4, Math.PI * 1.5, 0, false);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(iconX, iconY - 3);
                    ctx.lineTo(iconX + 3, iconY + 0.5);
                    ctx.lineTo(iconX, iconY + 4);
                    ctx.stroke();
                } else if (item.type === 'copy') {
                    // Copy Icon (overlapping squares)
                    ctx.strokeRect(iconX - 5, iconY - 5, 7, 7);
                    ctx.fillStyle = '#1c1c1e';
                    ctx.fillRect(iconX - 1, iconY - 1, 7, 7);
                    ctx.strokeRect(iconX - 1, iconY - 1, 7, 7);
                } else if (item.type === 'star') {
                    // Star Icon
                    ctx.beginPath();
                    ctx.moveTo(iconX, iconY - 6);
                    ctx.lineTo(iconX + 1.5, iconY - 2);
                    ctx.lineTo(iconX + 6, iconY - 2);
                    ctx.lineTo(iconX + 2.5, iconY + 0.5);
                    ctx.lineTo(iconX + 4, iconY + 5);
                    ctx.lineTo(iconX, iconY + 2.5);
                    ctx.lineTo(iconX - 4, iconY + 5);
                    ctx.lineTo(iconX - 2.5, iconY + 0.5);
                    ctx.lineTo(iconX - 6, iconY - 2);
                    ctx.lineTo(iconX - 1.5, iconY - 2);
                    ctx.closePath();
                    ctx.stroke();
                } else if (item.type === 'pin') {
                    // Pin Icon
                    ctx.beginPath();
                    ctx.moveTo(iconX - 2, iconY - 5);
                    ctx.lineTo(iconX + 2, iconY - 5);
                    ctx.moveTo(iconX, iconY - 5);
                    ctx.lineTo(iconX, iconY + 2);
                    ctx.moveTo(iconX - 3, iconY + 2);
                    ctx.lineTo(iconX + 3, iconY + 2);
                    ctx.moveTo(iconX, iconY + 2);
                    ctx.lineTo(iconX, iconY + 6);
                    ctx.stroke();
                } else if (item.type === 'alert') {
                    // Exclamation Triangle
                    ctx.beginPath();
                    ctx.moveTo(iconX, iconY - 6);
                    ctx.lineTo(iconX + 6, iconY + 4);
                    ctx.lineTo(iconX - 6, iconY + 4);
                    ctx.closePath();
                    ctx.stroke();
                    ctx.fillStyle = item.color;
                    ctx.fillRect(iconX - 0.8, iconY - 2, 1.6, 2.5);
                    ctx.fillRect(iconX - 0.8, iconY + 1.5, 1.6, 1.6);
                } else if (item.type === 'trash') {
                    // Trash Can
                    ctx.strokeRect(iconX - 4, iconY - 2, 8, 8);
                    ctx.beginPath();
                    ctx.moveTo(iconX - 6, iconY - 4);
                    ctx.lineTo(iconX + 6, iconY - 4);
                    ctx.moveTo(iconX - 2.5, iconY - 4);
                    ctx.lineTo(iconX - 2.5, iconY - 6);
                    ctx.lineTo(iconX + 2.5, iconY - 6);
                    ctx.lineTo(iconX + 2.5, iconY - 4);
                    ctx.stroke();
                }
            });

            // Convert and send as Sticker
            const imageBuffer = canvas.toBuffer('image/png');
            const { addStickerMetadata } = await import('@/lib/stickerMetadata.js');
            const stickerBuffer = await addStickerMetadata(imageBuffer, 'RizzerBot QC', 'Pentagon');

            await sock.sendMessage(msg.key.remoteJid, {
                sticker: stickerBuffer,
                mimetype: 'image/webp'
            }, { quoted: msg });

        } catch (err) {
            console.error('Local QC generation error:', err);
            await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal membuat gambar kutipan lokal: ${err.message}` }, { quoted: msg });
        }
    }
};
