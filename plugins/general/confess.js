import { createCanvas, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


try {
    const fontPath = path.join(__dirname, '..', 'assets', 'GreatVibes-Regular.ttf');
    if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: 'Great Vibes' });
    }
} catch (err) {
    console.error('Failed to register Great Vibes font:', err);
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
    
    ctx.quadraticCurveTo(x - size / 2, y - size / 2, x - size, y + size / 4);
    ctx.quadraticCurveTo(x - size, y + (size * 3) / 4, x, y + size * 1.2);
    
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
    premiumOnly: true,
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

            
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#ff758c');
            grad.addColorStop(1, '#ff7eb3');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            
            const glow1 = ctx.createRadialGradient(220, 170, 10, 220, 170, 160);
            glow1.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
            glow1.addColorStop(1, 'rgba(255, 117, 140, 0)');
            ctx.fillStyle = glow1;
            ctx.fillRect(20, 20, 400, 300);

            const glow2 = ctx.createRadialGradient(580, 330, 10, 580, 330, 180);
            glow2.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
            glow2.addColorStop(1, 'rgba(255, 126, 179, 0)');
            ctx.fillStyle = glow2;
            ctx.fillRect(380, 150, 400, 320);

            
            const hearts = [
                { x: 100, y: 120, size: 25, opacity: 0.25 },
                { x: 700, y: 150, size: 35, opacity: 0.2 },
                { x: 150, y: 380, size: 30, opacity: 0.25 },
                { x: 650, y: 390, size: 20, opacity: 0.3 },
                { x: 400, y: 60, size: 15, opacity: 0.35 },
                { x: 740, y: 80, size: 12, opacity: 0.4 },
                { x: 50, y: 250, size: 18, opacity: 0.22 }
            ];
            hearts.forEach(h => {
                drawHeart(ctx, h.x, h.y, h.size, '#ffffff', h.opacity);
            });

            
            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = 30;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 12;
            drawRoundRect(ctx, 60, 60, 680, 380, 24, 'rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.38)');
            
            
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            
            drawHeart(ctx, 95, 95, 20, '#ff4b78', 0.95);
            drawHeart(ctx, 705, 95, 12, '#ff4b78', 0.85); 

            
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 20px sans-serif';
            const titleText = 'SECRET LOVE CONFESSION';
            ctx.fillText(titleText, width / 2, 110);

            
            const titleWidth = ctx.measureText(titleText).width;
            drawHeart(ctx, (width / 2) - (titleWidth / 2) - 22, 98, 10, '#ffffff', 0.95);
            drawHeart(ctx, (width / 2) + (titleWidth / 2) + 22, 98, 10, '#ffffff', 0.95);

            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(100, 130);
            ctx.lineTo(700, 130);
            ctx.stroke();

            
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.font = '48px "Great Vibes", cursive';
            ctx.fillText(`To: ${to}`, 110, 190);

            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'italic 22px sans-serif';
            
            const textX = 110;
            let textY = 240;
            const maxWidth = 580;
            const words = message.split(' ');
            let line = '';
            const lineHeight = 32;

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

            
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'right';
            ctx.font = '44px "Great Vibes", cursive';
            ctx.fillText(`With Love, ${from}`, 690, 400);

            
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

