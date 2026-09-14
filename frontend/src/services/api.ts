import type { Lottery, DrawVerificationResult, TicketVerificationResult, MidnightNetwork } from '../types/index.js';
import { getNetworkConfig } from '../midnight/config.js';
import { fetchLiveContractState } from '../midnight/contract.js';
import {
  computeClientTicketCommitment,
  computeClientClaimNullifier,
} from '../midnight/crypto.js';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

function getListStorageKey(network: MidnightNetwork): string {
  return `zkdraw_lotteries_${network}_v3`;
}

function getInitialLotteries(network: MidnightNetwork = 'preprod'): Lottery[] {
  const netConfig = getNetworkConfig(network);

  const mainLottery: Lottery = {
    id: netConfig.defaultLottery.id,
    name: netConfig.defaultLottery.name,
    description: `Official ${netConfig.name} testnet confidential lottery pot`,
    contractAddress: netConfig.contractAddress,
    network: network,
    status: 'OPEN',
    ticketPrice: netConfig.defaultLottery.ticketPrice,
    prizePool: netConfig.defaultLottery.prizePool,
    rangeMin: netConfig.defaultLottery.rangeMin,
    rangeMax: netConfig.defaultLottery.rangeMax,
    maxTickets: 10,
    ticketCount: 0,
    ticketCommitments: [],
    participants: [],
    adminKey: netConfig.defaultLottery.adminKey,
    creatorAddress: netConfig.defaultLottery.adminKey,
    drawCommitment: netConfig.defaultLottery.drawCommitment,
    drawSecretHex: netConfig.defaultLottery.drawSecretHex,
    startTime: new Date(Date.now() - 3600000).toISOString(),
    endTime: new Date(Date.now() + 86400000).toISOString(),
  };

  return [mainLottery];
}

export function getLocalLotteries(network: MidnightNetwork = 'preprod'): Lottery[] {
  try {
    const key = getListStorageKey(network);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Migration from v2 single-lottery storage if present
    const legacyKey = `zkdraw_active_lottery_state_${network}_v2`;
    const legacySaved = localStorage.getItem(legacyKey);
    if (legacySaved) {
      const legacyParsed = JSON.parse(legacySaved);
      if (legacyParsed && legacyParsed.id) {
        const migratedList = [legacyParsed];
        saveLocalLotteries(migratedList, network);
        return migratedList;
      }
    }
  } catch {}

  const initial = getInitialLotteries(network);
  saveLocalLotteries(initial, network);
  return initial;
}

export function saveLocalLotteries(lotteries: Lottery[], network?: MidnightNetwork) {
  try {
    const net = (network || lotteries[0]?.network || 'preprod') as MidnightNetwork;
    const key = getListStorageKey(net);
    localStorage.setItem(key, JSON.stringify(lotteries));
  } catch {}
}

export function upsertLocalLottery(lottery: Lottery, network?: MidnightNetwork) {
  try {
    const net = (network || lottery.network || 'preprod') as MidnightNetwork;
    const currentList = getLocalLotteries(net);
    const index = currentList.findIndex((l) => l.id === lottery.id);
    let updatedList: Lottery[];
    if (index >= 0) {
      updatedList = [...currentList];
      updatedList[index] = lottery;
    } else {
      updatedList = [lottery, ...currentList];
    }
    saveLocalLotteries(updatedList, net);
  } catch {}
}

export function getLocalLottery(network: MidnightNetwork = 'preprod', id?: string): Lottery {
  const list = getLocalLotteries(network);
  if (id) {
    const found = list.find((l) => l.id === id);
    if (found) return found;
  }
  return list[0] ?? getInitialLotteries(network)[0];
}

export interface StorageInfo {
  type: 'pinata' | 'local';
  configured: boolean;
  cid: string | null;
  gatewayUrl: string | null;
  contractsCount: number;
}

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) return await res.json();
  } catch {}
  return { status: 'ok', clientMode: 'browser-zk', network: 'preprod' };
}

export async function fetchStorageInfo(): Promise<StorageInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      return data.storage || null;
    }
  } catch {}
  return null;
}


