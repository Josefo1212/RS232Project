import { SerialPort } from 'serialport';

const DEFAULT_BAUD_RATE = 9600;
const DEFAULT_INTER_BYTE_DELAY_MS = 5;
const DEFAULT_IDLE_TIMEOUT_MS = 250;
const DEFAULT_OVERALL_TIMEOUT_MS = 10000;

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const openSerialPort = (portPath, baudRate = DEFAULT_BAUD_RATE) => {
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

const transmitBufferWithDelay = async (port, buffer, delayMs = DEFAULT_INTER_BYTE_DELAY_MS) => {
  for (let index = 0; index < buffer.length; index++) {
    await writeToPort(port, Buffer.from([buffer[index]]));
    if (index < buffer.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }
};

const readLine = (port, timeoutMs = 3000) => {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => {
      port.off('data', handler);
      resolve(data);
    }, timeoutMs);

    const handler = (chunk) => {
      data += chunk.toString();
      if (data.includes('\n')) {
        clearTimeout(timer);
        port.off('data', handler);
        resolve(data.split('\n')[0].trim());
      }
    };

    port.on('data', handler);
  });
};

const readExactBytes = (port, count, idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS, overallTimeoutMs = DEFAULT_OVERALL_TIMEOUT_MS) => {
  return new Promise((resolve) => {
    const chunks = [];
    let received = 0;
    let lastDataAt = Date.now();
    const startTime = Date.now();

    const handler = (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      received += buf.length;
      lastDataAt = Date.now();

      if (received >= count) {
        port.off('data', handler);
        resolve(Buffer.concat(chunks, count));
      }
    };

    port.on('data', handler);

    const interval = setInterval(() => {
      const now = Date.now();
      if (received >= count) {
        clearInterval(interval);
        return;
      }
      if (received > 0 && now - lastDataAt >= idleTimeoutMs) {
        clearInterval(interval);
        port.off('data', handler);
        resolve(Buffer.concat(chunks, received));
      }
      if (now - startTime >= overallTimeoutMs) {
        clearInterval(interval);
        port.off('data', handler);
        resolve(Buffer.concat(chunks, received));
      }
    }, 10);
  });
};

export {
  sleep,
  openSerialPort,
  writeToPort,
  sendCommand,
  transmitBufferWithDelay,
  readLine,
  readExactBytes,
};
