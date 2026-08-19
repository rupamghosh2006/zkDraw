import type { Request, Response } from 'express';
import { config } from '../config/index.js';

export const getHealth = (_req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    service: 'zkDraw-backend',
    network: config.network,
    contractAddress: config.contractAddress,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};
