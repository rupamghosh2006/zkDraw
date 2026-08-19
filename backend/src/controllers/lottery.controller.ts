import type { Request, Response, NextFunction } from 'express';
import { lotteryService } from '../services/lottery.service.js';
import { verificationService } from '../services/verification.service.js';

export const getLotteries = (_req: Request, res: Response, next: NextFunction): void => {
  try {
    const lotteries = lotteryService.getAllLotteries();
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

export const buyTicket = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = String(req.params.id);
    const { ticketCommitment } = req.body;
    const updated = lotteryService.buyTicket(id, ticketCommitment);
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
