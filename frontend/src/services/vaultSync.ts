import type { UserTicket } from '../types/index.js';

export interface EncryptedVaultPayload {
  version: number;
  type: 'zkdraw-encrypted-vault';
  walletAddress: string;
  iv: string;
  ciphertext: string;
  ticketCount: number;
  timestamp: string;
}

export interface RemoteVaultInfo {
  exists: boolean;
  hasVault: boolean;
  cid?: string;
  datePinned?: string;
  pinnedAt?: string;
}

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
    ? 'https://zkdraw.onrender.com/api'
    : '/api')
).replace(/\/$/, '');

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derives an AES-GCM 256-bit encryption key deterministically from the player's wallet address.
 * Optional PIN adds two-factor entropy.
 */
export async function deriveVaultKey(walletAddress: string, pin?: string): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is required for vault encryption.');
  }

  const cleanAddr = walletAddress.trim().toLowerCase();
  const domainTag = `zkDraw:v1:vault-key:${cleanAddr}${pin ? `:${pin}` : ''}`;
  const encoded = new TextEncoder().encode(domainTag);
  const keyMaterial = await window.crypto.subtle.digest('SHA-256', encoded);

  return await window.crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts private tickets using AES-256-GCM before transmitting to IPFS.
 */
export async function encryptVault(
  tickets: UserTicket[],
  walletAddress: string,
  pin?: string,
): Promise<EncryptedVaultPayload> {
  const key = await deriveVaultKey(walletAddress, pin);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for GCM
  const jsonString = JSON.stringify(tickets);
  const plaintext = new TextEncoder().encode(jsonString);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    plaintext as unknown as BufferSource,
  );

  return {
    version: 1,
    type: 'zkdraw-encrypted-vault',
    walletAddress: walletAddress.trim().toLowerCase(),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(ciphertextBuffer)),
    ticketCount: tickets.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Decrypts an encrypted vault envelope into typed UserTicket objects.
 */
export async function decryptVault(
  payload: EncryptedVaultPayload,
  walletAddress: string,
  pin?: string,
): Promise<UserTicket[]> {
  const key = await deriveVaultKey(walletAddress, pin);
  const iv = hexToBytes(payload.iv);
  const ciphertextBytes = hexToBytes(payload.ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ciphertextBytes as unknown as BufferSource,
  );

  const jsonString = new TextDecoder().decode(decryptedBuffer);
  const parsed = JSON.parse(jsonString);

  if (!Array.isArray(parsed)) {
    throw new Error('Decrypted vault data is not a valid ticket array.');
  }

  return parsed as UserTicket[];
}

/**
 * Uploads an encrypted vault payload to backend which pins it to Pinata IPFS.
 * Returns the IPFS CID and pinning metadata.
 */
export async function syncVaultToIpfs(
  tickets: UserTicket[],
  walletAddress: string,
  pin?: string,
): Promise<{ success: boolean; cid: string; timestamp: string }> {
  const encrypted = await encryptVault(tickets, walletAddress, pin);

  const res = await fetch(`${API_BASE}/vault/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encrypted),
  });

  if (!res.ok) {
    let errorBody: any = {};
    try {
      errorBody = await res.json();
    } catch {}
    throw new Error(errorBody.error || `Vault sync failed with status ${res.status}`);
  }

  return await res.json();
}

/**
 * Checks whether an encrypted vault exists on IPFS for a given wallet address.
 */
export async function fetchRemoteVaultInfo(walletAddress: string): Promise<RemoteVaultInfo> {
  const cleanAddr = walletAddress.trim().toLowerCase();
  try {
    const res = await fetch(`${API_BASE}/vault/sync/wallet/${cleanAddr}`);
    if (res.ok) {
      const data = await res.json();
      const hasVault = Boolean(data.exists);
      return {
        exists: hasVault,
        hasVault,
        cid: data.cid,
        datePinned: data.datePinned,
        pinnedAt: data.datePinned,
      };
    }
  } catch {}

  return { exists: false, hasVault: false };
}

/**
 * Fetches and decrypts the latest vault from IPFS for the connected wallet.
 */
export async function restoreVaultFromIpfs(
  walletAddress: string,
  pin?: string,
  remoteCid?: string,
): Promise<{ tickets: UserTicket[]; cid: string }> {
  let targetCid = remoteCid;

  if (!targetCid) {
    const info = await fetchRemoteVaultInfo(walletAddress);
    if (!info.exists || !info.cid) {
      throw new Error('No encrypted vault found on IPFS for this wallet.');
    }
    targetCid = info.cid;
  }

  const res = await fetch(`${API_BASE}/vault/sync/${targetCid}`);
  if (!res.ok) {
    throw new Error(`Failed to retrieve encrypted vault from IPFS gateway (HTTP ${res.status})`);
  }

  const payload: EncryptedVaultPayload = await res.json();
  const decryptedTickets = await decryptVault(payload, walletAddress, pin);

  return {
    tickets: decryptedTickets,
    cid: targetCid,
  };
}

/**
 * Local offline backup download (.json)
 */
export function exportVaultJson(tickets: UserTicket[]): void {
  const backup = {
    application: 'zkDraw',
    version: 1,
    exportDate: new Date().toISOString(),
    ticketCount: tickets.length,
    tickets,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zkdraw-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Local offline backup restore from uploaded .json file
 */
export async function importVaultJson(file: File): Promise<UserTicket[]> {
  const text = await file.text();
  const parsed = JSON.parse(text);

  let rawTickets: unknown[] = [];
  if (Array.isArray(parsed)) {
    rawTickets = parsed;
  } else if (parsed && Array.isArray(parsed.tickets)) {
    rawTickets = parsed.tickets;
  } else {
    throw new Error('Invalid backup file format. Expected a zkDraw ticket backup JSON.');
  }

  // Validate each ticket has required fields
  const validTickets = rawTickets.filter((t: any) => {
    return t && t.id && t.lotteryId && typeof t.ticketNumber === 'number' && t.saltHex;
  }) as UserTicket[];

  if (validTickets.length === 0) {
    throw new Error('No valid tickets found in the imported file.');
  }

  return validTickets;
}
