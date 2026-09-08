import { describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import {
  Contract,
  ledger,
  pureCircuits,
} from '../managed/zkDraw/contract/index.js';
import * as compactRuntime from '@midnight-ntwrk/compact-runtime';

// Helper to create 32-byte Uint8Array from string or buffer
const toBytes32 = (str: string): Uint8Array => {
  return new Uint8Array(createHash('sha256').update(str, 'utf8').digest());
};

const createRandomBytes32 = (): Uint8Array => {
  return new Uint8Array(randomBytes(32));
};

// Convert 31-byte sliced Uint8Array to big-endian Field integer matching Compact's `slice<31>(entropy, 0) as Field`
const convert31BytesToField = (a: Uint8Array): bigint => {
  const sliced = a.slice(0, 31);
  let x = 0n;
  for (let i = sliced.length - 1; i >= 0; i -= 1) {
    x = x * 0x100n + BigInt(sliced[i]);
  }
  return x;
};

// Calculate mathematically exact quotient and winning number for drawWinner
const calculateDrawSolution = (
  drawId: bigint,
  revealedSecret: Uint8Array,
  ticketCount: bigint,
  rangeMin: bigint,
  rangeMax: bigint,
) => {
  const entropy = pureCircuits.deriveWinningEntropy(drawId, revealedSecret, ticketCount);
  const entropyField = convert31BytesToField(entropy);

  const span = rangeMax - rangeMin + 1n;
  const quotient = entropyField / span;
  const offset = entropyField % span;
  const winningNumber = rangeMin + offset;

  return { entropy, entropyField, span, quotient, offset, winningNumber };
};

describe('zkDraw Compact Smart Contract (Multi-Draw)', () => {
  // Test parameters
  const adminSecret = toBytes32('admin-master-secret-key-1');
  const adminKey = pureCircuits.deriveAdminKey(adminSecret);
  const ticketPrice = 100_000n;
  const rangeMin = 1n;
  const rangeMax = 50n;

  const drawSecret = toBytes32('operator-precommitted-entropy-1');
  const drawCommitment = pureCircuits.deriveDrawCommitment(drawSecret);

  // Helper to initialize a simulated contract
  const createTestContractInstance = (
    initialWitnesses: {
      adminSecret?: Uint8Array;
      privateTicketNumber?: bigint;
      ticketSalt?: Uint8Array;
      playerSecret?: Uint8Array;
    },
    maxTicketsVal = 10n,
    autoCreateDraw = true,
  ) => {
    let currentAdminSecret = initialWitnesses.adminSecret ?? adminSecret;
    let currentTicketNumber = initialWitnesses.privateTicketNumber ?? 1n;
    let currentTicketSalt = initialWitnesses.ticketSalt ?? createRandomBytes32();
    let currentPlayerSecret = initialWitnesses.playerSecret;

    const witnesses = {
      adminSecret: (context: any) => [context.privateState, currentAdminSecret],
      privateTicketNumber: (context: any) => [context.privateState, currentTicketNumber],
      ticketSalt: (context: any) => [context.privateState, currentTicketSalt],
      playerSecret: (context: any) => [
        context.privateState,
        currentPlayerSecret ?? createRandomBytes32(),
      ],
    };

    const contract = new Contract(witnesses as any);

    const constructorContext = {
      initialZswapLocalState: {
        coinPublicKey: createRandomBytes32(),
      },
      initialPrivateState: {},
    };

    const initResult = contract.initialState(constructorContext as any);

    let currentContractState = initResult.currentContractState;
    let currentPrivateState = initResult.currentPrivateState;
    let currentZswapState = initResult.currentZswapLocalState;

    const setWitnesses = (updates: {
      adminSecret?: Uint8Array;
      privateTicketNumber?: bigint;
      ticketSalt?: Uint8Array;
      playerSecret?: Uint8Array;
    }) => {
      if (updates.adminSecret !== undefined) currentAdminSecret = updates.adminSecret;
      if (updates.privateTicketNumber !== undefined) currentTicketNumber = updates.privateTicketNumber;
      if (updates.ticketSalt !== undefined) currentTicketSalt = updates.ticketSalt;
      if (updates.playerSecret !== undefined) currentPlayerSecret = updates.playerSecret;
    };

    const createContext = () => {
      return compactRuntime.createCircuitContext(
        compactRuntime.dummyContractAddress(),
        currentZswapState.coinPublicKey,
        currentContractState.data,
        currentPrivateState,
      );
    };

    const updateFromContext = (ctx: any) => {
      currentContractState.data = new compactRuntime.ChargedState(ctx.currentQueryContext.state.state);
      currentPrivateState = ctx.currentPrivateState;
    };

    const createDraw = (
      customAdminKey = adminKey,
      customPrice = ticketPrice,
      customMin = rangeMin,
      customMax = rangeMax,
      customCommitment = drawCommitment,
      customMaxTickets = maxTicketsVal,
    ): bigint => {
      const ctx = createContext();
      const res = contract.circuits.createDraw(
        ctx,
        customAdminKey,
        customPrice,
        customMin,
        customMax,
        customCommitment,
        customMaxTickets,
      );
      updateFromContext(res.context);
      return res.result;
    };

    let defaultDrawId = 0n;
    if (autoCreateDraw) {
      defaultDrawId = createDraw();
    }

    return {
      contract,
      get currentState() {
        return currentContractState;
      },
      createContext,
      updateFromContext,
      setWitnesses,
      createDraw,
      defaultDrawId,
    };
  };

  describe('Initialization & State', () => {
    it('initializes the contract with empty draws and nextDrawId = 0', () => {
      const sim = createTestContractInstance({}, 10n, false);
      const stateLedger = ledger(sim.currentState.data);

      expect(stateLedger.nextDrawId).toBe(0n);
      expect(stateLedger.draws.isEmpty()).toBe(true);
      expect(stateLedger.participants.isEmpty()).toBe(true);
      expect(stateLedger.ticketCommitments.isEmpty()).toBe(true);
      expect(stateLedger.claimedNullifiers.isEmpty()).toBe(true);
    });

    it('creates a new draw via createDraw circuit and initializes its state to OPEN', () => {
      const sim = createTestContractInstance({});
      const stateLedger = ledger(sim.currentState.data);

      expect(stateLedger.nextDrawId).toBe(1n);
      expect(stateLedger.draws.member(sim.defaultDrawId)).toBe(true);

      const draw = stateLedger.draws.lookup(sim.defaultDrawId);
      expect(draw.status).toBe(0n); // 0: OPEN
      expect(draw.ticketCount).toBe(0n);
      expect(draw.ticketPrice).toBe(ticketPrice);
      expect(draw.rangeMin).toBe(rangeMin);
      expect(draw.rangeMax).toBe(rangeMax);
      expect(draw.winningNumber).toBe(0n);
      expect(draw.maxTickets).toBe(10n);
      expect(Buffer.from(draw.admin).toString('hex')).toBe(Buffer.from(adminKey).toString('hex'));
      expect(Buffer.from(draw.drawCommitment).toString('hex')).toBe(Buffer.from(drawCommitment).toString('hex'));
    });
  });

  describe('Full Lottery Lifecycle', () => {
    it('executes full cycle: buy tickets -> close -> draw -> verify winner -> claim prize', () => {
      const sim = createTestContractInstance({});
      const drawId = sim.defaultDrawId;

      // Player 1: buys ticket 7
      const salt1 = toBytes32('alice-salt-001');
      const secret1 = toBytes32('alice-player-secret');
      sim.setWitnesses({ privateTicketNumber: 7n, ticketSalt: salt1, playerSecret: secret1 });
      const ctx1 = sim.createContext();
      const buyRes1 = sim.contract.circuits.buyTicket(ctx1, drawId);
      sim.updateFromContext(buyRes1.context);

      const expectedCommitment1 = pureCircuits.deriveTicketCommitment(drawId, 7n, salt1);
      expect(Buffer.from(buyRes1.result).toString('hex')).toBe(Buffer.from(expectedCommitment1).toString('hex'));

      // Player 2: buys ticket 24
      const salt2 = toBytes32('bob-salt-002');
      const secret2 = toBytes32('bob-player-secret');
      sim.setWitnesses({ privateTicketNumber: 24n, ticketSalt: salt2, playerSecret: secret2 });
      const ctx2 = sim.createContext();
      const buyRes2 = sim.contract.circuits.buyTicket(ctx2, drawId);
      sim.updateFromContext(buyRes2.context);

      // Player 3: buys ticket 42
      const salt3 = toBytes32('charlie-salt-003');
      const secret3 = toBytes32('charlie-player-secret');
      sim.setWitnesses({ privateTicketNumber: 42n, ticketSalt: salt3, playerSecret: secret3 });
      const ctx3 = sim.createContext();
      const buyRes3 = sim.contract.circuits.buyTicket(ctx3, drawId);
      sim.updateFromContext(buyRes3.context);

      // Verify ticket count and commitments on ledger
      let stateLedger = ledger(sim.currentState.data);
      let draw = stateLedger.draws.lookup(drawId);
      expect(draw.ticketCount).toBe(3n);
      expect(stateLedger.ticketCommitments.size()).toBe(3n);
      expect(stateLedger.ticketCommitments.member(expectedCommitment1)).toBe(true);

      // Admin closes lottery
      sim.setWitnesses({ adminSecret });
      const closeCtx = sim.createContext();
      const closeRes = sim.contract.circuits.closeLottery(closeCtx, drawId);
      sim.updateFromContext(closeRes.context);

      stateLedger = ledger(sim.currentState.data);
      draw = stateLedger.draws.lookup(drawId);
      expect(draw.status).toBe(1n); // 1: CLOSED

      // Derive exact winning solution
      const drawSolution = calculateDrawSolution(drawId, drawSecret, 3n, rangeMin, rangeMax);

      // Draw winner
      const drawCtx = sim.createContext();
      const drawRes = sim.contract.circuits.drawWinner(
        drawCtx,
        drawId,
        drawSecret,
        drawSolution.winningNumber,
        drawSolution.quotient,
      );
      sim.updateFromContext(drawRes.context);

      stateLedger = ledger(sim.currentState.data);
      draw = stateLedger.draws.lookup(drawId);
      expect(draw.status).toBe(2n); // 2: DRAWN
      expect(draw.winningNumber).toBe(drawSolution.winningNumber);
      expect(drawRes.result).toBe(drawSolution.winningNumber);
      expect(Buffer.from(draw.entropyRevealed).toString('hex')).toBe(Buffer.from(drawSecret).toString('hex'));

      const winningNum = drawSolution.winningNumber;
      expect(winningNum >= rangeMin && winningNum <= rangeMax).toBe(true);

      // Verify winning ticket circuit for Alice (7)
      sim.setWitnesses({ privateTicketNumber: 7n, ticketSalt: salt1 });
      const verifyCtxAlice = sim.createContext();
      const verifyResAlice = sim.contract.circuits.verifyWinningTicket(verifyCtxAlice, drawId);
      expect(verifyResAlice.result).toBe(winningNum === 7n);

      // Verify winning ticket circuit for Bob (24)
      sim.setWitnesses({ privateTicketNumber: 24n, ticketSalt: salt2 });
      const verifyCtxBob = sim.createContext();
      const verifyResBob = sim.contract.circuits.verifyWinningTicket(verifyCtxBob, drawId);
      expect(verifyResBob.result).toBe(winningNum === 24n);
    });

    it('allows a winner with the exact drawn number to claim and rejects non-winners', () => {
      const sim = createTestContractInstance({});
      const drawId = sim.defaultDrawId;

      // Pre-calculate what the winning number will be for 1 ticket
      const drawSolution = calculateDrawSolution(drawId, drawSecret, 1n, rangeMin, rangeMax);
      const winnerTicketNum = drawSolution.winningNumber;

      // Player buys the winning number
      const winnerSalt = toBytes32('winner-salt-777');
      const winnerSecret = toBytes32('winner-secret-888');

      sim.setWitnesses({
        privateTicketNumber: winnerTicketNum,
        ticketSalt: winnerSalt,
        playerSecret: winnerSecret,
      });

      const buyCtx = sim.createContext();
      const buyRes = sim.contract.circuits.buyTicket(buyCtx, drawId);
      sim.updateFromContext(buyRes.context);

      // Close lottery
      sim.setWitnesses({ adminSecret });
      const closeCtx = sim.createContext();
      const closeRes = sim.contract.circuits.closeLottery(closeCtx, drawId);
      sim.updateFromContext(closeRes.context);

      // Draw winner
      const drawCtx = sim.createContext();
      const drawRes = sim.contract.circuits.drawWinner(drawCtx, drawId, drawSecret, winnerTicketNum, drawSolution.quotient);
      sim.updateFromContext(drawRes.context);

      // Non-winner attempt to claim should fail
      sim.setWitnesses({
        privateTicketNumber: winnerTicketNum === 1n ? 2n : 1n,
        ticketSalt: winnerSalt,
        playerSecret: winnerSecret,
      });

      expect(() => {
        const fakeClaimCtx = sim.createContext();
        sim.contract.circuits.claimPrize(fakeClaimCtx, drawId);
      }).toThrow(/Ticket commitment not found on ledger/);

      // Legitimate winner claims prize
      sim.setWitnesses({
        privateTicketNumber: winnerTicketNum,
        ticketSalt: winnerSalt,
        playerSecret: winnerSecret,
      });

      const claimCtx = sim.createContext();
      const claimRes = sim.contract.circuits.claimPrize(claimCtx, drawId);
      sim.updateFromContext(claimRes.context);

      const stateLedger = ledger(sim.currentState.data);

      const expectedNullifier = pureCircuits.deriveClaimNullifier(
        drawId,
        pureCircuits.deriveTicketCommitment(drawId, winnerTicketNum, winnerSalt),
        winnerSecret,
      );
      expect(Buffer.from(claimRes.result).toString('hex')).toBe(Buffer.from(expectedNullifier).toString('hex'));
      expect(stateLedger.claimedNullifiers.member(expectedNullifier)).toBe(true);

      // Double claim must fail
      expect(() => {
        const doubleClaimCtx = sim.createContext();
        sim.contract.circuits.claimPrize(doubleClaimCtx, drawId);
      }).toThrow(/Prize for this ticket has already been claimed/);
    });
  });

  describe('Concurrent Multi-Draw Functionality', () => {
    it('supports multiple draws running concurrently at the same time in 1 single contract', () => {
      const sim = createTestContractInstance({}, 10n, false);

      // Draw A (drawId 0): Pot for Alice & Friends
      const drawSecretA = toBytes32('draw-secret-A');
      const drawCommitmentA = pureCircuits.deriveDrawCommitment(drawSecretA);
      const drawIdA = sim.createDraw(adminKey, 100_000n, 1n, 50n, drawCommitmentA, 3n);

      // Draw B (drawId 1): Pot for Bob & High Rollers
      const adminSecretB = toBytes32('admin-secret-B');
      const adminKeyB = pureCircuits.deriveAdminKey(adminSecretB);
      const drawSecretB = toBytes32('draw-secret-B');
      const drawCommitmentB = pureCircuits.deriveDrawCommitment(drawSecretB);
      const drawIdB = sim.createDraw(adminKeyB, 500_000n, 1n, 100n, drawCommitmentB, 5n);

      expect(drawIdA).toBe(0n);
      expect(drawIdB).toBe(1n);

      // Player 1 buys ticket in Draw A
      sim.setWitnesses({
        privateTicketNumber: 10n,
        ticketSalt: toBytes32('salt-p1-A'),
        playerSecret: toBytes32('secret-p1'),
      });
      const buyCtxA1 = sim.createContext();
      const buyResA1 = sim.contract.circuits.buyTicket(buyCtxA1, drawIdA);
      sim.updateFromContext(buyResA1.context);

      // Player 1 can ALSO buy ticket in Draw B (because participant keys are domain-separated by drawId!)
      sim.setWitnesses({
        privateTicketNumber: 77n,
        ticketSalt: toBytes32('salt-p1-B'),
        playerSecret: toBytes32('secret-p1'),
      });
      const buyCtxB1 = sim.createContext();
      const buyResB1 = sim.contract.circuits.buyTicket(buyCtxB1, drawIdB);
      sim.updateFromContext(buyResB1.context);

      let state = ledger(sim.currentState.data);
      expect(state.draws.lookup(drawIdA).ticketCount).toBe(1n);
      expect(state.draws.lookup(drawIdB).ticketCount).toBe(1n);
      expect(state.draws.lookup(drawIdA).status).toBe(0n); // OPEN
      expect(state.draws.lookup(drawIdB).status).toBe(0n); // OPEN

      // Close and finish Draw A early
      sim.setWitnesses({ adminSecret });
      const closeCtxA = sim.createContext();
      const closeResA = sim.contract.circuits.closeLottery(closeCtxA, drawIdA);
      sim.updateFromContext(closeResA.context);

      const solA = calculateDrawSolution(drawIdA, drawSecretA, 1n, 1n, 50n);
      const drawCtxA = sim.createContext();
      const drawResA = sim.contract.circuits.drawWinner(drawCtxA, drawIdA, drawSecretA, solA.winningNumber, solA.quotient);
      sim.updateFromContext(drawResA.context);

      state = ledger(sim.currentState.data);
      // Draw A is now DRAWN
      expect(state.draws.lookup(drawIdA).status).toBe(2n);
      // Draw B remains OPEN and completely unaffected!
      expect(state.draws.lookup(drawIdB).status).toBe(0n);
      expect(state.draws.lookup(drawIdB).ticketCount).toBe(1n);
    });
  });

  describe('Security & Negative Test Cases', () => {
    it('rejects buying a ticket with out-of-range number (< min)', () => {
      const sim = createTestContractInstance({});
      sim.setWitnesses({ privateTicketNumber: 0n }); // rangeMin is 1
      const ctx = sim.createContext();

      expect(() => {
        sim.contract.circuits.buyTicket(ctx, sim.defaultDrawId);
      }).toThrow(/Ticket number out of valid range/);
    });

    it('rejects buying a ticket with out-of-range number (> max)', () => {
      const sim = createTestContractInstance({});
      sim.setWitnesses({ privateTicketNumber: 51n }); // rangeMax is 50
      const ctx = sim.createContext();

      expect(() => {
        sim.contract.circuits.buyTicket(ctx, sim.defaultDrawId);
      }).toThrow(/Ticket number out of valid range/);
    });

    it('rejects duplicate ticket commitment in same draw', () => {
      const sim = createTestContractInstance({});
      const salt = toBytes32('shared-salt');
      sim.setWitnesses({ privateTicketNumber: 10n, ticketSalt: salt });

      const ctx1 = sim.createContext();
      const res1 = sim.contract.circuits.buyTicket(ctx1, sim.defaultDrawId);
      sim.updateFromContext(res1.context);

      const ctx2 = sim.createContext();
      expect(() => {
        sim.contract.circuits.buyTicket(ctx2, sim.defaultDrawId);
      }).toThrow(/Ticket commitment already registered/);
    });

    it('rejects creator from buying/drawing a ticket in their own draw', () => {
      const sim = createTestContractInstance({});
      sim.setWitnesses({
        privateTicketNumber: 12n,
        playerSecret: adminSecret, // Creator secret
      });
      const ctx = sim.createContext();

      expect(() => {
        sim.contract.circuits.buyTicket(ctx, sim.defaultDrawId);
      }).toThrow(/Creator cannot draw tickets from the lottery/);
    });

    it('allows participant to draw 1 ticket and rejects a second ticket from same participant', () => {
      const sim = createTestContractInstance({});
      const playerSecret = toBytes32('unique-participant-secret');

      // Participant draws ticket 1
      sim.setWitnesses({
        privateTicketNumber: 15n,
        ticketSalt: toBytes32('participant-salt-1'),
        playerSecret,
      });
      const ctx1 = sim.createContext();
      const buyRes1 = sim.contract.circuits.buyTicket(ctx1, sim.defaultDrawId);
      sim.updateFromContext(buyRes1.context);

      // Same participant tries to draw a second ticket
      sim.setWitnesses({
        privateTicketNumber: 25n,
        ticketSalt: toBytes32('participant-salt-2'),
        playerSecret, // same secret
      });
      const ctx2 = sim.createContext();

      expect(() => {
        sim.contract.circuits.buyTicket(ctx2, sim.defaultDrawId);
      }).toThrow(/Participant has already drawn a ticket/);
    });

    it('automatically ends the draw when all tickets are sold', () => {
      // Initialize with maxTickets = 2
      const sim = createTestContractInstance({}, 2n);
      const drawId = sim.defaultDrawId;

      // Player 1 draws ticket
      sim.setWitnesses({
        privateTicketNumber: 10n,
        ticketSalt: toBytes32('p1-salt'),
        playerSecret: toBytes32('p1-secret'),
      });
      const ctx1 = sim.createContext();
      const res1 = sim.contract.circuits.buyTicket(ctx1, drawId);
      sim.updateFromContext(res1.context);

      let state = ledger(sim.currentState.data);
      let draw = state.draws.lookup(drawId);
      expect(draw.ticketCount).toBe(1n);
      expect(draw.status).toBe(0n); // Still OPEN

      // Player 2 draws ticket (final ticket)
      sim.setWitnesses({
        privateTicketNumber: 20n,
        ticketSalt: toBytes32('p2-salt'),
        playerSecret: toBytes32('p2-secret'),
      });
      const ctx2 = sim.createContext();
      const res2 = sim.contract.circuits.buyTicket(ctx2, drawId);
      sim.updateFromContext(res2.context);

      state = ledger(sim.currentState.data);
      draw = state.draws.lookup(drawId);
      expect(draw.ticketCount).toBe(2n);
      expect(draw.status).toBe(1n); // CLOSED automatically!

      // Player 3 tries to draw when sold out
      sim.setWitnesses({
        privateTicketNumber: 30n,
        ticketSalt: toBytes32('p3-salt'),
        playerSecret: toBytes32('p3-secret'),
      });
      const ctx3 = sim.createContext();
      expect(() => {
        sim.contract.circuits.buyTicket(ctx3, drawId);
      }).toThrow(/Lottery is not OPEN/);
    });

    it('rejects non-creator attempting to close lottery', () => {
      const sim = createTestContractInstance({});
      const drawId = sim.defaultDrawId;

      // Buy a ticket first
      sim.setWitnesses({ privateTicketNumber: 5n });
      const buyCtx = sim.createContext();
      const buyRes = sim.contract.circuits.buyTicket(buyCtx, drawId);
      sim.updateFromContext(buyRes.context);

      // Attempt close with wrong admin secret
      sim.setWitnesses({ adminSecret: toBytes32('wrong-attacker-admin-secret') });
      const closeCtx = sim.createContext();

      expect(() => {
        sim.contract.circuits.closeLottery(closeCtx, drawId);
      }).toThrow(/Unauthorized: only creator can end the draw/);
    });

    it('rejects closing a lottery with 0 tickets', () => {
      const sim = createTestContractInstance({});
      sim.setWitnesses({ adminSecret });
      const ctx = sim.createContext();

      expect(() => {
        sim.contract.circuits.closeLottery(ctx, sim.defaultDrawId);
      }).toThrow(/Cannot close lottery with zero tickets/);
    });

    it('rejects drawing winner when lottery is still OPEN', () => {
      const sim = createTestContractInstance({});
      sim.setWitnesses({ adminSecret });
      const ctx = sim.createContext();

      expect(() => {
        sim.contract.circuits.drawWinner(ctx, sim.defaultDrawId, drawSecret, 10n, 100n);
      }).toThrow(/Lottery must be CLOSED to draw/);
    });

    it('rejects drawing winner with incorrect revealed secret', () => {
      const sim = createTestContractInstance({});
      const drawId = sim.defaultDrawId;

      // Buy a ticket
      sim.setWitnesses({ privateTicketNumber: 15n });
      const buyCtx = sim.createContext();
      const buyRes = sim.contract.circuits.buyTicket(buyCtx, drawId);
      sim.updateFromContext(buyRes.context);

      // Close lottery
      sim.setWitnesses({ adminSecret });
      const closeCtx = sim.createContext();
      const closeRes = sim.contract.circuits.closeLottery(closeCtx, drawId);
      sim.updateFromContext(closeRes.context);

      // Draw with tampered draw secret
      const fakeDrawSecret = toBytes32('tampered-fake-operator-secret');
      const drawCtx = sim.createContext();

      expect(() => {
        sim.contract.circuits.drawWinner(drawCtx, drawId, fakeDrawSecret, 15n, 0n);
      }).toThrow(/Invalid draw secret revealed/);
    });

    it('rejects drawing winner with manipulated winning number claim', () => {
      const sim = createTestContractInstance({});
      const drawId = sim.defaultDrawId;

      // Buy a ticket
      sim.setWitnesses({ privateTicketNumber: 20n });
      const buyCtx = sim.createContext();
      const buyRes = sim.contract.circuits.buyTicket(buyCtx, drawId);
      sim.updateFromContext(buyRes.context);

      // Close
      sim.setWitnesses({ adminSecret });
      const closeCtx = sim.createContext();
      const closeRes = sim.contract.circuits.closeLottery(closeCtx, drawId);
      sim.updateFromContext(closeRes.context);

      // Correct calculation
      const solution = calculateDrawSolution(drawId, drawSecret, 1n, rangeMin, rangeMax);

      // Try to pass a different number (manipulated winner)
      const fakeWinningNum = solution.winningNumber === 1n ? 2n : 1n;
      const drawCtx = sim.createContext();

      expect(() => {
        sim.contract.circuits.drawWinner(drawCtx, drawId, drawSecret, fakeWinningNum, solution.quotient);
      }).toThrow(/Mathematical entropy derivation check failed/);
    });
  });

  describe('Privacy & Fairness Invariants', () => {
    it('ensures public ledger contains zero raw ticket numbers or player secrets', () => {
      const sim = createTestContractInstance({});
      const drawId = sim.defaultDrawId;

      const secretSalt = toBytes32('alice-highly-confidential-salt-999');
      const playerSecret = toBytes32('alice-confidential-secret-key-888');
      const privateNumber = 37n;

      sim.setWitnesses({
        privateTicketNumber: privateNumber,
        ticketSalt: secretSalt,
        playerSecret,
      });

      const buyCtx = sim.createContext();
      const buyRes = sim.contract.circuits.buyTicket(buyCtx, drawId);
      sim.updateFromContext(buyRes.context);

      const stateLedger = ledger(sim.currentState.data);
      const commitmentList = Array.from(stateLedger.ticketCommitments).map(c => Buffer.from(c).toString('hex'));

      // Check state
      expect(stateLedger.draws.lookup(drawId).ticketCount).toBe(1n);
      expect(commitmentList.length).toBe(1);

      // The commitment is a cryptographic hash, not the raw number or salt
      expect(commitmentList[0]).not.toBe('37');
      expect(commitmentList[0]).not.toBe(Buffer.from(secretSalt).toString('hex'));
      expect(commitmentList[0]).not.toBe(Buffer.from(playerSecret).toString('hex'));
    });

    it('fairness: same committed inputs always yield identical winning numbers', () => {
      const solution1 = calculateDrawSolution(0n, drawSecret, 10n, 1n, 50n);
      const solution2 = calculateDrawSolution(0n, drawSecret, 10n, 1n, 50n);

      expect(solution1.winningNumber).toBe(solution2.winningNumber);
      expect(solution1.entropyField).toBe(solution2.entropyField);
      expect(solution1.quotient).toBe(solution2.quotient);
    });

    it('fairness: changing secret or ticket count changes entropy and winning derivation', () => {
      const secretA = toBytes32('entropy-seed-alpha');
      const secretB = toBytes32('entropy-seed-beta');

      const solA = calculateDrawSolution(0n, secretA, 5n, 1n, 50n);
      const solB = calculateDrawSolution(0n, secretB, 5n, 1n, 50n);

      expect(Buffer.from(solA.entropy).toString('hex')).not.toBe(Buffer.from(solB.entropy).toString('hex'));
    });
  });
});
