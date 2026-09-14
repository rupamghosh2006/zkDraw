import { Router } from 'express';
import { z } from 'zod';
import {
  getNetworks,
  getLotteries,
  getLotteryById,
  getLotteryStatus,
  getLotteryDraw,
  verifyLotteryDraw,
  createLottery,
  deployLottery,
  buyTicket,
  closeLottery,
  drawLottery,
  verifyTicket,
  getRegistry,
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
  participantKey: z
    .string()
    .regex(/^(0x)?[0-9a-fA-F]{64}$/, 'Participant key must be a 32-byte hex string')
    .optional(),
});

const createLotterySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  network: z.string().optional(),
  contractAddress: z.string().optional(),
  drawId: z.number().int().min(0).optional(),
  ticketPrice: z.string().optional(),
  rangeMin: z.number().int().min(1).optional(),
  rangeMax: z.number().int().min(2).optional(),
  maxTickets: z.number().int().min(1).optional(),
  adminKey: z.string().optional(),
  creatorAddress: z.string().optional(),
});

const deployLotterySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  network: z.string().optional(),
  ticketPrice: z.string(),
  rangeMin: z.number().int().min(1),
  rangeMax: z.number().int().min(2),
  maxTickets: z.number().int().min(1),
});

router.get('/networks', getNetworks);
router.get('/registry', getRegistry);
router.get('/lotteries', getLotteries);
router.post('/lotteries', validateBody(createLotterySchema), createLottery);
// Deploy route must come BEFORE /lotteries/:id so Express doesn't treat "deploy" as an id
router.post('/lotteries/deploy', validateBody(deployLotterySchema), deployLottery);


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
