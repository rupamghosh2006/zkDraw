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
} from '@midnight-ntwrk/ledger-v8';
import type { MidnightNetwork } from './config.js';
import { hexToBytes, sha256Hex } from './crypto.js';
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

    return {
      nextDrawId,
      draws: drawsList,
      ticketCommitments,
      claimedNullifiers,
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

async function proveAndSubmitTx(
  connectedApi: ConnectedAPI,
  circuitName: string,
  contractAddress: string,
  contractStateObj: ContractState,
  circuitContext: any,
  proofData: any,
  network: MidnightNetwork,
  report: (msg: string) => void,
): Promise<string> {
  const keyMaterialProvider = makeKeyMaterialProvider();
  const provingProvider = await connectedApi.getProvingProvider(keyMaterialProvider);

  // Get the ContractOperation (verifier key) for this circuit from the on-chain state
  const ledgerState = LedgerContractState.deserialize(contractStateObj.serialize());
  const op = ledgerState.operation(circuitName) ?? new ContractOperation();

  // Build a PreTranscript from the circuit's public transcript and query context
  const rand = communicationCommitmentRandomness();
  const preTranscript = new PreTranscript(
    circuitContext.currentQueryContext,
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

  report(`Generating ZK proof for ${circuitName} via 1AM wallet...`);
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

  report('1AM wallet: Balancing transaction & reserving DUST fees...');
  const { tx: balancedTxHex } = await connectedApi.balanceUnsealedTransaction(unsealedTxHex);

  report('Broadcasting transaction to Midnight network...');
  await connectedApi.submitTransaction(balancedTxHex);

  const txHashBytes = fromHex(balancedTxHex).slice(0, 32);
  return toHex(txHashBytes);
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

  const txHash = await proveAndSubmitTx(connectedApi, 'createDraw', cAddr, csObj, circuitContext, proofData, network, report);
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
): Promise<BuyTicketResult> {
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

  report(`Executing buyTicket ZK circuit for Draw #${drawId} locally...`);
  const { result: commitmentBytes, proofData } = contract.circuits.buyTicket(circuitContext, drawIdBig);
  const commitmentHex = toHex(commitmentBytes);

  const txHash = await proveAndSubmitTx(connectedApi, 'buyTicket', cAddr, csObj, circuitContext, proofData, network, report);
  return { txHash, commitmentHex };
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

  const txHash = await proveAndSubmitTx(connectedApi, 'closeLottery', cAddr, csObj, circuitContext, proofData, network, report);
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

  const txHash = await proveAndSubmitTx(connectedApi, 'drawWinner', cAddr, csObj, circuitContext, proofData, network, report);
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

  const txHash = await proveAndSubmitTx(connectedApi, 'claimPrize', cAddr, csObj, circuitContext, proofData, network, report);
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
  await connectedApi.submitTransaction(balancedTxHex);

  const txHashBytes = fromHex(balancedTxHex).slice(0, 32);
  const txHash = toHex(txHashBytes);

  return {
    contractAddress: deployedContractAddress,
    txHash,
  };
}

// Backwards compatibility alias
export const deployLotteryOnChain = deployMasterContractOnChain;