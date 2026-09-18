import { Router } from 'express';
import healthRoutes from './health.routes.js';
import lotteryRoutes from './lottery.routes.js';
import escrowRoutes from './escrow.routes.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/', lotteryRoutes);
router.use('/', escrowRoutes);

export default router;
