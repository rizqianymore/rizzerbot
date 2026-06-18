import fs from 'fs';
import sharp from 'sharp';

/**
 * Reads a local image file and compresses it to a lightweight JPEG thumbnail
 * if it exceeds 100KB, preventing WhatsApp payload delivery failures.
 * @param {string} imagePath - Absolute or relative path to the image.
 * @returns {Promise<Buffer|null>}
 */
export async function getThumbnailBuffer(imagePath) {
    if (!imagePath) return null;
    try {
        if (!fs.existsSync(imagePath)) return null;
        let buffer = fs.readFileSync(imagePath);
        
        // WhatsApp externalAdReply thumbnail should ideally be < 100KB
        if (buffer.length > 100 * 1024) {
            buffer = await sharp(buffer)
                .resize(300, 168, { fit: 'cover' })
                .jpeg({ quality: 75 })
                .toBuffer();
        }
        return buffer;
    } catch (err) {
        console.error('Failed to process thumbnail image:', err.message);
        return null;
    }
}
