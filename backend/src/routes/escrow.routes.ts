/**
 * escrow.routes.ts
 *
 * Routes for the Escrow Treasury endpoints.
 */

import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import {
  getVaultAddress,
  getEscrowStatus,
  registerEscrowClaim,
  openClaimWindow,
} from '../controllers/escrow.controller.js';
import { validateBody } from '../middleware/validation.middleware.js';

const router = Router();

// Strict rate limiter for the claim endpoint (5 per minute per IP)
const claimLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many claim requests. Please wait before retrying.' },
});

const claimBodySchema = z.object({
  nullifierHex: z
    .string()
    .regex(/^(0x)?[0-9a-fA-F]{64}$/, 'nullifierHex must be a 32-byte hex string'),
  winnerAddress: z
    .string()
    .min(10, 'winnerAddress must be a valid Midnight bech32m address'),
  network: z.enum(['preprod', 'preview']).optional(),
  lotteryId: z.string().optional(),
  ticketPriceAtomic: z.string().regex(/^\d+$/, 'ticketPriceAtomic must be a numeric string').optional(),
});

// GET /api/escrow/vault-address?network=preprod
router.get('/escrow/vault-address', getVaultAddress);

// GET /api/escrow/:contractAddress/:drawId
router.get('/escrow/:contractAddress/:drawId', getEscrowStatus);

// POST /api/escrow/:contractAddress/:drawId/claim
router.post(
  '/escrow/:contractAddress/:drawId/claim',
  claimLimiter,
  validateBody(claimBodySchema),
  registerEscrowClaim,
);

// POST /api/escrow/:contractAddress/:drawId/open-claim-window
// Called internally when draw winner is executed
router.post('/escrow/:contractAddress/:drawId/open-claim-window', openClaimWindow);

export default router;