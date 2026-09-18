/**
 * escrow.controller.ts
 *
 * REST controller for the Escrow Treasury endpoints.
 *
 * Routes:
 *   GET  /api/escrow/vault-address           - Returns escrow vault address(es) for each network
 *   GET  /api/escrow/:contractAddress/:drawId - Returns escrow pot status
 *   POST /api/escrow/:contractAddress/:drawId/claim - Register a winner's claim and trigger payout
 */

import type { Request, Response } from 'express';
import { escrowService } from '../services/escrow.service.js';
import type { MidnightNetwork } from '../config/index.js';

function parseNetwork(raw: unknown): MidnightNetwork {
  const str = Array.isArray(raw) ? raw[0] : String(raw ?? '');
  if (str === 'preview') return 'preview';
  return 'preprod';
}

function parseDrawId(raw: unknown): number {
  const str = Array.isArray(raw) ? raw[0] : String(raw ?? '0');
  const n = Number(str);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function getString(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * GET /api/escrow/vault-address
 * Returns the escrow vault bech32 address for each network.
 * The frontend uses this so ticket payments are directed to the correct vault.
 */
export async function getVaultAddress(req: Request, res: Response): Promise<void> {
  const network = parseNetwork(req.query.network);
  const address = escrowService.getVaultAddress(network);
  const configured = escrowService.isConfigured(network);

  res.json({
    network,
    address,
    configured,
    message: configured
      ? `Escrow vault is configured for real tNIGHT transfers on ${network}.`
      : `Escrow wallet not configured for ${network}. Real payouts are disabled (simulation mode). Set ESCROW_${network.toUpperCase()}_MNEMONIC to enable.`,
  });
}

/**
 * GET /api/escrow/:contractAddress/:drawId
 * Returns the escrow pot status for a draw — balance, claim count, payout hashes.
 */
export async function getEscrowStatus(req: Request, res: Response): Promise<void> {
  const contractAddress = getString(req.params.contractAddress);
  const parsedDrawId = parseDrawId(req.params.drawId);

  const pot = escrowService.getEscrowStatus(contractAddress, parsedDrawId);
  if (!pot) {
    res.json({
      exists: false,
      contractAddress,
      drawId: parsedDrawId,
      potAmountAtomic: '0',
      ticketCount: 0,
      status: 'open',
      claims: [],
      message: 'No escrow pot tracked for this draw yet. Pot is created when the first ticket is purchased.',
    });
    return;
  }

  // Return pot info, sanitizing any mnemonic-sensitive fields
  res.json({
    exists: true,
    key: pot.key,
    lotteryId: pot.lotteryId,
    contractAddress: pot.contractAddress,
    drawId: pot.drawId,
    network: pot.network,
    ticketPriceAtomic: pot.ticketPriceAtomic,
    ticketCount: pot.ticketCount,
    potAmountAtomic: pot.potAmountAtomic,
    escrowAddress: pot.escrowAddress,
    status: pot.status,
    createdAt: pot.createdAt,
    claimWindowOpenedAt: pot.claimWindowOpenedAt,
    settledAt: pot.settledAt,
    claimCount: pot.claims.length,
    verifiedClaimCount: pot.claims.filter(c => c.verifiedOnChain).length,
    settledClaimCount: pot.claims.filter(c => c.payoutTxHash).length,
    claims: pot.claims.map((c) => ({
      nullifierHex: c.nullifierHex,
      winnerAddress: c.winnerAddress,
      submittedAt: c.submittedAt,
      verifiedOnChain: c.verifiedOnChain,
      payoutTxHash: c.payoutTxHash,
      payoutAmountAtomic: c.payoutAmountAtomic,
      isSimulated: c.isSimulated,
      error: c.error,
    })),
  });
}

/**
 * POST /api/escrow/:contractAddress/:drawId/claim
 * Body: { nullifierHex, winnerAddress, network, lotteryId, ticketPriceAtomic }
 *
 * 1. Verifies the nullifier is on-chain in claimedNullifiers
 * 2. Records the claim in the escrow ledger
 * 3. If this is the first verified claim and the claim window is open, triggers immediate payout
 *    (winners after the first will be added to the split before settlement)
 */
export async function registerEscrowClaim(req: Request, res: Response): Promise<void> {
  const contractAddress = getString(req.params.contractAddress);
  const parsedDrawId = parseDrawId(req.params.drawId);
  const {
    nullifierHex,
    winnerAddress,
    network: networkRaw,
    lotteryId,
    ticketPriceAtomic,
  } = req.body as {
    nullifierHex: string;
    winnerAddress: string;
    network?: string;
    lotteryId?: string;
    ticketPriceAtomic?: string;
  };

  if (!nullifierHex || !winnerAddress) {
    res.status(400).json({ error: 'nullifierHex and winnerAddress are required' });
    return;
  }

  const network = parseNetwork(networkRaw);
  const effectiveLotteryId = lotteryId || `${contractAddress}_draw_${parsedDrawId}`;
  const effectiveTicketPrice = ticketPriceAtomic || '1000000';

  try {
    const { pot, claim, verified } = await escrowService.registerClaim(
      effectiveLotteryId,
      contractAddress,
      parsedDrawId,
      network,
      nullifierHex,
      winnerAddress,
      effectiveTicketPrice,
    );

    if (!verified) {
      res.status(422).json({
        error: 'Nullifier not verified on-chain',
        message:
          'The ZK nullifier was not found in the claimedNullifiers set on the Midnight ledger. ' +
          'Please ensure the claimPrize circuit transaction has been confirmed on-chain before requesting payout.',
        nullifierHex: nullifierHex.replace(/^0x/, '').slice(0, 16) + '...',
        potStatus: pot.status,
      });
      return;
    }

    // If pot has not been settled yet, it will settle automatically after claim window.
    // For user experience, we trigger immediate settlement if we're in claim_window status
    // and the pot was not yet settled (non-blocking — runs in background).
    if (pot.status === 'claim_window' && !claim.payoutTxHash) {
      // Trigger background settlement (non-blocking, the claim just submitted is included)
      setImmediate(async () => {
        try {
          await escrowService.settlePot(pot.key);
        } catch (e) {
          console.error('[EscrowController] Background settlement error:', e);
        }
      });
    }

    const latestPot = escrowService.getEscrowStatus(contractAddress, parsedDrawId);
    const latestClaim = latestPot?.claims.find(
      (c) => c.nullifierHex === nullifierHex.replace(/^0x/, '').toLowerCase(),
    );

    res.json({
      ok: true,
      verified: true,
      potStatus: latestPot?.status ?? pot.status,
      potAmountAtomic: latestPot?.potAmountAtomic ?? pot.potAmountAtomic,
      escrowAddress: pot.escrowAddress,
      claim: {
        nullifierHex: latestClaim?.nullifierHex ?? claim.nullifierHex,
        winnerAddress: latestClaim?.winnerAddress ?? claim.winnerAddress,
        verifiedOnChain: latestClaim?.verifiedOnChain ?? claim.verifiedOnChain,
        payoutTxHash: latestClaim?.payoutTxHash,
        payoutAmountAtomic: latestClaim?.payoutAmountAtomic,
        isSimulated: latestClaim?.isSimulated,
        error: latestClaim?.error,
      },
      message: latestClaim?.payoutTxHash
        ? `Payout of ${latestClaim.payoutAmountAtomic} atomic tNIGHT sent${latestClaim.isSimulated ? ' [SIMULATED]' : ''}. TxHash: ${latestClaim.payoutTxHash}`
        : 'Claim verified. Payout will be sent after the claim window closes.',
    });
  } catch (err) {
    console.error('[EscrowController] registerClaim error:', err);
    res.status(500).json({
      error: 'Internal escrow error',
      message: (err as Error).message,
    });
  }
}

/**
 * POST /api/escrow/:contractAddress/:drawId/open-claim-window
 * Called when the draw winner circuit is executed. Opens the settlement timer.
 */
export async function openClaimWindow(req: Request, res: Response): Promise<void> {
  const contractAddress = getString(req.params.contractAddress);
  const parsedDrawId = parseDrawId(req.params.drawId);
  const network = parseNetwork(req.body?.network ?? req.query.network);

  escrowService.openClaimWindow(contractAddress, parsedDrawId, network);

  res.json({
    ok: true,
    message: `Claim window opened for ${contractAddress} draw #${parsedDrawId} on ${network}.`,
  });
}