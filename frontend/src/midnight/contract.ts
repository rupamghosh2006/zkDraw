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
    if (shielded.shieldedCoinPublicKey) {
      coinPublicKey = shielded.shieldedCoinPublicKey;
    }
  } catch { /* fallback */ }

  const contract = new Contract(witnesses);
  const circuitContext = createCircuitContext(
    contractAddress,
    emptyZswapLocalState(coinPublicKey),
    contractStateObj,
    {},
  );

  return { contract, circuitContext };
}

async function proveAndSubmitTx(
  connectedApi: ConnectedAPI,
  circuitName: string,
  proofData: any,
  report: (msg: string) => void,
): Promise<string> {
  report(`Serializing ZK witness preimage for ${circuitName}...`);
  const serializedPreimage = proofDataIntoSerializedPreimage(
    proofData.input,
    proofData.output,
    proofData.publicTranscript,
    proofData.privateTranscriptOutputs,
    circuitName,
  );

  report(`Generating ZK proof for ${circuitName} via Midnight Lace wallet...`);
  const keyMaterialProvider = makeKeyMaterialProvider();
  const provingProvider = await connectedApi.getProvingProvider(keyMaterialProvider);
  const provedTxBytes = await provingProvider.prove(serializedPreimage, circuitName);
  const provedTxHex = toHex(provedTxBytes);

  report('Balancing transaction and reserving DUST fees...');
  const { tx: balancedTxHex } = await connectedApi.balanceUnsealedTransaction(provedTxHex);

  report('Broadcasting transaction to Midnight network...');
  await connectedApi.submitTransaction(balancedTxHex);

  const txHashBytes = fromHex(balancedTxHex).slice(0, 32);
  return toHex(txHashBytes);
}

// ---------------------------------------------------------------------------
// Main export: buyTicketOnChain
// ---------------------------------------------------------------------------

export async function buyTicketOnChain(
  connectedApi: ConnectedAPI,
  contractAddress: string,
  ticketNumber: number,
  saltHex: string,
  playerSecretHex: string,
  network: MidnightNetwork,
  onStep?: (step: string) => void,
): Promise<BuyTicketResult> {
  const report = (msg: string) => { onStep?.(msg); };
  const saltBytes = hexToBytes(saltHex);
  const playerSecretBytes = hexToBytes(playerSecretHex);
  const ticketNumBig = BigInt(ticketNumber);

  const witnesses: Witnesses<Record<string, never>> = {
    adminSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
    privateTicketNumber: (ctx) => [ctx.privateState, ticketNumBig],
    ticketSalt: (ctx) => [ctx.privateState, saltBytes],
    playerSecret: (ctx) => [ctx.privateState, playerSecretBytes],
  };

  const { contract, circuitContext } = await prepareCircuitContext(
    connectedApi,
    contractAddress,
    network,
    witnesses,
    report,
  );

  report('Executing buyTicket ZK circuit locally...');
  const { result: commitmentBytes, proofData } = contract.circuits.buyTicket(circuitContext);
  const commitmentHex = toHex(commitmentBytes);

  const txHash = await proveAndSubmitTx(connectedApi, 'buyTicket', proofData, report);
  return { txHash, commitmentHex };
}

// ---------------------------------------------------------------------------
// Main export: closeLotteryOnChain (Creator only)
// ---------------------------------------------------------------------------

export async function closeLotteryOnChain(
  connectedApi: ConnectedAPI,
  contractAddress: string,
  adminSecretHex: string,
  network: MidnightNetwork,
  onStep?: (step: string) => void,
): Promise<CloseLotteryResult> {
  const report = (msg: string) => { onStep?.(msg); };
  const adminSecretBytes = hexToBytes(adminSecretHex);

  const witnesses: Witnesses<Record<string, never>> = {
    adminSecret: (ctx) => [ctx.privateState, adminSecretBytes],
    privateTicketNumber: (ctx) => [ctx.privateState, 1n],
    ticketSalt: (ctx) => [ctx.privateState, new Uint8Array(32)],
    playerSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
  };

  const { contract, circuitContext } = await prepareCircuitContext(
    connectedApi,
    contractAddress,
    network,
    witnesses,
    report,
  );

  report('Executing closeLottery ZK circuit locally (verifying creator authorization)...');
  const { proofData } = contract.circuits.closeLottery(circuitContext);

  const txHash = await proveAndSubmitTx(connectedApi, 'closeLottery', proofData, report);
  return { txHash };
}

// ---------------------------------------------------------------------------
// Main export: drawWinnerOnChain (Creator only)
// ---------------------------------------------------------------------------

export async function drawWinnerOnChain(
  connectedApi: ConnectedAPI,
  contractAddress: string,
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

  const witnesses: Witnesses<Record<string, never>> = {
    adminSecret: (ctx) => [ctx.privateState, adminSecretBytes],
    privateTicketNumber: (ctx) => [ctx.privateState, 1n],
    ticketSalt: (ctx) => [ctx.privateState, new Uint8Array(32)],
    playerSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
  };

  const { contract, circuitContext } = await prepareCircuitContext(
    connectedApi,
    contractAddress,
    network,
    witnesses,
    report,
  );

  report('Executing drawWinner ZK circuit locally (verifying Euclidean division proof)...');
  const { result: winningNumResult, proofData } = contract.circuits.drawWinner(
    circuitContext,
    drawSecretBytes,
    BigInt(claimedWinningNum),
    BigInt(quotient),
  );

  const txHash = await proveAndSubmitTx(connectedApi, 'drawWinner', proofData, report);
  return { txHash, winningNumber: Number(winningNumResult) };
}

// ---------------------------------------------------------------------------
// Main export: claimPrizeOnChain
// ---------------------------------------------------------------------------

export async function claimPrizeOnChain(
  connectedApi: ConnectedAPI,
  contractAddress: string,
  ticketNumber: number,
  saltHex: string,
  playerSecretHex: string,
  network: MidnightNetwork,
  onStep?: (step: string) => void,
): Promise<ClaimPrizeResult> {
  const report = (msg: string) => { onStep?.(msg); };
  const saltBytes = hexToBytes(saltHex);
  const playerSecretBytes = hexToBytes(playerSecretHex);

  const witnesses: Witnesses<Record<string, never>> = {
    adminSecret: (ctx) => [ctx.privateState, new Uint8Array(32)],
    privateTicketNumber: (ctx) => [ctx.privateState, BigInt(ticketNumber)],
    ticketSalt: (ctx) => [ctx.privateState, saltBytes],
    playerSecret: (ctx) => [ctx.privateState, playerSecretBytes],
  };

  const { contract, circuitContext } = await prepareCircuitContext(
    connectedApi,
    contractAddress,
    network,
    witnesses,
    report,
  );

  report('Executing claimPrize ZK circuit locally (generating unique claim nullifier)...');
  const { result: nullifierBytes, proofData } = contract.circuits.claimPrize(circuitContext);
  const nullifierHex = toHex(nullifierBytes);

  const txHash = await proveAndSubmitTx(connectedApi, 'claimPrize', proofData, report);
  return { txHash, nullifierHex };
}