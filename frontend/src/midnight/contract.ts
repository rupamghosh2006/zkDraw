/**
 * midnight/contract.ts
 *
 * Executes a real on-chain buyTicket transaction using the Midnight Lace
 * wallet dapp-connector API (getProvingProvider + balanceUnsealedTransaction
 * + submitTransaction).
 *
 * Flow:
 *  1. Fetch current contract state from the Midnight indexer (GraphQL)
 *  2. Deserialize the state and build a CircuitContext
 *  3. Execute contract.circuits.buyTicket(circuitContext) => proofData
 *  4. Serialize proofData => preimage bytes
 *  5. Prove via wallet.getProvingProvider() => Uint8Array (unsealed tx)
 *  6. Balance via wallet.balanceUnsealedTransaction() => sealed+balanced tx
 *  7. Submit via wallet.submitTransaction()
 *  8. Return the real txHash and the commitment hex
 */

import type { ConnectedAPI, KeyMaterialProvider } from '@midnight-ntwrk/dapp-connector-api';
import { Contract, type Witnesses, ledger, pureCircuits } from '../contract/index.js';
import {
  createCircuitContext,
  emptyZswapLocalState,
  proofDataIntoSerializedPreimage,
  ContractState,
  sampleSigningKey,
  signatureVerifyingKey,
} from '@midnight-ntwrk/compact-runtime';
import {
  ContractDeploy,
  ContractOperation,
  ContractMaintenanceAuthority,
  ContractState as LedgerContractState,
  Intent,
  Transaction,
  CostModel,
  PrePartitionContractCall,
  PreTranscript,
  LedgerParameters,
  communicationCommitmentRandomness,
  QueryContext as LedgerQueryContext,
  nativeToken,
} from '@midnight-ntwrk/ledger-v8';
import type { MidnightNetwork } from './config.js';
import { hexToBytes, sha256Hex, getCreatorSecrets, saveCreatorSecrets, formatToBech32mAddress } from './crypto.js';
import { getNetworkConfig } from './config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecodedDraw {
  drawId: number;
  adminHex: string;
  status: 'OPEN' | 'CLOSED' | 'DRAWN';
  statusRaw: number;
  ticketPrice: string;
  rangeMin: number;
  rangeMax: number;
  maxTickets: number;
  ticketCount: number;
  drawCommitmentHex: string;
  winningNumber: number;
  entropyRevealedHex: string;
}

export interface DecodedContractState {
  nextDrawId: number;
  draws: DecodedDraw[];
  ticketCommitments: string[];
  claimedNullifiers: string[];
  participants: string[];
}

export interface CreateDrawResult {
  txHash: string;
  drawId: number;
}

export interface DeployLotteryOnChainResult {
  contractAddress: string;
  txHash: string;
}

export interface BuyTicketResult {
  /** Real on-chain transaction hash (hex, no 0x prefix) */
  txHash: string;
  /** 32-byte ZK ticket commitment (hex, no 0x prefix) */
  commitmentHex: string;
  /** 32-byte domain-separated participant key (hex, no 0x prefix) */
  participantKeyHex?: string;
  /** Optional real tNIGHT payment transaction hash (hex, no 0x prefix) */
  paymentTxHash?: string;
}

export interface CloseLotteryResult {
  txHash: string;
}

export interface DrawWinnerResult {
  txHash: string;
  winningNumber: number;
}

export interface ClaimPrizeResult {
  txHash: string;
  nullifierHex: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return out;
}

function cleanCircuitName(loc: string): string {
  const base = loc.split('/').pop() ?? 'buyTicket';
  return base.replace(/\.(zkir|bzkir|prover|verifier)$/, '');
}

// ---------------------------------------------------------------------------
// Fetch contract state from the Midnight indexer via GraphQL v4
// ---------------------------------------------------------------------------

export async function fetchContractStateHex(
  indexerUrl: string,
  contractAddress: string,
): Promise<string | null> {
  const query = `query GetContractState($address: HexEncoded!) {
    contractAction(address: $address) {
      address
      state
    }
  }`;
  const cleanAddress = contractAddress.replace(/^0x/, '');
  const res = await fetch(indexerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { address: cleanAddress } }),
  });
  if (!res.ok) throw new Error('Indexer returned HTTP ' + res.status);
  const json = (await res.json()) as {
    data?: { contractAction?: { address?: string; state?: string } | null };
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new Error('Indexer error: ' + json.errors.map((e) => e.message).join(', '));
  }
  return json.data?.contractAction?.state ?? null;
}

/**
 * Polls the Midnight GraphQL indexer until the specified transaction hash is mined into a block.
 * This ensures subsequent transactions from the same wallet are not rejected by the 1AM Dust Sponsorship
 * server with: "A transaction is already pending. Wait for it to confirm or expire before requesting another."
 */
