import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { DrawVerifier } from '../src/verification/draw-verifier.js';
import {
  getPureCircuits,
  bytesToHex,
  convert31BytesToField,
} from '../src/midnight/contract-client.js';
import type { Lottery } from '../src/types/index.js';

describe('DrawVerifier Cryptographic Verification Engine', () => {
  const circuits = getPureCircuits();

  const secret = new Uint8Array(
    createHash('sha256').update('test-operator-secret-999', 'utf8').digest(),
  );
  const secretHex = bytesToHex(secret);
  const drawCommitmentHex = bytesToHex(circuits.deriveDrawCommitment(secret));

  // Compute winning solution for 5 tickets in range 1-50
  const ticketCount = 5;
  const rangeMin = 1;
  const rangeMax = 50;
  const entropy = circuits.deriveWinningEntropy(secret, BigInt(ticketCount));
  const entropyField = convert31BytesToField(entropy);
  const span = BigInt(rangeMax - rangeMin + 1);
  const offset = entropyField % span;
  const correctWinningNumber = rangeMin + Number(offset);

  const sampleLottery: Lottery = {
    id: 'test-lottery-verification',
    name: 'Verification Test Lottery',
    contractAddress: '9d805bd89a06638928a7b1301bc4d731d747d4252ad7bd4cbf03b011b97d43f2',
    network: 'preview',
    status: 'DRAWN',
    ticketPrice: '1000000',
    prizePool: '5000000',
    rangeMin,
    rangeMax,
    ticketCount,
    ticketCommitments: [],
    drawCommitment: drawCommitmentHex,
    drawSecretHex: secretHex,
    winningNumber: correctWinningNumber,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
  };

  it('successfully verifies a faithfully drawn lottery', () => {
    const result = DrawVerifier.verifyDraw(sampleLottery);

    expect(result.valid).toBe(true);
    expect(result.checks.commitmentMatch).toBe(true);
    expect(result.checks.entropyDerivationValid).toBe(true);
    expect(result.checks.winningNumberInRange).toBe(true);
    expect(result.checks.euclideanDivisionValid).toBe(true);
    expect(result.winningNumber).toBe(correctWinningNumber);
  });

  it('fails verification if operator revealed secret does not match commitment', () => {
    const tamperedLottery: Lottery = {
      ...sampleLottery,
      drawCommitment: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
    };

    const result = DrawVerifier.verifyDraw(tamperedLottery);
    expect(result.valid).toBe(false);
    expect(result.checks.commitmentMatch).toBe(false);
  });

  it('fails verification if winning number was manipulated by operator', () => {
    const manipulatedLottery: Lottery = {
      ...sampleLottery,
      winningNumber: correctWinningNumber === 1 ? 2 : 1, // Changed number!
    };

    const result = DrawVerifier.verifyDraw(manipulatedLottery);
    expect(result.valid).toBe(false);
    expect(result.checks.entropyDerivationValid).toBe(false);
  });

  it('fails verification if winning number is out of range', () => {
    const outOfRangeLottery: Lottery = {
      ...sampleLottery,
      winningNumber: 999,
    };

    const result = DrawVerifier.verifyDraw(outOfRangeLottery);
    expect(result.valid).toBe(false);
    expect(result.checks.winningNumberInRange).toBe(false);
  });

  it('correctly verifies a winning ticket and derives claim nullifier', () => {
    const winningSalt = new Uint8Array(
      createHash('sha256').update('winning-ticket-salt', 'utf8').digest(),
    );
    const winningSaltHex = bytesToHex(winningSalt);
    const winningCommitment = bytesToHex(
      circuits.deriveTicketCommitment(BigInt(correctWinningNumber), winningSalt),
    );

    const lotteryWithTicket: Lottery = {
      ...sampleLottery,
      ticketCommitments: [winningCommitment],
    };

    const playerSecretHex = bytesToHex(
      new Uint8Array(createHash('sha256').update('player-sec-1', 'utf8').digest()),
    );

    const ticketResult = DrawVerifier.verifyTicket(
      lotteryWithTicket,
      correctWinningNumber,
      winningSaltHex,
      playerSecretHex,
    );

    expect(ticketResult.valid).toBe(true);
    expect(ticketResult.isWinner).toBe(true);
    expect(ticketResult.commitmentFound).toBe(true);
    expect(ticketResult.claimNullifier).toBeDefined();
  });

  it('correctly identifies non-winning tickets', () => {
    const nonWinningNumber = correctWinningNumber === 1 ? 2 : 1;
    const nonWinningSalt = new Uint8Array(
      createHash('sha256').update('non-winning-salt', 'utf8').digest(),
    );
    const nonWinningSaltHex = bytesToHex(nonWinningSalt);
    const nonWinningCommitment = bytesToHex(
      circuits.deriveTicketCommitment(BigInt(nonWinningNumber), nonWinningSalt),
    );

    const lotteryWithTicket: Lottery = {
      ...sampleLottery,
      ticketCommitments: [nonWinningCommitment],
    };

    const ticketResult = DrawVerifier.verifyTicket(
      lotteryWithTicket,
      nonWinningNumber,
      nonWinningSaltHex,
    );

    expect(ticketResult.valid).toBe(true);
    expect(ticketResult.isWinner).toBe(false);
    expect(ticketResult.commitmentFound).toBe(true);
    expect(ticketResult.claimNullifier).toBeUndefined();
  });
});
