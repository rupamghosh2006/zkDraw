export type LotteryStatus = 'OPEN' | 'CLOSED' | 'DRAWN';

export interface Lottery {
  id: string;
  name: string;
  contractAddress: string;
  drawId?: number;
  network: string;
  status: LotteryStatus;
  ticketPrice: string; // Atomic units (e.g. 1000000 = 1 tDUST)
  prizePool: string;
  rangeMin: number;
  rangeMax: number;
  maxTickets: number;
  ticketCount: number;
  ticketCommitments: string[]; // List of opaque 32-byte hex commitments
  participants?: string[]; // List of unique participant key hashes
  adminKey?: string; // Creator's admin key
  creatorAddress?: string;
  description?: string;
  drawCommitment: string; // 32-byte hex hash committed before draw
  drawSecretHex?: string; // Revealed only after DRAWN
  winningNumber?: number; // Result revealed after DRAWN
  winnerCount?: number;
  entropyRevealed?: string;
  claimedNullifiers?: string[]; // List of claimed ZK nullifier hashes
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
  method: 'zk-compact-pure-circuit' | 'mathematical-euclidean-proof';
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