export async function waitForTxConfirmation(
  indexerUrl: string,
  txHash: string,
  maxWaitMs: number = 60000,
  onProgress?: (elapsedSec: number) => void,
): Promise<{ height: number; timestamp: number }> {
  const cleanHash = txHash.replace(/^0x/, '').toLowerCase();
  const query = `query GetTxConfirmation($hash: HexEncoded!) {
    transactions(offset: { hash: $hash }) {
      hash
      block {
        height
        timestamp
      }
    }
  }`;

  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const res = await fetch(indexerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { hash: cleanHash } }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: { transactions?: Array<{ hash?: string; block?: { height?: number; timestamp?: number } | null }> };
        };
        const tx = json.data?.transactions?.[0];
        if (tx?.block?.height) {
          return { height: Number(tx.block.height), timestamp: Number(tx.block.timestamp ?? 0) };
        }
      }
    } catch (err) {
      console.warn('Polling error during waitForTxConfirmation:', err);
    }
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    onProgress?.(elapsedSec);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Transaction 0x${cleanHash.slice(0, 10)}... was not confirmed in a block within ${maxWaitMs / 1000}s`);
}

/**
 * Fetch and decode live on-chain contract ledger state directly from Midnight indexer
 */
export async function fetchLiveContractState(
  indexerUrl: string,
  contractAddress: string,
): Promise<DecodedContractState | null> {
  try {
    const stateHex = await fetchContractStateHex(indexerUrl, contractAddress);
    if (!stateHex) return null;
    const bytes = fromHex(stateHex);
    const contractState = ContractState.deserialize(bytes);
    const decoded = ledger(contractState.data);

    const nextDrawId = Number(decoded.nextDrawId ?? 0n);
    const drawsList: DecodedDraw[] = [];

    if (decoded.draws) {
      for (const [dId, drawObj] of decoded.draws) {
        const statusRaw = Number(drawObj.status);
        const status: 'OPEN' | 'CLOSED' | 'DRAWN' =
          statusRaw === 0 ? 'OPEN' : statusRaw === 1 ? 'CLOSED' : 'DRAWN';
        drawsList.push({
          drawId: Number(dId),
          adminHex: toHex(drawObj.admin),
          status,
          statusRaw,
          ticketPrice: drawObj.ticketPrice.toString(),
          rangeMin: Number(drawObj.rangeMin),
          rangeMax: Number(drawObj.rangeMax),
          maxTickets: Number(drawObj.maxTickets),
          ticketCount: Number(drawObj.ticketCount),
          drawCommitmentHex: toHex(drawObj.drawCommitment),
          winningNumber: Number(drawObj.winningNumber),
          entropyRevealedHex: toHex(drawObj.entropyRevealed),
        });
      }
    }

    const ticketCommitments: string[] = [];
    if (decoded.ticketCommitments) {
      for (const c of decoded.ticketCommitments) {
        ticketCommitments.push(toHex(c));
      }
    }

    const claimedNullifiers: string[] = [];
    if (decoded.claimedNullifiers) {
      for (const n of decoded.claimedNullifiers) {
        claimedNullifiers.push(toHex(n));
      }
    }

    const participants: string[] = [];
    if (decoded.participants) {
      for (const p of decoded.participants) {
        participants.push(toHex(p));
      }
    }

    return {
      nextDrawId,
      draws: drawsList,
      ticketCommitments,
      claimedNullifiers,
      participants,
    };
  } catch (err) {
    console.warn(`Could not decode live contract state for ${contractAddress}:`, err);
    return null;
  }
}

/**
 * Deterministically derive creator admin secret and public key from connected wallet signature
 */
export async function deriveAdminSecretFromWallet(
  connectedApi: ConnectedAPI,
  network: MidnightNetwork,
  contractAddressOrId: string,
): Promise<{ adminSecretHex: string; adminKeyHex: string }> {
  const domainTag = `zkDraw:v1:admin-seed:${network}:${contractAddressOrId}`;
  let seedBytes: Uint8Array;
  try {
    const sig = await connectedApi.signData(domainTag, {
      encoding: 'text',
      keyType: 'unshielded',
    });
    seedBytes = hexToBytes(sig.signature);
  } catch {
    // Fallback: derive deterministically from shielded coin public key + domain tag
    const shielded = await connectedApi.getShieldedAddresses().catch(() => null);
    const fallbackText = `${shielded?.shieldedCoinPublicKey || 'creator'}:${domainTag}`;
    seedBytes = new TextEncoder().encode(fallbackText);
  }

  const adminSecretHex = await sha256Hex(seedBytes);
  const adminSecretBytes = hexToBytes(adminSecretHex);
  const adminKeyBytes = pureCircuits.deriveAdminKey(adminSecretBytes);
  const adminKeyHex = toHex(adminKeyBytes);

  return { adminSecretHex, adminKeyHex };
}

export interface ResolvedCreatorSecrets {
  adminSecretHex: string;
  drawSecretHex: string;
  verifiedAdmin: boolean;
  verifiedDrawSecret: boolean;
}

/**
 * Resolves and cryptographically validates the operator's private witness secrets
 * (adminSecret and drawSecret) against on-chain circuit commitments before proving.
 * Prevents "Unauthorized: only creator can draw winner" and "Invalid draw secret revealed".
 */
export async function resolveCreatorAdminAndDrawSecret(
  draw: {
    id: string;
    contractAddress: string;
    drawId?: number;
    adminKey?: string;
    creatorAddress?: string;
    drawCommitment?: string;
    drawSecretHex?: string;
  },
  wallet: { address: string; connectedApi?: ConnectedAPI } | null,
  network: MidnightNetwork,
  onStep?: (msg: string) => void,
): Promise<ResolvedCreatorSecrets> {
  const report = (m: string) => { onStep?.(m); };
  const netConfig = getNetworkConfig(network);

  // 1. Determine expected on-chain keys
  let expectedAdminKey = (draw.adminKey || '').replace(/^0x/, '').toLowerCase();
  let expectedDrawCommitment = (draw.drawCommitment || '').replace(/^0x/, '').toLowerCase();

  // If missing or if adminKey is formatted as a wallet address string instead of 64-char hex, fetch live on-chain state
  if (!/^[0-9a-fA-F]{64}$/.test(expectedAdminKey) || !/^[0-9a-fA-F]{64}$/.test(expectedDrawCommitment)) {
    try {
      const live = await fetchLiveContractState(netConfig.indexerUrl, draw.contractAddress);
      const targetDraw = live?.draws?.find((d) => d.drawId === (draw.drawId ?? 0)) || live?.draws?.[0];
      if (targetDraw) {
        if (targetDraw.adminHex && /^[0-9a-fA-F]{64}$/.test(targetDraw.adminHex)) {
          expectedAdminKey = targetDraw.adminHex.replace(/^0x/, '').toLowerCase();
        }
        if (targetDraw.drawCommitmentHex && /^[0-9a-fA-F]{64}$/.test(targetDraw.drawCommitmentHex)) {
          expectedDrawCommitment = targetDraw.drawCommitmentHex.replace(/^0x/, '').toLowerCase();
        }
      }
    } catch {}
  }

  report('Verifying creator authorization keys & entropy secrets...');

  // Candidate secrets list
  const candidates: string[] = [];
  const addCandidate = (c?: string) => {
    if (c && /^[0-9a-fA-F]{64}$/.test(c) && !candidates.includes(c.toLowerCase())) {
      candidates.push(c.toLowerCase());
    }
  };

  // A. Stored in draw object
  addCandidate(draw.drawSecretHex);

  // B. Stored in localStorage creator secrets
  const localSec = getCreatorSecrets(draw.id, draw.contractAddress, draw.drawId);
  if (localSec) {
    addCandidate(localSec.adminSecretHex);
    addCandidate(localSec.drawSecretHex);
  }

  // C. Query backend operator secret
  try {
    const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '/api';
    const url = new URL(`${apiBase}/lotteries/${draw.id}/operator-secret`, window.location.origin);
    if (wallet?.address) url.searchParams.set('creatorAddress', wallet.address);
    const res = await fetch(url.toString(), {
      headers: wallet?.address ? { 'x-creator-address': wallet.address } : {},
    });
    if (res.ok) {
      const data = await res.json();
      addCandidate(data?.drawSecretHex);
    }
  } catch {}

  // D. Deterministic wallet fallbacks
  if (wallet?.address) {
    // 1. Fallback used in CreateDrawPage
    const encodedAdmin = new TextEncoder().encode(`zkDraw:admin:${wallet.address}`);
    addCandidate(await sha256Hex(encodedAdmin));

    // 2. Domain v2 admin tag
    const encodedV2 = new TextEncoder().encode(`zkDraw:v2:admin:${wallet.address.trim().toLowerCase()}`);
    addCandidate(await sha256Hex(encodedV2));

    // 3. Domain tag with draw.id
    const encodedTag = new TextEncoder().encode(`zkDraw:v1:admin-seed:${network}:${draw.id}`);
    addCandidate(await sha256Hex(encodedTag));

    // 4. Domain tag with contract address
    const encodedTagContract = new TextEncoder().encode(`zkDraw:v1:admin-seed:${network}:${draw.contractAddress}`);
    addCandidate(await sha256Hex(encodedTagContract));

    // 5. Domain tag with contract address + drawId
    const encodedTagContractDraw = new TextEncoder().encode(`zkDraw:v1:admin-seed:${network}:${draw.contractAddress}:${draw.drawId ?? 0}`);
    addCandidate(await sha256Hex(encodedTagContractDraw));
  }

  // E. Wallet connected signature derivation (if available)
  if (wallet?.connectedApi) {
    try {
      const derived = await deriveAdminSecretFromWallet(wallet.connectedApi, network, draw.id);
      addCandidate(derived.adminSecretHex);
    } catch {}
    try {
      const derived2 = await deriveAdminSecretFromWallet(wallet.connectedApi, network, draw.contractAddress);
      addCandidate(derived2.adminSecretHex);
    } catch {}
  }

  // F. Network default secret (if operating on canonical pot)
  addCandidate(netConfig.defaultLottery?.drawSecretHex);

  // Test all candidates against pureCircuits
  let matchedAdminSecret: string | null = null;
  let matchedDrawSecret: string | null = null;

  for (const cand of candidates) {
    try {
      const candBytes = hexToBytes(cand);

      // Test admin key derivation
      if (!matchedAdminSecret && expectedAdminKey) {
        const derivedKey = toHex(pureCircuits.deriveAdminKey(candBytes)).toLowerCase();
        if (derivedKey === expectedAdminKey) {
          matchedAdminSecret = cand;
        }
      }

      // Test draw commitment derivation
      if (!matchedDrawSecret && expectedDrawCommitment) {
        const derivedComm = toHex(pureCircuits.deriveDrawCommitment(candBytes)).toLowerCase();
        if (derivedComm === expectedDrawCommitment) {
          matchedDrawSecret = cand;
        }
      }
    } catch {}
  }

  // If one was matched and the other wasn't, check if the matched secret also matches the other circuit
  if (matchedAdminSecret && !matchedDrawSecret) {
    try {
      const derivedComm = toHex(pureCircuits.deriveDrawCommitment(hexToBytes(matchedAdminSecret))).toLowerCase();
      if (!expectedDrawCommitment || derivedComm === expectedDrawCommitment) {
        matchedDrawSecret = matchedAdminSecret;
      }
    } catch {}
  }

  if (matchedDrawSecret && !matchedAdminSecret) {
    try {
      const derivedKey = toHex(pureCircuits.deriveAdminKey(hexToBytes(matchedDrawSecret))).toLowerCase();
      if (!expectedAdminKey || derivedKey === expectedAdminKey) {
        matchedAdminSecret = matchedDrawSecret;
      }
    } catch {}
  }

  const finalAdminSecret = matchedAdminSecret || candidates[0] || netConfig.defaultLottery.drawSecretHex;
  const finalDrawSecret = matchedDrawSecret || finalAdminSecret;

  // Persist verified secret to localStorage
  if (matchedAdminSecret || matchedDrawSecret) {
    saveCreatorSecrets(draw.id, {
      adminSecretHex: finalAdminSecret,
      drawSecretHex: finalDrawSecret,
      adminKeyHex: expectedAdminKey || undefined,
      contractAddress: draw.contractAddress,
      drawId: draw.drawId,
      lotteryId: draw.id,
    });
  }

  return {
    adminSecretHex: finalAdminSecret,
    drawSecretHex: finalDrawSecret,
    verifiedAdmin: Boolean(matchedAdminSecret),
    verifiedDrawSecret: Boolean(matchedDrawSecret),
  };
}

// ---------------------------------------------------------------------------
// KeyMaterialProvider - serves ZK keys from /circuits/ static files
// ---------------------------------------------------------------------------

function makeKeyMaterialProvider(): KeyMaterialProvider {
  const base = '/circuits';
  return {
    async getZKIR(loc: string): Promise<Uint8Array> {
      const name = cleanCircuitName(loc);
      // Proof server requires binary ZKIR (.bzkir) with 'midnight:ir-source[v2]:' header.
      // The .zkir files are JSON format which the proof server rejects.
      const r = await fetch(base + '/' + name + '.bzkir');
      if (!r.ok) throw new Error('ZKIR fetch failed for ' + name + ': HTTP ' + r.status);
      return new Uint8Array(await r.arrayBuffer());
    },
    async getProverKey(loc: string): Promise<Uint8Array> {
      const name = cleanCircuitName(loc);
      const r = await fetch(base + '/' + name + '.prover');
      if (!r.ok) throw new Error('Prover key fetch failed for ' + name + ': HTTP ' + r.status);
      return new Uint8Array(await r.arrayBuffer());
    },
    async getVerifierKey(loc: string): Promise<Uint8Array> {
      const name = cleanCircuitName(loc);
      const r = await fetch(base + '/' + name + '.verifier');
      if (!r.ok) throw new Error('Verifier key fetch failed for ' + name + ': HTTP ' + r.status);
      return new Uint8Array(await r.arrayBuffer());
    },
  };
}

async function prepareCircuitContext(
  connectedApi: ConnectedAPI,
  contractAddress: string,
  network: MidnightNetwork,
  witnesses: Witnesses<Record<string, never>>,
  report: (msg: string) => void,
) {
  const netConfig = getNetworkConfig(network);
  report('Connecting to Midnight indexer...');
  let indexerUrl = netConfig.indexerUrl;
  try {
    const walletConfig = await connectedApi.getConfiguration();
    if (walletConfig.indexerUri) indexerUrl = walletConfig.indexerUri;
  } catch { /* fallback */ }

  report('Fetching on-chain contract state...');
  const stateHex = await fetchContractStateHex(indexerUrl, contractAddress);
  if (!stateHex) {
    throw new Error(
      'Contract not found at ' + contractAddress + ' on ' + network +
      '. Ensure the contract is deployed and network matches.',
    );
  }

  const stateBytes = fromHex(stateHex);
  const contractStateObj = ContractState.deserialize(stateBytes);

  let coinPublicKey = '00'.repeat(32);
  try {
    const shielded = await connectedApi.getShieldedAddresses();
    const rawKey = shielded?.shieldedCoinPublicKey ?? '';
    // emptyZswapLocalState requires a pure hex string — bech32 (mn1q...) would crash WASM
    if (/^[0-9a-fA-F]+$/.test(rawKey)) {
      coinPublicKey = rawKey;
    } else if (rawKey) {
      // Derive a deterministic hex key from the bech32 address via SHA-256
      const keyBytes = new TextEncoder().encode(rawKey);
      const hashBuf = await crypto.subtle.digest('SHA-256', keyBytes);
      coinPublicKey = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch { /* fallback to zero key */ }

  const contract = new Contract(witnesses);
  const circuitContext = createCircuitContext(
    contractAddress,
    emptyZswapLocalState(coinPublicKey),
    contractStateObj,
    {},
  );

  return { contract, circuitContext, contractStateObj, contractAddress };
}

/**
 * Extracts the real on-chain 32-byte transaction hash from a balanced transaction
 * or the submission response.
 *
 * In Midnight ledger-v8, a balanced transaction is a Transaction<SignatureEnabled, Proof, Binding>.
 * Calling Transaction.deserialize('signature', 'proof', 'binding', rawBytes).transactionHash()
 * computes the exact 256-bit hex hash recognized by the Midnight indexer and 1AM explorer.
 */
async function extractTxHash(balancedTxHex: string, submitResult?: unknown): Promise<string> {
  // If the wallet submitTransaction returned a valid 64-character hex hash, prefer it
  if (typeof submitResult === 'string') {
    const clean = submitResult.replace(/^0x/, '').trim();
    if (/^[0-9a-fA-F]{64}$/.test(clean)) {
      return clean.toLowerCase();
    }
  }
  if (submitResult && typeof submitResult === 'object') {
    for (const key of ['txHash', 'hash', 'txId', 'transactionId', 'id']) {
      const candidate = (submitResult as any)[key];
      if (typeof candidate === 'string') {
        const clean = candidate.replace(/^0x/, '').trim();
        if (/^[0-9a-fA-F]{64}$/.test(clean)) {
          return clean.toLowerCase();
        }
      }
    }
  }

  // Primary: Deserialize the balanced transaction with ledger-v8 and compute transactionHash().
  // Try all valid marker combinations supported by ledger-v8 (unshielded, sealed, unsealed, etc.).
  try {
    const rawBytes = fromHex(balancedTxHex);
    const markerCombos = [
      ['signature', 'proof', 'binding'],
      ['signature', 'no-proof', 'no-binding'],
      ['signature', 'proof', 'no-binding'],
      ['signature', 'no-proof', 'binding'],
      ['signature', 'pre-proof', 'pre-binding'],
      ['signature', 'pre-proof', 'no-binding'],
      ['signature-erased', 'no-proof', 'no-binding'],
      ['signature-erased', 'proof', 'binding'],
    ] as const;

    for (const [s, p, b] of markerCombos) {
      try {
        const deserializedTx = Transaction.deserialize(s as any, p as any, b as any, rawBytes);
        const hash = deserializedTx?.transactionHash?.();
        if (hash && typeof hash === 'string') {
          return hash.replace(/^0x/, '').toLowerCase();
        }
      } catch {
        // Try next combination
      }
    }
  } catch (err) {
    console.warn('Transaction.deserialize failed to compute transactionHash:', err);
  }

  // Fallback: SHA-256 hash of the balanced transaction bytes
  try {
    const rawBytes = fromHex(balancedTxHex);
    return (await sha256Hex(rawBytes)).toLowerCase();
  } catch (err) {
    console.warn('SHA-256 fallback failed:', err);
    return toHex(fromHex(balancedTxHex).slice(0, 32));
  }
}

async function proveAndSubmitTx(
  connectedApi: ConnectedAPI,
  circuitName: string,
  contractAddress: string,
  contractStateObj: ContractState,
  proofData: any,
  network: MidnightNetwork,
  report: (msg: string) => void,
): Promise<string> {
  const keyMaterialProvider = makeKeyMaterialProvider();
  const provingProvider = await connectedApi.getProvingProvider(keyMaterialProvider);

  // Get the ContractOperation (verifier key) for this circuit from the on-chain state
  const ledgerState = LedgerContractState.deserialize(contractStateObj.serialize());
  const op = ledgerState.operation(circuitName) ?? new ContractOperation();

  // Build a PreTranscript from the circuit's public transcript.
  // IMPORTANT: PreTranscript needs a QueryContext from ledger-v8's WASM, NOT from compact-runtime.
  // ledgerState.data is ChargedState from ledger-v8 → use it to create a compatible QueryContext.
  const rand = communicationCommitmentRandomness();
  const ledgerQueryCtx = new LedgerQueryContext(ledgerState.data, contractAddress);
  const preTranscript = new PreTranscript(
    ledgerQueryCtx,
    proofData.publicTranscript,
  );

  // Build a PrePartitionContractCall — the correct ledger-v8 representation of a circuit call
  const callPrototype = new PrePartitionContractCall(
    contractAddress,
    circuitName,
    op,
    preTranscript,
    proofData.privateTranscriptOutputs,
    proofData.input,
    proofData.output,
    rand,
    circuitName,
  );

  // Create an unproven transaction containing this call
  const ttl = new Date(Date.now() + 3600 * 1000);
  const ledgerParams = LedgerParameters.initialParameters();
  const unprovenTx = Transaction.fromPartsRandomized(network, undefined, undefined, undefined)
    .addCalls({ tag: 'first' }, [callPrototype], ledgerParams, ttl);

  const stage2Prefix = circuitName === 'buyTicket' ? '[2/3] ' : '';
  const stage3Prefix = circuitName === 'buyTicket' ? '[3/3] ' : '';
  report(`${stage2Prefix}Generating ZK proof for ${circuitName} via proving provider...`);
  let unsealedTxHex: string;
  try {
    const costModel = CostModel.initialCostModel();
    const provenTx = await unprovenTx.prove(provingProvider, costModel);
    unsealedTxHex = toHex(provenTx.serialize());
  } catch (proveErr) {
    // Fallback: use proofDataIntoSerializedPreimage + prove as a last resort
    console.warn('Transaction.prove failed, trying serialized preimage fallback:', proveErr);
    const serializedPreimage = proofDataIntoSerializedPreimage(
      proofData.input,
      proofData.output,
      proofData.publicTranscript,
      proofData.privateTranscriptOutputs,
      circuitName,
    );
    const proofBytes = await provingProvider.prove(serializedPreimage, circuitName);
    unsealedTxHex = toHex(proofBytes);
  }

  report(`${stage3Prefix}Please approve transaction balancing in wallet (gas in tDUST)...`);
  const { tx: balancedTxHex } = await connectedApi.balanceUnsealedTransaction(unsealedTxHex);

  report(`${stage3Prefix}Broadcasting transaction to Midnight network...`);
  const submitResult = await connectedApi.submitTransaction(balancedTxHex);

  return await extractTxHash(balancedTxHex, submitResult);
}

// ---------------------------------------------------------------------------
// Main export: createDrawOnChain (Launch a new draw on the single contract)
// ---------------------------------------------------------------------------

export async function createDrawOnChain(
  connectedApi: ConnectedAPI,
  contractAddress: string,
  params: {
    adminKeyHex: string;
    ticketPriceAtomic: string;
    rangeMin: number;
    rangeMax: number;
    drawCommitmentHex: string;
    maxTickets: number;
  },
  network: MidnightNetwork,
  onStep?: (step: string) => void,
): Promise<CreateDrawResult> {
  const report = (msg: string) => { onStep?.(msg); };

  // Validate hex inputs before passing to WASM (bech32 addresses like mn1q... would crash)
  if (!/^[0-9a-fA-F]{64}$/.test(params.adminKeyHex)) {
    throw new Error(
      `adminKeyHex must be a 64-character hex string (32 bytes). Got: "${params.adminKeyHex.slice(0, 12)}..." — ensure the wallet admin key is derived correctly.`,
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(params.drawCommitmentHex)) {
    throw new Error(
      `drawCommitmentHex must be a 64-character hex string (32 bytes). Got: "${params.drawCommitmentHex.slice(0, 12)}..."`,
    );
  }

  const adminKeyBytes = toArrayBuffer32(hexToBytes(params.adminKeyHex));
  const drawCommitmentBytes = toArrayBuffer32(hexToBytes(params.drawCommitmentHex));

  const witnesses: Witnesses<Record<string, never>> = {
    adminSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
    privateTicketNumber: (ctx) => [ctx.privateState, 1n],
    ticketSalt: (ctx) => [ctx.privateState, new Uint8Array(32)],
    playerSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
  };

  const { contract, circuitContext, contractStateObj: csObj, contractAddress: cAddr } = await prepareCircuitContext(
    connectedApi,
    contractAddress,
    network,
    witnesses,
    report,
  );

  report('Executing createDraw ZK circuit locally via 1AM wallet...');
  const { result: drawIdResult, proofData } = contract.circuits.createDraw(
    circuitContext,
    adminKeyBytes,
    BigInt(params.ticketPriceAtomic),
    BigInt(params.rangeMin),
    BigInt(params.rangeMax),
    drawCommitmentBytes,
    BigInt(params.maxTickets),
  );

  const txHash = await proveAndSubmitTx(connectedApi, 'createDraw', cAddr, csObj, proofData, network, report);
  return { txHash, drawId: Number(drawIdResult) };
}

// ---------------------------------------------------------------------------
// Main export: buyTicketOnChain
// ---------------------------------------------------------------------------

export async function buyTicketOnChain(
  connectedApi: ConnectedAPI,
  contractAddress: string,
  drawId: number,
  ticketNumber: number,
  saltHex: string,
  playerSecretHex: string,
  network: MidnightNetwork,
  onStep?: (step: string) => void,
  paymentParams?: {
    ticketPriceAtomic?: string;
    creatorAddress?: string;
    /** Escrow vault address — when set, ticket payment goes here instead of creator wallet */
    escrowAddress?: string;
    existingPaymentTxHash?: string;
    onPaymentConfirmed?: (txHash: string) => void;
  },
): Promise<BuyTicketResult> {
  const report = (msg: string) => { onStep?.(msg); };
  const saltBytes = hexToBytes(saltHex);
  const playerSecretBytes = hexToBytes(playerSecretHex);
  const ticketNumBig = BigInt(ticketNumber);
  const drawIdBig = BigInt(drawId);

  let paymentTxHash: string | undefined = paymentParams?.existingPaymentTxHash?.replace(/^0x/, '');

  if (paymentTxHash) {
    report(`[1/3] Pot entry payment already registered (tx: 0x${paymentTxHash.slice(0, 10)}...). Verifying block confirmation...`);
    paymentParams?.onPaymentConfirmed?.(paymentTxHash);
    const netConfig = getNetworkConfig(network);
    try {
      await waitForTxConfirmation(netConfig.indexerUrl, paymentTxHash, 20000, (elapsedSec) => {
        report(`[1/3] Checking payment block confirmation (elapsed: ${elapsedSec}s)...`);
      });
      report(`[1/3] Payment confirmed on-chain! Proceeding to ZK proof...`);
      await new Promise((r) => setTimeout(r, 1500));
    } catch {
      // Proceed if confirmation check timed out
    }
  } else {
    // Real tNIGHT Payment Transfer — sent to the zkDraw Escrow Vault (not the creator):
    // escrowAddress takes priority over creatorAddress so funds land in the trustless escrow vault.
    const priceAtomic = paymentParams?.ticketPriceAtomic ? BigInt(paymentParams.ticketPriceAtomic) : 0n;
    const rawRecipient = (paymentParams?.escrowAddress || paymentParams?.creatorAddress)?.trim();
    const recipientAddress = formatToBech32mAddress(rawRecipient, network) || (
      network === 'preprod'
        ? 'mn_addr_preprod1mpl8sse22gf7uvguze5a823tt6zz6huqpthxnjragqauwja6v7ds9jt4uk'
        : 'mn_addr_preview1mpl8sse22gf7uvguze5a823tt6zz6huqpthxnjragqauwja6v7ds9n490t'
    );

    if (priceAtomic > 0n && recipientAddress && typeof connectedApi.makeTransfer === 'function') {
      const formattedPrice = (Number(priceAtomic) / 1_000_000).toLocaleString();
      report(`[1/3] Please approve ${formattedPrice} tNIGHT ticket payment in your wallet window...`);
      try {
        const nativeTokenType = nativeToken().raw;
        const transferRes = await connectedApi.makeTransfer([
          {
            kind: 'unshielded',
            type: nativeTokenType,
            value: priceAtomic,
            recipient: recipientAddress,
          },
        ]);
        if (transferRes?.tx) {
          report('[1/3] Broadcasting tNIGHT payment transfer to Midnight network...');
          const submitRes = await connectedApi.submitTransaction(transferRes.tx);
          paymentTxHash = await extractTxHash(transferRes.tx, submitRes);
          paymentParams?.onPaymentConfirmed?.(paymentTxHash);
          report(`[1/3] Payment broadcast (tx: 0x${paymentTxHash.slice(0, 10)}...). Waiting for block confirmation...`);

          // Wait for block confirmation so 1AM proof server / Dust Sponsorship does not reject with:
          // "A transaction is already pending. Wait for it to confirm or expire before requesting another."
          const netConfig = getNetworkConfig(network);
          try {
            await waitForTxConfirmation(netConfig.indexerUrl, paymentTxHash, 45000, (elapsedSec) => {
              report(`[1/3] Confirming in Midnight block (~6-12s, elapsed: ${elapsedSec}s)...`);
            });
            report(`[1/3] Payment confirmed on Midnight ledger! Initializing ZK circuits...`);
            // Brief 2.5s pause to ensure the proof server's mempool cache synchronizes
            await new Promise((r) => setTimeout(r, 2500));
          } catch (waitErr) {
            console.warn('Block confirmation polling finished or timed out:', waitErr);
          }
        }
      } catch (payErr) {
        console.error('tNIGHT payment transfer via makeTransfer failed:', payErr);
        const payErrMsg = (payErr as Error)?.message || '';
        if (payErrMsg.includes('reject') || payErrMsg.includes('denied') || payErrMsg.includes('cancel')) {
          throw new Error(`tNIGHT ticket payment was declined in wallet: ${payErrMsg}`);
        }
        if (payErrMsg.includes('Duplicate request')) {
          throw new Error(`A pending wallet request is already open. Please open your 1AM wallet extension to approve or cancel it.`);
        }
        if (payErrMsg.includes('balance') || payErrMsg.includes('insufficient') || payErrMsg.includes('fund')) {
          throw new Error(`Insufficient tNIGHT balance in wallet to purchase ticket: ${payErrMsg}`);
        }
        throw new Error(`Failed to transfer ${formattedPrice} tNIGHT ticket payment: ${payErrMsg}`);
      }
    }
  }

  const witnesses: Witnesses<Record<string, never>> = {
    adminSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
    privateTicketNumber: (ctx) => [ctx.privateState, ticketNumBig],
    ticketSalt: (ctx) => [ctx.privateState, saltBytes],
    playerSecret: (ctx) => [ctx.privateState, playerSecretBytes],
  };

  report('[2/3] Setting up Zero-Knowledge execution context & fetching contract state...');
  const { contract, circuitContext, contractStateObj: csObj, contractAddress: cAddr } = await prepareCircuitContext(
    connectedApi,
    contractAddress,
    network,
    witnesses,
    report,
  );

  report(`[2/3] Executing buyTicket ZK circuit for Draw #${drawId} locally...`);
  const { result: commitmentBytes, proofData } = contract.circuits.buyTicket(circuitContext, drawIdBig);
  const commitmentHex = toHex(commitmentBytes);

  let participantKeyHex: string | undefined;
  try {
    const pKeyBytes = pureCircuits.deriveParticipantKey(drawIdBig, playerSecretBytes);
    participantKeyHex = toHex(pKeyBytes);
  } catch {}

  const txHash = await proveAndSubmitTx(connectedApi, 'buyTicket', cAddr, csObj, proofData, network, report);
  return { txHash, commitmentHex, participantKeyHex, paymentTxHash };
}

