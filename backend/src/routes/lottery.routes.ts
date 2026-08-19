import { Router } from 'express';
import { z } from 'zod';
import {
  getLotteries,
  getLotteryById,
  getLotteryStatus,
  getLotteryDraw,
  verifyLotteryDraw,
  buyTicket,
  closeLottery,
  drawLottery,
  verifyTicket,
} from '../controllers/lottery.controller.js';
import { validateBody, validateParams } from '../middleware/validation.middleware.js';

const router = Router();

const idParamsSchema = z.object({
  id: z.string().min(1, 'Lottery ID cannot be empty'),
});

const buyTicketSchema = z.object({
  ticketCommitment: z
    .string()
    .regex(/^(0x)?[0-9a-fA-F]{64}$/, 'Ticket commitment must be a 32-byte hex string'),
});

const verifyTicketSchema = z.object({
  ticketNumber: z.number().int().min(1, 'Ticket number must be positive'),
  ticketSaltHex: z
    .string()
    .regex(/^(0x)?[0-9a-fA-F]{64}$/, 'Ticket salt must be a 32-byte hex string'),
  playerSecretHex: z
    .string()
    .regex(/^(0x)?[0-9a-fA-F]{64}$/, 'Player secret must be a 32-byte hex string')
    .optional(),
});

router.get('/lotteries', getLotteries);
router.get('/lotteries/:id', validateParams(idParamsSchema), getLotteryById);
router.get('/lotteries/:id/status', validateParams(idParamsSchema), getLotteryStatus);
router.get('/lotteries/:id/draw', validateParams(idParamsSchema), getLotteryDraw);
router.get('/lotteries/:id/verify', validateParams(idParamsSchema), verifyLotteryDraw);

router.post(
  '/lotteries/:id/buy-ticket',
  validateParams(idParamsSchema),
  validateBody(buyTicketSchema),
  buyTicket,
);

router.post(
  '/lotteries/:id/close',
  validateParams(idParamsSchema),
  closeLottery,
);

router.post(
  '/lotteries/:id/draw',
  validateParams(idParamsSchema),
  drawLottery,
);

router.post(
  '/lotteries/:id/verify-ticket',
  validateParams(idParamsSchema),
  validateBody(verifyTicketSchema),
  verifyTicket,
);

export default router;
