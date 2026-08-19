export type LotteryStatus = 'OPEN' | 'CLOSED' | 'DRAWN';

export interface Lottery {
  id: string;
  name: string;
  contractAddress: string;
  network: string;
  status: LotteryStatus;
  ticketPrice: string;
  prizePool: string;
  rangeMin: number;
  rangeMax: number;
  ticketCount: number;
  ticketCommitments: string[];
  drawCommitment: string;
  drawSecretHex?: string;
  winningNumber?: number;
  winnerCount?: number;
  entropyRevealed?: string;
  startTime: string;
  endTime: string;
  drawnAt?: string;
  closedAt?: string;
}

export interface UserTicket {
  id: string;
  lotteryId: string;
  ticketNumber: number;
  saltHex: string;
  playerSecretHex: string;
  commitmentHex: string;
  purchasedAt: string;
  txHash?: string;
}

export interface DrawVerificationResult {
  valid: boolean;
  lotteryId: string;
  contractAddress: string;
  network: string;
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