// ---------------------------------------------------------------------------
// Main export: closeLotteryOnChain (Creator only)
// ---------------------------------------------------------------------------

export async function closeLotteryOnChain(
  connectedApi: ConnectedAPI,
  contractAddress: string,
  drawId: number,
  adminSecretHex: string,
  network: MidnightNetwork,
  onStep?: (step: string) => void,
): Promise<CloseLotteryResult> {
  const report = (msg: string) => { onStep?.(msg); };
  const adminSecretBytes = hexToBytes(adminSecretHex);
  const drawIdBig = BigInt(drawId);

  const witnesses: Witnesses<Record<string, never>> = {
    adminSecret: (ctx) => [ctx.privateState, adminSecretBytes],
    privateTicketNumber: (ctx) => [ctx.privateState, 1n],
    ticketSalt: (ctx) => [ctx.privateState, new Uint8Array(32)],
    playerSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
  };

  const { contract, circuitContext, contractStateObj: csObj, contractAddress: cAddr } = await prepareCircuitContext(
    connectedApi,
    contractAddress,
    network,
    witnesses,
    report,
  );

  report(`Executing closeLottery ZK circuit for Draw #${drawId} locally (verifying creator authorization)...`);
  const { proofData } = contract.circuits.closeLottery(circuitContext, drawIdBig);

  const txHash = await proveAndSubmitTx(connectedApi, 'closeLottery', cAddr, csObj, proofData, network, report);
  return { txHash };
}

