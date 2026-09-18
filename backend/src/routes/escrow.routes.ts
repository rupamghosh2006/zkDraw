import { Router } from 'express';
import { z } from 'zod';
import {
  getTreasuryAddress,
  getDrawEscrowStatus,
  requestPayout,
} from '../controllers/escrow.controller.js';
import { validateBody, validateParams } from '../middleware/validation.middleware.js';

const router = Router();

const drawIdParamsSchema = z.object({
  id: z.string().min(1, 'Draw ID cannot be empty'),
});

const payoutSchema = z.object({
  drawId: z.union([z.number().int().min(0), z.string()]),
  contractAddress: z.string().optional(),
  network: z.string().optional(),
  nullifierHex: z
    .string()
    .regex(/^(0x)?[0-9a-fA-F]{64}$/, 'Nullifier must be a 32-byte hex string'),
  winnerAddress: z.string().min(10, 'Winner address is required'),
  claimTxHash: z.string().optional(),
});

// GET /api/escrow/address — Get the active escrow treasury address
router.get('/address', getTreasuryAddress);

// GET /api/escrow/draws/:id — Get escrow pot status for a draw
router.get('/draws/:id', validateParams(drawIdParamsSchema), getDrawEscrowStatus);

// POST /api/escrow/payout — Claim and disburse prize from escrow
router.post('/payout', validateBody(payoutSchema), requestPayout);

export default router;
