// Browser-compatible cryptographic witness and commitment derivation

export function generateRandomHex(byteCount = 32): string {
  const bytes = new Uint8Array(byteCount);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function sha256Pure(data: Uint8Array): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const len = data.length;
  const bitLen = len * 8;
  const withPadLen = ((len + 8 + 64) >>> 6) << 6;
  const buf = new Uint8Array(withPadLen);
  buf.set(data);
  buf[len] = 0x80;

  const view = new DataView(buf.buffer);
  view.setUint32(withPadLen - 4, bitLen & 0xffffffff);
  view.setUint32(withPadLen - 8, Math.floor(bitLen / 0x100000000));

  const W = new Uint32Array(64);

  for (let i = 0; i < withPadLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^ ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^ (W[t - 15] >>> 3);
      const s1 = ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^ ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, H0);
  outView.setUint32(4, H1);
  outView.setUint32(8, H2);
  outView.setUint32(12, H3);
  outView.setUint32(16, H4);
  outView.setUint32(20, H5);
  outView.setUint32(24, H6);
  outView.setUint32(28, H7);
  return Array.from(out).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle?.digest) {
    try {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback to pure JS on any SubtleCrypto error
    }
  }
  return sha256Pure(data);
}


export function pad32String(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  const result = new Uint8Array(32);
  result.set(encoded.slice(0, 32));
  return result;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

import { pureCircuits } from '../contract/index.js';

/**
 * Computes the domain-separated ticket commitment in the user's browser:
 * H("zkDraw:v2:ticket" || drawId || num || salt)
 */
export async function computeClientTicketCommitment(
  ticketNumber: number,
  saltHex: string,
  drawId: number = 0,
): Promise<string> {
  try {
    const saltBytes = hexToBytes(saltHex);
    const commitmentBytes = pureCircuits.deriveTicketCommitment(
      BigInt(drawId),
      BigInt(ticketNumber),
      saltBytes,
    );
    return bytesToHex(commitmentBytes);
  } catch (err) {
    // Fallback if pure circuit throws
    const domainTag = pad32String('zkDraw:v2:ticket');
    const drawIdBytes = new Uint8Array(32);
    let d = BigInt(drawId);
    for (let i = 0; i < 32 && d > 0n; i++) {
      drawIdBytes[i] = Number(d & 0xffn);
      d = d >> 8n;
    }
    const numBytes = new Uint8Array(32);
    let n = BigInt(ticketNumber);
    for (let i = 0; i < 32 && n > 0n; i++) {
      numBytes[i] = Number(n & 0xffn);
      n = n >> 8n;
    }
    const saltBytes = hexToBytes(saltHex);
    const combined = new Uint8Array(32 + 32 + 32 + 32);
    combined.set(domainTag, 0);
    combined.set(drawIdBytes, 32);
    combined.set(numBytes, 64);
    combined.set(saltBytes, 96);
    return sha256Hex(combined);
  }
}

/**
 * Computes claim nullifier for winner:
 * H("zkDraw:v2:claim" || drawId || commitment || playerSecret)
 */
export async function computeClientClaimNullifier(
  commitmentHex: string,
  playerSecretHex: string,
  drawId: number = 0,
): Promise<string> {
  try {
    const commitmentBytes = hexToBytes(commitmentHex);
    const secretBytes = hexToBytes(playerSecretHex);
    const nullifierBytes = pureCircuits.deriveClaimNullifier(
      BigInt(drawId),
      commitmentBytes,
      secretBytes,
    );
    return bytesToHex(nullifierBytes);
  } catch (err) {
    const domainTag = pad32String('zkDraw:v2:claim');
    const drawIdBytes = new Uint8Array(32);
    let d = BigInt(drawId);
    for (let i = 0; i < 32 && d > 0n; i++) {
      drawIdBytes[i] = Number(d & 0xffn);
      d = d >> 8n;
    }
    const commitmentBytes = hexToBytes(commitmentHex);
    const secretBytes = hexToBytes(playerSecretHex);
    const combined = new Uint8Array(32 + 32 + 32 + 32);
    combined.set(domainTag, 0);
    combined.set(drawIdBytes, 32);
    combined.set(commitmentBytes, 64);
    combined.set(secretBytes, 96);
    return sha256Hex(combined);
  }
}

/**
 * Deterministically derives the player's private witness secret from their wallet address.
 * Kept strictly confidential on client (private witness, never disclosed on-chain or to backend).
 * Domain separated: SHA-256("zkDraw:v2:player:" || walletAddress)
 */
export async function derivePlayerSecret(walletAddress: string): Promise<string> {
  const cleanAddr = walletAddress.trim().toLowerCase();
  const domainTag = 'zkDraw:v2:player:';
  const encoded = new TextEncoder().encode(`${domainTag}${cleanAddr}`);
  return sha256Hex(encoded);
}

/**
 * Computes the domain-separated participant key in the user's browser:
 * H("zkDraw:v2:participant" || drawId || secret)
 * Matches Midnight smart contract pure circuit: participantKey(drawId, secret)
 */
export async function computeClientParticipantKey(
  drawId: number,
  playerSecretHex: string,
): Promise<string> {
  try {
    const secretBytes = hexToBytes(playerSecretHex);
    const pKeyBytes = pureCircuits.deriveParticipantKey(BigInt(drawId), secretBytes);
    return bytesToHex(pKeyBytes);
  } catch (err) {
    const domainTag = pad32String('zkDraw:v2:participant');
    const drawIdBytes = new Uint8Array(32);
    let d = BigInt(drawId);
    for (let i = 0; i < 32 && d > 0n; i++) {
      drawIdBytes[i] = Number(d & 0xffn);
      d = d >> 8n;
    }
    const secretBytes = hexToBytes(playerSecretHex);
    const combined = new Uint8Array(32 + 32 + 32);
    combined.set(domainTag, 0);
    combined.set(drawIdBytes, 32);
    combined.set(secretBytes, 64);
    return sha256Hex(combined);
  }
}

export interface CreatorSecrets {
  adminSecretHex: string;
  drawSecretHex: string;
  adminKeyHex?: string;
  contractAddress?: string;
  drawId?: number;
  lotteryId?: string;
  createdAt?: string;
}

const STORAGE_KEY_CREATOR_SECRETS = 'zkdraw_creator_secrets';

export function saveCreatorSecrets(lotteryId: string, secrets: CreatorSecrets): void {
  try {
    const existing: Record<string, CreatorSecrets> = JSON.parse(
      localStorage.getItem(STORAGE_KEY_CREATOR_SECRETS) ?? '{}',
    );
    existing[lotteryId] = { ...secrets, lotteryId, createdAt: new Date().toISOString() };
    if (secrets.contractAddress !== undefined && secrets.drawId !== undefined) {
      existing[`${secrets.contractAddress.toLowerCase()}:${secrets.drawId}`] = existing[lotteryId];
    }
    localStorage.setItem(STORAGE_KEY_CREATOR_SECRETS, JSON.stringify(existing));
  } catch (e) {
    console.warn('Could not save creator secrets to localStorage:', e);
  }
}

export function getCreatorSecrets(
  lotteryId?: string,
  contractAddress?: string,
  drawId?: number,
): CreatorSecrets | null {
  try {
    const map: Record<string, CreatorSecrets> = JSON.parse(
      localStorage.getItem(STORAGE_KEY_CREATOR_SECRETS) ?? '{}',
    );
    if (lotteryId && map[lotteryId]) return map[lotteryId];
    if (contractAddress && drawId !== undefined) {
      const key = `${contractAddress.toLowerCase()}:${drawId}`;
      if (map[key]) return map[key];
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// Bech32m Address Encoding for Midnight Unshielded Addresses
// ============================================================================

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32M_CONST = 0x2bc830a3;

function bech32mPolymod(values: number[]): number {
  let chk = 1;
  for (let p = 0; p < values.length; ++p) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ values[p];
    for (let i = 0; i < 5; ++i) {
      if ((top >> i) & 1) {
        chk ^= BECH32_GENERATOR[i];
      }
    }
  }
  return chk;
}

function bech32mHrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let p = 0; p < hrp.length; ++p) {
    ret.push(hrp.charCodeAt(p) >> 5);
  }
  ret.push(0);
  for (let p = 0; p < hrp.length; ++p) {
    ret.push(hrp.charCodeAt(p) & 31);
  }
  return ret;
}

function bech32mCreateChecksum(hrp: string, data: number[]): number[] {
  const values = bech32mHrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const mod = bech32mPolymod(values) ^ BECH32M_CONST;
  const ret: number[] = [];
  for (let p = 0; p < 6; ++p) {
    ret.push((mod >> (5 * (5 - p))) & 31);
  }
  return ret;
}

function convertBits(data: Uint8Array, frombits: number, tobits: number, pad: boolean): number[] | null {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << tobits) - 1;
  for (let p = 0; p < data.length; ++p) {
    const value = data[p];
    if (value < 0 || (value >> frombits) !== 0) {
      return null;
    }
    acc = (acc << frombits) | value;
    bits += frombits;
    while (bits >= tobits) {
      bits -= tobits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) {
      ret.push((acc << (tobits - bits)) & maxv);
    }
  } else if (bits >= frombits || ((acc << (tobits - bits)) & maxv)) {
    return null;
  }
  return ret;
}

export function encodeBech32m(hrp: string, bytes: Uint8Array): string {
  const words = convertBits(bytes, 8, 5, true);
  if (!words) throw new Error('convertBits failed for Bech32m');
  const check = bech32mCreateChecksum(hrp, words);
  const combined = words.concat(check);
  let ret = hrp + '1';
  for (let p = 0; p < combined.length; ++p) {
    ret += BECH32_CHARSET.charAt(combined[p]);
  }
  return ret;
}

export function formatToBech32mAddress(
  addressOrHex: string | undefined,
  network: 'preprod' | 'preview' = 'preprod',
): string | undefined {
  if (!addressOrHex) return undefined;
  const clean = addressOrHex.trim();
  if (/^mn_addr/i.test(clean)) return clean;
  // If it's a 32-byte hex public key (64 hex chars), encode to Bech32m
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    try {
      const bytes = hexToBytes(clean);
      const hrp = network === 'preprod' ? 'mn_addr_preprod' : 'mn_addr_preview';
      return encodeBech32m(hrp, bytes);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

