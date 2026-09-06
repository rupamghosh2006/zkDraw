import type { Request, Response, NextFunction } from 'express';
import { lotteryService } from '../services/lottery.service.js';
import { verificationService } from '../services/verification.service.js';
import { config } from '../config/index.js';

export const getNetworks = (_req: Request, res: Response, next: NextFunction): void => {
  try {
    res.json({
      defaultNetwork: config.network,
      networks: {
        preview: {
          network: 'preview',
          contractAddress: config.networks.preview.contractAddress,
          indexerUrl: config.networks.preview.indexerUrl,
          nodeUrl: config.networks.preview.nodeUrl,
          explorerContractUrl: `https://explorer.1am.xyz/contract/${config.networks.preview.contractAddress}?network=preview`,
          faucetUrl: 'https://midnight-tmnight-preview.nethermind.dev/',
        },
        preprod: {
          network: 'preprod',
          contractAddress: config.networks.preprod.contractAddress,
          indexerUrl: config.networks.preprod.indexerUrl,
          nodeUrl: config.networks.preprod.nodeUrl,
          explorerContractUrl: `https://explorer.1am.xyz/contract/${config.networks.preprod.contractAddress}?network=preprod`,
          faucetUrl: 'https://midnight-tmnight-preprod.nethermind.dev/',
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getLotteries = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const network = req.query.network ? String(req.query.network) : undefined;
    const lotteries = lotteryService.getAllLotteries(network);
    res.json(lotteries);
  } catch (err) {
    next(err);
  }
};

export const getLotteryById = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = String(req.params.id);
    const lottery = lotteryService.getLotteryById(id);
    if (!lottery) {
      res.status(404).json({ error: `Lottery with ID ${id} not found` });
      return;
    }
    res.json(lottery);
  } catch (err) {
    next(err);
  }
};

export const getLotteryStatus = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = String(req.params.id);
    const lottery = lotteryService.getLotteryById(id);
    if (!lottery) {
      res.status(404).json({ error: `Lottery with ID ${id} not found` });
      return;
    }
    res.json({
      id: lottery.id,
      status: lottery.status,
      ticketCount: lottery.ticketCount,
      prizePool: lottery.prizePool,
      winningNumber: lottery.winningNumber,
      drawnAt: lottery.drawnAt,
      closedAt: lottery.closedAt,
    });
  } catch (err) {
    next(err);
  }
};

export const getLotteryDraw = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = String(req.params.id);
    const lottery = lotteryService.getLotteryById(id);
    if (!lottery) {
      res.status(404).json({ error: `Lottery with ID ${id} not found` });
      return;
    }
    if (lottery.status !== 'DRAWN') {
      res.status(400).json({
        error: `Lottery ${id} has not been drawn yet. Current status: ${lottery.status}`,
      });
      return;
    }
    res.json({
      id: lottery.id,
      status: lottery.status,
      winningNumber: lottery.winningNumber,
      drawCommitment: lottery.drawCommitment,
      entropyRevealed: lottery.entropyRevealed,
      ticketCount: lottery.ticketCount,
      drawnAt: lottery.drawnAt,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyLotteryDraw = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = String(req.params.id);
    const verification = verificationService.verifyDrawById(id);
    res.json(verification);
  } catch (err) {
    next(err);
  }
};

export const createLottery = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { name, network, contractAddress, ticketPrice, rangeMin, rangeMax, maxTickets, adminKey } = req.body;
    const created = lotteryService.createLottery({
      name: name || 'Custom zkDraw Lottery Pot',
      network,
      contractAddress,
      ticketPrice,
      rangeMin: rangeMin !== undefined ? Number(rangeMin) : undefined,
      rangeMax: rangeMax !== undefined ? Number(rangeMax) : undefined,
      maxTickets: maxTickets !== undefined ? Number(maxTickets) : undefined,
      adminKey,
    });
    res.status(201).json({
      message: 'Lottery draw initialized successfully by creator',
      lottery: created,
    });
  } catch (err) {
    next(err);
  }
};

export const buyTicket = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = String(req.params.id);
    const { ticketCommitment, participantKey } = req.body;
    const updated = lotteryService.buyTicket(id, ticketCommitment, participantKey);
    res.status(201).json({
      message: 'Ticket commitment registered successfully',
      lottery: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const closeLottery = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = String(req.params.id);
    const updated = lotteryService.closeLottery(id);
    res.json({
      message: 'Lottery closed successfully',
      lottery: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const drawLottery = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = String(req.params.id);
    const updated = lotteryService.drawWinner(id);
    res.json({
      message: 'Lottery drawn successfully and winning number generated deterministically',
      lottery: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyTicket = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = String(req.params.id);
    const { ticketNumber, ticketSaltHex, playerSecretHex } = req.body;
    const result = verificationService.verifyTicketById(
      id,
      Number(ticketNumber),
      ticketSaltHex,
      playerSecretHex,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
