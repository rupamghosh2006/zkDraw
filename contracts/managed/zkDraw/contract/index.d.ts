import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Draw = { admin: Uint8Array;
                     status: bigint;
                     ticketPrice: bigint;
                     rangeMin: bigint;
                     rangeMax: bigint;
                     maxTickets: bigint;
                     ticketCount: bigint;
                     drawCommitment: Uint8Array;
                     winningNumber: bigint;
                     entropyRevealed: Uint8Array
                   };

export type Witnesses<PS> = {
  adminSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  privateTicketNumber(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  ticketSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  playerSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  createDraw(context: __compactRuntime.CircuitContext<PS>,
             initialAdminKey_0: Uint8Array,
             price_0: bigint,
             minVal_0: bigint,
             maxVal_0: bigint,
             initialDrawCommitment_0: Uint8Array,
             totalTickets_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  buyTicket(context: __compactRuntime.CircuitContext<PS>, drawId_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  closeLottery(context: __compactRuntime.CircuitContext<PS>, drawId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  drawWinner(context: __compactRuntime.CircuitContext<PS>,
             drawId_0: bigint,
             revealedSecret_0: Uint8Array,
             claimedWinningNum_0: bigint,
             quotient_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  verifyWinningTicket(context: __compactRuntime.CircuitContext<PS>,
                      drawId_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  claimPrize(context: __compactRuntime.CircuitContext<PS>, drawId_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type ProvableCircuits<PS> = {
  createDraw(context: __compactRuntime.CircuitContext<PS>,
             initialAdminKey_0: Uint8Array,
             price_0: bigint,
             minVal_0: bigint,
             maxVal_0: bigint,
             initialDrawCommitment_0: Uint8Array,
             totalTickets_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  buyTicket(context: __compactRuntime.CircuitContext<PS>, drawId_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  closeLottery(context: __compactRuntime.CircuitContext<PS>, drawId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  drawWinner(context: __compactRuntime.CircuitContext<PS>,
             drawId_0: bigint,
             revealedSecret_0: Uint8Array,
             claimedWinningNum_0: bigint,
             quotient_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  verifyWinningTicket(context: __compactRuntime.CircuitContext<PS>,
                      drawId_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  claimPrize(context: __compactRuntime.CircuitContext<PS>, drawId_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type PureCircuits = {
  deriveAdminKey(secret_0: Uint8Array): Uint8Array;
  deriveParticipantKey(drawId_0: bigint, secret_0: Uint8Array): Uint8Array;
  deriveTicketCommitment(drawId_0: bigint, num_0: bigint, salt_0: Uint8Array): Uint8Array;
  deriveDrawCommitment(secret_0: Uint8Array): Uint8Array;
  deriveWinningEntropy(drawId_0: bigint,
                       revealedSecret_0: Uint8Array,
                       count_0: bigint): Uint8Array;
  deriveClaimNullifier(drawId_0: bigint,
                       commitment_0: Uint8Array,
                       secret_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  deriveAdminKey(context: __compactRuntime.CircuitContext<PS>,
                 secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveParticipantKey(context: __compactRuntime.CircuitContext<PS>,
                       drawId_0: bigint,
                       secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveTicketCommitment(context: __compactRuntime.CircuitContext<PS>,
                         drawId_0: bigint,
                         num_0: bigint,
                         salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveDrawCommitment(context: __compactRuntime.CircuitContext<PS>,
                       secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveWinningEntropy(context: __compactRuntime.CircuitContext<PS>,
                       drawId_0: bigint,
                       revealedSecret_0: Uint8Array,
                       count_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveClaimNullifier(context: __compactRuntime.CircuitContext<PS>,
                       drawId_0: bigint,
                       commitment_0: Uint8Array,
                       secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  createDraw(context: __compactRuntime.CircuitContext<PS>,
             initialAdminKey_0: Uint8Array,
             price_0: bigint,
             minVal_0: bigint,
             maxVal_0: bigint,
             initialDrawCommitment_0: Uint8Array,
             totalTickets_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  buyTicket(context: __compactRuntime.CircuitContext<PS>, drawId_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  closeLottery(context: __compactRuntime.CircuitContext<PS>, drawId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  drawWinner(context: __compactRuntime.CircuitContext<PS>,
             drawId_0: bigint,
             revealedSecret_0: Uint8Array,
             claimedWinningNum_0: bigint,
             quotient_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  verifyWinningTicket(context: __compactRuntime.CircuitContext<PS>,
                      drawId_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  claimPrize(context: __compactRuntime.CircuitContext<PS>, drawId_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type Ledger = {
  readonly nextDrawId: bigint;
  draws: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Draw;
    [Symbol.iterator](): Iterator<[bigint, Draw]>
  };
  ticketCommitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  participants: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  claimedNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
