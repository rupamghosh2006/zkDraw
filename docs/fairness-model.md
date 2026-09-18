# zkDraw: Provable Fairness & Cryptographic Verification

zkDraw eliminates reliance on trusted third parties, closed-source random number generators, or off-chain oracles. The entire lottery lifecycle is provably fair, non-interactive, and mathematically verifiable by any participant or observer natively on the Midnight blockchain.

---

## 1. Decentralized Commit-Reveal Protocol

The lottery draw uses a cryptographically binding Commit-Reveal scheme enforced by Midnight Compact smart contracts.

### Phase 1: Creator Pre-Commitment (Draw Initialization)
Any connected user can create an on-chain lottery pot. During initialization:
1. The creator specifies pot parameters:
   - `ticketPrice`: Price per ticket in atomic units.
   - `maxTickets`: Total ticket capacity ($2 \le \text{maxTickets} \le 100$).
   - `rangeMin` / `rangeMax`: Allowed number span ($1..50$).
2. The client generates a cryptographically secure 256-bit entropy seed $S_{\text{draw}}$.
3. The cryptographic commitment is computed and registered on the Midnight ledger:
   $$C_{\text{draw}} = \mathcal{H}\Big(\text{"zkDraw:v1:draw"} \,\|\, S_{\text{draw}}\Big)$$
4. $C_{\text{draw}}$ is immutably stored in the contract state `drawCommitment`. The creator cannot alter $S_{\text{draw}}$ once published.
5. The creator address is recorded, and the contract strictly bars the creator from purchasing tickets in their own pot (`creator != playerAddress`).

### Phase 2: State Closure
A draw transitions from `OPEN` (0) to `CLOSED` (1) under two deterministic conditions:
- **Sellout Trigger**: The pot automatically transitions to `CLOSED` when all tickets are purchased (`ticketCount >= maxTickets`).
- **Creator Early Closure**: The creator may manually invoke `closeLottery` early via an authenticated action.

Once `CLOSED`, ticket sales are permanently terminated, and the total participant count $N = \text{ticketCount}$ is locked into the ledger.

### Phase 3: Reveal & ZK Circuit Execution
To execute the draw, the creator submits $S_{\text{draw}}$ and the computed quotient solution $q$ to the `drawWinner` circuit:
1. **Commitment Binding Check**:
   $$\mathcal{H}\Big(\text{"zkDraw:v1:draw"} \,\|\, S_{\text{draw}}\Big) \equiv C_{\text{draw}}$$
2. **Entropy Derivation**:
   $$E = \mathcal{H}\Big(\text{"zkDraw:v1:entropy"} \,\|\, S_{\text{draw}} \,\|\, N\Big)$$
3. **ZK-Field Slicing**:
   $$E_{31} = \text{slice}_{31}(E, 0) \in \mathbb{F}_{p}$$
   Extracting 31 bytes ($248 \text{ bits}$) guarantees that $E_{31} < \text{MAX\_FIELD}$ ($\approx 251.8 \text{ bits}$) for every possible hash value, eliminating modulo bias and arithmetic overflow.
4. **Status Update**: The contract transitions state to `DRAWN` (2) and commits the immutable `winningNumber`.

---

## 2. Euclidean Modulus Theorem & Remainder Uniqueness

In Compact arithmetic circuits, integer modulo operations are proven using Euclidean division relation constraints:

$$\text{span} = (\text{rangeMax} - \text{rangeMin} + 1)$$

$$\text{offset} = (\text{winningNumber} - \text{rangeMin})$$

The circuit enforces two mathematical constraints:
1. $\text{offset} < \text{span}$
2. $(q \cdot \text{span}) + \text{offset} == E_{31}$

By the **Euclidean Division Theorem**, given positive integers $E_{31}$ and $\text{span}$, there exist *unique* integers $q$ and $\text{offset}$ satisfying $E_{31} = q \cdot \text{span} + \text{offset}$ with $0 \le \text{offset} < \text{span}$.

Therefore, neither the creator nor the operator can pass any other winning number or quotient without causing the ZK circuit to immediately reject the transaction.

$$\text{winningNumber} = \text{rangeMin} + (E_{31} \pmod{\text{span}})$$

---

## 3. Independent Browser & API Verification Algorithm

Any user or independent auditor can verify a drawn lottery via the frontend `/verify` interface or backend API (`GET /api/lotteries/:id/verify`):

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
  const derivedCommitment = deriveDrawCommitment(revealedSecretHex);
  if (derivedCommitment !== drawCommitmentHex) return false;

  // Step 2: Entropy derivation
  const entropy = deriveWinningEntropy(revealedSecretHex, ticketCount);
  const entropy31Field = convert31BytesToField(entropy);

  // Step 3: Modulus and offset
  const span = rangeMax - rangeMin + 1;
  const offset = Number(entropy31Field % BigInt(span));
  const expectedWinner = rangeMin + offset;

  // Step 4: Verify equality
  return expectedWinner === claimedWinningNumber;
}
```

