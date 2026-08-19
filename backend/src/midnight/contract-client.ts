import { createHash } from 'node:crypto';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { config } from '../config/index.js';

// We can import pure circuits from compiled contract
let pureCircuits: any = null;
try {
  const contractModulePath = path.resolve(
    config.contractsPath,
    'managed/zkDraw/contract/index.js',
  );
  if (existsSync(contractModulePath)) {
    // Synchronously or dynamically imported
    const module = await import(`file://${contractModulePath.replace(/\\/g, '/')}`);
    pureCircuits = module.pureCircuits;
  }
} catch (e) {
  console.warn('Warning: Could not dynamically load pureCircuits, fallback enabled:', (e as Error).message);
}

export function getPureCircuits() {
  if (pureCircuits) return pureCircuits;
  throw new Error('Contract pure circuits are not available. Ensure contracts are compiled.');
}

export function loadDeploymentInfo() {
  const deploymentFile = path.join(
    config.contractsPath,
    `deployment.${config.network}.json`,
  );
  if (existsSync(deploymentFile)) {
    try {
      const data = JSON.parse(readFileSync(deploymentFile, 'utf8'));
      return data;
    } catch {
      // Ignore
    }
  }
  return {
    network: config.network,
    contractAddress: config.contractAddress,
    deployedAt: new Date().toISOString(),
  };
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return new Uint8Array(Buffer.from(cleanHex, 'hex'));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function convert31BytesToField(a: Uint8Array): bigint {
  const sliced = a.slice(0, 31);
  let x = 0n;
  for (let i = sliced.length - 1; i >= 0; i -= 1) {
    x = x * 0x100n + BigInt(sliced[i]);
  }
  return x;
}
