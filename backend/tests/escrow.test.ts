import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { lotteryService } from '../src/services/lottery.service.js';
import { escrowService, ESCROW_TREASURY_ADDRESSES } from '../src/services/escrow.service.js';
import { createHash } from 'node:crypto';

describe('zkDraw Escrow Treasury API & Service', () => {
  const app = createApp();

  describe('GET /api/escrow/address', () => {
    it('returns preprod escrow treasury address by default', async () => {
      const res = await request(app).get('/api/escrow/address');
      expect(res.status).toBe(200);
      expect(res.body.network).toBe('preprod');
      expect(res.body.treasuryAddress).toBe(ESCROW_TREASURY_ADDRESSES.preprod);
      expect(res.body.status).toBe('active');
    });

    it('returns preview escrow treasury address when specified', async () => {
      const res = await request(app).get('/api/escrow/address?network=preview');
      expect(res.status).toBe(200);
      expect(res.body.network).toBe('preview');
      expect(res.body.treasuryAddress).toBe(ESCROW_TREASURY_ADDRESSES.preview);
    });
  });

  describe('GET /api/escrow/draws/:id', () => {
    it('returns escrow status for an active draw', async () => {
      const res = await request(app).get('/api/escrow/draws/lottery-preprod-main');
      expect(res.status).toBe(200);
      expect(res.body.lotteryId).toBe('lottery-preprod-main');
      expect(res.body.treasuryAddress).toBe(ESCROW_TREASURY_ADDRESSES.preprod);
      expect(res.body.accumulatedPotAtomic).toBeDefined();
      expect(Array.isArray(res.body.payouts)).toBe(true);
    });

    it('returns 404 for a non-existent draw', async () => {
      const res = await request(app).get('/api/escrow/draws/non-existent-draw-999');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe('POST /api/escrow/payout', () => {
    it('rejects payout with malformed nullifier', async () => {
      const res = await request(app)
        .post('/api/escrow/payout')
        .send({
          drawId: 0,
          nullifierHex: 'not-a-valid-nullifier',
          winnerAddress: 'mn_addr_preprod1winner1234567890',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('rejects payout if draw is still OPEN', async () => {
      const dummyNullifier = createHash('sha256').update('test-nullifier-open').digest('hex');
      const res = await request(app)
        .post('/api/escrow/payout')
        .send({
          drawId: 'lottery-preprod-main',
          nullifierHex: dummyNullifier,
          winnerAddress: 'mn_addr_preprod1winner1234567890',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/expected DRAWN/i);
    });

    it('processes payout and prevents double payouts when draw is DRAWN', async () => {
      // Create a test draw
      const created = await lotteryService.createLottery({
        name: 'Escrow Payout Test Pot',
        network: 'preprod',
        ticketPrice: '1000000',
        maxTickets: 3,
        rangeMin: 1,
        rangeMax: 10,
      });

      // Buy a ticket
      const dummyCommitment = createHash('sha256').update('dummy-ticket').digest('hex');
      lotteryService.buyTicket(created.id, dummyCommitment);

      // Close and draw
      lotteryService.closeLottery(created.id);
      lotteryService.drawWinner(created.id);

      const winningNullifier = createHash('sha256').update('winning-nullifier-valid').digest('hex');
      const claimTxHash = createHash('sha256').update('claim-tx-hash').digest('hex');

      // First payout request
      const res1 = await request(app)
        .post('/api/escrow/payout')
        .send({
          drawId: created.id,
          network: 'preprod',
          nullifierHex: winningNullifier,
          winnerAddress: 'mn_addr_preprod1winner1234567890',
          claimTxHash,
        });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.payout).toBeDefined();
      expect(res1.body.payout.nullifierHex).toBe(winningNullifier);
      expect(res1.body.payout.winnerAddress).toBe('mn_addr_preprod1winner1234567890');
      expect(res1.body.payout.payoutTxHash).toBeDefined();

      // Second payout request with SAME nullifier must report already disbursed
      const res2 = await request(app)
        .post('/api/escrow/payout')
        .send({
          drawId: created.id,
          network: 'preprod',
          nullifierHex: winningNullifier,
          winnerAddress: 'mn_addr_preprod1winner1234567890',
          claimTxHash,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.message).toMatch(/already been disbursed/i);
    });
  });
});
