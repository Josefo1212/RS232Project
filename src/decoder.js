const sharp = require('sharp');
const { CONFIG } = require('./config.js');

/**
 * Reconstruye un archivo de imagen visible a partir del Buffer de bits crudos.
 * @param {Buffer} bitBuffer - El buffer de bits recuperado.
 * @param {string} outputPath - Destino del archivo PNG final en disco.
 */
const bitBufferToImage = async (bitBuffer, outputPath) => {
  const totalPixels = CONFIG.WIDTH * CONFIG.HEIGHT;
  const expandedGrayscaleBuffer = Buffer.alloc(totalPixels); 

  for (let i = 0; i < totalPixels; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitIndex = i % 8;

    // Aislar el bit específico usando una máscara binaria
    const bit = (bitBuffer[byteIndex] >> (7 - bitIndex)) & 1;

    // Expandir bit (0 o 1) a bytes de color de escala de grises (0 = Negro, 255 = Blanco)
    expandedGrayscaleBuffer[i] = bit === 1 ? 255 : 0;
  }

  // Utilizar la estructura raw de sharp para compilar la imagen
  await sharp(expandedGrayscaleBuffer, {
    raw: {
      width: CONFIG.WIDTH,
      height: CONFIG.HEIGHT,
      channels: 1 // Monocromático
    }
  })
  .png()
  .toFile(outputPath);
};

module.exports = { bitBufferToImage };