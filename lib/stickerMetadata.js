import sharp from 'sharp';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import webpmux from 'node-webpmux';

export async function addStickerMetadata(webpBuffer, packName = 'RizzerBot Stickers', author = 'Pentagon') {
    try {
        const isGif = webpBuffer.toString('ascii', 0, 10).includes('GIF');
        const isVideo = webpBuffer.toString('ascii', 0, 10).includes('ftyp') ||
                        webpBuffer.toString('ascii', 0, 30).includes('mp4');
        const isAnimatedWebP = webpBuffer.toString('ascii', 0, 1000).includes('ANIM');

        let webp;

        if (isVideo) {
            // Video (MP4) needs wa-sticker-formatter's ffmpeg conversion pipeline
            const sticker = new Sticker(webpBuffer, {
                pack: packName,
                author: author,
                type: StickerTypes.FULL,
                quality: 40 // lower quality for animated to stay under 100 KB
            });
            return await sticker.toBuffer();
        } else if (isGif || isAnimatedWebP) {
            // GIF or Animated WebP: Process natively with sharp (extremely fast & transparent)
            webp = await sharp(webpBuffer, { animated: true })
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 40 })
                .toBuffer();
        } else {
            // Static Image: Process natively with sharp
            webp = await sharp(webpBuffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 50 })
                .toBuffer();
        }

        const json = {
            'sticker-pack-id': `rizzerbot-${Date.now()}`,
            'sticker-pack-name': packName,
            'sticker-pack-publisher': author,
            'emojis': ['🤩', '🎉']
        };

        const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8');
        const exifHeader = Buffer.from([
            0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 
            0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 
            0x00, 0x00, 0x16, 0x00, 0x00, 0x00
        ]);

        exifHeader.writeUInt32LE(jsonBuffer.length, 14);
        const exifBuffer = Buffer.concat([exifHeader, jsonBuffer]);

        const img = new webpmux.Image();
        await img.load(webp);
        img.exif = exifBuffer;
        
        return await img.save(null);
    } catch (err) {
        console.error('Failed to write sticker metadata locally:', err);
        return webpBuffer;
    }
}
