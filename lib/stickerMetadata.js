import { Sticker, StickerTypes } from 'wa-sticker-formatter';

export async function addStickerMetadata(webpBuffer, packName = 'RizzerBot Stickers', author = 'Pentagon') {
    try {
        // Create an official Sticker instance from the buffer and inject standard EXIF metadata
        const sticker = new Sticker(webpBuffer, {
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
