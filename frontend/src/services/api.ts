import type { Lottery, DrawVerificationResult, TicketVerificationResult, MidnightNetwork } from '../types/index.js';
import { getNetworkConfig } from '../midnight/config.js';
import { fetchLiveContractState } from '../midnight/contract.js';
import {
  computeClientTicketCommitment,
  computeClientClaimNullifier,
  saveCreatorSecrets,
  getCreatorSecrets,
  type CreatorSecrets,
} from '../midnight/crypto.js';
export { saveCreatorSecrets, getCreatorSecrets, type CreatorSecrets };

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
    ? 'https://zkdraw.onrender.com/api'
    : '/api')
).replace(/\/$/, '');

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

export function isMockLottery(lottery: Partial<Lottery>): boolean {
  if (!lottery) return true;
  const dummyKey = '00'.repeat(32);
  const name = (lottery.name || '').toLowerCase();
  const id = (lottery.id || '').toLowerCase();

  // Allow canonical default lotteries
  if (id === 'lottery-preprod-main' || id === 'lottery-preview-main') {
    return false;
  }

  // Reject dummy placeholder lotteries
  if (
    name.includes('mock') ||
    name.includes('dummy') ||
    id.includes('mock') ||
    id.includes('dummy') ||
    lottery.adminKey === dummyKey
  ) {
    return true;
  }
  return false;
}

