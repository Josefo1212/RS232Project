const fs = require('fs');
const { bitBufferToImage } = require('./decoder.js');

const testDecoding = async () => {
  try {
    const binInput = './output_image.bin';
    const imageOutput = './restored_output.png';

    if (!fs.existsSync(binInput)) {
      console.error("❌ Error: No se detecta 'output_image.bin'. Corre pnpm encode primero.");
      return;
    }

    console.log("⏳ Leyendo bytes crudos y desempaquetando matriz binaria...");
    const buffer = fs.readFileSync(binInput);
    
    await bitBufferToImage(buffer, imageOutput);
    console.log(`✅ ¡Imagen reconstruida con éxito! Verificable en: ${imageOutput}`);
  } catch (err) {
    console.error("❌ Falla crítica en decodificación:", err);
  }
};
testDecoding();