import {
  getPureCircuits,
  hexToBytes,
  bytesToHex,
  convert31BytesToField,
} from '../midnight/contract-client.js';
import type { Lottery, DrawVerificationResult, TicketVerificationResult } from '../types/index.js';

export class DrawVerifier {
  /**
   * Cryptographically verifies that a lottery's winning number was generated
   * strictly and faithfully according to the predefined commit-reveal and
   * ZK-Compact contract rules without manipulation.
   */
  static verifyDraw(lottery: Lottery): DrawVerificationResult {
    const circuits = getPureCircuits();
    const rangeMin = BigInt(lottery.rangeMin);
    const rangeMax = BigInt(lottery.rangeMax);
    const ticketCount = BigInt(lottery.ticketCount);

    if (lottery.status !== 'DRAWN' || !lottery.drawSecretHex || lottery.winningNumber === undefined) {
      return {
        valid: false,
        lotteryId: lottery.id,
        contractAddress: lottery.contractAddress,
        network: lottery.network,
        status: lottery.status,
        drawCommitment: lottery.drawCommitment,
        ticketCount: lottery.ticketCount,
        rangeMin: lottery.rangeMin,
        rangeMax: lottery.rangeMax,
        method: 'zk-compact-pure-circuit',
        checks: {
          commitmentMatch: false,
          entropyDerivationValid: false,
          winningNumberInRange: false,
          euclideanDivisionValid: false,
        },
        details: {},
        verifiedAt: new Date().toISOString(),
      };
    }

    const revealedSecret = hexToBytes(lottery.drawSecretHex);
    const expectedDrawCommitment = circuits.deriveDrawCommitment(revealedSecret);
    const expectedCommitmentHex = bytesToHex(expectedDrawCommitment);

    // 1. Commitment Match Check: Hash of revealed secret must equal pre-committed drawCommitment
    const commitmentMatch =
      expectedCommitmentHex.toLowerCase() ===
      lottery.drawCommitment.replace(/^0x/, '').toLowerCase();

    // 2. Entropy Derivation via Compact Pure Circuit
    const derivedEntropy = circuits.deriveWinningEntropy(revealedSecret, ticketCount);
    const derivedEntropyHex = bytesToHex(derivedEntropy);
    const entropyField = convert31BytesToField(derivedEntropy);

    // 3. Mathematical Euclidean Division: entropyField = quotient * span + offset
    const span = rangeMax - rangeMin + 1n;
    const quotient = entropyField / span;
    const offset = entropyField % span;
    const computedWinningNumber = Number(rangeMin + offset);

    const winningNumberInRange =
      lottery.winningNumber >= lottery.rangeMin &&
      lottery.winningNumber <= lottery.rangeMax;

    const entropyDerivationValid = lottery.winningNumber === computedWinningNumber;
    const euclideanDivisionValid =
      quotient * span + offset === entropyField && offset < span;

    const valid =
      commitmentMatch &&
      entropyDerivationValid &&
      winningNumberInRange &&
      euclideanDivisionValid;

    return {
      valid,
      lotteryId: lottery.id,
      contractAddress: lottery.contractAddress,
      network: lottery.network,
      status: lottery.status,
      winningNumber: lottery.winningNumber,
      drawCommitment: lottery.drawCommitment,
      revealedEntropy: lottery.drawSecretHex,
      ticketCount: lottery.ticketCount,
      rangeMin: lottery.rangeMin,
      rangeMax: lottery.rangeMax,
      method: 'zk-compact-pure-circuit',
      checks: {
        commitmentMatch,
        entropyDerivationValid,
        winningNumberInRange,
        euclideanDivisionValid,
      },
      details: {
        derivedEntropyHex,
        span: Number(span),
        offset: Number(offset),
        quotient: quotient.toString(),
      },
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Evaluates if a given private ticket is a winning ticket in ZK witness simulation,
   * without exposing or persisting the secret number or salt to the database.
   */
  static verifyTicket(
    lottery: Lottery,
    ticketNumber: number,
    ticketSaltHex: string,
    playerSecretHex?: string,
  ): TicketVerificationResult {
    const circuits = getPureCircuits();
    const salt = hexToBytes(ticketSaltHex);
    const commitment = circuits.deriveTicketCommitment(BigInt(ticketNumber), salt);
    const commitmentHex = bytesToHex(commitment);

    const commitmentFound = lottery.ticketCommitments.some(
      (c) => c.toLowerCase() === commitmentHex.toLowerCase(),
    );

    const isWinner =
      lottery.status === 'DRAWN' &&
      lottery.winningNumber !== undefined &&
      lottery.winningNumber === ticketNumber &&
      commitmentFound;

    let claimNullifier: string | undefined;
    if (isWinner && playerSecretHex) {
      const secret = hexToBytes(playerSecretHex);
      const nullifier = circuits.deriveClaimNullifier(commitment, secret);
      claimNullifier = bytesToHex(nullifier);
    }

    return {
      valid: commitmentFound,
      lotteryId: lottery.id,
      isWinner,
      commitmentFound,
      winningNumber: lottery.winningNumber ?? 0,
      ticketCommitment: commitmentHex,
      claimNullifier,
      verifiedAt: new Date().toISOString(),
    };
  }
}
