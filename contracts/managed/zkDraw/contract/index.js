import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

const _descriptor_0 = new __compactRuntime.CompactTypeUnsignedInteger(4294967295n, 4);

const _descriptor_1 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_2 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

const _descriptor_3 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

class _Draw_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_2.alignment().concat(_descriptor_3.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_0.alignment().concat(_descriptor_1.alignment())))))))));
  }
  fromValue(value_0) {
    return {
      admin: _descriptor_1.fromValue(value_0),
      status: _descriptor_2.fromValue(value_0),
      ticketPrice: _descriptor_3.fromValue(value_0),
      rangeMin: _descriptor_0.fromValue(value_0),
      rangeMax: _descriptor_0.fromValue(value_0),
      maxTickets: _descriptor_0.fromValue(value_0),
      ticketCount: _descriptor_0.fromValue(value_0),
      drawCommitment: _descriptor_1.fromValue(value_0),
      winningNumber: _descriptor_0.fromValue(value_0),
      entropyRevealed: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.admin).concat(_descriptor_2.toValue(value_0.status).concat(_descriptor_3.toValue(value_0.ticketPrice).concat(_descriptor_0.toValue(value_0.rangeMin).concat(_descriptor_0.toValue(value_0.rangeMax).concat(_descriptor_0.toValue(value_0.maxTickets).concat(_descriptor_0.toValue(value_0.ticketCount).concat(_descriptor_1.toValue(value_0.drawCommitment).concat(_descriptor_0.toValue(value_0.winningNumber).concat(_descriptor_1.toValue(value_0.entropyRevealed))))))))));
  }
}

const _descriptor_4 = new _Draw_0();

const _descriptor_5 = __compactRuntime.CompactTypeBoolean;

const _descriptor_6 = __compactRuntime.CompactTypeField;

const _descriptor_7 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

const _descriptor_8 = new __compactRuntime.CompactTypeVector(2, _descriptor_1);

const _descriptor_9 = new __compactRuntime.CompactTypeVector(4, _descriptor_1);

const _descriptor_10 = new __compactRuntime.CompactTypeVector(3, _descriptor_1);

class _Either_0 {
  alignment() {
    return _descriptor_5.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_5.fromValue(value_0),
      left: _descriptor_1.fromValue(value_0),
      right: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_5.toValue(value_0.is_left).concat(_descriptor_1.toValue(value_0.left).concat(_descriptor_1.toValue(value_0.right)));
  }
}

const _descriptor_11 = new _Either_0();

const _descriptor_12 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_1.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.bytes);
  }
}

