import { createCanvas, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register elegant cursive font for the card
try {
    const fontPath = path.join(__dirname, '..', 'assets', 'DancingScript-Bold.ttf');
    if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: 'DancingScript' });
    }
} catch (err) {
    console.error('Failed to register DancingScript font:', err);
}

function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.save();
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
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.restore();
}

function drawHeart(ctx, x, y, size, fillStyle, opacity = 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    // Left curve
    ctx.quadraticCurveTo(x - size / 2, y - size / 2, x - size, y + size / 4);
    ctx.quadraticCurveTo(x - size, y + (size * 3) / 4, x, y + size * 1.2);
    // Right curve
    ctx.quadraticCurveTo(x + size, y + (size * 3) / 4, x + size, y + size / 4);
    ctx.quadraticCurveTo(x + size, y - size / 2, x, y + size / 4);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.shadowColor = 'rgba(255, 75, 120, 0.3)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
}

export default {
    name: 'confess',
    aliases: ['confesscard', 'lovecard', 'menfess'],
    description: 'Membuat kartu ucapan / pengakuan cinta (love confession card) rahasia yang cantik.',
    usage: '<untuk> | <pesan> | <dari>',
    example: 'Alya | Aku suka kamu sejak pertama kali kita sekelompok tugas | Rahasia',
    category: 'Fun',
    cooldown: 5000,
    run: async (sock, msg, args, { sendTyping, senderName, activePrefix }) => {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: `⚠️ *Penggunaan Salah!*\n\n` +
                      `Format: *${activePrefix || '.'}confess Untuk | Pesan | Dari*\n` +
                      `Contoh: *${activePrefix || '.'}confess Dia | Aku sayang kamu | Anonim*`
            }, { quoted: msg });
            return;
        }

        let to = '';
        let message = '';
        let from = senderName;

        // Split by pipe (|) or comma (,)
        if (text.includes('|')) {
            const parts = text.split('|');
            to = parts[0]?.trim() || '';
            message = parts[1]?.trim() || '';
            if (parts[2]) from = parts[2]?.trim() || '';
        } else if (text.includes(',')) {
            const parts = text.split(',');
            to = parts[0]?.trim() || '';
            message = parts[1]?.trim() || '';
            if (parts[2]) from = parts[2]?.trim() || '';
        } else {
            // Fallback if no delimiter
            to = 'Seseorang';
            message = text.trim();
        }

        if (!to || !message) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Harap masukkan minimal penerima dan pesan. Contoh: *.confess Kamu | Aku suka kamu*'
            }, { quoted: msg });
            return;
        }

        await sendTyping();

        try {
            const width = 800;
            const height = 500;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // 1. Draw solid gradient background (romantic theme)
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#ff758c');
            grad.addColorStop(1, '#ff7eb3');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            // 2. Draw romantic floating background hearts
            const hearts = [
                { x: 100, y: 120, size: 25, opacity: 0.2 },
                { x: 700, y: 150, size: 35, opacity: 0.15 },
                { x: 150, y: 380, size: 30, opacity: 0.2 },
                { x: 650, y: 390, size: 20, opacity: 0.25 },
                { x: 400, y: 60, size: 15, opacity: 0.3 },
                { x: 740, y: 80, size: 12, opacity: 0.35 },
                { x: 50, y: 250, size: 18, opacity: 0.18 }
            ];
            hearts.forEach(h => {
                drawHeart(ctx, h.x, h.y, h.size, '#ffffff', h.opacity);
            });

            // 3. Draw glassmorphic confession card container
            ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
            ctx.shadowBlur = 25;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 10;
            drawRoundRect(ctx, 60, 60, 680, 380, 24, 'rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.35)');
            ctx.shadowBlur = 0; // Reset shadow for text

            // 4. Draw card corner decoration hearts
            drawHeart(ctx, 95, 95, 20, '#ff4b78', 0.9);
            drawHeart(ctx, 705, 95, 12, '#ff4b78', 0.75);

            // 5. Draw Header/Title
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 22px "Arial", sans-serif';
            ctx.fillText('💝 SECRET LOVE CONFESSION 💝', width / 2, 110);

            // 6. Draw "To: <target>"
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.font = '36px "DancingScript", "Georgia", serif';
            ctx.fillText(`To: ${to}`, 110, 180);

            // 7. Draw Message Body (wrapped text)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'italic 20px "Arial", sans-serif';
            
            const textX = 110;
            let textY = 225;
            const maxWidth = 580;
            const words = message.split(' ');
            let line = '';
            const lineHeight = 28;

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    ctx.fillText(line, textX, textY);
                    line = words[n] + ' ';
                    textY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, textX, textY);

            // 8. Draw "From: <sender>" at the bottom right
            ctx.fillStyle = '#ffe3e8';
            ctx.textAlign = 'right';
            ctx.font = '36px "DancingScript", "Georgia", serif';
            ctx.fillText(`With Love, ${from}`, 690, 400);

            // 9. Send the image card
            const imageBuffer = canvas.toBuffer('image/png');
            await sock.sendMessage(msg.key.remoteJid, {
                image: imageBuffer,
                caption: `💝 *Love Confession Card Baru!*\n\n` +
                         `💌 *Untuk:* _${to}_\n` +
                         `👤 *Dari:* _${from}_\n\n` +
                         `*Pesan:* "${message}"`
            }, { quoted: msg });

        } catch (err) {
            console.error('Confess Card Generation Error:', err);
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Gagal membuat kartu pengakuan cinta. Pastikan format teks benar.'
            }, { quoted: msg });
        }
    }
};
