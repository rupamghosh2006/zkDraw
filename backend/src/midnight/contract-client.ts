import { createHash } from 'node:crypto';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
import { config } from '../config/index.js';

// Setup compact runtime descriptors for pure circuit fallback
const _descriptor_bytes32 = new __compactRuntime.CompactTypeBytes(32);
const _descriptor_vec2 = new __compactRuntime.CompactTypeVector(2, _descriptor_bytes32);
const _descriptor_vec3 = new __compactRuntime.CompactTypeVector(3, _descriptor_bytes32);
const _descriptor_vec4 = new __compactRuntime.CompactTypeVector(4, _descriptor_bytes32);

function pad32(str: string): Uint8Array {
  const buf = new Uint8Array(32);
  const encoded = Buffer.from(str, 'utf8');
  buf.set(encoded.subarray(0, 32));
  return buf;
}

const fallbackPureCircuits = {
  deriveAdminKey: (secret: Uint8Array): Uint8Array => {
    return __compactRuntime.persistentHash(_descriptor_vec2, [
      pad32('zkDraw:v2:admin'),
      secret,
    ]);
  },
  deriveParticipantKey: (drawId: bigint, secret: Uint8Array): Uint8Array => {
    return __compactRuntime.persistentHash(_descriptor_vec3, [
      pad32('zkDraw:v2:participant'),
      __compactRuntime.convertFieldToBytes(32, drawId, 'zkDraw.compact line 50 char 5'),
      secret,
    ]);
  },
  deriveTicketCommitment: (drawId: bigint, num: bigint, salt: Uint8Array): Uint8Array => {
    return __compactRuntime.persistentHash(_descriptor_vec4, [
      pad32('zkDraw:v2:ticket'),
      __compactRuntime.convertFieldToBytes(32, drawId, 'zkDraw.compact line 62 char 5'),
      __compactRuntime.convertFieldToBytes(32, num, 'zkDraw.compact line 63 char 5'),
      salt,
    ]);
  },
  deriveDrawCommitment: (secret: Uint8Array): Uint8Array => {
    return __compactRuntime.persistentHash(_descriptor_vec2, [
      pad32('zkDraw:v2:draw_secret'),
      secret,
    ]);
  },
  deriveWinningEntropy: (drawId: bigint, revealedSecret: Uint8Array, count: bigint): Uint8Array => {
    return __compactRuntime.persistentHash(_descriptor_vec4, [
      pad32('zkDraw:v2:winner_entropy'),
      __compactRuntime.convertFieldToBytes(32, drawId, 'zkDraw.compact line 86 char 5'),
      revealedSecret,
      __compactRuntime.convertFieldToBytes(32, count, 'zkDraw.compact line 88 char 5'),
    ]);
  },
  deriveClaimNullifier: (drawId: bigint, commitment: Uint8Array, secret: Uint8Array): Uint8Array => {
    return __compactRuntime.persistentHash(_descriptor_vec4, [
      pad32('zkDraw:v2:claim'),
      __compactRuntime.convertFieldToBytes(32, drawId, 'zkDraw.compact line 99 char 5'),
      commitment,
      secret,
    ]);
  },
};

// Attempt to load pure circuits and ledger from compiled contract if available
let pureCircuits: any = fallbackPureCircuits;
let contractLedgerFn: any = null;
let compactRuntimeModule: any = __compactRuntime;
try {
  const contractModulePath = path.resolve(
    config.contractsPath,
    'managed/zkDraw/contract/index.js',
  );
  const contractRuntimePath = path.resolve(
    config.contractsPath,
    'node_modules/@midnight-ntwrk/compact-runtime/dist/index.js',
  );
  if (existsSync(contractRuntimePath)) {
    compactRuntimeModule = await import(`file://${contractRuntimePath.replace(/\\/g, '/')}`);
  }
  if (existsSync(contractModulePath)) {
    const module = await import(`file://${contractModulePath.replace(/\\/g, '/')}`);
    if (module?.pureCircuits) {
      pureCircuits = module.pureCircuits;
    }
    if (module?.ledger) {
      contractLedgerFn = module.ledger;
    }
  }
} catch (e) {
  // Use fallbackPureCircuits seamlessly
}

export function getPureCircuits() {
  return pureCircuits ?? fallbackPureCircuits;
}

export async function fetchLiveContractState(
  indexerUrl: string,
  contractAddress: string,
  drawId: number = 0,
) {
  try {
    const cleanAddress = contractAddress.replace(/^0x/, '');
    const query = `query GetContractState($address: HexEncoded!) {
      contractAction(address: $address) {
        address
        state
      }
    }`;
    const res = await fetch(indexerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { address: cleanAddress } }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const stateHex = json?.data?.contractAction?.state;
    if (!stateHex) return null;

    const bytes = hexToBytes(stateHex);
    const contractStateObj = compactRuntimeModule.ContractState.deserialize(bytes);
    if (!contractLedgerFn) return null;
    const decoded = contractLedgerFn(contractStateObj.data);

    let drawObj: any = null;
    if (decoded.draws) {
      if (typeof decoded.draws.lookup === 'function') {
        try {
          if (decoded.draws.member(BigInt(drawId))) {
            drawObj = decoded.draws.lookup(BigInt(drawId));
          }
        } catch {}
      }
      if (!drawObj) {
        try {
          for (const [id, d] of decoded.draws) {
            if (Number(id) === drawId) {
              drawObj = d;
              break;
            }
          }
        } catch {}
      }
      if (!drawObj) {
        try {
          if (typeof decoded.draws.size === 'function' && decoded.draws.size() > 0n) {
            for (const [, d] of decoded.draws) {
              drawObj = d;
              break;
            }
          }
        } catch {}
      }
    } else if (decoded.ticketPrice !== undefined) {
      // Legacy single-draw contract support
      drawObj = decoded;
    }

    if (!drawObj) return null;

    const statusRaw = Number(drawObj.status);
    const status: 'OPEN' | 'CLOSED' | 'DRAWN' =
      statusRaw === 0 ? 'OPEN' : statusRaw === 1 ? 'CLOSED' : 'DRAWN';

    const ticketCommitments: string[] = [];
    if (decoded.ticketCommitments) {
      for (const c of decoded.ticketCommitments) {
        ticketCommitments.push(bytesToHex(c));
      }
    }
    const participants: string[] = [];
    if (decoded.participants) {
      for (const p of decoded.participants) {
        participants.push(bytesToHex(p));
      }
    }
    const claimedNullifiers: string[] = [];
    if (decoded.claimedNullifiers) {
      for (const n of decoded.claimedNullifiers) {
        claimedNullifiers.push(bytesToHex(n));
      }
    }

    return {
      adminHex: bytesToHex(drawObj.admin),
      status,
      ticketPrice: drawObj.ticketPrice.toString(),
      rangeMin: Number(drawObj.rangeMin),
      rangeMax: Number(drawObj.rangeMax),
      maxTickets: Number(drawObj.maxTickets),
      ticketCount: Number(drawObj.ticketCount),
      drawCommitmentHex: bytesToHex(drawObj.drawCommitment),
      winningNumber: Number(drawObj.winningNumber),
      entropyRevealedHex: bytesToHex(drawObj.entropyRevealed),
      ticketCommitments,
      participants,
      claimedNullifiers,
      winnerCount: claimedNullifiers.length,
    };
  } catch (err) {
    console.warn(`Error fetching live contract state for ${contractAddress}:`, err);
    return null;
  }
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
