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
    this.seedInitialLotteries();
  }

  private seedInitialLotteries() {
    const circuits = getPureCircuits();

    // 1. Seed Preprod Lottery
    const preprodContractAddress = config.networks.preprod.contractAddress;
    const preprodAdminKey =
      config.networks.preprod.adminKey ??
      'd87e78432a5213ee311c1669d3aa2b5e842d5f800aee69c87d403bc74bba679b';
    const preprodDrawSecret = hexToBytes(
      '0dfcc49e9d7fe799d2c7b8266ab095efe0bf60226edafd4723324fc5a8e3ff99',
    );
    const preprodDrawCommitment = bytesToHex(
      circuits.deriveDrawCommitment(preprodDrawSecret),
    );

    const preprodLottery: Lottery = {
      id: 'lottery-preprod-main',
      name: 'zkDraw Preprod Confidential Pot',
      contractAddress: preprodContractAddress,
      network: 'preprod',
      status: 'OPEN',
      ticketPrice: '1000000', // 1 tDUST
      prizePool: '35000000', // 35 tDUST starting jackpot
      rangeMin: 1,
      rangeMax: 50,
      maxTickets: 10,
      ticketCount: 0,
      ticketCommitments: [],
      participants: [],
      adminKey: preprodAdminKey,
      drawCommitment: preprodDrawCommitment,
      drawSecretHex: bytesToHex(preprodDrawSecret),
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    // 2. Seed Preview Lottery
    const previewContractAddress = config.networks.preview.contractAddress;
    const previewAdminKey =
      config.networks.preview.adminKey ??
      '495e53af5d3db0c94bde14ceb65a8e036224eb4a086a1c4e9fa2fe5e0ecbbedf';
    const previewDrawSecret = hexToBytes(
      '63a5afc537996c7fed603aa49157963704ec9456d095f1410d08fa4b63baf297',
    );
    const previewDrawCommitment = bytesToHex(
      circuits.deriveDrawCommitment(previewDrawSecret),
    );

    const previewLottery: Lottery = {
      id: 'lottery-preview-main',
      name: 'zkDraw Preview Confidential Pot',
      contractAddress: previewContractAddress,
      network: 'preview',
      status: 'OPEN',
      ticketPrice: '1000000', // 1 tDUST
      prizePool: '25000000', // 25 tDUST starting jackpot
      rangeMin: 1,
      rangeMax: 50,
      maxTickets: 10,
      ticketCount: 0,
      ticketCommitments: [],
      participants: [],
      adminKey: previewAdminKey,
      drawCommitment: previewDrawCommitment,
      drawSecretHex: bytesToHex(previewDrawSecret),
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    this.lotteries.set(preprodLottery.id, preprodLottery);
    this.lotteries.set(previewLottery.id, previewLottery);
  }

  public getAllLotteries(network?: string): Lottery[] {
    const list = Array.from(this.lotteries.values());
    if (network) {
      const filtered = list.filter((l) => l.network === network);
      if (filtered.length > 0) {
        return filtered.map(this.sanitizeLottery);
      }
    }
    return list.map(this.sanitizeLottery);
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
    network?: string;
    contractAddress?: string;
    ticketPrice?: string;
    rangeMin?: number;
    rangeMax?: number;
    maxTickets?: number;
    adminKey?: string;
  }): Lottery {
    const circuits = getPureCircuits();
    const id = params.id ?? `lottery-${Date.now()}`;
    const network = params.network ?? config.network;
    const rangeMin = params.rangeMin ?? 1;
    const rangeMax = params.rangeMax ?? 50;
    const maxTickets = params.maxTickets ?? 10;
    const ticketPrice = params.ticketPrice ?? '1000000';

    const drawSecret = new Uint8Array(randomBytes(32));
    const drawCommitment = bytesToHex(circuits.deriveDrawCommitment(drawSecret));

    const newLottery: Lottery = {
      id,
      name: params.name,
      contractAddress: params.contractAddress ?? config.contractAddress,
      network: network,
      status: 'OPEN',
      ticketPrice,
      prizePool: '10000000',
      rangeMin,
      rangeMax,
      maxTickets,
      ticketCount: 0,
      ticketCommitments: [],
      participants: [],
      adminKey: params.adminKey,
      drawCommitment,
      drawSecretHex: bytesToHex(drawSecret),
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };

    this.lotteries.set(id, newLottery);
    return this.sanitizeLottery(newLottery);
  }

  public buyTicket(id: string, ticketCommitment: string, participantKeyHex?: string): Lottery {
    const lottery = this.lotteries.get(id);
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

    // Draw ends automatically after all tickets are sold
    if (lottery.ticketCount >= lottery.maxTickets) {
      lottery.status = 'CLOSED';
      lottery.closedAt = new Date().toISOString();
    }

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
