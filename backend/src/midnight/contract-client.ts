import { createHash } from 'node:crypto';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
import { config } from '../config/index.js';

// Setup compact runtime descriptors for pure circuit fallback
const _descriptor_bytes32 = new __compactRuntime.CompactTypeBytes(32);
const _descriptor_vec2 = new __compactRuntime.CompactTypeVector(2, _descriptor_bytes32);
const _descriptor_vec3 = new __compactRuntime.CompactTypeVector(3, _descriptor_bytes32);

function pad32(str: string): Uint8Array {
  const buf = new Uint8Array(32);
  const encoded = Buffer.from(str, 'utf8');
  buf.set(encoded.subarray(0, 32));
  return buf;
}

const fallbackPureCircuits = {
  deriveAdminKey: (secret: Uint8Array): Uint8Array => {
    return __compactRuntime.persistentHash(_descriptor_vec2, [
      pad32('zkDraw:v1:admin'),
      secret,
    ]);
  },
  deriveTicketCommitment: (num: bigint, salt: Uint8Array): Uint8Array => {
    return __compactRuntime.persistentHash(_descriptor_vec3, [
      pad32('zkDraw:v1:ticket'),
      __compactRuntime.convertFieldToBytes(32, num, 'zkDraw.compact line 44 char 5'),
      salt,
    ]);
  },
  deriveDrawCommitment: (secret: Uint8Array): Uint8Array => {
    return __compactRuntime.persistentHash(_descriptor_vec2, [
      pad32('zkDraw:v1:draw_secret'),
      secret,
    ]);
  },
  deriveWinningEntropy: (revealedSecret: Uint8Array, count: bigint): Uint8Array => {
    return __compactRuntime.persistentHash(_descriptor_vec3, [
      pad32('zkDraw:v1:winner_entropy'),
      revealedSecret,
      __compactRuntime.convertFieldToBytes(32, count, 'zkDraw.compact line 68 char 5'),
    ]);
  },
  deriveClaimNullifier: (commitment: Uint8Array, secret: Uint8Array): Uint8Array => {
    return __compactRuntime.persistentHash(_descriptor_vec3, [
      pad32('zkDraw:v1:claim'),
      commitment,
      secret,
    ]);
  },
};

// Attempt to load pure circuits from compiled contract if available
let pureCircuits: any = fallbackPureCircuits;
try {
  const contractModulePath = path.resolve(
    config.contractsPath,
    'managed/zkDraw/contract/index.js',
  );
  if (existsSync(contractModulePath)) {
    const module = await import(`file://${contractModulePath.replace(/\\/g, '/')}`);
    if (module?.pureCircuits) {
      pureCircuits = module.pureCircuits;
    }
  }
} catch (e) {
  // Use fallbackPureCircuits seamlessly
}

export function getPureCircuits() {
  return pureCircuits ?? fallbackPureCircuits;
}

export function loadDeploymentInfo() {
  const specificFile = path.join(
    config.contractsPath,
    `deployment.${config.network}.json`,
  );
  const defaultFile = path.join(
    config.contractsPath,
    'deployment.json',
  );
  const deploymentFile = existsSync(specificFile) ? specificFile : defaultFile;
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
