import type { Request, Response, NextFunction } from 'express';
import { pinataService } from '../services/pinata.service.js';

export interface EncryptedVaultPayload {
  version: number;
  type: 'zkdraw-encrypted-vault';
  walletAddress: string;
  iv: string;
  ciphertext: string;
  ticketCount: number;
  timestamp: string;
}

export const syncEncryptedVault = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as EncryptedVaultPayload;

    if (!payload.walletAddress || !payload.ciphertext || !payload.iv) {
      res.status(400).json({ error: 'Invalid encrypted vault payload. Required: walletAddress, ciphertext, iv.' });
      return;
    }

    const cleanAddr = payload.walletAddress.trim().toLowerCase();
    const pinName = `zkdraw_vault_${cleanAddr}`;

    if (!pinataService.isConfigured()) {
      // In local dev without Pinata credentials, return simulated CID
      res.status(200).json({
        success: true,
        simulated: true,
        cid: `bafkrei-simulated-vault-${cleanAddr.slice(0, 8)}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await pinataService.pinJSON(payload, {
      name: pinName,
      keyvalues: {
        type: 'zkdraw-encrypted-vault',
        wallet: cleanAddr,
        ticketCount: String(payload.ticketCount || 0),
      },
    });

    res.status(201).json({
      success: true,
      cid: result.cid,
      timestamp: result.timestamp,
    });
  } catch (err) {
    next(err);
  }
};

export const getLatestVaultByWallet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const walletAddress = String(req.params.walletAddress || '').trim().toLowerCase();
    if (!walletAddress) {
      res.status(400).json({ error: 'walletAddress is required' });
      return;
    }

    if (!pinataService.isConfigured()) {
      res.status(200).json({
        exists: false,
        message: 'Pinata is not configured on backend',
      });
      return;
    }

    const pinName = `zkdraw_vault_${walletAddress}`;
    const latest = await pinataService.getLatestPinByName(pinName);

    if (!latest) {
      res.status(200).json({ exists: false });
      return;
    }

    res.status(200).json({
      exists: true,
      cid: latest.cid,
      datePinned: latest.datePinned,
    });
  } catch (err) {
    next(err);
  }
};

export const getVaultByCid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cid = String(req.params.cid || '').trim();
    if (!cid) {
      res.status(400).json({ error: 'cid is required' });
      return;
    }

    if (cid.startsWith('bafkrei-simulated-vault-')) {
      res.status(404).json({ error: 'Simulated CID cannot be retrieved from IPFS gateway' });
      return;
    }

    const content = await pinataService.fetchFromGateway<EncryptedVaultPayload>(cid);
    res.status(200).json(content);
  } catch (err) {
    next(err);
  }
};
