import type { MidnightNetwork } from '../midnight/config.js';

export type { MidnightNetwork };

export type LotteryStatus = 'OPEN' | 'CLOSED' | 'DRAWN';

export interface Lottery {
  id: string;
  name: string;
  contractAddress: string;
  drawId?: number;
  network: MidnightNetwork | string;
  status: LotteryStatus;
  ticketPrice: string;
  prizePool: string;
  rangeMin: number;
  rangeMax: number;
  maxTickets: number;
  ticketCount: number;
  ticketCommitments: string[];
  participants?: string[];
  adminKey?: string;
  creatorAddress?: string;
  description?: string;
  drawCommitment: string;
  drawSecretHex?: string;
  winningNumber?: number;
  winnerCount?: number;
  entropyRevealed?: string;
  claimedNullifiers?: string[];
  startTime: string;
  endTime: string;
  drawnAt?: string;
  closedAt?: string;
}

export interface EscrowPayoutRecord {
  nullifierHex: string;
  drawId: number;
  winnerAddress: string;
  amountAtomic: string;
  payoutTxHash: string;
  claimTxHash?: string;
  network: string;
  paidAt: string;
}

export interface DrawEscrowStatus {
  drawId: number;
  lotteryId: string;
  network: string;
  contractAddress: string;
  ticketPriceAtomic: string;
  ticketCount: number;
  accumulatedPotAtomic: string;
  treasuryAddress: string;
  status: LotteryStatus;
  winningNumber?: number;
  totalClaimedWinners: number;
  claimedNullifiers: string[];
  payouts: EscrowPayoutRecord[];
}

export interface EscrowPayoutResult {
  success: boolean;
  payout: EscrowPayoutRecord;
  message: string;
}

export interface UserTicket {
  id: string;
  lotteryId: string;
  drawId?: number;
  network: MidnightNetwork | string;
  contractAddress: string;
  ticketNumber: number;
  saltHex: string;
  playerSecretHex: string;
  commitmentHex: string;
  purchasedAt: string;
  txHash?: string;
  paymentTxHash?: string;
}

export interface DrawVerificationResult {
  valid: boolean;
  lotteryId: string;
  contractAddress: string;
  network: MidnightNetwork | string;
  status: LotteryStatus;
  winningNumber?: number;
  drawCommitment: string;
  revealedEntropy?: string;
  ticketCount: number;
  rangeMin: number;
  rangeMax: number;
  method: string;
  checks: {
    commitmentMatch: boolean;
    entropyDerivationValid: boolean;
    winningNumberInRange: boolean;
    euclideanDivisionValid: boolean;
  };
  details: {
    derivedEntropyHex?: string;
    span?: number;
    offset?: number;
    quotient?: string;
  };
  verifiedAt: string;
}

export interface TicketVerificationResult {
  valid: boolean;
  lotteryId: string;
  isWinner: boolean;
  commitmentFound: boolean;
  winningNumber: number;
  ticketCommitment: string;
  claimNullifier?: string;
  verifiedAt: string;
}
