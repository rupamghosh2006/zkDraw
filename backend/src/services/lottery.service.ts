import { createHash, randomBytes } from 'node:crypto';
import type { Lottery } from '../types/index.js';
import {
  getPureCircuits,
  loadDeploymentInfo,
  bytesToHex,
  hexToBytes,
  convert31BytesToField,
} from '../midnight/contract-client.js';
import { config } from '../config/index.js';

export class LotteryService {
  private lotteries: Map<string, Lottery> = new Map();

  constructor() {
    this.seedInitialLottery();
  }

  private seedInitialLottery() {
    const deployment = loadDeploymentInfo();
    const initialDrawSecret = new Uint8Array(
      createHash('sha256')
        .update(`zkDraw:${config.network}:draw:seed:initial`, 'utf8')
        .digest(),
    );

    const circuits = getPureCircuits();
    const initialDrawCommitment = bytesToHex(
      circuits.deriveDrawCommitment(initialDrawSecret),
    );

    const primaryLottery: Lottery = {
      id: 'lottery-preview-main',
      name: 'zkDraw Genesis Confidential Pot',
      contractAddress: deployment.contractAddress ?? config.contractAddress,
      network: config.network,
      status: 'OPEN',
      ticketPrice: '1000000', // 1 tDUST / tNIGHT
      prizePool: '25000000', // 25 tDUST starting jackpot
      rangeMin: 1,
      rangeMax: 50,
      ticketCount: 0,
      ticketCommitments: [],
      drawCommitment: initialDrawCommitment,
      drawSecretHex: bytesToHex(initialDrawSecret), // Stored internally by operator, not exposed in public view until DRAWN
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    // Pre-register some sample privacy-preserved commitments for demonstration
    const sampleSalts = ['salt-alpha-1', 'salt-beta-2', 'salt-gamma-3'];
    const sampleNumbers = [7, 24, 42];
    for (let i = 0; i < sampleNumbers.length; i++) {
      const salt = new Uint8Array(
        createHash('sha256').update(sampleSalts[i], 'utf8').digest(),
      );
      const commitment = bytesToHex(
        circuits.deriveTicketCommitment(BigInt(sampleNumbers[i]), salt),
      );
      primaryLottery.ticketCommitments.push(commitment);
      primaryLottery.ticketCount++;
    }

    this.lotteries.set(primaryLottery.id, primaryLottery);
  }

  public getAllLotteries(): Lottery[] {
    return Array.from(this.lotteries.values()).map(this.sanitizeLottery);
  }

  public getLotteryById(id: string): Lottery | null {
    const lottery = this.lotteries.get(id);
    return lottery ? this.sanitizeLottery(lottery) : null;
  }

  public getInternalLotteryById(id: string): Lottery | null {
    return this.lotteries.get(id) ?? null;
  }

  public createLottery(params: {
    id?: string;
    name: string;
    ticketPrice?: string;
    rangeMin?: number;
    rangeMax?: number;
  }): Lottery {
    const circuits = getPureCircuits();
    const id = params.id ?? `lottery-${Date.now()}`;
    const rangeMin = params.rangeMin ?? 1;
    const rangeMax = params.rangeMax ?? 50;
    const ticketPrice = params.ticketPrice ?? '1000000';

    const drawSecret = new Uint8Array(randomBytes(32));
    const drawCommitment = bytesToHex(circuits.deriveDrawCommitment(drawSecret));

    const newLottery: Lottery = {
      id,
      name: params.name,
      contractAddress: config.contractAddress,
      network: config.network,
      status: 'OPEN',
      ticketPrice,
      prizePool: '10000000',
      rangeMin,
      rangeMax,
      ticketCount: 0,
      ticketCommitments: [],
      drawCommitment,
      drawSecretHex: bytesToHex(drawSecret),
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };

    this.lotteries.set(id, newLottery);
    return this.sanitizeLottery(newLottery);
  }

  public buyTicket(id: string, ticketCommitment: string): Lottery {
    const lottery = this.lotteries.get(id);
    if (!lottery) {
      throw new Error(`Lottery with ID ${id} not found`);
    }
    if (lottery.status !== 'OPEN') {
      throw new Error(`Cannot purchase ticket: lottery is ${lottery.status}`);
    }

    const cleanCommitment = ticketCommitment.replace(/^0x/, '').toLowerCase();
    if (cleanCommitment.length !== 64) {
      throw new Error('Invalid ticket commitment: must be 32-byte hex');
    }

    if (lottery.ticketCommitments.includes(cleanCommitment)) {
      throw new Error('Ticket commitment already registered');
    }

    lottery.ticketCommitments.push(cleanCommitment);
    lottery.ticketCount++;
    lottery.prizePool = (BigInt(lottery.prizePool) + BigInt(lottery.ticketPrice)).toString();

    return this.sanitizeLottery(lottery);
  }

  public closeLottery(id: string): Lottery {
    const lottery = this.lotteries.get(id);
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

    return this.sanitizeLottery(lottery);
  }

  public drawWinner(id: string): Lottery {
    const lottery = this.lotteries.get(id);
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
    const revealedSecret = hexToBytes(lottery.drawSecretHex);
    const entropy = circuits.deriveWinningEntropy(revealedSecret, BigInt(lottery.ticketCount));
    const entropyField = convert31BytesToField(entropy);

    const span = BigInt(lottery.rangeMax - lottery.rangeMin + 1);
    const offset = entropyField % span;
    const winningNumber = lottery.rangeMin + Number(offset);

    lottery.status = 'DRAWN';
    lottery.winningNumber = winningNumber;
    lottery.entropyRevealed = lottery.drawSecretHex;
    lottery.drawnAt = new Date().toISOString();

    return this.sanitizeLottery(lottery);
  }

  /**
   * Sanitizes lottery data before sending to public clients:
   * Hides the unrevealed operator drawSecretHex while lottery is OPEN or CLOSED.
   */
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
