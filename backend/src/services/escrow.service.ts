/**
 * escrow.service.ts
 *
 * Escrow Treasury Service for zkDraw.
 *
 * Responsibilities:
 * 1. Track per-draw pot balances (as ticket fees are paid to the escrow vault address)
 * 2. Verify winner claims by checking the on-chain claimedNullifiers set via the Midnight Indexer
 * 3. Settle payouts by distributing the pot equally among all verified winners
 * 4. Persist ledger state to disk (backend/data/escrow-ledger.json)
 *
 * Pot tracking is maintained by the backend when a ticket purchase is reported
 * (via registerTicketPayment). The actual tNIGHT tokens sit in the on-chain
 * escrow vault address — this service tracks the logical balance and orchestrates
 * the payout via EscrowWallet.
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, ESCROW_CLAIM_WINDOW_MS } from '../config/index.js';
import { sendEscrowPayout, getEscrowAddress, isEscrowConfigured } from '../midnight/escrow-wallet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const LEDGER_FILE = path.join(DATA_DIR, 'escrow-ledger.json');

// Module-level memoization for compact-runtime and compiled contract
let cachedContractStateClass: any = null;
let cachedContractModule: any = null;
let modulesAttempted = false;

async function getContractRuntimeAndModule() {
  if (!modulesAttempted) {
    modulesAttempted = true;
    try {
      const { ContractState } = await import('@midnight-ntwrk/compact-runtime');
      cachedContractStateClass = ContractState;
    } catch {}

    try {
      const contractModulePath = path.resolve(
        config.contractsPath,
        'managed/zkDraw/contract/index.js',
      );
      if (existsSync(contractModulePath)) {
        cachedContractModule = await import(`file://${contractModulePath.replace(/\\/g, '/')}`);
      }
    } catch {}
  }
  return {
    ContractState: cachedContractStateClass,
    contractModule: cachedContractModule,
  };
}

export interface EscrowClaim {
  nullifierHex: string;
  winnerAddress: string;
  submittedAt: string;
  verifiedOnChain: boolean;
  payoutTxHash?: string;
  payoutAmountAtomic?: string;
  isSimulated?: boolean;
  error?: string;
}

export type EscrowPotStatus = 'open' | 'claim_window' | 'settled' | 'failed';

export interface EscrowPot {
  /** Unique key: `${contractAddress}:${drawId}` */
  key: string;
  lotteryId: string;
  contractAddress: string;
  drawId: number;
  network: 'preprod' | 'preview';
  ticketPriceAtomic: string;
  ticketCount: number;
  potAmountAtomic: string;
  escrowAddress: string;
  status: EscrowPotStatus;
  createdAt: string;
  claimWindowOpenedAt?: string;
  settledAt?: string;
  claims: EscrowClaim[];
}

export interface EscrowLedger {
  pots: Record<string, EscrowPot>;
  updatedAt: string;
}

class EscrowService {
  private ledger: EscrowLedger = { pots: {}, updatedAt: new Date().toISOString() };
  private claimWindowTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.ensureDataDir();
    this.loadLedger();
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  private ensureDataDir(): void {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  }

  private loadLedger(): void {
    try {
      if (existsSync(LEDGER_FILE)) {
        const raw = readFileSync(LEDGER_FILE, 'utf8');
        this.ledger = JSON.parse(raw);
        this.recoverClaimWindowTimers();
      }
    } catch (e) {
      console.warn('[EscrowService] Failed to load ledger, starting fresh:', e);
    }
  }

  private recoverClaimWindowTimers(): void {
    const now = Date.now();
    for (const [key, pot] of Object.entries(this.ledger.pots)) {
      if (pot.status === 'claim_window') {
        const openedAt = pot.claimWindowOpenedAt ? new Date(pot.claimWindowOpenedAt).getTime() : 0;
        const elapsed = now - openedAt;
        const remaining = ESCROW_CLAIM_WINDOW_MS - elapsed;

        if (remaining <= 0) {
          // Window expired while offline -> settle immediately
          setImmediate(() => {
            this.settlePot(key).catch((err) => {
              console.error(`[EscrowService] Recovered settlement error for pot ${key}:`, err);
            });
          });
        } else {
          // Window still active -> schedule timer for remaining duration
          const timer = setTimeout(() => {
            this.claimWindowTimers.delete(key);
            this.settlePot(key).catch((err) => {
              console.error(`[EscrowService] Settlement error for pot ${key}:`, err);
            });
          }, remaining);
          this.claimWindowTimers.set(key, timer);
        }
      }
    }
  }