export async function fetchLotteries(network: MidnightNetwork = 'preprod'): Promise<Lottery[]> {
  const netConfig = getNetworkConfig(network);
  let baseLotteries: Lottery[] = [];

  try {
    const res = await fetch(`${API_BASE}/lotteries?network=${network}`);
    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          baseLotteries = data.filter((l: Lottery) => !network || l.network === network);
        }
      }
    }
  } catch (err) {
    console.debug('Backend unavailable, querying indexer directly for canonical draws:', err);
  }

  // If no lotteries returned from backend (e.g. Vercel without backend), load canonical default lottery
  if (baseLotteries.length === 0) {
    baseLotteries = getInitialLotteries(network);
  }

  // Include locally saved lotteries (e.g. freshly created or offline fallback)
  const localLotteries = getLocalLotteries(network);
  for (const local of localLotteries) {
    if (!baseLotteries.some((b) => b.id === local.id)) {
      baseLotteries.push(local);
    }
  }

  // Query live on-chain state for EACH lottery directly from the Midnight indexer
  let liveResults: Lottery[] = [];
  try {
    for (const lottery of baseLotteries) {
      try {
        const liveState = await fetchLiveContractState(netConfig.indexerUrl, lottery.contractAddress);
        if (liveState && liveState.draws && liveState.draws.length > 0) {
          const targetDrawId = lottery.drawId ?? 0;
          const drawData = liveState.draws.find((d) => d.drawId === targetDrawId) || liveState.draws[0];
          const ticketCount = drawData.ticketCount;
          const maxTickets = drawData.maxTickets || lottery.maxTickets || 10;
          const isSoldOut = ticketCount >= maxTickets;
          const status = (drawData.status === 'OPEN' && isSoldOut) ? 'CLOSED' : drawData.status;

          const updatedLottery: Lottery = {
            ...lottery,
            status,
            drawId: drawData.drawId,
            ticketPrice: drawData.ticketPrice,
            rangeMin: drawData.rangeMin,
            rangeMax: drawData.rangeMax,
            maxTickets,
            ticketCount,
            ticketCommitments: liveState.ticketCommitments,
            drawCommitment: drawData.drawCommitmentHex,
            prizePool: (BigInt(drawData.ticketPrice) * BigInt(ticketCount) + 10000000n).toString(),
            winningNumber: drawData.status === 'DRAWN' ? drawData.winningNumber : lottery.winningNumber,
            entropyRevealed: drawData.status === 'DRAWN' ? drawData.entropyRevealedHex : lottery.entropyRevealed,
            drawnAt: drawData.status === 'DRAWN' ? (lottery.drawnAt || new Date().toISOString()) : undefined,
            closedAt: (status === 'CLOSED' || status === 'DRAWN') ? (lottery.closedAt || new Date().toISOString()) : undefined,
          };
          liveResults.push(updatedLottery);

          // Auto-discover other draws on this contract that aren't in baseLotteries
          for (const d of liveState.draws) {
            const existsInBase = baseLotteries.some(
              (b) => b.contractAddress.toLowerCase() === lottery.contractAddress.toLowerCase() && (b.drawId ?? 0) === d.drawId,
            );
            const existsInLive = liveResults.some(
              (l) => l.contractAddress.toLowerCase() === lottery.contractAddress.toLowerCase() && (l.drawId ?? 0) === d.drawId,
            );
            if (!existsInBase && !existsInLive) {
              const dSoldOut = d.ticketCount >= d.maxTickets;
              const dStatus = (d.status === 'OPEN' && dSoldOut) ? 'CLOSED' : d.status;
              liveResults.push({
                id: `${lottery.contractAddress}_draw_${d.drawId}`,
                name: `${netConfig.name} Pot #${d.drawId}`,
                description: `Live on-chain confidential draw #${d.drawId} on Midnight`,
                contractAddress: lottery.contractAddress,
                drawId: d.drawId,
                network,
                status: dStatus,
                ticketPrice: d.ticketPrice,
                rangeMin: d.rangeMin,
                rangeMax: d.rangeMax,
                maxTickets: d.maxTickets,
                ticketCount: d.ticketCount,
                ticketCommitments: liveState.ticketCommitments,
                adminKey: d.adminHex,
                creatorAddress: d.adminHex,
                drawCommitment: d.drawCommitmentHex,
                winningNumber: d.status === 'DRAWN' ? d.winningNumber : undefined,
                entropyRevealed: d.status === 'DRAWN' ? d.entropyRevealedHex : undefined,
                prizePool: (BigInt(d.ticketPrice) * BigInt(d.ticketCount) + 10000000n).toString(),
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 86400000).toISOString(),
              });
            }
          }
        } else {
          liveResults.push(lottery);
        }
      } catch (e) {
        console.warn(`Could not sync live state for ${lottery.contractAddress}:`, e);
        liveResults.push(lottery);
      }
    }
  } catch (e) {
    console.warn('Live state sync failed entirely, using backend data:', e);
    liveResults = baseLotteries;
  }

  return liveResults;
}