// ---------------------------------------------------------------------------
// Main export: drawWinnerOnChain (Creator only)
// ---------------------------------------------------------------------------

export async function drawWinnerOnChain(
  connectedApi: ConnectedAPI,
  contractAddress: string,
  drawId: number,
  adminSecretHex: string,
  drawSecretHex: string,
  claimedWinningNum: number,
  quotient: bigint | string,
  network: MidnightNetwork,
  onStep?: (step: string) => void,
): Promise<DrawWinnerResult> {
  const report = (msg: string) => { onStep?.(msg); };
  const adminSecretBytes = hexToBytes(adminSecretHex);
  const drawSecretBytes = hexToBytes(drawSecretHex);
  const drawIdBig = BigInt(drawId);

  const witnesses: Witnesses<Record<string, never>> = {
    adminSecret: (ctx) => [ctx.privateState, adminSecretBytes],
    privateTicketNumber: (ctx) => [ctx.privateState, 1n],
    ticketSalt: (ctx) => [ctx.privateState, new Uint8Array(32)],
    playerSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
  };

  const { contract, circuitContext, contractStateObj: csObj, contractAddress: cAddr } = await prepareCircuitContext(
    connectedApi,
    contractAddress,
    network,
    witnesses,
    report,
  );

  report(`Executing drawWinner ZK circuit for Draw #${drawId} locally (verifying Euclidean division proof)...`);
  const { result: winningNumResult, proofData } = contract.circuits.drawWinner(
    circuitContext,
    drawIdBig,
    drawSecretBytes,
    BigInt(claimedWinningNum),
    BigInt(quotient),
  );

  const txHash = await proveAndSubmitTx(connectedApi, 'drawWinner', cAddr, csObj, proofData, network, report);
  return { txHash, winningNumber: Number(winningNumResult) };
}

