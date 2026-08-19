import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourceRelative = 'zkDraw.compact';
const outputRelative = 'managed/zkDraw';

const source = path.join(rootDir, sourceRelative);
const output = path.join(rootDir, outputRelative);

if (!existsSync(source)) {
  throw new Error(`Compact source is missing: ${source}`);
}

console.log(`Compiling Compact contract: ${sourceRelative} -> ${outputRelative}`);

let result;
if (process.platform === 'win32') {
  // Convert Windows path to WSL path
  const toWslPath = (winPath) => {
    const resolved = path.resolve(winPath).replace(/\\/g, '/');
    const driveMatch = resolved.match(/^([A-Za-z]):\/(.*)$/);
    if (driveMatch) {
      return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
    }
    return resolved;
  };

  const wslSource = toWslPath(source);
  const wslOutput = toWslPath(output);
  const compactBin = process.env.COMPACT_BIN ?? '/home/rupamghosh2006/.local/bin/compact';

  console.log(`Running compact via WSL: ${compactBin} compile "${wslSource}" "${wslOutput}"`);
  result = spawnSync('wsl', ['-e', 'sh', '-c', `"${compactBin}" compile "${wslSource}" "${wslOutput}"`], {
    stdio: 'inherit',
  });
} else {
  const compiler = process.env.COMPACT_BIN ?? 'compact';
  result = spawnSync(compiler, ['compile', source, output], { stdio: 'inherit' });
}

if (result.error) {
  throw new Error(`Unable to run Midnight Compact compiler: ${result.error.message}`);
}

if (result.status !== 0) {
  console.error(`Compact compilation failed with code ${result.status}`);
  process.exit(result.status ?? 1);
}

console.log('Compact contract compiled successfully!');
