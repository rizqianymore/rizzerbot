import { createCanvas } from 'canvas';

// Helper Masking Functions
function maskName(name) {
    if (!name) return '';
    if (name.length <= 2) return name.charAt(0) + '*';
    return name.charAt(0).toUpperCase() + '*'.repeat(name.length - 2) + name.charAt(name.length - 1).toLowerCase();
}

function maskPhone(phone) {
    if (!phone) return '';
    if (phone.length <= 8) return phone.substring(0, 3) + '****';
    return phone.substring(0, 4) + '****' + phone.substring(phone.length - 4);
}

export default {
    name: 'trx',
    aliases: ['transaksi', 'receipt', 'tx'],
    description: 'Membuat bukti transaksi via canvas lokal (Desain Worker).',
    usage: '<item> | <harga> | [metode] | [pembeli] | [hp]',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args, { sendTyping, sendUsage }) => {
        const text = args.join(' ');
        if (!text) return await sendUsage();

        let parts = [];
        if (text.includes('|')) {
            parts = text.split('|').map(p => p.trim());
        } else if (text.includes(',')) {
            parts = text.split(',').map(p => p.trim());
        } else {
            parts = [text];
        }

        const [item, price, method, buyer, phone] = parts;
        if (!item || !price) return await sendUsage();

        await sendTyping();

        try {
            // Setup values matching Worker logic
            const rawPrice = price.replace(/\D/g, '');
            const formattedAmount = new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
            }).format(rawPrice || 0);

            const payMethod = method || 'QRIS';
            const buyerName = buyer || 'Pelanggan';
            const phoneNum = phone || '08123456789';
            const trxId = 'TRX-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            
            const now = new Date();
            const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':') + ' WIB';

            // Create Canvas matching CSS dimensions (380x560 + margins = 440x620)
            const width = 440;
            const height = 640;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // 1. Draw Page Background (bg-gray-100)
            ctx.fillStyle = '#f3f4f6';
            ctx.fillRect(0, 0, width, height);

            // 2. Draw Receipt Container Card (bg-white border-gray-200)
            const cardX = 30;
            const cardY = 30;
            const cardW = width - (cardX * 2); // 380
            const cardH = height - (cardY * 2); // 580
            const radius = 8; // rounded-md

            ctx.save();
            // Shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 4;
            
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            
            // Rounded rect path
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
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // 3. Draw Watermark ("SUCCESS" rotated -45deg)
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(-45 * Math.PI / 180);
            ctx.font = '900 64px Arial, sans-serif';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SUCCESS', 0, 0);
            ctx.restore();

            // 4. Draw Green Success Checkmark Badge (bg-green-500)
            const badgeX = width / 2;
            const badgeY = cardY + 70;
            const badgeR = 36;

            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
            ctx.fillStyle = '#22c55e'; // green-500
            ctx.fill();

            // Checkmark Symbol
            ctx.beginPath();
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#ffffff';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(badgeX - 12, badgeY + 2);
            ctx.lineTo(badgeX - 4, badgeY + 10);
            ctx.lineTo(badgeX + 14, badgeY - 8);
            ctx.stroke();

            // 5. Title & Subtitle
            ctx.fillStyle = '#111827'; // text-gray-900
            ctx.font = 'bold 20px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Pembayaran Berhasil', width / 2, badgeY + 65);

            ctx.fillStyle = '#6b7280'; // text-gray-500
            ctx.font = '13px Arial, sans-serif';
            const subtitleText = `Pembayaran untuk ${item} telah diterima.`;
            // Word wrap subtitle if it is too long
            const maxSubW = cardW - 60;
            if (ctx.measureText(subtitleText).width > maxSubW) {
                const words = subtitleText.split(' ');
                let line1 = '';
                let line2 = '';
                for (let word of words) {
                    if (ctx.measureText(line1 + word).width < maxSubW && line2 === '') {
                        line1 += word + ' ';
                    } else {
                        line2 += word + ' ';
                    }
                }
                ctx.fillText(line1.trim(), width / 2, badgeY + 88);
                ctx.fillText(line2.trim(), width / 2, badgeY + 104);
            } else {
                ctx.fillText(subtitleText, width / 2, badgeY + 88);
            }

            // 6. Dashed Divider 1
            const div1Y = badgeY + 125;
            ctx.save();
            ctx.strokeStyle = '#d1d5db'; // border-gray-300
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(cardX + 25, div1Y);
            ctx.lineTo(cardX + cardW - 25, div1Y);
            ctx.stroke();
            ctx.restore();

            // 7. Details list
            const details = [
                { key: 'Total Bayar', val: formattedAmount, isBold: true, isLarge: true },
                { key: 'Metode', val: payMethod },
                { key: 'Waktu', val: `${dateStr}, ${timeStr}` },
                { key: 'Pembeli', val: maskName(buyerName) },
                { key: 'No. HP', val: maskPhone(phoneNum) }
            ];

            let startY = div1Y + 35;
            const rowHeight = 35;

            details.forEach(det => {
                // Key (left aligned)
                ctx.fillStyle = '#6b7280'; // text-gray-500
                ctx.font = '13px Arial, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(det.key, cardX + 25, startY);

                // Value (right aligned)
                ctx.textAlign = 'right';
                if (det.isBold) {
                    ctx.fillStyle = '#111827';
                    ctx.font = det.isLarge ? 'bold 16px Arial, sans-serif' : 'bold 13px Arial, sans-serif';
                } else {
                    ctx.fillStyle = '#111827';
                    ctx.font = '600 13px Arial, sans-serif';
                }
                ctx.fillText(det.val, cardX + cardW - 25, startY);
                startY += rowHeight;
            });

            // 8. Dashed Divider 2
            const div2Y = startY - 10;
            ctx.save();
            ctx.strokeStyle = '#d1d5db';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(cardX + 25, div2Y);
            ctx.lineTo(cardX + cardW - 25, div2Y);
            ctx.stroke();
            ctx.restore();

            // 9. Transaction ID footer
            ctx.fillStyle = '#9ca3af'; // text-gray-400
            ctx.font = 'bold 9px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('TRANSACTION ID', width / 2, div2Y + 28);

            ctx.fillStyle = '#1f2937'; // text-gray-800
            ctx.font = 'bold 13px Courier New, monospace';
            ctx.fillText(trxId, width / 2, div2Y + 45);

            // Convert to image buffer
            const buffer = canvas.toBuffer('image/png');

            await sock.sendMessage(msg.key.remoteJid, {
                image: buffer,
                caption: `📸 *Bukti Transaksi*\n\n🛍️ *Produk:* ${item}\n💵 *Total:* ${formattedAmount}\n💳 *Metode:* ${payMethod}`
            }, { quoted: msg });

        } catch (err) {
            console.error(err);
            await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal membuat bukti transaksi.' }, { quoted: msg });
        }
    }
};