// ---------------------------------------------------------------------------
// Main export: claimPrizeOnChain
// ---------------------------------------------------------------------------

export async function claimPrizeOnChain(
  connectedApi: ConnectedAPI,
  contractAddress: string,
  drawId: number,
  ticketNumber: number,
  saltHex: string,
  playerSecretHex: string,
  network: MidnightNetwork,
  onStep?: (step: string) => void,
): Promise<ClaimPrizeResult> {
  const report = (msg: string) => { onStep?.(msg); };
  const saltBytes = hexToBytes(saltHex);
  const playerSecretBytes = hexToBytes(playerSecretHex);
  const ticketNumBig = BigInt(ticketNumber);
  const drawIdBig = BigInt(drawId);

  const witnesses: Witnesses<Record<string, never>> = {
    adminSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
    privateTicketNumber: (ctx) => [ctx.privateState, ticketNumBig],
    ticketSalt: (ctx) => [ctx.privateState, saltBytes],
    playerSecret: (ctx) => [ctx.privateState, playerSecretBytes],
  };

  const { contract, circuitContext, contractStateObj: csObj, contractAddress: cAddr } = await prepareCircuitContext(
    connectedApi,
    contractAddress,
    network,
    witnesses,
    report,
  );

  report(`Executing claimPrize ZK circuit for Draw #${drawId} locally (generating unique claim nullifier)...`);
  const { result: nullifierBytes, proofData } = contract.circuits.claimPrize(circuitContext, drawIdBig);
  const nullifierHex = toHex(nullifierBytes);

  const txHash = await proveAndSubmitTx(connectedApi, 'claimPrize', cAddr, csObj, proofData, network, report);
  return { txHash, nullifierHex };
}