const _descriptor_13 = new _ContractAddress_0();

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.adminSecret) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named adminSecret');
    }
    if (typeof(witnesses_0.privateTicketNumber) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named privateTicketNumber');
    }
    if (typeof(witnesses_0.ticketSalt) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named ticketSalt');
    }
    if (typeof(witnesses_0.playerSecret) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named playerSecret');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      deriveAdminKey(context, ...args_1) {
        return { result: pureCircuits.deriveAdminKey(...args_1), context };
      },
      deriveParticipantKey(context, ...args_1) {
        return { result: pureCircuits.deriveParticipantKey(...args_1), context };
      },
      deriveTicketCommitment(context, ...args_1) {
        return { result: pureCircuits.deriveTicketCommitment(...args_1), context };
      },
      deriveDrawCommitment(context, ...args_1) {
        return { result: pureCircuits.deriveDrawCommitment(...args_1), context };
      },
      deriveWinningEntropy(context, ...args_1) {
        return { result: pureCircuits.deriveWinningEntropy(...args_1), context };
      },
      deriveClaimNullifier(context, ...args_1) {
        return { result: pureCircuits.deriveClaimNullifier(...args_1), context };
      },
      createDraw: (...args_1) => {
        if (args_1.length !== 7) {
          throw new __compactRuntime.CompactError(`createDraw: expected 7 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const initialAdminKey_0 = args_1[1];
        const price_0 = args_1[2];
        const minVal_0 = args_1[3];
        const maxVal_0 = args_1[4];
        const initialDrawCommitment_0 = args_1[5];
        const totalTickets_0 = args_1[6];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('createDraw',
                                     'argument 1 (as invoked from Typescript)',
                                     'zkDraw.compact line 114 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(initialAdminKey_0.buffer instanceof ArrayBuffer && initialAdminKey_0.BYTES_PER_ELEMENT === 1 && initialAdminKey_0.length === 32)) {
          __compactRuntime.typeError('createDraw',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'zkDraw.compact line 114 char 1',
                                     'Bytes<32>',
                                     initialAdminKey_0)
        }
        if (!(typeof(price_0) === 'bigint' && price_0 >= 0n && price_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('createDraw',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'zkDraw.compact line 114 char 1',
                                     'Uint<0..18446744073709551616>',
                                     price_0)
        }
        if (!(typeof(minVal_0) === 'bigint' && minVal_0 >= 0n && minVal_0 <= 4294967295n)) {
          __compactRuntime.typeError('createDraw',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'zkDraw.compact line 114 char 1',
                                     'Uint<0..4294967296>',
                                     minVal_0)
        }
        if (!(typeof(maxVal_0) === 'bigint' && maxVal_0 >= 0n && maxVal_0 <= 4294967295n)) {
          __compactRuntime.typeError('createDraw',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'zkDraw.compact line 114 char 1',
                                     'Uint<0..4294967296>',
                                     maxVal_0)
        }
        if (!(initialDrawCommitment_0.buffer instanceof ArrayBuffer && initialDrawCommitment_0.BYTES_PER_ELEMENT === 1 && initialDrawCommitment_0.length === 32)) {
          __compactRuntime.typeError('createDraw',
                                     'argument 5 (argument 6 as invoked from Typescript)',
                                     'zkDraw.compact line 114 char 1',
                                     'Bytes<32>',
                                     initialDrawCommitment_0)
        }
        if (!(typeof(totalTickets_0) === 'bigint' && totalTickets_0 >= 0n && totalTickets_0 <= 4294967295n)) {
          __compactRuntime.typeError('createDraw',
                                     'argument 6 (argument 7 as invoked from Typescript)',
                                     'zkDraw.compact line 114 char 1',
                                     'Uint<0..4294967296>',
                                     totalTickets_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(initialAdminKey_0).concat(_descriptor_3.toValue(price_0).concat(_descriptor_0.toValue(minVal_0).concat(_descriptor_0.toValue(maxVal_0).concat(_descriptor_1.toValue(initialDrawCommitment_0).concat(_descriptor_0.toValue(totalTickets_0)))))),
            alignment: _descriptor_1.alignment().concat(_descriptor_3.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_0.alignment())))))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._createDraw_0(context,
                                            partialProofData,
                                            initialAdminKey_0,
                                            price_0,
                                            minVal_0,
                                            maxVal_0,
                                            initialDrawCommitment_0,
                                            totalTickets_0);
        partialProofData.output = { value: _descriptor_0.toValue(result_0), alignment: _descriptor_0.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      buyTicket: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`buyTicket: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const drawId_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('buyTicket',
                                     'argument 1 (as invoked from Typescript)',
                                     'zkDraw.compact line 146 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(drawId_0) === 'bigint' && drawId_0 >= 0n && drawId_0 <= 4294967295n)) {
          __compactRuntime.typeError('buyTicket',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'zkDraw.compact line 146 char 1',
                                     'Uint<0..4294967296>',
                                     drawId_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(drawId_0),
            alignment: _descriptor_0.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._buyTicket_0(context, partialProofData, drawId_0);
        partialProofData.output = { value: _descriptor_1.toValue(result_0), alignment: _descriptor_1.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      closeLottery: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`closeLottery: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const drawId_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('closeLottery',
                                     'argument 1 (as invoked from Typescript)',
                                     'zkDraw.compact line 209 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(drawId_0) === 'bigint' && drawId_0 >= 0n && drawId_0 <= 4294967295n)) {
          __compactRuntime.typeError('closeLottery',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'zkDraw.compact line 209 char 1',
                                     'Uint<0..4294967296>',
                                     drawId_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(drawId_0),
            alignment: _descriptor_0.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._closeLottery_0(context,
                                              partialProofData,
                                              drawId_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      drawWinner: (...args_1) => {
        if (args_1.length !== 5) {
          throw new __compactRuntime.CompactError(`drawWinner: expected 5 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const drawId_0 = args_1[1];
        const revealedSecret_0 = args_1[2];
        const claimedWinningNum_0 = args_1[3];
        const quotient_0 = args_1[4];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('drawWinner',
                                     'argument 1 (as invoked from Typescript)',
                                     'zkDraw.compact line 235 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(drawId_0) === 'bigint' && drawId_0 >= 0n && drawId_0 <= 4294967295n)) {
          __compactRuntime.typeError('drawWinner',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'zkDraw.compact line 235 char 1',
                                     'Uint<0..4294967296>',
                                     drawId_0)
        }
        if (!(revealedSecret_0.buffer instanceof ArrayBuffer && revealedSecret_0.BYTES_PER_ELEMENT === 1 && revealedSecret_0.length === 32)) {
          __compactRuntime.typeError('drawWinner',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'zkDraw.compact line 235 char 1',
                                     'Bytes<32>',
                                     revealedSecret_0)
        }
        if (!(typeof(claimedWinningNum_0) === 'bigint' && claimedWinningNum_0 >= 0n && claimedWinningNum_0 <= 4294967295n)) {
          __compactRuntime.typeError('drawWinner',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'zkDraw.compact line 235 char 1',
                                     'Uint<0..4294967296>',
                                     claimedWinningNum_0)
        }
        if (!(typeof(quotient_0) === 'bigint' && quotient_0 >= 0 && quotient_0 <= __compactRuntime.MAX_FIELD)) {
          __compactRuntime.typeError('drawWinner',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'zkDraw.compact line 235 char 1',
                                     'Field',
                                     quotient_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(drawId_0).concat(_descriptor_1.toValue(revealedSecret_0).concat(_descriptor_0.toValue(claimedWinningNum_0).concat(_descriptor_6.toValue(quotient_0)))),
            alignment: _descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_0.alignment().concat(_descriptor_6.alignment())))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._drawWinner_0(context,
                                            partialProofData,
                                            drawId_0,
                                            revealedSecret_0,
                                            claimedWinningNum_0,
                                            quotient_0);
        partialProofData.output = { value: _descriptor_0.toValue(result_0), alignment: _descriptor_0.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      verifyWinningTicket: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`verifyWinningTicket: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const drawId_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('verifyWinningTicket',
                                     'argument 1 (as invoked from Typescript)',
                                     'zkDraw.compact line 273 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(drawId_0) === 'bigint' && drawId_0 >= 0n && drawId_0 <= 4294967295n)) {
          __compactRuntime.typeError('verifyWinningTicket',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'zkDraw.compact line 273 char 1',
                                     'Uint<0..4294967296>',
                                     drawId_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(drawId_0),
            alignment: _descriptor_0.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._verifyWinningTicket_0(context,
                                                     partialProofData,
                                                     drawId_0);
        partialProofData.output = { value: _descriptor_5.toValue(result_0), alignment: _descriptor_5.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      claimPrize: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`claimPrize: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const drawId_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('claimPrize',
                                     'argument 1 (as invoked from Typescript)',
                                     'zkDraw.compact line 290 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(drawId_0) === 'bigint' && drawId_0 >= 0n && drawId_0 <= 4294967295n)) {
          __compactRuntime.typeError('claimPrize',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'zkDraw.compact line 290 char 1',
                                     'Uint<0..4294967296>',
                                     drawId_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(drawId_0),
            alignment: _descriptor_0.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._claimPrize_0(context, partialProofData, drawId_0);
        partialProofData.output = { value: _descriptor_1.toValue(result_0), alignment: _descriptor_1.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      createDraw: this.circuits.createDraw,
      buyTicket: this.circuits.buyTicket,
      closeLottery: this.circuits.closeLottery,
      drawWinner: this.circuits.drawWinner,
      verifyWinningTicket: this.circuits.verifyWinningTicket,
      claimPrize: this.circuits.claimPrize
    };
    this.provableCircuits = {
      createDraw: this.circuits.createDraw,
      buyTicket: this.circuits.buyTicket,
      closeLottery: this.circuits.closeLottery,
      drawWinner: this.circuits.drawWinner,
      verifyWinningTicket: this.circuits.verifyWinningTicket,
      claimPrize: this.circuits.claimPrize
    };
  }
  initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('createDraw', new __compactRuntime.ContractOperation());
    state_0.setOperation('buyTicket', new __compactRuntime.ContractOperation());
    state_0.setOperation('closeLottery', new __compactRuntime.ContractOperation());
    state_0.setOperation('drawWinner', new __compactRuntime.ContractOperation());
    state_0.setOperation('verifyWinningTicket', new __compactRuntime.ContractOperation());
    state_0.setOperation('claimPrize', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(0n),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(1n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(2n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(3n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(4n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_10, value_0);
    return result_0;
  }
  _persistentHash_1(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_8, value_0);
    return result_0;
  }
  _persistentHash_2(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_9, value_0);
    return result_0;
  }
  _adminSecret_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.adminSecret(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('adminSecret',
                                 'return value',
                                 'zkDraw.compact line 30 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _privateTicketNumber_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.privateTicketNumber(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0n && result_0 <= 4294967295n)) {
      __compactRuntime.typeError('privateTicketNumber',
                                 'return value',
                                 'zkDraw.compact line 31 char 1',
                                 'Uint<0..4294967296>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_0.toValue(result_0),
      alignment: _descriptor_0.alignment()
    });
    return result_0;
  }
  _ticketSalt_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.ticketSalt(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('ticketSalt',
                                 'return value',
                                 'zkDraw.compact line 32 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _playerSecret_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.playerSecret(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('playerSecret',
                                 'return value',
                                 'zkDraw.compact line 33 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _adminKey_0(secret_0) {
    return this._persistentHash_1([new Uint8Array([122, 107, 68, 114, 97, 119, 58, 118, 50, 58, 97, 100, 109, 105, 110, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   secret_0]);
  }
  _deriveAdminKey_0(secret_0) { return this._adminKey_0(secret_0); }
  _participantKey_0(drawId_0, secret_0) {
    return this._persistentHash_0([new Uint8Array([122, 107, 68, 114, 97, 119, 58, 118, 50, 58, 112, 97, 114, 116, 105, 99, 105, 112, 97, 110, 116, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        drawId_0,
                                                                        'zkDraw.compact line 50 char 5'),
                                   secret_0]);
  }
  _deriveParticipantKey_0(drawId_0, secret_0) {
    return this._participantKey_0(drawId_0, secret_0);
  }
  _computeTicketCommitment_0(drawId_0, num_0, salt_0) {
    return this._persistentHash_2([new Uint8Array([122, 107, 68, 114, 97, 119, 58, 118, 50, 58, 116, 105, 99, 107, 101, 116, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        drawId_0,
                                                                        'zkDraw.compact line 62 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        num_0,
                                                                        'zkDraw.compact line 63 char 5'),
                                   salt_0]);
  }
  _deriveTicketCommitment_0(drawId_0, num_0, salt_0) {
    return this._computeTicketCommitment_0(drawId_0, num_0, salt_0);
  }
  _computeDrawCommitment_0(secret_0) {
    return this._persistentHash_1([new Uint8Array([122, 107, 68, 114, 97, 119, 58, 118, 50, 58, 100, 114, 97, 119, 95, 115, 101, 99, 114, 101, 116, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   secret_0]);
  }
  _deriveDrawCommitment_0(secret_0) {
    return this._computeDrawCommitment_0(secret_0);
  }
  _computeWinningEntropy_0(drawId_0, revealedSecret_0, count_0) {
    return this._persistentHash_2([new Uint8Array([122, 107, 68, 114, 97, 119, 58, 118, 50, 58, 119, 105, 110, 110, 101, 114, 95, 101, 110, 116, 114, 111, 112, 121, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        drawId_0,
                                                                        'zkDraw.compact line 86 char 5'),
                                   revealedSecret_0,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        count_0,
                                                                        'zkDraw.compact line 88 char 5')]);
  }
  _deriveWinningEntropy_0(drawId_0, revealedSecret_0, count_0) {
    return this._computeWinningEntropy_0(drawId_0, revealedSecret_0, count_0);
  }
  _computeClaimNullifier_0(drawId_0, commitment_0, secret_0) {
    return this._persistentHash_2([new Uint8Array([122, 107, 68, 114, 97, 119, 58, 118, 50, 58, 99, 108, 97, 105, 109, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        drawId_0,
                                                                        'zkDraw.compact line 99 char 5'),
                                   commitment_0,
                                   secret_0]);
  }
  _deriveClaimNullifier_0(drawId_0, commitment_0, secret_0) {
    return this._computeClaimNullifier_0(drawId_0, commitment_0, secret_0);
  }
  _createDraw_0(context,
                partialProofData,
                initialAdminKey_0,
                price_0,
                minVal_0,
                maxVal_0,
                initialDrawCommitment_0,
                totalTickets_0)
  {
    __compactRuntime.assert(maxVal_0 > minVal_0,
                            'maxVal must be strictly greater than minVal');
    __compactRuntime.assert(totalTickets_0 > 0n,
                            'totalTickets must be greater than zero');
    const drawId_0 = ((t1) => {
                       if (t1 > 4294967295n) {
                         throw new __compactRuntime.CompactError('zkDraw.compact line 125 char 18: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                       }
                       return t1;
                     })(_descriptor_3.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                  partialProofData,
                                                                                  [
                                                                                   { dup: { n: 0 } },
                                                                                   { idx: { cached: false,
                                                                                            pushPath: false,
                                                                                            path: [
                                                                                                   { tag: 'value',
                                                                                                     value: { value: _descriptor_2.toValue(0n),
                                                                                                              alignment: _descriptor_2.alignment() } }] } },
                                                                                   { popeq: { cached: true,
                                                                                              result: undefined } }]).value));
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(0n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_7.toValue(tmp_0),
                                                                alignment: _descriptor_7.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    const newDraw_0 = { admin: initialAdminKey_0,
                        status: 0n,
                        ticketPrice: price_0,
                        rangeMin: minVal_0,
                        rangeMax: maxVal_0,
                        maxTickets: totalTickets_0,
                        ticketCount: 0n,
                        drawCommitment: initialDrawCommitment_0,
                        winningNumber: 0n,
                        entropyRevealed:
                          new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(1n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(drawId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(newDraw_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return drawId_0;
  }
  _buyTicket_0(context, partialProofData, drawId_0) {
    const dId_0 = drawId_0;
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(1n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(dId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Draw does not exist');
    const draw_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                             partialProofData,
                                                                             [
                                                                              { dup: { n: 0 } },
                                                                              { idx: { cached: false,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_2.toValue(1n),
                                                                                                         alignment: _descriptor_2.alignment() } }] } },
                                                                              { idx: { cached: false,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_0.toValue(dId_0),
                                                                                                         alignment: _descriptor_0.alignment() } }] } },
                                                                              { popeq: { cached: false,
                                                                                         result: undefined } }]).value);
    __compactRuntime.assert(this._equal_0(draw_0.status, 0n),
                            'Lottery is not OPEN');
    let t_0;
    __compactRuntime.assert((t_0 = draw_0.ticketCount, t_0 < draw_0.maxTickets),
                            'All tickets have already been sold');
    const num_0 = this._privateTicketNumber_0(context, partialProofData);
    const salt_0 = this._ticketSalt_0(context, partialProofData);
    const secret_0 = this._playerSecret_0(context, partialProofData);
    __compactRuntime.assert(!this._equal_1(this._adminKey_0(secret_0),
                                           draw_0.admin),
                            'Creator cannot draw tickets from the lottery');
    const pKey_0 = this._participantKey_0(dId_0, secret_0);
    __compactRuntime.assert(!_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_2.toValue(3n),
                                                                                                                   alignment: _descriptor_2.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(pKey_0),
                                                                                                                                               alignment: _descriptor_1.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Participant has already drawn a ticket');
    __compactRuntime.assert(num_0 >= draw_0.rangeMin && num_0 <= draw_0.rangeMax,
                            'Ticket number out of valid range');
    const commitment_0 = this._computeTicketCommitment_0(dId_0, num_0, salt_0);
    __compactRuntime.assert(!_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_2.toValue(2n),
                                                                                                                   alignment: _descriptor_2.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(commitment_0),
                                                                                                                                               alignment: _descriptor_1.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Ticket commitment already registered');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(2n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(commitment_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(3n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(pKey_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const newTicketCount_0 = ((t1) => {
                               if (t1 > 4294967295n) {
                                 throw new __compactRuntime.CompactError('zkDraw.compact line 173 char 26: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                               }
                               return t1;
                             })(draw_0.ticketCount + 1n);
    const isSoldOut_0 = this._equal_2(newTicketCount_0, draw_0.maxTickets);
    if (isSoldOut_0) {
      const updatedDraw_0 = { admin: draw_0.admin,
                              status: 1n,
                              ticketPrice: draw_0.ticketPrice,
                              rangeMin: draw_0.rangeMin,
                              rangeMax: draw_0.rangeMax,
                              maxTickets: draw_0.maxTickets,
                              ticketCount: newTicketCount_0,
                              drawCommitment: draw_0.drawCommitment,
                              winningNumber: draw_0.winningNumber,
                              entropyRevealed: draw_0.entropyRevealed };
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { idx: { cached: false,
                                                  pushPath: true,
                                                  path: [
                                                         { tag: 'value',
                                                           value: { value: _descriptor_2.toValue(1n),
                                                                    alignment: _descriptor_2.alignment() } }] } },
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(dId_0),
                                                                                                alignment: _descriptor_0.alignment() }).encode() } },
                                         { push: { storage: true,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(updatedDraw_0),
                                                                                                alignment: _descriptor_4.alignment() }).encode() } },
                                         { ins: { cached: false, n: 1 } },
                                         { ins: { cached: true, n: 1 } }]);
    } else {
      const updatedDraw_1 = { admin: draw_0.admin,
                              status: draw_0.status,
                              ticketPrice: draw_0.ticketPrice,
                              rangeMin: draw_0.rangeMin,
                              rangeMax: draw_0.rangeMax,
                              maxTickets: draw_0.maxTickets,
                              ticketCount: newTicketCount_0,
                              drawCommitment: draw_0.drawCommitment,
                              winningNumber: draw_0.winningNumber,
                              entropyRevealed: draw_0.entropyRevealed };
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { idx: { cached: false,
                                                  pushPath: true,
                                                  path: [
                                                         { tag: 'value',
                                                           value: { value: _descriptor_2.toValue(1n),
                                                                    alignment: _descriptor_2.alignment() } }] } },
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(dId_0),
                                                                                                alignment: _descriptor_0.alignment() }).encode() } },
                                         { push: { storage: true,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(updatedDraw_1),
                                                                                                alignment: _descriptor_4.alignment() }).encode() } },
                                         { ins: { cached: false, n: 1 } },
                                         { ins: { cached: true, n: 1 } }]);
    }
    return commitment_0;
  }
  _closeLottery_0(context, partialProofData, drawId_0) {
    const dId_0 = drawId_0;
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(1n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(dId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Draw does not exist');
    const draw_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                             partialProofData,
                                                                             [
                                                                              { dup: { n: 0 } },
                                                                              { idx: { cached: false,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_2.toValue(1n),
                                                                                                         alignment: _descriptor_2.alignment() } }] } },
                                                                              { idx: { cached: false,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_0.toValue(dId_0),
                                                                                                         alignment: _descriptor_0.alignment() } }] } },
                                                                              { popeq: { cached: false,
                                                                                         result: undefined } }]).value);
    __compactRuntime.assert(this._equal_3(this._adminKey_0(this._adminSecret_0(context,
                                                                               partialProofData)),
                                          draw_0.admin),
                            'Unauthorized: only creator can end the draw');
    __compactRuntime.assert(this._equal_4(draw_0.status, 0n),
                            'Lottery must be OPEN to close');
    let t_0;
    __compactRuntime.assert((t_0 = draw_0.ticketCount, t_0 > 0n),
                            'Cannot close lottery with zero tickets');
    const updatedDraw_0 = { admin: draw_0.admin,
                            status: 1n,
                            ticketPrice: draw_0.ticketPrice,
                            rangeMin: draw_0.rangeMin,
                            rangeMax: draw_0.rangeMax,
                            maxTickets: draw_0.maxTickets,
                            ticketCount: draw_0.ticketCount,
                            drawCommitment: draw_0.drawCommitment,
                            winningNumber: draw_0.winningNumber,
                            entropyRevealed: draw_0.entropyRevealed };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(1n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(dId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(updatedDraw_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _drawWinner_0(context,
                partialProofData,
                drawId_0,
                revealedSecret_0,
                claimedWinningNum_0,
                quotient_0)
  {
    const dId_0 = drawId_0;
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(1n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(dId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Draw does not exist');
    const draw_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                             partialProofData,
                                                                             [
                                                                              { dup: { n: 0 } },
                                                                              { idx: { cached: false,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_2.toValue(1n),
                                                                                                         alignment: _descriptor_2.alignment() } }] } },
                                                                              { idx: { cached: false,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_0.toValue(dId_0),
                                                                                                         alignment: _descriptor_0.alignment() } }] } },
                                                                              { popeq: { cached: false,
                                                                                         result: undefined } }]).value);
    __compactRuntime.assert(this._equal_5(this._adminKey_0(this._adminSecret_0(context,
                                                                               partialProofData)),
                                          draw_0.admin),
                            'Unauthorized: only creator can draw winner');
    __compactRuntime.assert(this._equal_6(draw_0.status, 1n),
                            'Lottery must be CLOSED to draw');
    __compactRuntime.assert(this._equal_7(this._computeDrawCommitment_0(revealedSecret_0),
                                          draw_0.drawCommitment),
                            'Invalid draw secret revealed');
    __compactRuntime.assert(claimedWinningNum_0 >= draw_0.rangeMin
                            &&
                            claimedWinningNum_0 <= draw_0.rangeMax,
                            'Winning number out of range');
    const entropy_0 = this._computeWinningEntropy_0(dId_0,
                                                    revealedSecret_0,
                                                    draw_0.ticketCount);
    const entropy31_0 = ((e, i) => e.slice(i, i+31))(entropy_0, Number(0n));
    const entropyField_0 = __compactRuntime.convertBytesToField(31,
                                                                entropy31_0,
                                                                'zkDraw.compact line 247 char 24');
    let t_0, t_1;
    const span_0 = ((t1) => {
                     if (t1 > 4294967295n) {
                       throw new __compactRuntime.CompactError('zkDraw.compact line 249 char 16: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                     }
                     return t1;
                   })((t_0 = draw_0.rangeMax,
                       (t_1 = draw_0.rangeMin,
                        (__compactRuntime.assert(t_0 >= t_1,
                                                 'result of subtraction would be negative'),
                         t_0 - t_1)))
                      +
                      1n);
    let t_2;
    const offset_0 = (t_2 = draw_0.rangeMin,
                      (__compactRuntime.assert(claimedWinningNum_0 >= t_2,
                                               'result of subtraction would be negative'),
                       claimedWinningNum_0 - t_2));
    __compactRuntime.assert(offset_0 < span_0, 'Offset exceeds span');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.mulField(quotient_0,
                                                                                span_0),
                                                      offset_0)
                            ===
                            entropyField_0,
                            'Mathematical entropy derivation check failed');
    const updatedDraw_0 = { admin: draw_0.admin,
                            status: 2n,
                            ticketPrice: draw_0.ticketPrice,
                            rangeMin: draw_0.rangeMin,
                            rangeMax: draw_0.rangeMax,
                            maxTickets: draw_0.maxTickets,
                            ticketCount: draw_0.ticketCount,
                            drawCommitment: draw_0.drawCommitment,
                            winningNumber: claimedWinningNum_0,
                            entropyRevealed: revealedSecret_0 };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(1n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(dId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(updatedDraw_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return claimedWinningNum_0;
  }
  _verifyWinningTicket_0(context, partialProofData, drawId_0) {
    const dId_0 = drawId_0;
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(1n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(dId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Draw does not exist');
    const draw_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                             partialProofData,
                                                                             [
                                                                              { dup: { n: 0 } },
                                                                              { idx: { cached: false,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_2.toValue(1n),
                                                                                                         alignment: _descriptor_2.alignment() } }] } },
                                                                              { idx: { cached: false,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_0.toValue(dId_0),
                                                                                                         alignment: _descriptor_0.alignment() } }] } },
                                                                              { popeq: { cached: false,
                                                                                         result: undefined } }]).value);
    __compactRuntime.assert(this._equal_8(draw_0.status, 2n),
                            'Lottery must be DRAWN to verify winner');
    const num_0 = this._privateTicketNumber_0(context, partialProofData);
    const salt_0 = this._ticketSalt_0(context, partialProofData);
    const commitment_0 = this._computeTicketCommitment_0(dId_0, num_0, salt_0);
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(2n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(commitment_0),
                                                                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Ticket commitment not found on ledger');
    const isWinner_0 = this._equal_9(num_0, draw_0.winningNumber);
    return isWinner_0;
  }
  _claimPrize_0(context, partialProofData, drawId_0) {
    const dId_0 = drawId_0;
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(1n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(dId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Draw does not exist');
    const draw_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                             partialProofData,
                                                                             [
                                                                              { dup: { n: 0 } },
                                                                              { idx: { cached: false,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_2.toValue(1n),
                                                                                                         alignment: _descriptor_2.alignment() } }] } },
                                                                              { idx: { cached: false,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_0.toValue(dId_0),
                                                                                                         alignment: _descriptor_0.alignment() } }] } },
                                                                              { popeq: { cached: false,
                                                                                         result: undefined } }]).value);
    __compactRuntime.assert(this._equal_10(draw_0.status, 2n),
                            'Lottery must be DRAWN to claim prize');
    const num_0 = this._privateTicketNumber_0(context, partialProofData);
    const salt_0 = this._ticketSalt_0(context, partialProofData);
    const secret_0 = this._playerSecret_0(context, partialProofData);
    const commitment_0 = this._computeTicketCommitment_0(dId_0, num_0, salt_0);
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(2n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(commitment_0),
                                                                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Ticket commitment not found on ledger');
    __compactRuntime.assert(this._equal_11(num_0, draw_0.winningNumber),
                            'Ticket number does not match winning number');
    const nullifier_0 = this._computeClaimNullifier_0(dId_0,
                                                      commitment_0,
                                                      secret_0);
    __compactRuntime.assert(!_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_2.toValue(4n),
                                                                                                                   alignment: _descriptor_2.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(nullifier_0),
                                                                                                                                               alignment: _descriptor_1.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Prize for this ticket has already been claimed');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(4n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(nullifier_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return nullifier_0;
  }
  _equal_0(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_1(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_2(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_3(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_4(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_5(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_6(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_7(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_8(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_9(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_10(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_11(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    get nextDrawId() {
      return _descriptor_3.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_2.toValue(0n),
                                                                                                   alignment: _descriptor_2.alignment() } }] } },
                                                                        { popeq: { cached: true,
                                                                                   result: undefined } }]).value);
    },
    draws: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(1n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(0n),
                                                                                                                                 alignment: _descriptor_3.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_3.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(1n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 4294967295n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'zkDraw.compact line 24 char 1',
                                     'Uint<0..4294967296>',
                                     key_0)
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(1n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(key_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 4294967295n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'zkDraw.compact line 24 char 1',
                                     'Uint<0..4294967296>',
                                     key_0)
        }
        return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(1n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_0.toValue(key_0),
                                                                                                     alignment: _descriptor_0.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_0.fromValue(key.value),      _descriptor_4.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    ticketCommitments: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(2n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(0n),
                                                                                                                                 alignment: _descriptor_3.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_3.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(2n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'zkDraw.compact line 25 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(2n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[2];
        return self_0.asMap().keys().map((elem) => _descriptor_1.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    participants: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(3n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(0n),
                                                                                                                                 alignment: _descriptor_3.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_3.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(3n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'zkDraw.compact line 26 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(3n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[3];
        return self_0.asMap().keys().map((elem) => _descriptor_1.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    claimedNullifiers: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(4n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(0n),
                                                                                                                                 alignment: _descriptor_3.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_3.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(4n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'zkDraw.compact line 27 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(4n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[4];
        return self_0.asMap().keys().map((elem) => _descriptor_1.fromValue(elem.value))[Symbol.iterator]();
      }
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  adminSecret: (...args) => undefined,
  privateTicketNumber: (...args) => undefined,
  ticketSalt: (...args) => undefined,
  playerSecret: (...args) => undefined
});
export const pureCircuits = {
  deriveAdminKey: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`deriveAdminKey: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const secret_0 = args_0[0];
    if (!(secret_0.buffer instanceof ArrayBuffer && secret_0.BYTES_PER_ELEMENT === 1 && secret_0.length === 32)) {
      __compactRuntime.typeError('deriveAdminKey',
                                 'argument 1',
                                 'zkDraw.compact line 43 char 1',
                                 'Bytes<32>',
                                 secret_0)
    }
    return _dummyContract._deriveAdminKey_0(secret_0);
  },
  deriveParticipantKey: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`deriveParticipantKey: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const drawId_0 = args_0[0];
    const secret_0 = args_0[1];
    if (!(typeof(drawId_0) === 'bigint' && drawId_0 >= 0n && drawId_0 <= 4294967295n)) {
      __compactRuntime.typeError('deriveParticipantKey',
                                 'argument 1',
                                 'zkDraw.compact line 55 char 1',
                                 'Uint<0..4294967296>',
                                 drawId_0)
    }
    if (!(secret_0.buffer instanceof ArrayBuffer && secret_0.BYTES_PER_ELEMENT === 1 && secret_0.length === 32)) {
      __compactRuntime.typeError('deriveParticipantKey',
                                 'argument 2',
                                 'zkDraw.compact line 55 char 1',
                                 'Bytes<32>',
                                 secret_0)
    }
    return _dummyContract._deriveParticipantKey_0(drawId_0, secret_0);
  },
  deriveTicketCommitment: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`deriveTicketCommitment: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const drawId_0 = args_0[0];
    const num_0 = args_0[1];
    const salt_0 = args_0[2];
    if (!(typeof(drawId_0) === 'bigint' && drawId_0 >= 0n && drawId_0 <= 4294967295n)) {
      __compactRuntime.typeError('deriveTicketCommitment',
                                 'argument 1',
                                 'zkDraw.compact line 68 char 1',
                                 'Uint<0..4294967296>',
                                 drawId_0)
    }
    if (!(typeof(num_0) === 'bigint' && num_0 >= 0n && num_0 <= 4294967295n)) {
      __compactRuntime.typeError('deriveTicketCommitment',
                                 'argument 2',
                                 'zkDraw.compact line 68 char 1',
                                 'Uint<0..4294967296>',
                                 num_0)
    }
    if (!(salt_0.buffer instanceof ArrayBuffer && salt_0.BYTES_PER_ELEMENT === 1 && salt_0.length === 32)) {
      __compactRuntime.typeError('deriveTicketCommitment',
                                 'argument 3',
                                 'zkDraw.compact line 68 char 1',
                                 'Bytes<32>',
                                 salt_0)
    }
    return _dummyContract._deriveTicketCommitment_0(drawId_0, num_0, salt_0);
  },
  deriveDrawCommitment: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`deriveDrawCommitment: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const secret_0 = args_0[0];
    if (!(secret_0.buffer instanceof ArrayBuffer && secret_0.BYTES_PER_ELEMENT === 1 && secret_0.length === 32)) {
      __compactRuntime.typeError('deriveDrawCommitment',
                                 'argument 1',
                                 'zkDraw.compact line 79 char 1',
                                 'Bytes<32>',
                                 secret_0)
    }
    return _dummyContract._deriveDrawCommitment_0(secret_0);
  },
  deriveWinningEntropy: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`deriveWinningEntropy: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const drawId_0 = args_0[0];
    const revealedSecret_0 = args_0[1];
    const count_0 = args_0[2];
    if (!(typeof(drawId_0) === 'bigint' && drawId_0 >= 0n && drawId_0 <= 4294967295n)) {
      __compactRuntime.typeError('deriveWinningEntropy',
                                 'argument 1',
                                 'zkDraw.compact line 92 char 1',
                                 'Uint<0..4294967296>',
                                 drawId_0)
    }
    if (!(revealedSecret_0.buffer instanceof ArrayBuffer && revealedSecret_0.BYTES_PER_ELEMENT === 1 && revealedSecret_0.length === 32)) {
      __compactRuntime.typeError('deriveWinningEntropy',
                                 'argument 2',
                                 'zkDraw.compact line 92 char 1',
                                 'Bytes<32>',
                                 revealedSecret_0)
    }
    if (!(typeof(count_0) === 'bigint' && count_0 >= 0n && count_0 <= 4294967295n)) {
      __compactRuntime.typeError('deriveWinningEntropy',
                                 'argument 3',
                                 'zkDraw.compact line 92 char 1',
                                 'Uint<0..4294967296>',
                                 count_0)
    }
    return _dummyContract._deriveWinningEntropy_0(drawId_0,
                                                  revealedSecret_0,
                                                  count_0);
  },
  deriveClaimNullifier: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`deriveClaimNullifier: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const drawId_0 = args_0[0];
    const commitment_0 = args_0[1];
    const secret_0 = args_0[2];
    if (!(typeof(drawId_0) === 'bigint' && drawId_0 >= 0n && drawId_0 <= 4294967295n)) {
      __compactRuntime.typeError('deriveClaimNullifier',
                                 'argument 1',
                                 'zkDraw.compact line 105 char 1',
                                 'Uint<0..4294967296>',
                                 drawId_0)
    }
    if (!(commitment_0.buffer instanceof ArrayBuffer && commitment_0.BYTES_PER_ELEMENT === 1 && commitment_0.length === 32)) {
      __compactRuntime.typeError('deriveClaimNullifier',
                                 'argument 2',
                                 'zkDraw.compact line 105 char 1',
                                 'Bytes<32>',
                                 commitment_0)
    }
    if (!(secret_0.buffer instanceof ArrayBuffer && secret_0.BYTES_PER_ELEMENT === 1 && secret_0.length === 32)) {
      __compactRuntime.typeError('deriveClaimNullifier',
                                 'argument 3',
                                 'zkDraw.compact line 105 char 1',
                                 'Bytes<32>',
                                 secret_0)
    }
    return _dummyContract._deriveClaimNullifier_0(drawId_0,
                                                  commitment_0,
                                                  secret_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
//# sourceMappingURL=index.js.map
