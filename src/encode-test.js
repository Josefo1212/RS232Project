const fs = require('fs');
const { imageToBitBuffer } = require('./encoder.js');

const testEncoding = async () => {
  try {
    const inputFile = './input.png';
    const binOutputFile = './output_image.bin';

    if (!fs.existsSync(inputFile)) {
      console.error("❌ Error: Coloca un archivo 'input.png' en la raíz de tu proyecto para correr el test.");
      return;
    }

    console.log("⏳ Ejecutando análisis, re-dimensionamiento y empaquetamiento binario...");
    const buffer = await imageToBitBuffer(inputFile);

    fs.writeFileSync(binOutputFile, buffer);
    console.log("✅ ¡Proceso finalizado con éxito!");
    console.log(`📊 Tamaño exacto del buffer: ${buffer.length} bytes.`);
    console.log(`🔍 Huella Hexadecimal para Jose:\n[ ${buffer.toString('hex').toUpperCase()} ]`);
  } catch (err) {
    console.error("❌ Falla crítica en codificación:", err);
  }
};
testEncoding();