import sharp from 'sharp';
import { CONFIG } from './config.js';

const bitBufferToImage = async (bitBuffer, outputPath) => {
  const totalPixels = CONFIG.WIDTH * CONFIG.HEIGHT;
  const expandedGrayscaleBuffer = Buffer.alloc(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitIndex = i % 8;
    const bit = (bitBuffer[byteIndex] >> (7 - bitIndex)) & 1;
    expandedGrayscaleBuffer[i] = bit === 1 ? 255 : 0;
  }

  await sharp(expandedGrayscaleBuffer, {
    raw: {
      width: CONFIG.WIDTH,
      height: CONFIG.HEIGHT,
      channels: 1
    }
  })
  .png()
  .toFile(outputPath);
};

export { bitBufferToImage };