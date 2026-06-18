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
        
        // If the original buffer is already under 200 KB, send it directly to keep maximum quality
        if (buffer.length <= 200 * 1024) {
            return buffer;
        }

        // Keep it HD (960px width) but compress it to stay under WhatsApp's limit (~200KB)
        buffer = await sharp(buffer)
            .resize({ width: 960, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85, progressive: true })
            .toBuffer();

        // Safe fallback if still slightly over 200KB
        if (buffer.length > 200 * 1024) {
            buffer = await sharp(buffer)
                .resize({ width: 720, fit: 'inside' })
                .jpeg({ quality: 75 })
                .toBuffer();
        }
        
        return buffer;
    } catch (err) {
        console.error('Failed to process thumbnail image:', err.message);
        return null;
    }
}
