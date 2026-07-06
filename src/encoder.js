import sharp from 'sharp';
import { CONFIG } from './config.js';

const imageToBitBuffer = async (inputPath) => {
  const rawGrayscalePixels = await sharp(inputPath)
    .resize(CONFIG.WIDTH, CONFIG.HEIGHT, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  const totalPixels = CONFIG.WIDTH * CONFIG.HEIGHT;
  const compressedSize = Math.ceil(totalPixels / 8);
  const bitBuffer = Buffer.alloc(compressedSize);

  for (let i = 0; i < totalPixels; i++) {
    const pixelValue = rawGrayscalePixels[i];
    const bit = pixelValue >= CONFIG.THRESHOLD ? 1 : 0;
    const byteIndex = Math.floor(i / 8);
    const bitIndex = i % 8;

    if (bit === 1) {
      bitBuffer[byteIndex] |= (1 << (7 - bitIndex));
    }
  }

  return bitBuffer;
};

export { imageToBitBuffer };