import { createHash, randomBytes } from 'node:crypto';
import type { Lottery } from '../types/index.js';
import {
  getPureCircuits,
  bytesToHex,
  hexToBytes,
  convert31BytesToField,
  fetchLiveContractState,
} from '../midnight/contract-client.js';
import { config } from '../config/index.js';
import { registryService, CANONICAL_CONTRACTS, type RegisteredContract } from './registry.service.js';
import { escrowService } from './escrow.service.js';

interface CacheEntry {
  lottery: Lottery;
  cachedAt: number;
}

const LIVE_CACHE_TTL_MS = 10_000; // 10 seconds for open/closed lotteries

async function pMap<T, R>(
  items: T[],
  mapper: (item: T) => Promise<R>,
  concurrency: number = 6,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await mapper(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export class LotteryService {
  private cache: Map<string, CacheEntry> = new Map();

  constructor() {
    // Immediately populate canonical contracts so service is ready without waiting for network
    for (const reg of CANONICAL_CONTRACTS) {
      const initial = this.toLottery(reg);
      this.setCache(initial);
    }
    this.syncInitialLotteries();
  }

  private setCache(lottery: Lottery, customCachedAt?: number): void {
    const cachedAt =
      customCachedAt !== undefined
        ? customCachedAt
        : lottery.status === 'DRAWN'
        ? Number.MAX_SAFE_INTEGER
        : Date.now();
    const entry: CacheEntry = { lottery, cachedAt };
    this.cache.set(lottery.id, entry);
    this.cache.set(lottery.contractAddress.toLowerCase(), entry);
  }

  private getCachedEntry(idOrAddr: string): CacheEntry | undefined {
    return this.cache.get(idOrAddr) || this.cache.get(idOrAddr.toLowerCase());
  }

  private isFresh(entry: CacheEntry): boolean {
    if (entry.lottery.status === 'DRAWN') return true; // immutable on-chain
    return Date.now() - entry.cachedAt < LIVE_CACHE_TTL_MS;
  }

  private toLottery(reg: RegisteredContract): Lottery {
    return {
      id: reg.id,
      name: reg.name,
      description: reg.description,
      contractAddress: reg.contractAddress,
      drawId: reg.drawId ?? 0,
      network: reg.network,
      status: 'OPEN',
      ticketPrice: reg.ticketPrice || '1000000',
      prizePool: '10000000',
      rangeMin: reg.rangeMin || 1,
      rangeMax: reg.rangeMax || 50,
      maxTickets: reg.maxTickets || 10,
      ticketCount: 0,
      ticketCommitments: [],
      participants: [],
      adminKey: reg.adminKey,
      creatorAddress: reg.creatorAddress,
      drawCommitment: reg.drawCommitment,
      drawSecretHex: reg.drawSecretHex,
      startTime: reg.deployedAt,
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  private async syncInitialLotteries() {
    try {
      const contracts = await registryService.getRegisteredContracts();
      for (const reg of contracts) {
        if (!this.getCachedEntry(reg.id)) {
          const initialLottery = this.toLottery(reg);
          this.setCache(initialLottery);
        }
      }
    } catch (e) {
      console.warn('Initial registry sync warning:', e);
    }
  }

  private async fetchAndSyncLiveState(reg: RegisteredContract): Promise<Lottery> {
    const net = reg.network || 'preprod';
    const netConfig = net === 'preprod' ? config.networks.preprod : config.networks.preview;

    const cached = this.getCachedEntry(reg.id);
    let lottery: Lottery = cached?.lottery || this.toLottery(reg);

    // Fast-path: If already DRAWN, state is immutable on-chain
    if (lottery.status === 'DRAWN') {
      return lottery;
    }

    try {
      const live = await fetchLiveContractState(netConfig.indexerUrl, reg.contractAddress, reg.drawId ?? 0);
      if (live) {
        lottery = {
          ...lottery,
          status: live.status,
          ticketPrice: live.ticketPrice,
          rangeMin: live.rangeMin,
          rangeMax: live.rangeMax,
          maxTickets: live.maxTickets,
          ticketCount: live.ticketCount,
          ticketCommitments: live.ticketCommitments,
          participants: live.participants,
          drawCommitment: live.drawCommitmentHex,
          prizePool: (BigInt(live.ticketPrice) * BigInt(live.ticketCount) + 10000000n).toString(),
          winningNumber: live.status === 'DRAWN' ? live.winningNumber : lottery.winningNumber,
          entropyRevealed: live.status === 'DRAWN' ? live.entropyRevealedHex : lottery.entropyRevealed,
          drawnAt: live.status === 'DRAWN' ? (lottery.drawnAt || new Date().toISOString()) : undefined,
          closedAt: (live.status === 'CLOSED' || live.status === 'DRAWN') ? (lottery.closedAt || new Date().toISOString()) : undefined,
        };
        this.setCache(lottery);
      }
    } catch (err) {
      console.warn(`Could not sync live contract state for ${reg.contractAddress}:`, err);
    }

    return lottery;
  }

  public async getAllLotteries(network?: string): Promise<Lottery[]> {
    const contracts = await registryService.getRegisteredContracts(network);

    const lotteries = await pMap(
      contracts,
      async (reg) => {
        const cached = this.getCachedEntry(reg.id);
        if (cached && this.isFresh(cached)) {
          return cached.lottery;
        }
        return await this.fetchAndSyncLiveState(reg);
      },
      6,
    );

    return lotteries.map((l) => this.sanitizeLottery(l));
  }

  public async getLotteryById(id: string): Promise<Lottery | null> {
    const cached = this.getCachedEntry(id);
    if (cached && this.isFresh(cached)) {
      return this.sanitizeLottery(cached.lottery);
    }

    const reg = (await registryService.getRegisteredContractById(id)) ??
                (await registryService.getRegisteredContractByAddress(id));
    if (!reg) {
      return cached ? this.sanitizeLottery(cached.lottery) : null;
    }

    const lottery = await this.fetchAndSyncLiveState(reg);
    return this.sanitizeLottery(lottery);
  }

  public getInternalLotteryById(id: string): Lottery | null {
    const cached = this.getCachedEntry(id);
    if (cached) return cached.lottery;

    const canonical = CANONICAL_CONTRACTS.find(
      (c) => c.id === id || c.contractAddress.toLowerCase() === id.toLowerCase(),
    );
    if (canonical) {
      const initial = this.toLottery(canonical);
      this.setCache(initial);
      return initial;
    }
    return null;
  }

  public async createLottery(params: {
    id?: string;
    name: string;
    description?: string;
    network?: string;
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
    const circuits = getPureCircuits();
    const id = params.id ?? `lottery-${Date.now()}`;
    const network = (params.network ?? config.network) as 'preprod' | 'preview';
    const rangeMin = params.rangeMin ?? 1;
    const rangeMax = params.rangeMax ?? 50;
    const maxTickets = params.maxTickets ?? 10;
    const ticketPrice = params.ticketPrice ?? '1000000';
    const adminKey = params.adminKey ?? '00'.repeat(32);
    const creatorAddress = params.creatorAddress ?? adminKey;
    const drawId = params.drawId !== undefined ? params.drawId : 0;

    const drawSecret = params.drawSecretHex ? hexToBytes(params.drawSecretHex) : new Uint8Array(randomBytes(32));
    const drawCommitment = params.drawCommitment ?? bytesToHex(circuits.deriveDrawCommitment(drawSecret));
    const contractAddress = params.contractAddress ?? config.networks[network].contractAddress;

    const registered: RegisteredContract = {
      id,
      name: params.name,
      description: params.description,
      contractAddress,
      drawId,
      network,
      deployedAt: new Date().toISOString(),
      adminKey,
      creatorAddress,
      drawCommitment,
      drawSecretHex: bytesToHex(drawSecret),
      ticketPrice,
      rangeMin,
      rangeMax,
      maxTickets,
    };

    await registryService.registerContract(registered, { backgroundSync: true });

    const lottery: Lottery = {
      ...registered,
      drawId,
      ticketPrice: registered.ticketPrice || '1000000',
      rangeMin: registered.rangeMin || 1,
      rangeMax: registered.rangeMax || 50,
      maxTickets: registered.maxTickets || 10,
      status: 'OPEN',
      prizePool: '10000000',
      ticketCount: 0,
      ticketCommitments: [],
      participants: [],
      startTime: registered.deployedAt,
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    this.setCache(lottery);

    return this.sanitizeLottery(lottery);
  }

  public buyTicket(id: string, ticketCommitment: string, participantKeyHex?: string): Lottery {
    const lottery = this.getInternalLotteryById(id);
    if (!lottery) {
      throw new Error(`Lottery with ID ${id} not found`);
    }
    if (lottery.status !== 'OPEN') {
      throw new Error(`Cannot purchase ticket: lottery is ${lottery.status}`);
    }
    if (lottery.ticketCount >= lottery.maxTickets) {
      throw new Error('All tickets have already been sold');
    }

    const cleanCommitment = ticketCommitment.replace(/^0x/, '').toLowerCase();
    if (cleanCommitment.length !== 64) {
      throw new Error('Invalid ticket commitment: must be 32-byte hex');
    }

    if (lottery.ticketCommitments.includes(cleanCommitment)) {
      throw new Error('Ticket commitment already registered');
    }

    if (participantKeyHex) {
      const cleanPKey = participantKeyHex.replace(/^0x/, '').toLowerCase();
      if (lottery.participants?.includes(cleanPKey)) {
        throw new Error('Participant has already drawn a ticket');
      }
      lottery.participants = lottery.participants || [];
      lottery.participants.push(cleanPKey);
    }

    lottery.ticketCommitments.push(cleanCommitment);
    lottery.ticketCount++;
    lottery.prizePool = (BigInt(lottery.prizePool) + BigInt(lottery.ticketPrice)).toString();

    if (lottery.ticketCount >= lottery.maxTickets) {
      lottery.status = 'CLOSED';
      lottery.closedAt = new Date().toISOString();
    }

    // Keep cache updated immediately
    this.setCache(lottery);

    // Notify escrow service of ticket payment so it tracks the pot balance
    const lotteryNet = (lottery.network as 'preprod' | 'preview') || 'preprod';
    try {
      escrowService.registerTicketPayment(
        lottery.id,
        lottery.contractAddress,
        lottery.drawId ?? 0,
        lotteryNet,
        lottery.ticketPrice,
      );
    } catch (e) {
      console.warn('[LotteryService] escrowService.registerTicketPayment failed (non-fatal):', e);
    }

    return this.sanitizeLottery(lottery);
  }

  public closeLottery(id: string): Lottery {
    const lottery = this.getInternalLotteryById(id);
    if (!lottery) {
      throw new Error(`Lottery with ID ${id} not found`);
    }
    if (lottery.status !== 'OPEN') {
      throw new Error(`Cannot close lottery: status is ${lottery.status}, expected OPEN`);
    }
    if (lottery.ticketCount === 0) {
      throw new Error('Cannot close lottery with zero tickets purchased');
    }

    lottery.status = 'CLOSED';
    lottery.closedAt = new Date().toISOString();
    this.setCache(lottery);

    return this.sanitizeLottery(lottery);
  }

  public drawWinner(id: string): Lottery {
    const lottery = this.getInternalLotteryById(id);

    if (!lottery) {
      throw new Error(`Lottery with ID ${id} not found`);
    }
    if (lottery.status !== 'CLOSED') {
      throw new Error(`Cannot execute draw: lottery is ${lottery.status}, expected CLOSED`);
    }
    if (!lottery.drawSecretHex) {
      throw new Error('Operator draw secret is missing');
    }

    const circuits = getPureCircuits();
    const drawId = BigInt(lottery.drawId ?? 0);
    const revealedSecret = hexToBytes(lottery.drawSecretHex);
    const entropy = circuits.deriveWinningEntropy(drawId, revealedSecret, BigInt(lottery.ticketCount));
    const entropyField = convert31BytesToField(entropy);

    const span = BigInt(lottery.rangeMax - lottery.rangeMin + 1);
    const offset = entropyField % span;
    const winningNumber = lottery.rangeMin + Number(offset);

    lottery.status = 'DRAWN';
    lottery.winningNumber = winningNumber;
    lottery.entropyRevealed = lottery.drawSecretHex;
    lottery.drawnAt = new Date().toISOString();
    this.setCache(lottery);

    // Open the escrow claim window — pot will be settled after the window expires
    const lotteryNet = (lottery.network as 'preprod' | 'preview') || 'preprod';
    try {
      escrowService.openClaimWindow(lottery.contractAddress, lottery.drawId ?? 0, lotteryNet);
    } catch (e) {
      console.warn('[LotteryService] escrowService.openClaimWindow failed (non-fatal):', e);
    }

    return this.sanitizeLottery(lottery);
  }

  private sanitizeLottery(lottery: Lottery): Lottery {
    const copy = { ...lottery };
    if (copy.status !== 'DRAWN') {
      delete copy.drawSecretHex;
      delete copy.winningNumber;
      delete copy.entropyRevealed;
    }
    return copy;
  }
}

export const lotteryService = new LotteryService();
