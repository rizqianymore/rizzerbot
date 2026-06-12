import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import sharp from 'sharp';

export async function addStickerMetadata(webpBuffer, packName = 'RizzerBot Stickers', author = 'Pentagon') {
    try {
        let processedBuffer = webpBuffer;
        
        // Use sharp to convert to 512x512 WebP with transparent background if it's a static image
        try {
            processedBuffer = await sharp(webpBuffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 50 })
                .toBuffer();
        } catch (sharpErr) {
            // If sharp fails (e.g., if it is a video/GIF), fall back to letting wa-sticker-formatter handle the raw buffer
            console.warn('[Sticker Pre-process Warning] sharp pre-processing failed, letting wa-sticker-formatter handle it:', sharpErr.message);
        }

        const sticker = new Sticker(processedBuffer, {
            pack: packName,
            author: author,
            type: StickerTypes.FULL,
            quality: 50
        });

        // Let the library compile the TIFF EXIF headers correctly
        const outputBuffer = await sticker.toBuffer();
        return outputBuffer;
    } catch (err) {
        console.error('Failed to write sticker metadata locally:', err);
        return webpBuffer; // fallback to raw buffer on error
    }
}
