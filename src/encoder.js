const sharp = require('sharp');
const { CONFIG } = require('./config.js');

/**
 * Transforma una imagen en un Buffer empaquetado a nivel de bits (Big-Endian).
 * @param {string} inputPath - Ruta del archivo de imagen de origen.
 * @returns {Promise<Buffer>} Buffer binario optimizado (128 bytes para 32x32).
 */
const imageToBitBuffer = async (inputPath) => {
  // 1. Redimensionar, pasar a escala de grises y extraer canales raw de 8-bits
  const rawGrayscalePixels = await sharp(inputPath)
    .resize(CONFIG.WIDTH, CONFIG.HEIGHT, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  const totalPixels = CONFIG.WIDTH * CONFIG.HEIGHT;
  const compressedSize = Math.ceil(totalPixels / 8);
  const bitBuffer = Buffer.alloc(compressedSize); // Exactamente 128 bytes

  for (let i = 0; i < totalPixels; i++) {
    const pixelValue = rawGrayscalePixels[i];
    
    // Aplicación estricta del umbral de binarización
    const bit = pixelValue >= CONFIG.THRESHOLD ? 1 : 0;

    const byteIndex = Math.floor(i / 8);
    const bitIndex = i % 8;

    // Inserción del bit en el byte correspondiente: Big-Endian (MSB primero)
    if (bit === 1) {
      bitBuffer[byteIndex] |= (1 << (7 - bitIndex));
    }
  }

  return bitBuffer;
};

module.exports = { imageToBitBuffer };