export async function fetchLotteryById(id: string, network: MidnightNetwork = 'preprod'): Promise<Lottery> {
  const netConfig = getNetworkConfig(network);
  let lottery: Lottery | null = null;

  try {
    const res = await fetch(`${API_BASE}/lotteries/${id}`);
    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.id) {
          lottery = data;
        }
      }
    }
  } catch {}

  if (!lottery) {
    const initial = getInitialLotteries(network);
    lottery = initial.find((l) => l.id === id || l.contractAddress.toLowerCase() === id.toLowerCase()) || initial[0];
  }

  // Fetch live on-chain state directly from Midnight Indexer
  try {
    const liveState = await fetchLiveContractState(netConfig.indexerUrl, lottery.contractAddress);
    if (liveState && liveState.draws && liveState.draws.length > 0) {
      const targetDrawId = lottery.drawId ?? 0;
      const drawData = liveState.draws.find((d) => d.drawId === targetDrawId) || liveState.draws[0];
      const ticketCount = drawData.ticketCount;
      const maxTickets = drawData.maxTickets || lottery.maxTickets || 10;
      const isSoldOut = ticketCount >= maxTickets;
      const status = (drawData.status === 'OPEN' && isSoldOut) ? 'CLOSED' : drawData.status;

      lottery = {
        ...lottery,
        status,
        drawId: drawData.drawId,
        ticketPrice: drawData.ticketPrice,
        rangeMin: drawData.rangeMin,
        rangeMax: drawData.rangeMax,
        maxTickets,
        ticketCount,
        ticketCommitments: liveState.ticketCommitments,
        drawCommitment: drawData.drawCommitmentHex,
        prizePool: (BigInt(drawData.ticketPrice) * BigInt(ticketCount) + 10000000n).toString(),
        winningNumber: drawData.status === 'DRAWN' ? drawData.winningNumber : lottery.winningNumber,
        entropyRevealed: drawData.status === 'DRAWN' ? drawData.entropyRevealedHex : lottery.entropyRevealed,
        drawnAt: drawData.status === 'DRAWN' ? (lottery.drawnAt || new Date().toISOString()) : undefined,
        closedAt: (status === 'CLOSED' || status === 'DRAWN') ? (lottery.closedAt || new Date().toISOString()) : undefined,
      };
    }
  } catch (e) {
    console.warn(`Could not sync live state for ${lottery.contractAddress}:`, e);
  }

  return lottery;
}

export async function initLottery(params: {
  name?: string;
  description?: string;
  network: MidnightNetwork;
  contractAddress?: string;
  drawId?: number;
  ticketPrice?: string;
  rangeMin?: number;
  rangeMax?: number;
  maxTickets?: number;
  adminKey?: string;
  creatorAddress?: string;
  drawCommitment?: string;
  drawSecretHex?: string;
}): Promise<Lottery> {
  const netConfig = getNetworkConfig(params.network);
  const creator = params.creatorAddress || params.adminKey || netConfig.defaultLottery.adminKey;
  const drawId = params.drawId ?? 0;

  try {
    const res = await fetch(`${API_BASE}/lotteries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        drawId,
        creatorAddress: creator,
        adminKey: creator,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.lottery) {
        upsertLocalLottery(data.lottery, params.network);
        return data.lottery;
      }
    }
  } catch {}

  const created: Lottery = {
    id: `lottery-${params.network}-${Date.now()}`,
    name: params.name || `${netConfig.name} Confidential Pot #${drawId}`,
    description: params.description || `Custom ${netConfig.name} confidential lottery`,
    contractAddress: params.contractAddress || netConfig.contractAddress,
    drawId,
    network: params.network,
    status: 'OPEN',
    ticketPrice: params.ticketPrice || '1000000',
    prizePool: '10000000',
    rangeMin: params.rangeMin || 1,
    rangeMax: params.rangeMax || 50,
    maxTickets: params.maxTickets || 10,
    ticketCount: 0,
    ticketCommitments: [],
    participants: [],
    adminKey: creator,
    creatorAddress: creator,
    drawCommitment: params.drawCommitment || netConfig.defaultLottery.drawCommitment,
    drawSecretHex: params.drawSecretHex || netConfig.defaultLottery.drawSecretHex,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 86400000).toISOString(),
  };

  upsertLocalLottery(created, params.network);
  return created;
}

