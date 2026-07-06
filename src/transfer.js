import fs from 'fs';
import { exec } from 'child_process';
import { imageToBitBuffer } from './encoder.js';
import { bitBufferToImage } from './decoder.js';
import {
  sleep,
  openSerialPort,
  sendCommand,
  writeToPort,
  transmitBufferWithDelay,
  readLine,
  readExactBytes,
} from './serial.js';

const writeImageToArduino = async (portPath, inputPath, baudRate, delayMs) => {
  const bitBuffer = await imageToBitBuffer(inputPath);
  const port = await openSerialPort(portPath, baudRate);

  try {
    await sleep(2500);

    await sendCommand(port, 'W');

    const response = await readLine(port, 3000);
    if (!response.includes('READY')) {
      throw new Error(`Arduino no confirmo recepcion: "${response}"`);
    }

    const header = Buffer.alloc(2);
    header.writeUInt16BE(bitBuffer.length, 0);
    await writeToPort(port, header);

    await transmitBufferWithDelay(port, bitBuffer, delayMs);

    const result = await readLine(port, 3000);
    if (!result.includes('OK')) {
      throw new Error(`Arduino reporto error: "${result}"`);
    }
  } finally {
    await new Promise((resolve) => port.close(() => resolve()));
  }

  return bitBuffer;
};

const recoverImageFromArduino = async (portPath, baudRate, idleTimeoutMs, overallTimeoutMs, outputPath, binOutputPath) => {
  const port = await openSerialPort(portPath, baudRate);

  try {
    await sleep(2500);

    await sendCommand(port, 'R');

    const response = await readLine(port, 3000);
    if (!response.includes('SEND')) {
      throw new Error(`Arduino no confirmo envio: "${response}"`);
    }

    const headerBuffer = await readExactBytes(port, 2, idleTimeoutMs, overallTimeoutMs);
    if (headerBuffer.length < 2) {
      throw new Error('No se recibio el header de tamano');
    }
    const dataLength = headerBuffer.readUInt16BE(0);

    const receivedBuffer = await readExactBytes(port, dataLength, idleTimeoutMs, overallTimeoutMs);

    if (binOutputPath) {
      fs.writeFileSync(binOutputPath, receivedBuffer);
    }

    if (outputPath) {
      await bitBufferToImage(receivedBuffer, outputPath);
      openImage(outputPath);
    }

    return receivedBuffer;
  } finally {
    await new Promise((resolve) => port.close(() => resolve()));
  }
};

const openImage = (filePath) => {
  return new Promise((resolve) => {
    exec(`start "" "${filePath}"`, () => resolve());
  });
};

const roundTrip = async (portPath, inputPath, baudRate, delayMs, idleTimeoutMs, overallTimeoutMs, outputPath, binOutputPath) => {
  await writeImageToArduino(portPath, inputPath, baudRate, delayMs);
  return recoverImageFromArduino(portPath, baudRate, idleTimeoutMs, overallTimeoutMs, outputPath, binOutputPath);
};

export { writeImageToArduino, recoverImageFromArduino, roundTrip };