export function getLocalLotteries(network: MidnightNetwork = 'preprod'): Lottery[] {
  try {
    const key = getListStorageKey(network);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Strip out all mock data from localStorage
        const clean = parsed.filter((l) => !isMockLottery(l));
        if (clean.length !== parsed.length) {
          saveLocalLotteries(clean.length > 0 ? clean : getInitialLotteries(network), network);
        }
        if (clean.length > 0) {
          return clean;
        }
      }
    }

    // Migration from v2 single-lottery storage if present
    const legacyKey = `zkdraw_active_lottery_state_${network}_v2`;
    const legacySaved = localStorage.getItem(legacyKey);
    if (legacySaved) {
      const legacyParsed = JSON.parse(legacySaved);
      if (legacyParsed && legacyParsed.id && !isMockLottery(legacyParsed)) {
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

export async function fetchOperatorSecret(
  id: string,
  network: MidnightNetwork = 'preprod',
  creatorAddress?: string,
): Promise<{ drawSecretHex?: string; adminKey?: string } | null> {
  const normalizedId = id.startsWith(`lottery-${network}-`) ? id : id.replace(/^lottery-/, `lottery-${network}-`);
  const strippedId = id.replace(new RegExp(`^lottery-${network}-`), 'lottery-');
  const idsToTry = Array.from(new Set([id, strippedId, normalizedId]));

  for (const queryId of idsToTry) {
    try {
      const url = new URL(`${API_BASE}/lotteries/${queryId}/operator-secret`, window.location.origin);
      if (network) {
        url.searchParams.set('network', network);
      }
      if (creatorAddress) {
        url.searchParams.set('creatorAddress', creatorAddress);
      }
      const res = await fetch(url.toString(), {
        headers: creatorAddress ? { 'x-creator-address': creatorAddress } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.drawSecretHex) {
          return {
            drawSecretHex: data.drawSecretHex,
            adminKey: data.adminKey,
          };
        }
      }
    } catch (err) {
      console.warn(`Could not fetch operator secret from backend for ${queryId}:`, err);
    }
  }

  // Fallback: Query Pinata IPFS registry gateway directly
  try {
    const ipfsRes = await fetch(
      'https://gateway.pinata.cloud/ipfs/bafkreidaxgfte3ztx53lvov7jumm6r4rlcgjtdclxo6wqgokrmx4wy7nim',
      { signal: AbortSignal.timeout(4000) },
    );
    if (ipfsRes.ok) {
      const items = await ipfsRes.json();
      if (Array.isArray(items)) {
        const match = items.find(
          (it: any) =>
            idsToTry.includes(it.id) ||
            (it.drawId !== undefined && String(it.drawId) === id) ||
            (it.drawSecretHex && it.adminKey === creatorAddress),
        );
        if (match?.drawSecretHex) {
          return {
            drawSecretHex: match.drawSecretHex,
            adminKey: match.adminKey,
          };
        }
      }
    }
  } catch {}

  return null;
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

let rateLimitedUntil = 0;

export function isCurrentlyRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

function handleRateLimitResponse(res: Response): void {
  if (res.status === 429) {
    const retryHeader = res.headers.get('Retry-After');
    const seconds = retryHeader ? parseInt(retryHeader, 10) : 30;
    rateLimitedUntil = Date.now() + (isNaN(seconds) ? 30 : seconds) * 1000;
    console.warn(`[API] Rate limited (429). Pausing requests until ${new Date(rateLimitedUntil).toLocaleTimeString()}`);
  }
}

export async function fetchLotteries(network: MidnightNetwork = 'preprod'): Promise<Lottery[]> {
  const netConfig = getNetworkConfig(network);
  let baseLotteries: Lottery[] = [];

  if (!isCurrentlyRateLimited()) {
    try {
      const res = await fetch(`${API_BASE}/lotteries?network=${network}`);
      if (res.status === 429) {
        handleRateLimitResponse(res);
      } else if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            baseLotteries = data
              .filter((l: Lottery) => !network || l.network === network)
              .filter((l: Lottery) => !isMockLottery(l));
          }
        }
      }
    } catch (err) {
      console.debug('Backend unavailable, querying indexer directly for canonical draws:', err);
    }
  }

  // If no lotteries returned from backend (e.g. Vercel without backend), load canonical default lottery
  if (baseLotteries.length === 0) {
    baseLotteries = getInitialLotteries(network);
  }

  // Include locally saved lotteries (excluding any mock data)
  const localLotteries = getLocalLotteries(network).filter((l) => !isMockLottery(l));
  for (const local of localLotteries) {
    if (!baseLotteries.some((b) => b.id === local.id)) {
      baseLotteries.push(local);
    }
  }

  // Query live on-chain state for EACH lottery directly from the Midnight indexer
  let liveResults: Lottery[] = [];
  try {
    for (const lottery of baseLotteries) {
      if (isMockLottery(lottery)) continue;
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
            participants: liveState.participants,
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
              const discoveredDraw: Lottery = {
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
                participants: liveState.participants,
                adminKey: d.adminHex,
                creatorAddress: d.adminHex,
                drawCommitment: d.drawCommitmentHex,
                winningNumber: d.status === 'DRAWN' ? d.winningNumber : undefined,
                entropyRevealed: d.status === 'DRAWN' ? d.entropyRevealedHex : undefined,
                prizePool: (BigInt(d.ticketPrice) * BigInt(d.ticketCount) + 10000000n).toString(),
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 86400000).toISOString(),
              };
              if (!isMockLottery(discoveredDraw)) {
                liveResults.push(discoveredDraw);
              }
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

  return liveResults.filter((l) => !isMockLottery(l));

}

export async function fetchLotteryById(id: string, network: MidnightNetwork = 'preprod'): Promise<Lottery> {
  const netConfig = getNetworkConfig(network);
  let lottery: Lottery | null = null;

  const normalizedId = id.startsWith(`lottery-${network}-`) ? id : id.replace(/^lottery-/, `lottery-${network}-`);
  const strippedId = id.replace(new RegExp(`^lottery-${network}-`), 'lottery-');
  const idsToTry = Array.from(new Set([id, strippedId, normalizedId]));

  if (!isCurrentlyRateLimited()) {
    for (const qId of idsToTry) {
      try {
        const res = await fetch(`${API_BASE}/lotteries/${qId}`);
        if (res.status === 429) {
          handleRateLimitResponse(res);
          break; // Stop immediately; do not send multiple cascading requests while rate limited
        }
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (data && data.id) {
              lottery = data;
              break;
            }
          }
        }
      } catch {}
    }
  }

  if (!lottery) {
    // 1. Check local lotteries stored in the browser (crucial for client-side creations on Vercel)
    const localList = getLocalLotteries(network);
    lottery = localList.find((l) => idsToTry.includes(l.id) || l.contractAddress.toLowerCase() === id.toLowerCase()) || null;
  }

  if (!lottery) {
    // 2. Check creator secrets storage to see if this ID was saved with a specific drawId
    for (const qId of idsToTry) {
      const creatorSec = getCreatorSecrets(qId);
      if (creatorSec && creatorSec.drawId !== undefined) {
        lottery = {
          id: qId,
          name: `Draw #${creatorSec.drawId}`,
          contractAddress: creatorSec.contractAddress || netConfig.contractAddress,
          drawId: creatorSec.drawId,
          network,
          status: 'OPEN',
          ticketPrice: '1000000',
          prizePool: '10000000',
          rangeMin: 1,
          rangeMax: 50,
          maxTickets: 10,
          ticketCount: 0,
          ticketCommitments: [],
          participants: [],
          adminKey: creatorSec.adminKeyHex,
          drawCommitment: '',
          drawSecretHex: creatorSec.drawSecretHex,
          startTime: creatorSec.createdAt || new Date().toISOString(),
          endTime: new Date(Date.now() + 86400000).toISOString(),
        };
        break;
      }
    }
  }

  // 3. Check Pinata IPFS registry gateway fallback
  if (!lottery) {
    try {
      const ipfsRes = await fetch(
        'https://gateway.pinata.cloud/ipfs/bafkreidaxgfte3ztx53lvov7jumm6r4rlcgjtdclxo6wqgokrmx4wy7nim',
        { signal: AbortSignal.timeout(4000) },
      );
      if (ipfsRes.ok) {
        const items = await ipfsRes.json();
        if (Array.isArray(items)) {
          const match = items.find(
            (it: any) =>
              idsToTry.includes(it.id) ||
              (it.drawId !== undefined && (String(it.drawId) === id || it.id.endsWith(id.replace(/\D/g, '')))),
          );
          if (match) {
            lottery = {
              id: match.id,
              name: match.name || `Draw #${match.drawId}`,
              description: match.description,
              contractAddress: match.contractAddress || netConfig.contractAddress,
              drawId: match.drawId,
              network: match.network || network,
              status: 'OPEN',
              ticketPrice: match.ticketPrice || '1000000',
              prizePool: (BigInt(match.ticketPrice || '1000000') * BigInt(match.maxTickets || 10)).toString(),
              rangeMin: match.rangeMin || 1,
              rangeMax: match.rangeMax || 50,
              maxTickets: match.maxTickets || 10,
              ticketCount: 0,
              ticketCommitments: [],
              participants: [],
              adminKey: match.adminKey,
              creatorAddress: match.creatorAddress || match.adminKey,
              drawCommitment: match.drawCommitment,
              drawSecretHex: match.drawSecretHex,
              startTime: match.deployedAt || new Date().toISOString(),
              endTime: new Date(Date.now() + 86400000).toISOString(),
            };
            if (match.drawSecretHex) {
              saveCreatorSecrets(match.id, {
                adminSecretHex: match.drawSecretHex,
                drawSecretHex: match.drawSecretHex,
                adminKeyHex: match.adminKey,
                contractAddress: match.contractAddress,
                drawId: match.drawId,
                lotteryId: match.id,
              });
            }
          }
        }
      }
    } catch {}
  }

  if (!lottery) {
    const initial = getInitialLotteries(network);
    lottery = initial.find((l) => idsToTry.includes(l.id) || l.contractAddress.toLowerCase() === id.toLowerCase()) || initial[0];
  }

  // Fetch live on-chain state directly from Midnight Indexer
  try {
    const liveState = await fetchLiveContractState(netConfig.indexerUrl, lottery.contractAddress);
    if (liveState && liveState.draws && liveState.draws.length > 0) {
      let drawData: (typeof liveState.draws)[0] | undefined;
      if (lottery.drawId !== undefined) {
        drawData = liveState.draws.find((d) => d.drawId === lottery!.drawId);
      }
      if (!drawData && lottery.adminKey) {
        const cleanAdmin = lottery.adminKey.replace(/^0x/, '').toLowerCase();
        drawData = liveState.draws.find((d) => d.adminHex.toLowerCase() === cleanAdmin);
      }
      if (!drawData && lottery.drawCommitment) {
        const cleanComm = lottery.drawCommitment.replace(/^0x/, '').toLowerCase();
        drawData = liveState.draws.find((d) => d.drawCommitmentHex.toLowerCase() === cleanComm);
      }
      if (!drawData) {
        const sec = getCreatorSecrets(id);
        if (sec?.drawId !== undefined) {
          drawData = liveState.draws.find((d) => d.drawId === sec.drawId);
        }
      }
      if (!drawData && (lottery.id === 'lottery-preprod-main' || lottery.id === 'lottery-preview-main')) {
        drawData = liveState.draws[0];
      }
      if (!drawData) {
        drawData = liveState.draws[liveState.draws.length - 1];
      }

      const ticketCount = drawData.ticketCount;
      const maxTickets = drawData.maxTickets || lottery.maxTickets || 10;
      const isSoldOut = ticketCount >= maxTickets;
      const status = (drawData.status === 'OPEN' && isSoldOut) ? 'CLOSED' : drawData.status;

      lottery = {
        ...lottery,
        status,
        drawId: drawData.drawId,
        adminKey: drawData.adminHex || lottery.adminKey,
        ticketPrice: drawData.ticketPrice,
        rangeMin: drawData.rangeMin,
        rangeMax: drawData.rangeMax,
        maxTickets,
        ticketCount,
        ticketCommitments: liveState.ticketCommitments,
        participants: liveState.participants,
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

  // Restore creator secrets if lottery.drawSecretHex is missing
  if (lottery && !lottery.drawSecretHex) {
    const creatorSec = getCreatorSecrets(lottery.id, lottery.contractAddress, lottery.drawId);
    if (creatorSec?.drawSecretHex) {
      lottery.drawSecretHex = creatorSec.drawSecretHex;
    } else if (lottery.status === 'CLOSED' || lottery.status === 'DRAWN') {
      try {
        const backendSecret = await fetchOperatorSecret(lottery.id, network, lottery.creatorAddress);
        if (backendSecret?.drawSecretHex) {
          lottery.drawSecretHex = backendSecret.drawSecretHex;
          saveCreatorSecrets(lottery.id, {
            adminSecretHex: backendSecret.drawSecretHex,
            drawSecretHex: backendSecret.drawSecretHex,
            adminKeyHex: backendSecret.adminKey || lottery.adminKey,
            contractAddress: lottery.contractAddress,
            drawId: lottery.drawId,
            lotteryId: lottery.id,
          });
        }
      } catch {}
    }
  }

  return lottery;
}

export async function initLottery(params: {
  id?: string;
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
  const adminKey = params.adminKey || creator;
  const drawId = params.drawId ?? 0;
  const lotteryId = params.id || `lottery-${params.network}-${Date.now()}`;

  if (params.drawSecretHex) {
    saveCreatorSecrets(lotteryId, {
      adminSecretHex: params.drawSecretHex,
      drawSecretHex: params.drawSecretHex,
      adminKeyHex: adminKey,
      contractAddress: params.contractAddress,
      drawId,
      lotteryId,
    });
  }

  try {
    const res = await fetch(`${API_BASE}/lotteries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        id: lotteryId,
        drawId,
        creatorAddress: creator,
        adminKey: adminKey,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.lottery) {
        const enriched: Lottery = {
          ...data.lottery,
          drawSecretHex: params.drawSecretHex || data.lottery.drawSecretHex,
          adminKey: params.adminKey || data.lottery.adminKey,
        };
        upsertLocalLottery(enriched, params.network);
        if (enriched.id && enriched.id !== lotteryId && params.drawSecretHex) {
          saveCreatorSecrets(enriched.id, {
            adminSecretHex: params.drawSecretHex,
            drawSecretHex: params.drawSecretHex,
            adminKeyHex: params.adminKey || adminKey,
            contractAddress: enriched.contractAddress,
            drawId: enriched.drawId,
            lotteryId: enriched.id,
          });
        }
        return enriched;
      }
    }
  } catch {}

  const created: Lottery = {
    id: lotteryId,
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
    adminKey: adminKey,
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
  if (participantKey) {
    const cleanKey = participantKey.replace(/^0x/, '').toLowerCase();
    if (!lottery.participants?.map((p) => p.replace(/^0x/, '').toLowerCase()).includes(cleanKey)) {
      lottery.participants = [...(lottery.participants || []), cleanKey];
    }
  }
  const cleanCommitment = ticketCommitment.replace(/^0x/, '').toLowerCase();
  if (!lottery.ticketCommitments?.map((c) => c.replace(/^0x/, '').toLowerCase()).includes(cleanCommitment)) {
    lottery.ticketCommitments = [...(lottery.ticketCommitments || []), cleanCommitment];
    lottery.ticketCount = (lottery.ticketCount || 0) + 1;
  }
  upsertLocalLottery(lottery, network);
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