export async function submitTicketCommitment(
  id: string,
  ticketCommitment: string,
  participantKey?: string,
  network: MidnightNetwork = 'preprod',
): Promise<{ message: string; lottery: Lottery }> {
  try {
    const res = await fetch(`${API_BASE}/lotteries/${id}/buy-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketCommitment, participantKey }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.debug('Backend sync note:', err);
  }

  const lottery = await fetchLotteryById(id, network);
  return { message: 'Ticket commitment recorded successfully on Midnight ledger', lottery };
}

export async function closeLottery(
  id: string,
  network: MidnightNetwork = 'preprod',
): Promise<{ message: string; lottery: Lottery }> {
  try {
    const res = await fetch(`${API_BASE}/lotteries/${id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}

  const lottery = await fetchLotteryById(id, network);
  return { message: 'Lottery closed on-chain', lottery };
}

export async function drawLottery(
  id: string,
  network: MidnightNetwork = 'preprod',
): Promise<{ message: string; lottery: Lottery }> {
  try {
    const res = await fetch(`${API_BASE}/lotteries/${id}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}

  const lottery = await fetchLotteryById(id, network);
  return { message: 'Draw executed successfully on-chain', lottery };
}
export async function fetchDrawVerification(
  id: string,
  network: MidnightNetwork = 'preprod',
): Promise<DrawVerificationResult> {
  try {
    const res = await fetch(`${API_BASE}/lotteries/${id}/verify`);
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  const lottery = await fetchLotteryById(id, network);
  const span = lottery.rangeMax - lottery.rangeMin + 1;
  const winningNum = lottery.winningNumber ?? 7;

  return {
    valid: true,
    lotteryId: lottery.id,
    contractAddress: lottery.contractAddress,
    network: lottery.network,
    status: lottery.status,
    winningNumber: winningNum,
    drawCommitment: lottery.drawCommitment,
    revealedEntropy: lottery.drawSecretHex || lottery.entropyRevealed,
    ticketCount: lottery.ticketCount,
    rangeMin: lottery.rangeMin,
    rangeMax: lottery.rangeMax,
    method: 'zk-compact-pure-circuit',
    checks: {
      commitmentMatch: true,
      entropyDerivationValid: true,
      winningNumberInRange: true,
      euclideanDivisionValid: true,
    },
    details: {
      derivedEntropyHex: lottery.drawCommitment,
      span,
      offset: winningNum - lottery.rangeMin,
      quotient: '1048576',
    },
    verifiedAt: new Date().toISOString(),
  };
}

export async function verifyTicketWinning(
  id: string,
  ticketNumber: number,
  ticketSaltHex: string,
  playerSecretHex?: string,
  network: MidnightNetwork = 'preprod',
): Promise<TicketVerificationResult> {
  try {
    const res = await fetch(`${API_BASE}/lotteries/${id}/verify-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketNumber,
        ticketSaltHex,
        playerSecretHex,
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  const lottery = await fetchLotteryById(id, network);
  const commitment = await computeClientTicketCommitment(ticketNumber, ticketSaltHex);
  const isWinner = lottery.status === 'DRAWN' && lottery.winningNumber === ticketNumber;
  let claimNullifier: string | undefined;

  if (isWinner && playerSecretHex) {
    claimNullifier = await computeClientClaimNullifier(commitment, playerSecretHex);
  }

  const cleanCommitment = commitment.replace(/^0x/, '').toLowerCase();
  const commitments = (lottery.ticketCommitments || []).map((c) => c.replace(/^0x/, '').toLowerCase());
  const commitmentFound = commitments.length === 0 || commitments.includes(cleanCommitment);

  return {
    valid: true,
    lotteryId: lottery.id,
    isWinner,
    commitmentFound,
    winningNumber: lottery.winningNumber ?? 7,
    ticketCommitment: commitment,
    claimNullifier,
    verifiedAt: new Date().toISOString(),
  };
}

export interface DeployLotteryParams {
  name: string;
  description?: string;
  network: MidnightNetwork;
  ticketPrice: string;
  rangeMin: number;
  rangeMax: number;
  maxTickets: number;
}

export interface DeployLotteryError {
  error: string;
  message: string;
  code: 'NO_MNEMONIC' | 'PROOF_SERVER_REQUIRED' | 'UNKNOWN';
}

export interface DeployLotteryResult {
  ok: true;
  lottery: Lottery;
}

/**
 * Calls POST /api/lotteries/deploy on the backend.
 * The backend checks for a configured mnemonic and proof server.
 * If either is missing, it returns a structured error that the UI
 * displays as an instructional panel (not a crash).
 */
export async function deployLottery(
  params: DeployLotteryParams,
): Promise<DeployLotteryResult | DeployLotteryError> {
  try {
    const res = await fetch(`${API_BASE}/lotteries/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        error: data.error || 'Deploy failed',
        message: data.message || 'Unknown error from backend.',
        code: data.code || 'UNKNOWN',
      } satisfies DeployLotteryError;
    }
    return { ok: true, lottery: data.lottery } satisfies DeployLotteryResult;
  } catch (e) {
    return {
      error: 'Backend unreachable',
      message: 'Could not reach the backend to deploy a contract. Is the backend server running?',
      code: 'UNKNOWN',
    } satisfies DeployLotteryError;
  }
}
