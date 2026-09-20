import { Router } from 'express';
import {
  syncEncryptedVault,
  getLatestVaultByWallet,
  getVaultByCid,
} from '../controllers/vault.controller.js';

const router = Router();

// POST /api/vault/sync - Pin client-side encrypted vault to IPFS via Pinata
router.post('/vault/sync', syncEncryptedVault);

// GET /api/vault/sync/wallet/:walletAddress - Retrieve latest pinned vault metadata
router.get('/vault/sync/wallet/:walletAddress', getLatestVaultByWallet);

// GET /api/vault/sync/:cid - Fetch encrypted vault payload by CID
router.get('/vault/sync/:cid', getVaultByCid);

export default router;
