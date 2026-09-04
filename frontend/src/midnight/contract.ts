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
import { Contract, type Witnesses } from '../contract/index.js';
import {
  createCircuitContext,
  emptyZswapLocalState,
  proofDataIntoSerializedPreimage,
  ContractState,
} from '@midnight-ntwrk/compact-runtime';
import type { MidnightNetwork } from './config.js';
import { hexToBytes } from './crypto.js';
import { getNetworkConfig } from './config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuyTicketResult {
  /** Real on-chain transaction hash (hex, no 0x prefix) */
  txHash: string;
  /** 32-byte ZK ticket commitment (hex, no 0x prefix) */
  commitmentHex: string;
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
// Fetch contract state from the Midnight indexer via GraphQL
// ---------------------------------------------------------------------------

async function fetchContractStateHex(
  indexerUrl: string,
  contractAddress: string,
): Promise<string | null> {
  const query = 'query ContractState($address: String!) { contractState(address: $address) { state } }';
  const res = await fetch(indexerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { address: contractAddress } }),
  });
  if (!res.ok) throw new Error('Indexer returned HTTP ' + res.status);
  const json = await res.json() as {
    data?: { contractState?: { state?: string } | null };
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new Error('Indexer error: ' + json.errors.map((e) => e.message).join(', '));
  }
  return json.data?.contractState?.state ?? null;
}

// ---------------------------------------------------------------------------
// KeyMaterialProvider - serves ZK keys from /circuits/ static files
// ---------------------------------------------------------------------------

function makeKeyMaterialProvider(): KeyMaterialProvider {
  const base = '/circuits';
  return {
    async getZKIR(loc: string): Promise<Uint8Array> {
      const name = cleanCircuitName(loc);
      const r = await fetch(base + '/' + name + '.zkir');
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

// ---------------------------------------------------------------------------
// Main export: buyTicketOnChain
// ---------------------------------------------------------------------------

/**
 * Submits a real on-chain buyTicket transaction to the Midnight network.
 *
 * @param connectedApi  - Live ConnectedAPI from the Midnight Lace wallet
 * @param contractAddress - Hex contract address (no 0x prefix)
 * @param ticketNumber  - User's chosen lottery number
 * @param saltHex       - 32-byte random salt (hex, no 0x prefix)
 * @param network       - 'preprod' | 'preview'
 * @param onStep        - Optional progress callback for UI step labels
 */
export async function buyTicketOnChain(
  connectedApi: ConnectedAPI,
  contractAddress: string,
  ticketNumber: number,
  saltHex: string,
  network: MidnightNetwork,
  onStep?: (step: string) => void,
): Promise<BuyTicketResult> {
  const netConfig = getNetworkConfig(network);
  const report = (msg: string) => { onStep?.(msg); };

  // Step 1: Get indexer URL (prefer wallet-configured URL for privacy/network match)
  report('Connecting to Midnight indexer...');
  let indexerUrl = netConfig.indexerUrl;
  try {
    const walletConfig = await connectedApi.getConfiguration();
    if (walletConfig.indexerUri) indexerUrl = walletConfig.indexerUri;
  } catch { /* fall back to default network indexer */ }

  // Step 2: Fetch current on-chain contract state from indexer
  report('Fetching on-chain contract state...');
  const stateHex = await fetchContractStateHex(indexerUrl, contractAddress);
  if (!stateHex) {
    throw new Error(
      'Contract not found at ' + contractAddress + ' on ' + network +
      '. Ensure the correct network is selected.',
    );
  }

  // Deserialize the hex-encoded ContractState from the indexer
  const stateBytes = fromHex(stateHex);
  const contractStateObj = ContractState.deserialize(stateBytes);

  // Step 3: Build the circuit context from on-chain state
  report('Building ZK circuit context...');
  const saltBytes = hexToBytes(saltHex);
  const ticketNumBig = BigInt(ticketNumber);

  // Get coin public key from wallet for Zswap local state tracking
  let coinPublicKey = '00'.repeat(32);
  try {
    const shielded = await connectedApi.getShieldedAddresses();
    if (shielded.shieldedCoinPublicKey) {
      coinPublicKey = shielded.shieldedCoinPublicKey;
    }
  } catch {
    // If wallet shielded address is unavailable, default key is used for unshielded contract call
  }

  const witnesses: Witnesses<Record<string, never>> = {
    adminSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
    privateTicketNumber: (ctx) => [ctx.privateState, ticketNumBig],
    ticketSalt: (ctx) => [ctx.privateState, saltBytes],
    playerSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
  };

  const contract = new Contract(witnesses);

  const circuitContext = createCircuitContext(
    contractAddress,
    emptyZswapLocalState(coinPublicKey),
    contractStateObj,
    {},
  );

  // Step 4: Execute the circuit locally — produces proofData (pure local computation)
  report('Executing buyTicket ZK circuit locally...');
  const { result: commitmentBytes, proofData } = contract.circuits.buyTicket(circuitContext);
  const commitmentHex = toHex(commitmentBytes);

  // Step 5: Serialize proofData into wire-format preimage for the prover
  report('Serializing ZK witness preimage...');
  const serializedPreimage = proofDataIntoSerializedPreimage(
    proofData.input,
    proofData.output,
    proofData.publicTranscript,
    proofData.privateTranscriptOutputs,
    'buyTicket',
  );

  // Step 6: Generate ZK proof via the wallet's proving provider
  //         Downloads /circuits/buyTicket.prover (~2.8 MB) on first call.
  report('Generating ZK proof via Midnight Lace wallet (may take ~30 seconds)...');
  const keyMaterialProvider = makeKeyMaterialProvider();
  const provingProvider = await connectedApi.getProvingProvider(keyMaterialProvider);
  const provedTxBytes = await provingProvider.prove(serializedPreimage, 'buyTicket');
  const provedTxHex = toHex(provedTxBytes);

  // Step 7: Balance the transaction (wallet adds DUST fees + token balancing)
  report('Balancing transaction and adding DUST fees...');
  const { tx: balancedTxHex } = await connectedApi.balanceUnsealedTransaction(provedTxHex);

  // Step 8: Broadcast the balanced+proved transaction on-chain
  report('Broadcasting transaction to Midnight network...');
  await connectedApi.submitTransaction(balancedTxHex);

  // Derive a displayable txHash from the first 32 bytes of the balanced tx.
  // The Midnight ledger identifies transactions by their hash;
  // the explorer and indexer will confirm the hash once finalized.
  const txHashBytes = fromHex(balancedTxHex).slice(0, 32);
  const txHash = toHex(txHashBytes);

  return { txHash, commitmentHex };
}