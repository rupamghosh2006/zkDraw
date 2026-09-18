/**
 * escrow.ts
 *
 * Frontend API client for the Escrow Treasury Service.
 *
 * Provides functions to:
 * - Fetch the escrow vault address for directing ticket payments
 * - Register a winner's ZK claim nullifier with the backend escrow service
 * - Fetch escrow pot status and payout results
 */

import type { MidnightNetwork } from '../types/index.js';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EscrowVaultInfo {
  network: MidnightNetwork;
  address: string;
  configured: boolean;
  message: string;
}

export interface EscrowClaimResult {
  ok: boolean;
  verified: boolean;
  potStatus: string;
  potAmountAtomic: string;
  escrowAddress: string;
  claim: {
    nullifierHex: string;
    winnerAddress: string;
    verifiedOnChain: boolean;
    payoutTxHash?: string;
    payoutAmountAtomic?: string;
    isSimulated?: boolean;
    error?: string;
  };
  message: string;
  error?: string;
}

export interface EscrowStatus {
  exists: boolean;
  key?: string;
  lotteryId?: string;
  contractAddress: string;
  drawId: number;
  network?: MidnightNetwork;
  ticketPriceAtomic?: string;
  ticketCount: number;
  potAmountAtomic: string;
  escrowAddress?: string;
  status: string;
  createdAt?: string;
  claimWindowOpenedAt?: string;
  settledAt?: string;
  claimCount: number;
  verifiedClaimCount: number;
  settledClaimCount: number;
  claims: Array<{
    nullifierHex: string;
    winnerAddress: string;
    submittedAt: string;
    verifiedOnChain: boolean;
    payoutTxHash?: string;
    payoutAmountAtomic?: string;
    isSimulated?: boolean;
    error?: string;
  }>;
  message?: string;
}

// ─── Cached escrow addresses ──────────────────────────────────────────────────

const escrowAddressCache = new Map<MidnightNetwork, string>();

/**
 * Fetches the escrow vault address for a given network from the backend.
 * Returns empty string if the backend is unavailable.
 */
export async function fetchEscrowVaultAddress(
  network: MidnightNetwork,
): Promise<EscrowVaultInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/escrow/vault-address?network=${network}`);
    if (res.ok) {
      const data: EscrowVaultInfo = await res.json();
      if (data.address) {
        escrowAddressCache.set(network, data.address);
      }
      return data;
    }
  } catch {
    // Backend unavailable — silently fall back to static config
  }
  return null;
}

/**
 * Returns the cached (or freshly fetched) escrow vault address.
 * Falls back to the staticFallback if backend is not reachable.
 */
export async function getEscrowAddress(
  network: MidnightNetwork,
  staticFallback: string = '',
): Promise<string> {
  if (escrowAddressCache.has(network)) {
    return escrowAddressCache.get(network)!;
  }
  const info = await fetchEscrowVaultAddress(network);
  if (info?.address) return info.address;
  return staticFallback;
}

// ─── Claim & Payout ───────────────────────────────────────────────────────────

/**
 * Registers a winner's ZK claim nullifier with the escrow service.
 * The backend verifies the nullifier on-chain and triggers the payout transfer.
 *
 * @param contractAddress  The zkDraw contract address
 * @param drawId           The draw ID within the contract
 * @param nullifierHex     The 32-byte ZK nullifier returned by claimPrizeOnChain
 * @param winnerAddress    The winner's Midnight bech32m wallet address (for payout)
 * @param network          'preprod' | 'preview'
 * @param lotteryId        The frontend lottery ID (optional, for logging)
 * @param ticketPriceAtomic Ticket price in atomic units (optional, fallback '1000000')
 */
export async function requestEscrowPayout(
  contractAddress: string,
  drawId: number,
  nullifierHex: string,
  winnerAddress: string,
  network: MidnightNetwork,
  lotteryId?: string,
  ticketPriceAtomic?: string,
): Promise<EscrowClaimResult> {
  try {
    const res = await fetch(
      `${API_BASE}/escrow/${contractAddress}/${drawId}/claim`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nullifierHex,
          winnerAddress,
          network,
          lotteryId,
          ticketPriceAtomic,
        }),
      },
    );

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        verified: false,
        potStatus: 'unknown',
        potAmountAtomic: '0',
        escrowAddress: '',
        claim: {
          nullifierHex,
          winnerAddress,
          verifiedOnChain: false,
          error: data.message || data.error || 'Backend returned an error',
        },
        message: data.message || data.error || 'Payout request failed',
        error: data.error,
      };
    }

    return data as EscrowClaimResult;
  } catch (err) {
    const message = (err as Error).message || 'Network error contacting escrow service';
    return {
      ok: false,
      verified: false,
      potStatus: 'unknown',
      potAmountAtomic: '0',
      escrowAddress: '',
      claim: {
        nullifierHex,
        winnerAddress,
        verifiedOnChain: false,
        error: message,
      },
      message,
      error: message,
    };
  }
}

/**
 * Fetches the current escrow status for a draw.
 */
export async function fetchEscrowStatus(
  contractAddress: string,
  drawId: number,
): Promise<EscrowStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/escrow/${contractAddress}/${drawId}`);
    if (res.ok) {
      return await res.json() as EscrowStatus;
    }
  } catch {
    // Backend unavailable
  }
  return null;
}