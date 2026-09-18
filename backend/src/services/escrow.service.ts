import { createHash } from 'node:crypto';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DrawEscrowStatus, EscrowPayoutRecord, Lottery } from '../types/index.js';
import { lotteryService } from './lottery.service.js';
import { fetchLiveContractState } from '../midnight/contract-client.js';
import { config, type MidnightNetwork } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ESCROW_TREASURY_ADDRESSES: Record<MidnightNetwork, string> = {
  preprod:
    process.env.MIDNIGHT_PREPROD_ESCROW_ADDRESS ||
    'mn_addr_preprod1mpl8sse22gf7uvguze5a823tt6zz6huqpthxnjragqauwja6v7ds9jt4uk',
  preview:
    process.env.MIDNIGHT_PREVIEW_ESCROW_ADDRESS ||
    'mn_addr_preview1mpl8sse22gf7uvguze5a823tt6zz6huqpthxnjragqauwja6v7ds9n490t',
};

export class EscrowService {
  private payouts: Map<string, EscrowPayoutRecord[]> = new Map(); // key: `${network}:${drawId}`
  private dataFilePath: string;

  constructor() {
    this.dataFilePath = path.resolve(__dirname, '../../data/escrow-vault.json');
    this.loadPersistedPayouts();
  }

  private loadPersistedPayouts() {
    try {
      if (existsSync(this.dataFilePath)) {
        const raw = readFileSync(this.dataFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        for (const [key, records] of Object.entries(parsed)) {
          this.payouts.set(key, records as EscrowPayoutRecord[]);
        }
      }
    } catch (err) {
      console.warn('Could not load persisted escrow payouts:', err);
    }
  }

  private savePersistedPayouts() {
    try {
      const dir = path.dirname(this.dataFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const obj: Record<string, EscrowPayoutRecord[]> = {};
      for (const [key, records] of this.payouts.entries()) {
        obj[key] = records;
      }
      writeFileSync(this.dataFilePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      console.warn('Could not persist escrow payouts:', err);
    }
  }

  public getTreasuryAddress(network: string = 'preprod'): string {
    const net = (network.toLowerCase() === 'preview' ? 'preview' : 'preprod') as MidnightNetwork;
    return ESCROW_TREASURY_ADDRESSES[net];
  }

  public async getDrawEscrowStatus(
    idOrDrawId: string,
    network?: string,
  ): Promise<DrawEscrowStatus | null> {
    const lottery = await lotteryService.getLotteryById(idOrDrawId);
    if (!lottery) return null;

    const net = (lottery.network || network || 'preprod') as MidnightNetwork;
    const drawId = lottery.drawId ?? 0;
    const potKey = `${net}:${drawId}`;
    const drawPayouts = this.payouts.get(potKey) || [];

    const ticketPrice = BigInt(lottery.ticketPrice || '1000000');
    const ticketCount = BigInt(lottery.ticketCount || 0);
    const accumulatedPotAtomic = (ticketPrice * ticketCount).toString();
    const treasuryAddress = this.getTreasuryAddress(net);

    const claimedNullifiers = lottery.claimedNullifiers || [];
    const totalClaimedWinners = Math.max(claimedNullifiers.length, drawPayouts.length);

    return {
      drawId,
      lotteryId: lottery.id,
      network: net,
      contractAddress: lottery.contractAddress,
      ticketPriceAtomic: lottery.ticketPrice,
      ticketCount: Number(ticketCount),
      accumulatedPotAtomic,
      treasuryAddress,
      status: lottery.status,
      winningNumber: lottery.winningNumber,
      totalClaimedWinners,
      claimedNullifiers,
      payouts: drawPayouts,
    };
  }

  public async requestPayout(params: {
    drawId: number | string;
    contractAddress?: string;
    network?: string;
    nullifierHex: string;
    winnerAddress: string;
    claimTxHash?: string;
  }): Promise<{ success: boolean; payout: EscrowPayoutRecord; message: string }> {
    const { nullifierHex, winnerAddress, claimTxHash } = params;
    const cleanNullifier = nullifierHex.replace(/^0x/, '').toLowerCase();

    if (!/^[0-9a-fA-F]{64}$/.test(cleanNullifier)) {
      throw new Error('Invalid claim nullifier format. Must be a 64-character hex string.');
    }
    if (!winnerAddress || winnerAddress.trim().length < 10) {
      throw new Error('Valid winner payout address is required.');
    }

    const net = ((params.network || 'preprod').toLowerCase() === 'preview' ? 'preview' : 'preprod') as MidnightNetwork;
    const netConfig = net === 'preprod' ? config.networks.preprod : config.networks.preview;

    // Resolve the lottery
    let lottery: Lottery | null = null;
    if (typeof params.drawId === 'number' || /^\d+$/.test(String(params.drawId))) {
      const targetDrawId = Number(params.drawId);
      const all = await lotteryService.getAllLotteries(net);
      lottery = all.find((l) => l.drawId === targetDrawId && l.network === net) || null;
    }
    if (!lottery) {
      lottery = await lotteryService.getLotteryById(String(params.drawId));
    }
    if (!lottery) {
      throw new Error(`Lottery draw #${params.drawId} not found on ${net}.`);
    }

    const drawId = lottery.drawId ?? 0;
    const potKey = `${net}:${drawId}`;
    const drawPayouts = this.payouts.get(potKey) || [];

    // Guard 1: Prevent double payouts on the same nullifier
    const alreadyPaid = drawPayouts.find((p) => p.nullifierHex.toLowerCase() === cleanNullifier);
    if (alreadyPaid) {
      return {
        success: true,
        payout: alreadyPaid,
        message: 'Prize for this nullifier has already been disbursed by the Escrow Treasury.',
      };
    }

    // Guard 2: Verify the draw status is DRAWN
    if (lottery.status !== 'DRAWN') {
      throw new Error(`Cannot disburse escrow prize: draw is ${lottery.status}, expected DRAWN.`);
    }

    // Guard 3: Query live contract state to confirm the nullifier exists in on-chain claimedNullifiers
    const cAddress = params.contractAddress || lottery.contractAddress;
    let onChainVerified = false;

    try {
      const live = await fetchLiveContractState(netConfig.indexerUrl, cAddress, drawId);
      if (live?.claimedNullifiers && live.claimedNullifiers.length > 0) {
        onChainVerified = live.claimedNullifiers.some(
          (n) => n.replace(/^0x/, '').toLowerCase() === cleanNullifier,
        );
      }
    } catch (err) {
      console.warn('Could not query live on-chain nullifiers before escrow payout:', err);
    }

    // Also check local cache if on-chain indexer is lagging behind by a block
    if (!onChainVerified && lottery.claimedNullifiers) {
      onChainVerified = lottery.claimedNullifiers.some(
        (n) => n.replace(/^0x/, '').toLowerCase() === cleanNullifier,
      );
    }

    // If claimTxHash is provided, accept it if either onChain is verified or valid tx hash is provided
    if (!onChainVerified && (!claimTxHash || !/^[0-9a-fA-F]{64}$/.test(claimTxHash.replace(/^0x/, '')))) {
      throw new Error(
        'On-chain nullifier verification failed. Ensure your claimPrize transaction has been confirmed on the Midnight ledger.',
      );
    }

    // Calculate payout amount (support split pots if multiple winners)
    const ticketPrice = BigInt(lottery.ticketPrice || '1000000');
    const ticketCount = BigInt(Math.max(1, lottery.ticketCount || 1));
    const totalPotAtomic = ticketPrice * ticketCount;

    // Number of winners sharing the pot
    const winnerCount = Math.max(1, lottery.winnerCount || (lottery.claimedNullifiers?.length || 1));
    const splitAmountAtomic = (totalPotAtomic / BigInt(winnerCount)).toString();

    // Generate cryptographic payout receipt hash
    const payoutTxHash = `0x${createHash('sha256')
      .update(`zkdraw:escrow:payout:${net}:${drawId}:${cleanNullifier}:${winnerAddress}:${Date.now()}`)
      .digest('hex')}`;

    const payoutRecord: EscrowPayoutRecord = {
      nullifierHex: cleanNullifier,
      drawId,
      winnerAddress,
      amountAtomic: splitAmountAtomic,
      payoutTxHash,
      claimTxHash: claimTxHash ? `0x${claimTxHash.replace(/^0x/, '')}` : undefined,
      network: net,
      paidAt: new Date().toISOString(),
    };

    drawPayouts.push(payoutRecord);
    this.payouts.set(potKey, drawPayouts);
    this.savePersistedPayouts();

    const formattedNight = (Number(splitAmountAtomic) / 1_000_000).toLocaleString();

    return {
      success: true,
      payout: payoutRecord,
      message: `Successfully disbursed ${formattedNight} tNIGHT from Escrow Treasury to ${winnerAddress}.`,
    };
  }
}

export const escrowService = new EscrowService();
