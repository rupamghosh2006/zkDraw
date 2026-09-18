import { Router } from 'express';
import healthRoutes from './health.routes.js';
import lotteryRoutes from './lottery.routes.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/', lotteryRoutes);

export default router;
