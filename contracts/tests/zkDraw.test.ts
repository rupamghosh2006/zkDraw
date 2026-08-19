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
  revealedSecret: Uint8Array,
  ticketCount: bigint,
  rangeMin: bigint,
  rangeMax: bigint,
) => {
  const entropy = pureCircuits.deriveWinningEntropy(revealedSecret, ticketCount);
  const entropyField = convert31BytesToField(entropy);

  const span = rangeMax - rangeMin + 1n;
  const quotient = entropyField / span;
  const offset = entropyField % span;
  const winningNumber = rangeMin + offset;

  return { entropy, entropyField, span, quotient, offset, winningNumber };
};

describe('zkDraw Compact Smart Contract', () => {
  // Test parameters
  const adminSecret = toBytes32('admin-master-secret-key-1');
  const adminKey = pureCircuits.deriveAdminKey(adminSecret);
  const ticketPrice = 100_000n;
  const rangeMin = 1n;
  const rangeMax = 50n;

  const drawSecret = toBytes32('operator-precommitted-entropy-1');
  const drawCommitment = pureCircuits.deriveDrawCommitment(drawSecret);

  // Helper to initialize a simulated contract
  const createTestContractInstance = (initialWitnesses: {
    adminSecret?: Uint8Array;
    privateTicketNumber?: bigint;
    ticketSalt?: Uint8Array;
    playerSecret?: Uint8Array;
  }) => {
    let currentAdminSecret = initialWitnesses.adminSecret ?? adminSecret;
    let currentTicketNumber = initialWitnesses.privateTicketNumber ?? 1n;
    let currentTicketSalt = initialWitnesses.ticketSalt ?? createRandomBytes32();
    let currentPlayerSecret = initialWitnesses.playerSecret ?? createRandomBytes32();

    const witnesses = {
      adminSecret: (context: any) => [context.privateState, currentAdminSecret],
      privateTicketNumber: (context: any) => [context.privateState, currentTicketNumber],
      ticketSalt: (context: any) => [context.privateState, currentTicketSalt],
      playerSecret: (context: any) => [context.privateState, currentPlayerSecret],
    };

    const contract = new Contract(witnesses as any);

    const constructorContext = {
      initialZswapLocalState: {
        coinPublicKey: createRandomBytes32(),
      },
      initialPrivateState: {},
    };

    const initResult = contract.initialState(
      constructorContext as any,
      adminKey,
      ticketPrice,
      rangeMin,
      rangeMax,
      drawCommitment,
    );

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

    return {
      contract,
      get currentState() {
        return currentContractState;
      },
      createContext,
      updateFromContext,
      setWitnesses,
    };
  };

  describe('Initialization & State', () => {
    it('initializes the lottery correctly in OPEN state', () => {
      const sim = createTestContractInstance({});
      const stateLedger = ledger(sim.currentState.data);

      expect(stateLedger.status).toBe(0n); // 0: OPEN
      expect(stateLedger.ticketCount).toBe(0n);
      expect(stateLedger.ticketPrice).toBe(ticketPrice);
      expect(stateLedger.rangeMin).toBe(rangeMin);
      expect(stateLedger.rangeMax).toBe(rangeMax);
      expect(stateLedger.winningNumber).toBe(0n);
      expect(stateLedger.winnerCount).toBe(0n);
      expect(stateLedger.ticketCommitments.isEmpty()).toBe(true);
      expect(Buffer.from(stateLedger.admin).toString('hex')).toBe(Buffer.from(adminKey).toString('hex'));
      expect(Buffer.from(stateLedger.drawCommitment).toString('hex')).toBe(Buffer.from(drawCommitment).toString('hex'));
    });
  });

  describe('Full Lottery Lifecycle', () => {
    it('executes full cycle: buy tickets -> close -> draw -> verify winner -> claim prize', () => {
      const sim = createTestContractInstance({});

      // Player 1: buys ticket 7
      const salt1 = toBytes32('alice-salt-001');
      const secret1 = toBytes32('alice-player-secret');
      sim.setWitnesses({ privateTicketNumber: 7n, ticketSalt: salt1, playerSecret: secret1 });
      const ctx1 = sim.createContext();
      const buyRes1 = sim.contract.circuits.buyTicket(ctx1);
      sim.updateFromContext(buyRes1.context);

      const expectedCommitment1 = pureCircuits.deriveTicketCommitment(7n, salt1);
      expect(Buffer.from(buyRes1.result).toString('hex')).toBe(Buffer.from(expectedCommitment1).toString('hex'));

      // Player 2: buys ticket 24
      const salt2 = toBytes32('bob-salt-002');
      const secret2 = toBytes32('bob-player-secret');
      sim.setWitnesses({ privateTicketNumber: 24n, ticketSalt: salt2, playerSecret: secret2 });
      const ctx2 = sim.createContext();
      const buyRes2 = sim.contract.circuits.buyTicket(ctx2);
      sim.updateFromContext(buyRes2.context);

      // Player 3: buys ticket 42
      const salt3 = toBytes32('charlie-salt-003');
      const secret3 = toBytes32('charlie-player-secret');
      sim.setWitnesses({ privateTicketNumber: 42n, ticketSalt: salt3, playerSecret: secret3 });
      const ctx3 = sim.createContext();
      const buyRes3 = sim.contract.circuits.buyTicket(ctx3);
      sim.updateFromContext(buyRes3.context);

      // Verify ticket count and commitments on ledger
      let stateLedger = ledger(sim.currentState.data);
      expect(stateLedger.ticketCount).toBe(3n);
      expect(stateLedger.ticketCommitments.size()).toBe(3n);
      expect(stateLedger.ticketCommitments.member(expectedCommitment1)).toBe(true);

      // Admin closes lottery
      sim.setWitnesses({ adminSecret });
      const closeCtx = sim.createContext();
      const closeRes = sim.contract.circuits.closeLottery(closeCtx);
      sim.updateFromContext(closeRes.context);

      stateLedger = ledger(sim.currentState.data);
      expect(stateLedger.status).toBe(1n); // 1: CLOSED

      // Derive exact winning solution
      const drawSolution = calculateDrawSolution(drawSecret, 3n, rangeMin, rangeMax);

      // Draw winner
      const drawCtx = sim.createContext();
      const drawRes = sim.contract.circuits.drawWinner(
        drawCtx,
        drawSecret,
        drawSolution.winningNumber,
        drawSolution.quotient,
      );
      sim.updateFromContext(drawRes.context);

      stateLedger = ledger(sim.currentState.data);
      expect(stateLedger.status).toBe(2n); // 2: DRAWN
      expect(stateLedger.winningNumber).toBe(drawSolution.winningNumber);
      expect(drawRes.result).toBe(drawSolution.winningNumber);
      expect(Buffer.from(stateLedger.entropyRevealed).toString('hex')).toBe(Buffer.from(drawSecret).toString('hex'));

      // Let's check who won
      const winningNum = drawSolution.winningNumber;
      expect(winningNum >= rangeMin && winningNum <= rangeMax).toBe(true);

      // Verify winning ticket circuit for Alice (7)
      sim.setWitnesses({ privateTicketNumber: 7n, ticketSalt: salt1 });
      const verifyCtxAlice = sim.createContext();
      const verifyResAlice = sim.contract.circuits.verifyWinningTicket(verifyCtxAlice);
      expect(verifyResAlice.result).toBe(winningNum === 7n);

      // Verify winning ticket circuit for Bob (24)
      sim.setWitnesses({ privateTicketNumber: 24n, ticketSalt: salt2 });
      const verifyCtxBob = sim.createContext();
      const verifyResBob = sim.contract.circuits.verifyWinningTicket(verifyCtxBob);
      expect(verifyResBob.result).toBe(winningNum === 24n);
    });

    it('allows a winner with the exact drawn number to claim and rejects non-winners', () => {
      const sim = createTestContractInstance({});

      // Pre-calculate what the winning number will be for 1 ticket
      const drawSolution = calculateDrawSolution(drawSecret, 1n, rangeMin, rangeMax);
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
      const buyRes = sim.contract.circuits.buyTicket(buyCtx);
      sim.updateFromContext(buyRes.context);

      // Close lottery
      sim.setWitnesses({ adminSecret });
      const closeCtx = sim.createContext();
      const closeRes = sim.contract.circuits.closeLottery(closeCtx);
      sim.updateFromContext(closeRes.context);

      // Draw winner
      const drawCtx = sim.createContext();
      const drawRes = sim.contract.circuits.drawWinner(drawCtx, drawSecret, winnerTicketNum, drawSolution.quotient);
      sim.updateFromContext(drawRes.context);

      // Non-winner attempt to claim should fail
      sim.setWitnesses({
        privateTicketNumber: winnerTicketNum === 1n ? 2n : 1n,
        ticketSalt: winnerSalt,
        playerSecret: winnerSecret,
      });

      expect(() => {
        const fakeClaimCtx = sim.createContext();
        sim.contract.circuits.claimPrize(fakeClaimCtx);
      }).toThrow(/Ticket commitment not found on ledger/);

      // Legitimate winner claims prize
      sim.setWitnesses({
        privateTicketNumber: winnerTicketNum,
        ticketSalt: winnerSalt,
        playerSecret: winnerSecret,
      });

      const claimCtx = sim.createContext();
      const claimRes = sim.contract.circuits.claimPrize(claimCtx);
      sim.updateFromContext(claimRes.context);

      const stateLedger = ledger(sim.currentState.data);
      expect(stateLedger.winnerCount).toBe(1n);

      const expectedNullifier = pureCircuits.deriveClaimNullifier(
        pureCircuits.deriveTicketCommitment(winnerTicketNum, winnerSalt),
        winnerSecret,
      );
      expect(Buffer.from(claimRes.result).toString('hex')).toBe(Buffer.from(expectedNullifier).toString('hex'));
      expect(stateLedger.claimedNullifiers.member(expectedNullifier)).toBe(true);

      // Double claim must fail
      expect(() => {
        const doubleClaimCtx = sim.createContext();
        sim.contract.circuits.claimPrize(doubleClaimCtx);
      }).toThrow(/Prize for this ticket has already been claimed/);
    });
  });

  describe('Security & Negative Test Cases', () => {
    it('rejects buying a ticket with out-of-range number (< min)', () => {
      const sim = createTestContractInstance({});
      sim.setWitnesses({ privateTicketNumber: 0n }); // rangeMin is 1
      const ctx = sim.createContext();

      expect(() => {
        sim.contract.circuits.buyTicket(ctx);
      }).toThrow(/Ticket number out of valid range/);
    });

    it('rejects buying a ticket with out-of-range number (> max)', () => {
      const sim = createTestContractInstance({});
      sim.setWitnesses({ privateTicketNumber: 51n }); // rangeMax is 50
      const ctx = sim.createContext();

      expect(() => {
        sim.contract.circuits.buyTicket(ctx);
      }).toThrow(/Ticket number out of valid range/);
    });

    it('rejects duplicate ticket commitment', () => {
      const sim = createTestContractInstance({});
      const salt = toBytes32('shared-salt');
      sim.setWitnesses({ privateTicketNumber: 10n, ticketSalt: salt });

      const ctx1 = sim.createContext();
      const res1 = sim.contract.circuits.buyTicket(ctx1);
      sim.updateFromContext(res1.context);

      const ctx2 = sim.createContext();
      expect(() => {
        sim.contract.circuits.buyTicket(ctx2);
      }).toThrow(/Ticket commitment already registered/);
    });

    it('rejects non-admin attempting to close lottery', () => {
      const sim = createTestContractInstance({});

      // Buy a ticket first
      sim.setWitnesses({ privateTicketNumber: 5n });
      const buyCtx = sim.createContext();
      const buyRes = sim.contract.circuits.buyTicket(buyCtx);
      sim.updateFromContext(buyRes.context);

      // Attempt close with wrong admin secret
      sim.setWitnesses({ adminSecret: toBytes32('wrong-attacker-admin-secret') });
      const closeCtx = sim.createContext();

      expect(() => {
        sim.contract.circuits.closeLottery(closeCtx);
      }).toThrow(/Unauthorized: only admin can close/);
    });

    it('rejects closing a lottery with 0 tickets', () => {
      const sim = createTestContractInstance({});
      sim.setWitnesses({ adminSecret });
      const ctx = sim.createContext();

      expect(() => {
        sim.contract.circuits.closeLottery(ctx);
      }).toThrow(/Cannot close lottery with zero tickets/);
    });

    it('rejects drawing winner when lottery is still OPEN', () => {
      const sim = createTestContractInstance({});
      sim.setWitnesses({ adminSecret });
      const ctx = sim.createContext();

      expect(() => {
        sim.contract.circuits.drawWinner(ctx, drawSecret, 10n, 100n);
      }).toThrow(/Lottery must be CLOSED to draw/);
    });

    it('rejects drawing winner with incorrect revealed secret', () => {
      const sim = createTestContractInstance({});

      // Buy a ticket
      sim.setWitnesses({ privateTicketNumber: 15n });
      const buyCtx = sim.createContext();
      const buyRes = sim.contract.circuits.buyTicket(buyCtx);
      sim.updateFromContext(buyRes.context);

      // Close lottery
      sim.setWitnesses({ adminSecret });
      const closeCtx = sim.createContext();
      const closeRes = sim.contract.circuits.closeLottery(closeCtx);
      sim.updateFromContext(closeRes.context);

      // Draw with tampered draw secret
      const fakeDrawSecret = toBytes32('tampered-fake-operator-secret');
      const drawCtx = sim.createContext();

      expect(() => {
        sim.contract.circuits.drawWinner(drawCtx, fakeDrawSecret, 15n, 0n);
      }).toThrow(/Invalid draw secret revealed/);
    });

    it('rejects drawing winner with manipulated winning number claim', () => {
      const sim = createTestContractInstance({});

      // Buy a ticket
      sim.setWitnesses({ privateTicketNumber: 20n });
      const buyCtx = sim.createContext();
      const buyRes = sim.contract.circuits.buyTicket(buyCtx);
      sim.updateFromContext(buyRes.context);

      // Close
      sim.setWitnesses({ adminSecret });
      const closeCtx = sim.createContext();
      const closeRes = sim.contract.circuits.closeLottery(closeCtx);
      sim.updateFromContext(closeRes.context);

      // Correct calculation
      const solution = calculateDrawSolution(drawSecret, 1n, rangeMin, rangeMax);

      // Try to pass a different number (manipulated winner)
      const fakeWinningNum = solution.winningNumber === 1n ? 2n : 1n;
      const drawCtx = sim.createContext();

      expect(() => {
        sim.contract.circuits.drawWinner(drawCtx, drawSecret, fakeWinningNum, solution.quotient);
      }).toThrow(/Mathematical entropy derivation check failed/);
    });
  });

  describe('Privacy & Fairness Invariants', () => {
    it('ensures public ledger contains zero raw ticket numbers or player secrets', () => {
      const sim = createTestContractInstance({});

      const secretSalt = toBytes32('alice-highly-confidential-salt-999');
      const playerSecret = toBytes32('alice-confidential-secret-key-888');
      const privateNumber = 37n;

      sim.setWitnesses({
        privateTicketNumber: privateNumber,
        ticketSalt: secretSalt,
        playerSecret,
      });

      const buyCtx = sim.createContext();
      const buyRes = sim.contract.circuits.buyTicket(buyCtx);
      sim.updateFromContext(buyRes.context);

      const stateLedger = ledger(sim.currentState.data);
      const commitmentList = Array.from(stateLedger.ticketCommitments).map(c => Buffer.from(c).toString('hex'));

      // Check state
      expect(stateLedger.ticketCount).toBe(1n);
      expect(commitmentList.length).toBe(1);

      // The commitment is a cryptographic hash, not the raw number or salt
      expect(commitmentList[0]).not.toBe('37');
      expect(commitmentList[0]).not.toBe(Buffer.from(secretSalt).toString('hex'));
      expect(commitmentList[0]).not.toBe(Buffer.from(playerSecret).toString('hex'));
    });

    it('fairness: same committed inputs always yield identical winning numbers', () => {
      const solution1 = calculateDrawSolution(drawSecret, 10n, 1n, 50n);
      const solution2 = calculateDrawSolution(drawSecret, 10n, 1n, 50n);

      expect(solution1.winningNumber).toBe(solution2.winningNumber);
      expect(solution1.entropyField).toBe(solution2.entropyField);
      expect(solution1.quotient).toBe(solution2.quotient);
    });

    it('fairness: changing secret or ticket count changes entropy and winning derivation', () => {
      const secretA = toBytes32('entropy-seed-alpha');
      const secretB = toBytes32('entropy-seed-beta');

      const solA = calculateDrawSolution(secretA, 5n, 1n, 50n);
      const solB = calculateDrawSolution(secretB, 5n, 1n, 50n);

      expect(Buffer.from(solA.entropy).toString('hex')).not.toBe(Buffer.from(solB.entropy).toString('hex'));
    });
  });
});
