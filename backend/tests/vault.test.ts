import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Encrypted Vault IPFS Sync Endpoints', () => {
  const app = createApp();

  it('rejects invalid payloads missing required fields', async () => {
    const res = await request(app)
      .post('/api/vault/sync')
      .send({ walletAddress: 'mn_addr_preprod1abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Required: walletAddress, ciphertext, iv');
  });

  it('accepts valid encrypted vault payload and returns sync result', async () => {
    const mockEncryptedPayload = {
      version: 1,
      type: 'zkdraw-encrypted-vault',
      walletAddress: 'mn_addr_preprod17hhujr34dkhlv2qpzdzddvxzuwr8qt4g4wy9jle7v37jedey6glsgp3k35',
      iv: '0102030405060708090a0b0c',
      ciphertext: 'deadbeefcafe1234567890',
      ticketCount: 2,
      timestamp: new Date().toISOString(),
    };

    const res = await request(app)
      .post('/api/vault/sync')
      .send(mockEncryptedPayload);

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.cid).toBeDefined();
  });

  it('queries latest vault metadata by wallet address', async () => {
    const testAddr = 'mn_addr_preprod17hhujr34dkhlv2qpzdzddvxzuwr8qt4g4wy9jle7v37jedey6glsgp3k35';
    const res = await request(app).get(`/api/vault/sync/wallet/${testAddr}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.exists).toBe('boolean');
  });
});