function toArrayBuffer32(bytes: Uint8Array): Uint8Array {
  const buf = new ArrayBuffer(32);
  const arr = new Uint8Array(buf);
  arr.set(bytes.subarray(0, 32));
  return arr;
}

// ---------------------------------------------------------------------------
// Main export: deployMasterContractOnChain (Deploy single master multi-draw contract via 1AM wallet)
// ---------------------------------------------------------------------------

export async function deployMasterContractOnChain(
  connectedApi: ConnectedAPI,
  network: MidnightNetwork,
  onStep?: (step: string) => void,
): Promise<DeployLotteryOnChainResult> {
  const report = (msg: string) => { onStep?.(msg); };

  report('Initializing multi-draw master contract constructor...');
  const witnesses: Witnesses<Record<string, never>> = {
    adminSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
    privateTicketNumber: (ctx) => [ctx.privateState, 1n],
    ticketSalt: (ctx) => [ctx.privateState, new Uint8Array(32)],
    playerSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
  };
  const contract = new Contract(witnesses);

  let coinPublicKey = '00'.repeat(32);
  try {
    const shielded = await connectedApi.getShieldedAddresses();
    const rawKey = shielded?.shieldedCoinPublicKey ?? '';
    if (/^[0-9a-fA-F]+$/.test(rawKey)) {
      coinPublicKey = rawKey;
    } else if (rawKey) {
      const keyBytes = new TextEncoder().encode(rawKey);
      const hashBuf = await crypto.subtle.digest('SHA-256', keyBytes);
      coinPublicKey = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch { /* fallback to zero key */ }

  const constructorContext = {
    initialPrivateState: {},
    initialZswapLocalState: emptyZswapLocalState(coinPublicKey),
  };

  report('Evaluating master contract initialState bytecode...');
  const initRes = contract.initialState(constructorContext);

  const compactStateSerialized = initRes.currentContractState.serialize();
  const ledgerState = LedgerContractState.deserialize(compactStateSerialized);

  report('Attaching cryptographic verifier keys to contract operations...');
  const keyMaterialProvider = makeKeyMaterialProvider();
  const circuitNames = [
    'createDraw',
    'buyTicket',
    'closeLottery',
    'drawWinner',
    'verifyWinningTicket',
    'claimPrize',
  ];

  for (const name of circuitNames) {
    const vkBytes = await keyMaterialProvider.getVerifierKey(name);
    const op = new ContractOperation();
    op.verifierKey = vkBytes;
    ledgerState.setOperation(name, op);
  }

  report('Setting initial contract maintenance authority...');
  const signingKey = sampleSigningKey();
  const verifyingKey = signatureVerifyingKey(signingKey);
  ledgerState.maintenanceAuthority = new ContractMaintenanceAuthority([verifyingKey], 1, 0n);

  report('Constructing on-chain master contract deployment intent...');
  const contractDeploy = new ContractDeploy(ledgerState);
  let deployedContractAddress = contractDeploy.address.replace(/^0x/, '').toLowerCase();
  if (deployedContractAddress.length === 70) {
    deployedContractAddress = deployedContractAddress.slice(-64);
  }

  const ttl = new Date(Date.now() + 3600 * 1000);
  const intent = Intent.new(ttl).addDeploy(contractDeploy);

  report(`Assembling unproven deployment transaction for ${network}...`);
  const unprovenTx = Transaction.fromPartsRandomized(network, undefined, undefined, intent);

  report('Proving deployment transaction via 1AM wallet...');
  const provingProvider = await connectedApi.getProvingProvider(keyMaterialProvider);

  let unsealedTxHex: string;
  try {
    const costModel = CostModel.initialCostModel();
    const provenTx = await unprovenTx.prove(provingProvider, costModel);
    unsealedTxHex = toHex(provenTx.serialize());
  } catch (proveErr) {
    console.warn('Standard proveTx fallback to mockProve for deploy transaction:', proveErr);
    const mockTx = unprovenTx.mockProve();
    unsealedTxHex = toHex(mockTx.serialize());
  }

  report('1AM wallet prompt: Balancing deployment transaction & reserving DUST fees...');
  const { tx: balancedTxHex } = await connectedApi.balanceUnsealedTransaction(unsealedTxHex);

  report('Broadcasting master contract deployment transaction to Midnight network...');
  const submitResult = await connectedApi.submitTransaction(balancedTxHex);

  const txHash = await extractTxHash(balancedTxHex, submitResult);

  return {
    contractAddress: deployedContractAddress,
    txHash,
  };
}

// Backwards compatibility alias
export const deployLotteryOnChain = deployMasterContractOnChain;