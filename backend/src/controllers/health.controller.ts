import type { Request, Response } from 'express';
import { config } from '../config/index.js';

export const getHealth = (_req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    service: 'zkDraw-backend',
    network: config.network,
    contractAddress: config.contractAddress,
    networks: {
      preview: {
        network: 'preview',
        contractAddress: config.networks.preview.contractAddress,
        indexerUrl: config.networks.preview.indexerUrl,
        nodeUrl: config.networks.preview.nodeUrl,
      },
      preprod: {
        network: 'preprod',
        contractAddress: config.networks.preprod.contractAddress,
        indexerUrl: config.networks.preprod.indexerUrl,
        nodeUrl: config.networks.preprod.nodeUrl,
      },
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};
