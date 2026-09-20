import { Router } from 'express';
import healthRoutes from './health.routes.js';
import lotteryRoutes from './lottery.routes.js';
import escrowRoutes from './escrow.routes.js';
import vaultRoutes from './vault.routes.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/', lotteryRoutes);
router.use('/', escrowRoutes);
router.use('/', vaultRoutes);

export default router;
