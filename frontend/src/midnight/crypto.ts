// Browser-compatible cryptographic witness and commitment derivation

export function generateRandomHex(byteCount = 32): string {
  const bytes = new Uint8Array(byteCount);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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

/**
 * Computes the domain-separated ticket commitment in the user's browser:
 * H("zkDraw:v1:ticket" || num as Bytes<32> || salt)
 */
export async function computeClientTicketCommitment(
  ticketNumber: number,
  saltHex: string,
): Promise<string> {
  const domainTag = pad32String('zkDraw:v1:ticket');
  
  const numBytes = new Uint8Array(32);
  let n = BigInt(ticketNumber);
  for (let i = 0; i < 32 && n > 0n; i++) {
    numBytes[i] = Number(n & 0xffn);
    n = n >> 8n;
  }

  const saltBytes = hexToBytes(saltHex);

  const combined = new Uint8Array(32 + 32 + 32);
  combined.set(domainTag, 0);
  combined.set(numBytes, 32);
  combined.set(saltBytes, 64);

  return sha256Hex(combined);
}

/**
 * Computes claim nullifier for winner:
 * H("zkDraw:v1:claim" || commitment || playerSecret)
 */
export async function computeClientClaimNullifier(
  commitmentHex: string,
  playerSecretHex: string,
): Promise<string> {
  const domainTag = pad32String('zkDraw:v1:claim');
  const commitmentBytes = hexToBytes(commitmentHex);
  const secretBytes = hexToBytes(playerSecretHex);

  const combined = new Uint8Array(32 + 32 + 32);
  combined.set(domainTag, 0);
  combined.set(commitmentBytes, 32);
  combined.set(secretBytes, 64);

  return sha256Hex(combined);
}
