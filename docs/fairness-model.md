# zkDraw: Provable Fairness & Cryptographic Verification

zkDraw eliminates reliance on trusted third parties, closed-source RNGs, or off-chain oracles. The entire draw mechanism is provably fair, non-interactive, and mathematically verifiable by any participant or observer.

---

## 1. Commit-Reveal Draw Randomness Protocol

The lottery draw uses a cryptographically binding Commit-Reveal scheme enforced by Midnight smart contracts.

### Phase 1: Pre-Commitment (Lottery Initialization)
Before any ticket can be purchased, the lottery operator generates a 256-bit random entropy seed $S_{\text{draw}}$ and registers its cryptographic commitment on-chain:
$$C_{\text{draw}} = \mathcal{H}\Big(\text{"zkDraw:v1:draw"} \,\|\, S_{\text{draw}}\Big)$$

$C_{\text{draw}}$ is immutably stored in the contract ledger state `drawCommitment`. The operator cannot alter $S_{\text{draw}}$ once published.

### Phase 2: State Closure
When the lottery closes, the state transitions from `OPEN` (0) to `CLOSED` (1). Ticket purchasing is permanently disabled, and the total participant count $N = \text{ticketCount}$ is locked.

### Phase 3: Reveal & ZK Circuit Execution
The operator submits $S_{\text{draw}}$ to the `drawWinner` circuit along with the quotient solution $q$.
The circuit enforces:
1. **Commitment Binding Check**:
   $$\mathcal{H}\Big(\text{"zkDraw:v1:draw"} \,\|\, S_{\text{draw}}\Big) \equiv C_{\text{draw}}$$
2. **Entropy Derivation**:
   $$E = \mathcal{H}\Big(\text{"zkDraw:v1:entropy"} \,\|\, S_{\text{draw}} \,\|\, N\Big)$$
3. **ZK-Field Slicing**:
   $$E_{31} = \text{slice}_{31}(E, 0) \in \mathbb{F}_{p}$$
   Extracting 31 bytes ($248 \text{ bits}$) guarantees that $E_{31} < \text{MAX\_FIELD}$ ($\approx 251.8 \text{ bits}$) for every possible hash value, avoiding arithmetic overflow.

---

## 2. Euclidean Modulus Theorem & Remainder Uniqueness

In Compact arithmetic circuits, integer modulo operations are proven using Euclidean division relation constraints:

$$\text{span} = (\text{rangeMax} - \text{rangeMin} + 1)$$

$$\text{offset} = (\text{winningNumber} - \text{rangeMin})$$

The circuit enforces two mathematical constraints:
1. $\text{offset} < \text{span}$
2. $(q \cdot \text{span}) + \text{offset} == E_{31}$

By the **Euclidean Division Theorem**, given positive integers $E_{31}$ and $\text{span}$, there exist *unique* integers $q$ and $\text{offset}$ satisfying $E_{31} = q \cdot \text{span} + \text{offset}$ with $0 \le \text{offset} < \text{span}$.

Therefore, the operator cannot pass any other winning number or quotient without causing the circuit to reject the transaction.

$$\text{winningNumber} = \text{rangeMin} + (E_{31} \pmod{\text{span}})$$

---

## 3. Independent Browser & API Verification Algorithm

Any user can independently verify a drawn lottery:

```typescript
function verifyLotteryDraw(
  drawCommitmentHex: string,
  revealedSecretHex: string,
  ticketCount: number,
  rangeMin: number,
  rangeMax: number,
  claimedWinningNumber: number,
): boolean {
  // Step 1: Pre-commitment verification
  const derivedCommitment = deriveDrawCommitment(revealedSecret);
  if (derivedCommitment !== drawCommitmentHex) return false;

  // Step 2: Entropy derivation
  const entropy = deriveWinningEntropy(revealedSecret, ticketCount);
  const entropy31Field = convert31BytesToField(entropy);

  // Step 3: Modulus and offset
  const span = rangeMax - rangeMin + 1;
  const offset = Number(entropy31Field % BigInt(span));
  const expectedWinner = rangeMin + offset;

  // Step 4: Verify equality
  return expectedWinner === claimedWinningNumber;
}
```