  private saveLedger(): void {
    this.ledger.updatedAt = new Date().toISOString();
    // Non-blocking asynchronous file save
    this.writeLedgerDisk().catch((e) => {
      console.error('[EscrowService] Failed to save ledger:', e);
    });
  }

  private async writeLedgerDisk(): Promise<void> {
    try {
      this.ensureDataDir();
      await writeFile(LEDGER_FILE, JSON.stringify(this.ledger, null, 2), 'utf8');
    } catch (e) {
      console.error('[EscrowService] Failed to write ledger to disk:', e);
    }
  }

  public cleanup(): void {
    for (const timer of this.claimWindowTimers.values()) {
      clearTimeout(timer);
    }
    this.claimWindowTimers.clear();
  }

  // ─── Key Helpers ─────────────────────────────────────────────────────────

  private potKey(contractAddress: string, drawId: number): string {
    return `${contractAddress.toLowerCase()}:${drawId}`;
  }

  private getOrCreatePot(
    lotteryId: string,
    contractAddress: string,
    drawId: number,
    network: 'preprod' | 'preview',
    ticketPriceAtomic: string,
  ): EscrowPot {
    const key = this.potKey(contractAddress, drawId);
    if (!this.ledger.pots[key]) {
      this.ledger.pots[key] = {
        key,
        lotteryId,
        contractAddress: contractAddress.toLowerCase(),
        drawId,
        network,
        ticketPriceAtomic,
        ticketCount: 0,
        potAmountAtomic: '0',
        escrowAddress: getEscrowAddress(network),
        status: 'open',
        createdAt: new Date().toISOString(),
        claims: [],
      };
    }
    return this.ledger.pots[key];
  }

  // ─── On-chain Nullifier Verification ─────────────────────────────────────

  /**
   * Verifies that a ZK nullifier has been registered in the on-chain
   * `claimedNullifiers` set by querying the Midnight Indexer GraphQL.
   *
   * This is the trust anchor: if the nullifier is on-chain, the player
   * genuinely executed `claimPrize` with a valid ZK proof.
   */
  private async verifyNullifierOnChain(
    contractAddress: string,
    nullifierHex: string,
    network: 'preprod' | 'preview',
  ): Promise<boolean> {
    const netCfg = config.networks[network];
    if (!netCfg) return false;

    try {
      // Query the Midnight Indexer for the contract's raw state with 4s timeout
      const cleanAddress = contractAddress.replace(/^0x/, '');
      const query = `query GetContractState($address: HexEncoded!) {
        contractAction(address: $address) {
          address
          state
        }
      }`;

      const res = await fetch(netCfg.indexerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { address: cleanAddress } }),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        console.warn(`[EscrowService] Indexer returned HTTP ${res.status} for nullifier verification`);
        return false;
      }

      const json = (await res.json()) as any;
      const stateHex: string | undefined = json?.data?.contractAction?.state;
      if (!stateHex) {
        console.warn('[EscrowService] No contract state returned from indexer');
        return false;
      }

      // Try to deserialize and check claimedNullifiers via memoized compact-runtime & contract module
      try {
        const { ContractState, contractModule } = await getContractRuntimeAndModule();
        if (ContractState && contractModule?.ledger) {
          const bytes = Buffer.from(stateHex, 'hex');
          const contractStateObj = ContractState.deserialize(bytes);
          const decoded = contractModule.ledger(contractStateObj.data);
          if (decoded?.claimedNullifiers) {
            const cleanNullifier = nullifierHex.replace(/^0x/, '');
            for (const claimed of decoded.claimedNullifiers) {
              const claimedHex = Buffer.from(claimed).toString('hex');
              if (claimedHex === cleanNullifier) {
                console.log(`[EscrowService] Nullifier verified on-chain: ${cleanNullifier.slice(0, 16)}...`);
                return true;
              }
            }
            console.warn(`[EscrowService] Nullifier NOT found in claimedNullifiers: ${cleanNullifier.slice(0, 16)}...`);
            return false;
          }
        }
      } catch (deserErr) {
        console.warn('[EscrowService] Could not deserialize contract state for nullifier check:', deserErr);
      }

