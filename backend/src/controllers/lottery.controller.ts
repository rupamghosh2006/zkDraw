import type { Request, Response, NextFunction } from 'express';
import { lotteryService } from '../services/lottery.service.js';
import { verificationService } from '../services/verification.service.js';
import { registryService } from '../services/registry.service.js';
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

export const getLotteries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const network = req.query.network ? String(req.query.network) : undefined;
    const lotteries = await lotteryService.getAllLotteries(network);
    res.json(lotteries);
  } catch (err) {
    next(err);
  }
};

export const getLotteryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const lottery = await lotteryService.getLotteryById(id);
    if (!lottery) {
      res.status(404).json({ error: `Lottery with ID ${id} not found` });
      return;
    }
    res.json(lottery);
  } catch (err) {
    next(err);
  }
};

export const getLotteryStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const lottery = await lotteryService.getLotteryById(id);
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

export const getLotteryDraw = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const lottery = await lotteryService.getLotteryById(id);
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

export const getOperatorSecret = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const internalLottery = lotteryService.getInternalLotteryById(id);
    if (!internalLottery) {
      res.status(404).json({ error: `Lottery with ID ${id} not found` });
      return;
    }

    const requester = (req.query.creatorAddress as string) || (req.headers['x-creator-address'] as string);
    const isCreator = Boolean(
      requester && (
        (internalLottery.creatorAddress && internalLottery.creatorAddress.toLowerCase() === requester.toLowerCase()) ||
        (internalLottery.adminKey && internalLottery.adminKey.toLowerCase() === requester.toLowerCase())
      )
    );
    const isClosedOrSoldOut = internalLottery.status === 'CLOSED' ||
      internalLottery.status === 'DRAWN' ||
      internalLottery.ticketCount >= internalLottery.maxTickets;

    if (!isClosedOrSoldOut && !isCreator) {
      res.status(403).json({
        error: 'Operator secret is protected until tickets are sold out or draw is closed, unless requested by verified creator',
      });
      return;
    }

    res.json({
      id: internalLottery.id,
      drawId: internalLottery.drawId ?? 0,
      adminKey: internalLottery.adminKey,
      creatorAddress: internalLottery.creatorAddress,
      drawCommitment: internalLottery.drawCommitment,
      drawSecretHex: internalLottery.drawSecretHex,
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

export const createLottery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, network, contractAddress, drawId, ticketPrice, rangeMin, rangeMax, maxTickets, adminKey, creatorAddress, drawCommitment, drawSecretHex } = req.body;
    const created = await lotteryService.createLottery({
      name: name || 'Custom zkDraw Lottery Pot',
      description,
      network,
      contractAddress,
      drawId: drawId !== undefined ? Number(drawId) : undefined,
      ticketPrice,
      rangeMin: rangeMin !== undefined ? Number(rangeMin) : undefined,
      rangeMax: rangeMax !== undefined ? Number(rangeMax) : undefined,
      maxTickets: maxTickets !== undefined ? Number(maxTickets) : undefined,
      adminKey,
      creatorAddress: creatorAddress || adminKey,
      drawCommitment,
      drawSecretHex,
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

export const deployLottery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { network = 'preprod' } = req.body as { network?: string };

    // Determine which env var to check for this network
    const mnemonicEnvMap: Record<string, string[]> = {
      preprod: ['MIDNIGHT_PREPROD_MNEMONIC', 'MIDNIGHT_MNEMONIC'],
      preview: ['MIDNIGHT_PREVIEW_MNEMONIC', 'MIDNIGHT_MNEMONIC'],
      mainnet: ['MIDNIGHT_MAINNET_MNEMONIC', 'MIDNIGHT_MNEMONIC'],
    };
    const envVarsToCheck = mnemonicEnvMap[network] ?? ['MIDNIGHT_MNEMONIC'];
    const hasMnemonic = envVarsToCheck.some((v) => !!process.env[v]);

    if (!hasMnemonic) {
      res.status(503).json({
        error: 'Mnemonic not configured',
        code: 'NO_MNEMONIC',
        message:
          `The backend does not have a wallet mnemonic configured for the "${network}" network. ` +
          `Contract deployment requires the backend to hold a funded Midnight wallet. ` +
          `To deploy manually: run \`npm run deploy:${network}\` in the contracts/ directory, ` +
          `then use the "Register Deployed Contract" tab to add the resulting address.`,
        envVarsNeeded: envVarsToCheck,
      });
      return;
    }

    // Mnemonic is present but proof server is always required for actual deployment
    res.status(503).json({
      error: 'Proof server required',
      code: 'PROOF_SERVER_REQUIRED',
      message:
        'Contract deployment requires a local Midnight proof server running at http://127.0.0.1:6300. ' +
        'This is not available in the cloud-hosted backend. ' +
        'To deploy: run `npm run deploy:' + network + '` in the contracts/ directory, ' +
        'then use the "Register Deployed Contract" tab to add the resulting address.',
    });
  } catch (err) {
    next(err);
  }
};

export const getRegistry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const network = req.query.network ? String(req.query.network) : undefined;
    const contracts = await registryService.getRegisteredContracts(network);
    const storage = registryService.getStorageInfo();
    res.json({
      storage,
      count: contracts.length,
      contracts,
    });
  } catch (err) {
    next(err);
  }
};

