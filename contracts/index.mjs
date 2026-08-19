import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

export {
  Contract,
  ledger,
  pureCircuits,
} from './managed/zkDraw/contract/index.js';
import { Contract } from './managed/zkDraw/contract/index.js';

const contractDirectory = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.join(contractDirectory, 'managed', 'zkDraw');

export const createCompiledZkDrawContract = (witnesses) =>
  CompiledContract.make('zkDrawContract', Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );
