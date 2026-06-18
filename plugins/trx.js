import { createCanvas } from 'canvas';
import { db } from '@/lib/database.js';
import { settings } from '@/config/settings.js';

export default {
    name: 'trx',
    aliases: ['transaksi', 'receipt', 'tx'],
    description: 'Membuat bukti transaksi pembayaran sukses.',
    usage: '<item> | <harga> | [metode] | [status] | [ref]',
    example: 'Premium Gold | 35000 | GOPAY',
    category: 'Utilities',
    premiumOnly: false,
    run: async (sock, msg, args, { sendTyping, sendUsage }) => {
        const text = args.join(' ');
        if (!text) {
            await sendUsage();
            return;
        }

        const parts = text.split('|').map(p => p.trim());
        const item = parts[0];
        const rawPrice = parts[1];
        
        if (!item || !rawPrice) {
            await sendUsage();
            return;
        }

        // Parse optional arguments
        const payment = parts[2] || 'QRIS';
        const status = (parts[3] || 'SUCCESS').toUpperCase();
        const ref = parts[4] || `TX${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

        // Formatting price
        let price = rawPrice;
        if (/^\d+$/.test(rawPrice)) {
            price = new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Number(rawPrice));
        }

        await sendTyping();

        try {
            // Colors based on payment brand
            const payUpper = payment.toUpperCase();
            let brandColor = '#10B981'; // Default Emerald
            if (payUpper.includes('QRIS')) brandColor = '#E91E63';
            else if (payUpper.includes('GOPAY')) brandColor = '#00AED6';
            else if (payUpper.includes('DANA')) brandColor = '#1E88E5';
            else if (payUpper.includes('OVO')) brandColor = '#8A3FFC';
            else if (payUpper.includes('SHOPEE')) brandColor = '#EE4D2D';

            // Create Canvas
            const width = 600;
            const height = 800;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // 1. Background Gradient
            const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
            bgGrad.addColorStop(0, '#0B0F19');
            bgGrad.addColorStop(1, '#111827');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);

            // 2. Decorative Top Blur Glow
            ctx.save();
            const glowGrad = ctx.createRadialGradient(width / 2, 0, 50, width / 2, 0, 300);
            glowGrad.addColorStop(0, brandColor + '33');
            glowGrad.addColorStop(1, '#00000000');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(width / 2, 0, 300, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 3. Draw Main Card container
            const cardX = 40;
            const cardY = 60;
            const cardW = width - (cardX * 2);
            const cardH = height - (cardY * 2);
            const radius = 24;

            ctx.save();
            // Shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 10;

            // Card Path
            ctx.beginPath();
            ctx.moveTo(cardX + radius, cardY);
            ctx.lineTo(cardX + cardW - radius, cardY);
            ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
            ctx.lineTo(cardX + cardW, cardY + cardH - radius);
            ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
            ctx.lineTo(cardX + radius, cardY + cardH);
            ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
            ctx.lineTo(cardX, cardY + radius);
            ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
            ctx.closePath();
            ctx.fillStyle = '#1F2937';
            ctx.fill();

            // Border
            ctx.shadowColor = 'transparent'; // Reset shadow for border
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.stroke();
            ctx.restore();

            // Draw Top Color Strip Accent
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cardX + radius, cardY);
            ctx.lineTo(cardX + cardW - radius, cardY);
            ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
            ctx.lineTo(cardX + cardW, cardY + 20);
            ctx.lineTo(cardX, cardY + 20);
            ctx.lineTo(cardX, cardY + radius);
            ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
            ctx.closePath();
            ctx.fillStyle = brandColor;
            ctx.fill();
            ctx.restore();

            // 4. Success Circle Icon
            const iconX = width / 2;
            const iconY = cardY + 90;
            const iconR = 36;

            // Outer circle glow
            ctx.save();
            ctx.beginPath();
            ctx.arc(iconX, iconY, iconR + 8, 0, Math.PI * 2);
            ctx.fillStyle = brandColor + '22';
            ctx.fill();

            // Circle background
            ctx.beginPath();
            ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
            ctx.fillStyle = brandColor;
            ctx.fill();

            // Checkmark
            ctx.beginPath();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#ffffff';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(iconX - 12, iconY + 2);
            ctx.lineTo(iconX - 4, iconY + 10);
            ctx.lineTo(iconX + 14, iconY - 8);
            ctx.stroke();
            ctx.restore();

            // 5. Success Header Text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 22px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(status === 'SUCCESS' ? 'TRANSAKSI BERHASIL' : status, width / 2, iconY + 70);

            // Subtext Shop Name
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '14px Arial, sans-serif';
            ctx.fillText(settings.botName || 'Palantir Shop', width / 2, iconY + 95);

            // Large Price Amount
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 36px Arial, sans-serif';
            ctx.fillText(price, width / 2, iconY + 145);

            // Divider Line
            const divY = iconY + 180;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cardX + 30, divY);
            ctx.lineTo(cardX + cardW - 30, divY);
            ctx.stroke();

            // 6. Transaction Details Table
            const details = [
                { key: 'Produk/Item', val: item },
                { key: 'Metode Pembayaran', val: payment },
                { key: 'Waktu Transaksi', val: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) + ' WIB' },
                { key: 'No. Referensi', val: ref },
                { key: 'Status Pembayaran', val: 'Berhasil' }
            ];

            let startY = divY + 40;
            const rowHeight = 42;

            details.forEach(detail => {
                // Key (Left)
                ctx.fillStyle = '#9CA3AF';
                ctx.font = '15px Arial, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(detail.key, cardX + 30, startY);

                // Value (Right)
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 15px Arial, sans-serif';
                ctx.textAlign = 'right';
                
                // Truncate long product names if necessary
                let displayVal = detail.val;
                if (detail.key === 'Produk/Item' && displayVal.length > 25) {
                    displayVal = displayVal.substring(0, 22) + '...';
                }
                
                ctx.fillText(displayVal, cardX + cardW - 30, startY);
                startY += rowHeight;
            });

            // Another Divider
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cardX + 30, startY);
            ctx.lineTo(cardX + cardW - 30, startY);
            ctx.stroke();

            // 7. Barcode decoration
            const barcodeY = startY + 30;
            const barcodeHeight = 45;
            ctx.fillStyle = '#E5E7EB';
            ctx.textAlign = 'center';

            // Draw pseudo barcode lines
            ctx.save();
            let currentX = cardX + 60;
            const endBarcodeX = cardX + cardW - 60;
            const barcodeWidth = endBarcodeX - currentX;
            
            // Seeded-like drawing of barcode lines
            let barcodeSeed = ref;
            let seedIdx = 0;
            while (currentX < endBarcodeX) {
                const charCode = barcodeSeed.charCodeAt(seedIdx % barcodeSeed.length);
                const lineWidth = (charCode % 4) + 1; // line width 1 to 4
                const spaceWidth = ((charCode >> 1) % 4) + 1; // space 1 to 4
                
                ctx.fillStyle = '#E5E7EB';
                ctx.fillRect(currentX, barcodeY, lineWidth, barcodeHeight);
                currentX += lineWidth + spaceWidth;
                seedIdx++;
            }
            ctx.restore();

            // Barcode Reference text
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '12px Courier New, monospace';
            ctx.fillText(ref, width / 2, barcodeY + barcodeHeight + 20);

            // Convert canvas to buffer
            const buffer = canvas.toBuffer('image/png');

            // Send verification/receipt image
            await sock.sendMessage(msg.key.remoteJid, {
                image: buffer,
                caption: `📸 *Bukti Transaksi Berhasil*\n\n` +
                         `🛍️ *Produk:* ${item}\n` +
                         `💵 *Total:* ${price}\n` +
                         `💳 *Metode:* ${payment}\n` +
                         `🧾 *Ref ID:* ${ref}\n\n` +
                         `Terima kasih atas pembelian Anda! ✨`
            }, { quoted: msg });

        } catch (err) {
            console.error('TRX Generator Error:', err);
            await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal membuat bukti transaksi.' }, { quoted: msg });
        }
    }
};