      // Fallback: check via raw state hex for nullifier substring
      // (less reliable, but works if contract module is not compiled)
      const cleanNullifier = nullifierHex.replace(/^0x/, '').toLowerCase();
      const stateHexLower = stateHex.toLowerCase();
      const found = stateHexLower.includes(cleanNullifier);
      if (found) {
        console.log(`[EscrowService] Nullifier found via raw state scan (fallback): ${cleanNullifier.slice(0, 16)}...`);
      } else {
        console.warn(`[EscrowService] Nullifier not found in raw state (fallback): ${cleanNullifier.slice(0, 16)}...`);
      }
      return found;
    } catch (err) {
      console.error('[EscrowService] Error during nullifier verification:', err);
      return false;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Called when a ticket is successfully purchased (after on-chain buyTicket).
   * Increments the escrow pot balance for this draw.
   */
  public registerTicketPayment(
    lotteryId: string,
    contractAddress: string,
    drawId: number,
    network: 'preprod' | 'preview',
    ticketPriceAtomic: string,
  ): EscrowPot {
    const pot = this.getOrCreatePot(lotteryId, contractAddress, drawId, network, ticketPriceAtomic);

    if (pot.status !== 'open') {
      console.warn(`[EscrowService] registerTicketPayment on pot ${pot.key} with status=${pot.status}`);
    }

    pot.ticketCount++;
    pot.potAmountAtomic = (BigInt(pot.potAmountAtomic) + BigInt(ticketPriceAtomic)).toString();
    pot.escrowAddress = getEscrowAddress(network);

    this.saveLedger();
    console.log(`[EscrowService] Pot ${pot.key}: +${ticketPriceAtomic} atomic. Total: ${pot.potAmountAtomic} (${pot.ticketCount} tickets)`);
    return pot;
  }

  /**
   * Called when the draw winner is executed on-chain.
   * Opens the claim window: starts a timer after which the pot is settled
   * among all verified claims.
   */
  public openClaimWindow(
    contractAddress: string,
    drawId: number,
    network: 'preprod' | 'preview',
  ): void {
    const key = this.potKey(contractAddress, drawId);
    const pot = this.ledger.pots[key];
    if (!pot) {
      console.warn(`[EscrowService] openClaimWindow: pot ${key} not found`);
      return;
    }
    if (pot.status !== 'open') return;

    pot.status = 'claim_window';
    pot.claimWindowOpenedAt = new Date().toISOString();
    this.saveLedger();

    console.log(`[EscrowService] Claim window opened for pot ${key}. Settling in ${ESCROW_CLAIM_WINDOW_MS}ms.`);

    // Cancel any existing timer
    const existing = this.claimWindowTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.claimWindowTimers.delete(key);
      this.settlePot(key).catch((err) => {
        console.error(`[EscrowService] Settlement error for pot ${key}:`, err);
      });
    }, ESCROW_CLAIM_WINDOW_MS);

    this.claimWindowTimers.set(key, timer);
  }

  /**
   * Registers a winner's claim after they have submitted the ZK claimPrize
   * circuit on-chain. Verifies the nullifier exists in claimedNullifiers,
   * then records the claim and checks if immediate settlement is possible.
   */
  public async registerClaim(
    lotteryId: string,
    contractAddress: string,
    drawId: number,
    network: 'preprod' | 'preview',
    nullifierHex: string,
    winnerAddress: string,
    ticketPriceAtomic: string,
  ): Promise<{ pot: EscrowPot; claim: EscrowClaim; verified: boolean }> {
    const key = this.potKey(contractAddress, drawId);
    let pot = this.ledger.pots[key];

    // Auto-create pot if not tracked (e.g. was created before this service was running)
    if (!pot) {
      pot = this.getOrCreatePot(lotteryId, contractAddress, drawId, network, ticketPriceAtomic);
      pot.status = 'claim_window';
      pot.claimWindowOpenedAt = new Date().toISOString();
    }

    // Check for duplicate claim
    const cleanNullifier = nullifierHex.replace(/^0x/, '').toLowerCase();
    const existing = pot.claims.find((c) => c.nullifierHex.toLowerCase() === cleanNullifier);
    if (existing) {
      console.warn(`[EscrowService] Duplicate claim for nullifier ${cleanNullifier.slice(0, 16)}...`);
      return { pot, claim: existing, verified: existing.verifiedOnChain };
    }

    // Verify the nullifier exists on-chain
    console.log(`[EscrowService] Verifying nullifier on-chain for ${key}...`);
    const verified = await this.verifyNullifierOnChain(contractAddress, nullifierHex, network);

    const claim: EscrowClaim = {
      nullifierHex: cleanNullifier,
      winnerAddress,
      submittedAt: new Date().toISOString(),
      verifiedOnChain: verified,
    };
    pot.claims.push(claim);
    this.saveLedger();

    if (!verified) {
      console.warn(`[EscrowService] Claim rejected: nullifier not on-chain yet for ${key}`);
      return { pot, claim, verified: false };
    }

    console.log(`[EscrowService] Claim verified! Pot ${key} now has ${pot.claims.filter(c => c.verifiedOnChain).length} verified claims.`);
    return { pot, claim, verified: true };
  }

  /**
   * Settles a pot by distributing funds equally among all verified claimants.
   * Called automatically after the claim window expires.
   */
  public async settlePot(key: string): Promise<void> {
    const pot = this.ledger.pots[key];
    if (!pot) {
      console.warn(`[EscrowService] settlePot: pot ${key} not found`);
      return;
    }
    if (pot.status === 'settled') {
      console.log(`[EscrowService] Pot ${key} already settled, skipping`);
      return;
    }

    const verifiedClaims = pot.claims.filter((c) => c.verifiedOnChain && !c.payoutTxHash);
    if (verifiedClaims.length === 0) {
      console.warn(`[EscrowService] Pot ${key} has no verified claims. Marking as settled (no payout).`);
      pot.status = 'settled';
      pot.settledAt = new Date().toISOString();
      this.saveLedger();
      return;
    }

    const totalPot = BigInt(pot.potAmountAtomic);
    const perWinner = totalPot / BigInt(verifiedClaims.length);

    console.log(
      `[EscrowService] Settling pot ${key}: ${totalPot} atomic tNIGHT → ` +
      `${verifiedClaims.length} winner(s) × ${perWinner} each`,
    );

    let anyFailure = false;
    for (const claim of verifiedClaims) {
      try {
        const result = await sendEscrowPayout(claim.winnerAddress, perWinner, pot.network);
        claim.payoutTxHash = result.txHash;
        claim.payoutAmountAtomic = perWinner.toString();
        claim.isSimulated = result.isSimulated;
        if (!result.ok) {
          claim.error = result.error;
          anyFailure = true;
          console.error(`[EscrowService] Payout FAILED for ${claim.winnerAddress}: ${result.error}`);
        } else {
          console.log(
            `[EscrowService] Payout ${result.isSimulated ? '[SIMULATED]' : '[REAL]'} ` +
            `${perWinner} → ${claim.winnerAddress} | TxHash: ${result.txHash}`,
          );
        }
        this.saveLedger();
      } catch (err) {
        claim.error = (err as Error).message;
        anyFailure = true;
        this.saveLedger();
      }
    }

    pot.status = anyFailure ? 'failed' : 'settled';
    pot.settledAt = new Date().toISOString();
    this.saveLedger();

    console.log(`[EscrowService] Pot ${key} settlement complete. Status: ${pot.status}`);
  }

  /**
   * Returns the escrow status for a given draw.
   */
  public getEscrowStatus(contractAddress: string, drawId: number): EscrowPot | null {
    const key = this.potKey(contractAddress, drawId);
    return this.ledger.pots[key] ?? null;
  }

  /**
   * Returns the escrow vault address for a given network.
   */
  public getVaultAddress(network: 'preprod' | 'preview'): string {
    return getEscrowAddress(network);
  }

  /**
   * Returns whether the escrow wallet is configured for real transfers.
   */
  public isConfigured(network: 'preprod' | 'preview'): boolean {
    return isEscrowConfigured(network);
  }

  /**
   * Returns all pots in the ledger (for admin/debug).
   */
  public getAllPots(): EscrowPot[] {
    return Object.values(this.ledger.pots);
  }
}

// Singleton
export const escrowService = new EscrowService();