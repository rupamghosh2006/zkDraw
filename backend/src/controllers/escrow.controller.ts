import type { Request, Response, NextFunction } from 'express';
import { escrowService } from '../services/escrow.service.js';

export const getTreasuryAddress = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const network = (req.query.network as string) || 'preprod';
    const address = escrowService.getTreasuryAddress(network);
    res.json({
      network,
      treasuryAddress: address,
      status: 'active',
      description: 'Programmatic Escrow Treasury for zkDraw confidential prize pots',
    });
  } catch (err) {
    next(err);
  }
};

export const getDrawEscrowStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = String(req.params.id);
    const network = (req.query.network as string) || undefined;
    const status = await escrowService.getDrawEscrowStatus(id, network);

    if (!status) {
      res.status(404).json({ error: `Escrow status for draw ID ${id} not found` });
      return;
    }

    res.json(status);
  } catch (err) {
    next(err);
  }
};

export const requestPayout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { drawId, contractAddress, network, nullifierHex, winnerAddress, claimTxHash } = req.body;

    if (!nullifierHex || !winnerAddress) {
      res.status(400).json({ error: 'Missing required parameters: nullifierHex and winnerAddress are required' });
      return;
    }

    const result = await escrowService.requestPayout({
      drawId: drawId !== undefined ? drawId : 0,
      contractAddress,
      network: network || 'preprod',
      nullifierHex,
      winnerAddress,
      claimTxHash,
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
};
