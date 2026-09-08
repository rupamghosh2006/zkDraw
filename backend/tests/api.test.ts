import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createHash } from 'node:crypto';
import { getPureCircuits, bytesToHex } from '../src/midnight/contract-client.js';

const toBytes32 = (str: string) => new Uint8Array(createHash('sha256').update(str, 'utf8').digest());

describe('zkDraw Backend REST API', () => {
  const app = createApp();
  const circuits = getPureCircuits();

  describe('Health & Networks Endpoints', () => {
    it('returns health status 200 with both preview and preprod network configs', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('zkDraw-backend');
      expect(res.body.network).toBeDefined();
      expect(res.body.contractAddress).toBeDefined();
      expect(res.body.networks).toBeDefined();
      expect(res.body.networks.preview.contractAddress).toBeDefined();
      expect(res.body.networks.preprod.contractAddress).toBeDefined();
    });

    it('returns networks configuration via /api/networks', async () => {
      const res = await request(app).get('/api/networks');
      expect(res.status).toBe(200);
      expect(res.body.defaultNetwork).toBeDefined();
      expect(res.body.networks.preview.contractAddress).toBeDefined();
      expect(res.body.networks.preprod.contractAddress).toBeDefined();
    });
  });

  describe('Lottery Retrieval & State Flow', () => {
    it('returns all active and historical lotteries', async () => {
      const res = await request(app).get('/api/lotteries');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns a specific lottery by ID', async () => {
      const res = await request(app).get('/api/lotteries/lottery-preview-main');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('lottery-preview-main');
      expect(res.body.status).toBe('OPEN');
      expect(typeof res.body.ticketCount).toBe('number');
      expect(res.body.drawSecretHex).toBeUndefined(); // Must NOT leak secret while OPEN
    });

    it('allows creator to initialize a new lottery draw with chosen maxTickets', async () => {
      const res = await request(app)
        .post('/api/lotteries')
        .send({
          name: 'Creator Custom Pot',
          network: 'preprod',
          ticketPrice: '2000000',
          maxTickets: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.lottery.name).toBe('Creator Custom Pot');
      expect(res.body.lottery.maxTickets).toBe(5);
      expect(res.body.lottery.ticketCount).toBe(0);
      expect(res.body.lottery.status).toBe('OPEN');
    });

    it('returns 404 for non-existent lottery ID', async () => {
      const res = await request(app).get('/api/lotteries/non-existent-pot-999');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('returns status overview for an active lottery', async () => {
      const res = await request(app).get('/api/lotteries/lottery-preview-main/status');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('lottery-preview-main');
      expect(res.body.status).toBe('OPEN');
      expect(typeof res.body.ticketCount).toBe('number');
    });
  });

  describe('Ticket Purchase & Lifecycle Transitions', () => {
    it('rejects malformed ticket commitments', async () => {
      const res = await request(app)
        .post('/api/lotteries/lottery-preview-main/buy-ticket')
        .send({ ticketCommitment: 'not-a-valid-hex' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('successfully registers a valid private ticket commitment', async () => {
      const testSalt = new Uint8Array(createHash('sha256').update('unique-player-salt-test', 'utf8').digest());
      const commitment = bytesToHex(circuits.deriveTicketCommitment(0n, 18n, testSalt));

      const res = await request(app)
        .post('/api/lotteries/lottery-preview-main/buy-ticket')
        .send({ ticketCommitment: commitment });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('registered successfully');
      expect(res.body.lottery.ticketCommitments).toContain(commitment);
    });

    it('enforces 1-ticket participant limit and auto-closes when maxTickets sold', async () => {
      // Create a 2-ticket lottery
      const createRes = await request(app)
        .post('/api/lotteries')
        .send({ name: 'Mini Pot', maxTickets: 2 });
      const potId = createRes.body.lottery.id;

      const saltA = new Uint8Array(createHash('sha256').update('salt-a', 'utf8').digest());
      const commitA = bytesToHex(circuits.deriveTicketCommitment(0n, 5n, saltA));
      const pKeyA = bytesToHex(circuits.deriveParticipantKey(0n, toBytes32('player-a-secret')));

      // Player A buys ticket 1
      const buyRes1 = await request(app)
        .post(`/api/lotteries/${potId}/buy-ticket`)
        .send({ ticketCommitment: commitA, participantKey: pKeyA });
      expect(buyRes1.status).toBe(201);
      expect(buyRes1.body.lottery.status).toBe('OPEN');

      // Player A tries to buy ticket 2 (rejected)
      const saltA2 = new Uint8Array(createHash('sha256').update('salt-a-2', 'utf8').digest());
      const commitA2 = bytesToHex(circuits.deriveTicketCommitment(0n, 12n, saltA2));
      const buyResA2 = await request(app)
        .post(`/api/lotteries/${potId}/buy-ticket`)
        .send({ ticketCommitment: commitA2, participantKey: pKeyA });
      expect(buyResA2.status).toBe(400);
      expect(buyResA2.body.error).toContain('Participant has already drawn a ticket');

      // Player B buys ticket 2 (reaches maxTickets = 2 -> auto-close)
      const saltB = new Uint8Array(createHash('sha256').update('salt-b', 'utf8').digest());
      const commitB = bytesToHex(circuits.deriveTicketCommitment(0n, 22n, saltB));
      const pKeyB = bytesToHex(circuits.deriveParticipantKey(0n, toBytes32('player-b-secret')));
      const buyRes2 = await request(app)
        .post(`/api/lotteries/${potId}/buy-ticket`)
        .send({ ticketCommitment: commitB, participantKey: pKeyB });
      expect(buyRes2.status).toBe(201);
      expect(buyRes2.body.lottery.status).toBe('CLOSED');
      expect(buyRes2.body.lottery.ticketCount).toBe(2);
    });

    it('rejects closing a non-existent lottery', async () => {
      const res = await request(app).post('/api/lotteries/unknown-lottery/close');
      expect(res.status).toBe(404);
    });

    it('closes the lottery and transitions to CLOSED', async () => {
      const res = await request(app).post('/api/lotteries/lottery-preview-main/close');
      expect(res.status).toBe(200);
      expect(res.body.lottery.status).toBe('CLOSED');
      expect(res.body.lottery.closedAt).toBeDefined();
    });

    it('draws the lottery deterministically and transitions to DRAWN', async () => {
      const res = await request(app).post('/api/lotteries/lottery-preview-main/draw');
      expect(res.status).toBe(200);
      expect(res.body.lottery.status).toBe('DRAWN');
      expect(typeof res.body.lottery.winningNumber).toBe('number');
      expect(res.body.lottery.winningNumber).toBeGreaterThanOrEqual(1);
      expect(res.body.lottery.winningNumber).toBeLessThanOrEqual(50);
      expect(res.body.lottery.entropyRevealed).toBeDefined();
    });

    it('provides independent draw verification data after draw', async () => {
      const res = await request(app).get('/api/lotteries/lottery-preview-main/verify');
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.checks.commitmentMatch).toBe(true);
      expect(res.body.checks.entropyDerivationValid).toBe(true);
      expect(res.body.checks.winningNumberInRange).toBe(true);
      expect(res.body.checks.euclideanDivisionValid).toBe(true);
    });

    it('allows client to verify whether their private ticket won without disclosing to public', async () => {
      const testSalt = new Uint8Array(createHash('sha256').update('unique-player-salt-test', 'utf8').digest());
      const res = await request(app)
        .post('/api/lotteries/lottery-preview-main/verify-ticket')
        .send({
          ticketNumber: 18,
          ticketSaltHex: bytesToHex(testSalt),
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(typeof res.body.isWinner).toBe('boolean');
      expect(res.body.commitmentFound).toBe(true);
    });
  });
});
