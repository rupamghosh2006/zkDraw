import { lotteryService } from './lottery.service.js';
import { DrawVerifier } from '../verification/draw-verifier.js';
import type { DrawVerificationResult, TicketVerificationResult } from '../types/index.js';

export class VerificationService {
  public verifyDrawById(id: string): DrawVerificationResult {
    const lottery = lotteryService.getInternalLotteryById(id);
    if (!lottery) {
      throw new Error(`Lottery with ID ${id} not found`);
    }
    return DrawVerifier.verifyDraw(lottery);
  }

  public verifyTicketById(
    id: string,
    ticketNumber: number,
    ticketSaltHex: string,
    playerSecretHex?: string,
  ): TicketVerificationResult {
    const lottery = lotteryService.getInternalLotteryById(id);
    if (!lottery) {
      throw new Error(`Lottery with ID ${id} not found`);
    }
    return DrawVerifier.verifyTicket(lottery, ticketNumber, ticketSaltHex, playerSecretHex);
  }
}

export const verificationService = new VerificationService();
