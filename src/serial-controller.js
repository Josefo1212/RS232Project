const fs = require('fs');
const { SerialPort } = require('serialport');
const { imageToBitBuffer } = require('./encoder.js');
const { bitBufferToImage } = require('./decoder.js');

const DEFAULT_BAUD_RATE = 9600;
const DEFAULT_INTER_BYTE_DELAY_MS = 5;
const DEFAULT_IDLE_TIMEOUT_MS = 250;
const DEFAULT_OVERALL_TIMEOUT_MS = 10000;

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const parseArgs = (argv) => {
  const args = {
    command: 'roundtrip',
    port: process.env.SERIAL_PORT || process.env.COM_PORT || '',
    input: './input.png',
    output: './arduino_output.png',
    binOutput: './arduino_output.bin',
    baudRate: DEFAULT_BAUD_RATE,
    delayMs: DEFAULT_INTER_BYTE_DELAY_MS,
    expectedBytes: 0,
    idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
    overallTimeoutMs: DEFAULT_OVERALL_TIMEOUT_MS,
  };

  const positional = [];

  for (let index = 2; index < argv.length; index++) {
    const current = argv[index];

    if (current.startsWith('--')) {
      const [rawKey, inlineValue] = current.slice(2).split('=');
      const nextValue = inlineValue ?? argv[index + 1];

      switch (rawKey) {
        case 'port':
          args.port = nextValue;
          if (inlineValue === undefined) index++;
          break;
        case 'input':
          args.input = nextValue;
          if (inlineValue === undefined) index++;
          break;
        case 'output':
          args.output = nextValue;
          if (inlineValue === undefined) index++;
          break;
        case 'bin-output':
          args.binOutput = nextValue;
          if (inlineValue === undefined) index++;
          break;
        case 'baud':
          args.baudRate = Number(nextValue);
          if (inlineValue === undefined) index++;
          break;
        case 'delay':
          args.delayMs = Number(nextValue);
          if (inlineValue === undefined) index++;
          break;
        case 'expected-bytes':
          args.expectedBytes = Number(nextValue);
          if (inlineValue === undefined) index++;
          break;
        case 'idle-timeout':
          args.idleTimeoutMs = Number(nextValue);
          if (inlineValue === undefined) index++;
          break;
        case 'overall-timeout':
          args.overallTimeoutMs = Number(nextValue);
          if (inlineValue === undefined) index++;
          break;
        default:
          break;
      }
    } else {
      positional.push(current);
    }
  }

  if (positional.length > 0) {
    args.command = positional[0];
  }

  return args;
};

const requirePortPath = (portPath) => {
  if (!portPath) {
    throw new Error('Debes indicar un puerto serie con --port o la variable SERIAL_PORT.');
  }
};

const openSerialPort = (portPath, baudRate) => {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({
      path: portPath,
      baudRate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false,
    });

    port.open((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(port);
    });
  });
};

const writeToPort = (port, data) => {
  return new Promise((resolve, reject) => {
    port.write(data, (error) => {
      if (error) {
        reject(error);
        return;
      }

      port.drain((drainError) => {
        if (drainError) {
          reject(drainError);
          return;
        }

        resolve();
      });
    });
  });
};

const sendCommand = async (port, command) => {
  await writeToPort(port, Buffer.from(command, 'utf8'));
};

const transmitBufferWithDelay = async (port, buffer, delayMs) => {
  for (let index = 0; index < buffer.length; index++) {
    await writeToPort(port, Buffer.from([buffer[index]]));

    if (index < buffer.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }
};

const receiveBuffer = async (port, { expectedBytes, idleTimeoutMs, overallTimeoutMs }) => {
  const chunks = [];
  let receivedBytes = 0;
  let lastDataAt = Date.now();

  const dataHandler = (chunk) => {
    const bufferChunk = Buffer.from(chunk);
    chunks.push(bufferChunk);
    receivedBytes += bufferChunk.length;
    lastDataAt = Date.now();
  };

  port.on('data', dataHandler);

  try {
    const startTime = Date.now();

    while (true) {
      if (expectedBytes > 0 && receivedBytes >= expectedBytes) {
        break;
      }

      const now = Date.now();

      if (now - startTime >= overallTimeoutMs) {
        break;
      }

      if (receivedBytes > 0 && now - lastDataAt >= idleTimeoutMs) {
        break;
      }

      await sleep(10);
    }
  } finally {
    port.off('data', dataHandler);
  }

  return Buffer.concat(chunks, receivedBytes);
};

const writeImageToArduino = async (portPath, inputPath, baudRate, delayMs) => {
  const bitBuffer = await imageToBitBuffer(inputPath);
  const port = await openSerialPort(portPath, baudRate);

  try {
    await sendCommand(port, 'W');
    await transmitBufferWithDelay(port, bitBuffer, delayMs);
  } finally {
    await new Promise((resolve) => port.close(() => resolve()));
  }

  return bitBuffer;
};

const recoverImageFromArduino = async (portPath, baudRate, expectedBytes, idleTimeoutMs, overallTimeoutMs, outputPath, binOutputPath) => {
  const port = await openSerialPort(portPath, baudRate);

  try {
    await sendCommand(port, 'R');
    const receivedBuffer = await receiveBuffer(port, {
      expectedBytes,
      idleTimeoutMs,
      overallTimeoutMs,
    });

    if (binOutputPath) {
      fs.writeFileSync(binOutputPath, receivedBuffer);
    }

    if (outputPath) {
      await bitBufferToImage(receivedBuffer, outputPath);
    }

    return receivedBuffer;
  } finally {
    await new Promise((resolve) => port.close(() => resolve()));
  }
};

const roundTrip = async (portPath, inputPath, baudRate, delayMs, idleTimeoutMs, overallTimeoutMs, outputPath, binOutputPath) => {
  const bitBuffer = await writeImageToArduino(portPath, inputPath, baudRate, delayMs);
  return recoverImageFromArduino(
    portPath,
    baudRate,
    bitBuffer.length,
    idleTimeoutMs,
    overallTimeoutMs,
    outputPath,
    binOutputPath,
  );
};

const main = async () => {
  const args = parseArgs(process.argv);
  requirePortPath(args.port);

  if (args.command === 'send') {
    const bitBuffer = await writeImageToArduino(args.port, args.input, args.baudRate, args.delayMs);
    console.log(`Enviado a Arduino: ${bitBuffer.length} bytes.`);
    return;
  }

  if (args.command === 'receive') {
    const receivedBuffer = await recoverImageFromArduino(
      args.port,
      args.baudRate,
      args.expectedBytes,
      args.idleTimeoutMs,
      args.overallTimeoutMs,
      args.output,
      args.binOutput,
    );
    console.log(`Recibido desde Arduino: ${receivedBuffer.length} bytes.`);
    return;
  }

  const receivedBuffer = await roundTrip(
    args.port,
    args.input,
    args.baudRate,
    args.delayMs,
    args.idleTimeoutMs,
    args.overallTimeoutMs,
    args.output,
    args.binOutput,
  );

  console.log(`Flujo completo terminado. Bytes recuperados: ${receivedBuffer.length}.`);
};

main().catch((error) => {
  console.error('Error en el flujo serie de Luismi:', error);
  process.exitCode = 1;
});

module.exports = {
  openSerialPort,
  receiveBuffer,
  recoverImageFromArduino,
  roundTrip,
  sendCommand,
  transmitBufferWithDelay,
  writeImageToArduino,
};