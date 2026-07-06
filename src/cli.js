import readline from 'readline';
import { CONFIG } from './config.js';
import { writeImageToArduino, recoverImageFromArduino, roundTrip } from './transfer.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

const parseArgs = (argv) => {
  const args = {
    command: '',
    port: process.env.SERIAL_PORT || process.env.COM_PORT || '',
    input: './logo.png',
    output: './arduino_output.png',
    binOutput: './arduino_output.bin',
    baudRate: 9600,
    delayMs: 5,
    idleTimeoutMs: 250,
    overallTimeoutMs: 10000,
  };

  for (let index = 2; index < argv.length; index++) {
    const current = argv[index];
    if (current.startsWith('--')) {
      const [rawKey, inlineValue] = current.slice(2).split('=');
      const nextValue = inlineValue ?? argv[index + 1];
      switch (rawKey) {
        case 'port': args.port = nextValue; if (inlineValue === undefined) index++; break;
        case 'input': args.input = nextValue; if (inlineValue === undefined) index++; break;
        case 'output': args.output = nextValue; if (inlineValue === undefined) index++; break;
        case 'bin-output': args.binOutput = nextValue; if (inlineValue === undefined) index++; break;
        case 'baud': args.baudRate = Number(nextValue); if (inlineValue === undefined) index++; break;
        case 'delay': args.delayMs = Number(nextValue); if (inlineValue === undefined) index++; break;
        case 'idle-timeout': args.idleTimeoutMs = Number(nextValue); if (inlineValue === undefined) index++; break;
        case 'overall-timeout': args.overallTimeoutMs = Number(nextValue); if (inlineValue === undefined) index++; break;
      }
    } else {
      args.command = current;
    }
  }

  return args;
};

const runCliMode = async (args) => {
  const { port, input, output, binOutput, baudRate, delayMs, idleTimeoutMs, overallTimeoutMs, command } = args;

  if (command === 'send') {
    await writeImageToArduino(port, input, baudRate, delayMs);
    console.log(`Enviado a Arduino: OK`);
    return;
  }

  if (command === 'receive') {
    const buffer = await recoverImageFromArduino(port, baudRate, idleTimeoutMs, overallTimeoutMs, output, binOutput);
    console.log(`Recibido desde Arduino: ${buffer.length} bytes.`);
    return;
  }

  const buffer = await roundTrip(port, input, baudRate, delayMs, idleTimeoutMs, overallTimeoutMs, output, binOutput);
  console.log(`Roundtrip completado. Bytes recuperados: ${buffer.length}.`);
};

const showMenu = () => {
  console.log('\n--- RS232 - Transferencia de Imagen ---');
  console.log('1. Enviar imagen a Arduino');
  console.log('2. Recibir imagen desde Arduino');
  console.log('3. Roundtrip (enviar + recibir)');
  console.log('0. Salir\n');
};

const runInteractiveMode = async (args) => {
  const { input, output, binOutput, baudRate, delayMs, idleTimeoutMs, overallTimeoutMs } = args;
  let port = args.port || CONFIG.DEFAULT_PORT;

  console.log('--- RS232 - Transferencia de Imagen ---\n');

  while (!port) {
    port = await ask('Puerto COM (ej: COM3): ');
    if (!port) console.log('El puerto es obligatorio.');
  }

  while (true) {
    showMenu();
    const option = await ask('Selecciona una opcion: ');

    try {
      if (option === '1') {
        console.log('\nEnviando imagen...');
        await writeImageToArduino(port, input, baudRate, delayMs);
        console.log('Imagen enviada correctamente.\n');
      } else if (option === '2') {
        console.log('\nRecibiendo imagen...');
        const buffer = await recoverImageFromArduino(port, baudRate, idleTimeoutMs, overallTimeoutMs, output, binOutput);
        console.log(`Imagen recibida: ${buffer.length} bytes.\n`);
      } else if (option === '3') {
        console.log('\nEjecutando roundtrip...');
        const buffer = await roundTrip(port, input, baudRate, delayMs, idleTimeoutMs, overallTimeoutMs, output, binOutput);
        console.log(`Roundtrip completado: ${buffer.length} bytes.\n`);
      } else if (option === '0') {
        console.log('Saliendo...');
        break;
      } else {
        console.log('Opcion no valida.\n');
      }
    } catch (error) {
      console.error(`Error: ${error.message}\n`);
    }
  }

  rl.close();
};

const main = async () => {
  const args = parseArgs(process.argv);

  if (args.port) {
    await runCliMode(args);
    process.exit(0);
  }

  await runInteractiveMode(args);
};

main().catch((error) => {
  console.error('Error:', error);
  process.exitCode = 1;
});
