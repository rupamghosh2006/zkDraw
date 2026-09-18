# zkDraw: Security Policy & Cryptographic Model

zkDraw is built from the ground up on Midnight's zero-knowledge architecture to eliminate trust, fraud, front-running, and central points of failure in on-chain lottery gaming. This document outlines the security policies, cryptographic primitives, threat mitigations, and mathematical invariants governing the protocol.

---

## 1. Core Security Guarantees

| Security Property | Mechanism | Enforcement Layer |
|:---|:---|:---|
| **Zero Witness Exposure** | 256-bit CSPRNG salts & client-side ZK proofs | Client browser & Midnight Proof Server |
| **Commitment Integrity** | Cryptographic one-way hashing with domain separation | Compact smart contract (`zkDraw.compact`) |
| **Provable Randomness** | Commit-reveal scheme with Euclidean modulus constraints | ZK arithmetic circuits & field assertions |
| **Anti-Insider Trading** | Creator address barred from ticket purchases | Contract logic (`creator != playerAddress`) |
| **Sybil Resistance** | On-chain participant key registry | Contract ledger (`assert(!participantKeys.member)`) |
| **Double-Claim Prevention** | Single-use deterministic claim nullifiers | Contract ledger (`claimedNullifiers`) |
| **Storage Immutability** | Decentralized IPFS pinning via Pinata | IPFS content identifiers (CIDs) |
| **Auditable Fairness** | Client and server independent verification tools | Open mathematical verification algorithms |

---

## 2. Cryptographic Primitives & Domain Separation

zkDraw employs strict cryptographic domain separation across all hashing routines to prevent cross-protocol collisions and type-confusion attacks:

1. **Ticket Commitment**:
   $$C_{\text{ticket}} = \mathcal{H}\Big(\text{"zkDraw:v1:ticket"} \,\|\, \text{number} \,\|\, S_{\text{ticket}}\Big)$$
   - `number`: Secret integer in range $[1..50]$.
   - $S_{\text{ticket}}$: 256-bit cryptographically secure pseudorandom salt generated client-side ($2^{256}$ search space).
2. **Creator Draw Pre-Commitment**:
   $$C_{\text{draw}} = \mathcal{H}\Big(\text{"zkDraw:v1:draw"} \,\|\, S_{\text{draw}}\Big)$$
   - $S_{\text{draw}}$: 256-bit entropy seed generated before ticket sales open.
3. **Entropy Derivation**:
   $$E = \mathcal{H}\Big(\text{"zkDraw:v1:entropy"} \,\|\, S_{\text{draw}} \,\|\, N\Big)$$
   - $N$: Total ticket count locked at draw closure.
4. **Prize Claim Nullifier**:
   $$\text{Nullifier} = \mathcal{H}\Big(\text{"zkDraw:v1:claim"} \,\|\, C_{\text{ticket}} \,\|\, K_{\text{player}}\Big)$$
   - $K_{\text{player}}$: Private claim key held in the winner's local vault.

---

## 3. Mathematical Invariants & Circuit Constraints

### 3.1 Euclidean Modulus Remainder Uniqueness
In Compact smart contracts, integer modulo operations are constrained through Euclidean division assertions:

$$\text{span} = \text{rangeMax} - \text{rangeMin} + 1$$
$$\text{offset} = \text{winningNumber} - \text{rangeMin}$$

The `drawWinner` circuit enforces:
1. $\text{offset} < \text{span}$
2. $(q \cdot \text{span}) + \text{offset} == E_{31}$

By the **Euclidean Division Theorem**, given positive integers $E_{31}$ and $\text{span}$, there exists exactly one pair of integers $(q, \text{offset})$ satisfying these conditions. The creator or operator cannot supply any other number without triggering an immediate circuit constraint failure.

### 3.2 Field Element Safety
Extracting 31 bytes ($248 \text{ bits}$) via `slice<31>` ensures $E_{31} < \text{MAX\_FIELD}$ ($\approx 251.8 \text{ bits}$) for the underlying elliptic curve scalar field, eliminating arithmetic overflow vulnerabilities.

---

## 4. Operational Security & Anti-Fraud Measures

### 4.1 Creator Exclusion
To prevent creators from manipulating odds or siphoning jackpots:
- The contract asserts `creatorAddress != playerAddress` in the `buyTicket` circuit.
- The UI proactively disables purchasing for the connected creator address with clear feedback.

### 4.2 Sybil & Multi-Purchase Prevention
- Every participant address is checked against on-chain ledger state (`!participantKeys.member(playerKey)`).
- Clearing browser cookies or local storage does not permit a participant to buy a second ticket for the same draw.

### 4.3 State Machine Transition Enforcement
Transitions follow a strict one-way lifecycle:
- `OPEN` (0) $\to$ `CLOSED` (1): Triggered only upon sellout (`ticketCount >= maxTickets`) or creator early closure.
- `CLOSED` (1) $\to$ `DRAWN` (2): Triggered only when the valid pre-committed seed $S_{\text{draw}}$ is revealed by the authorized creator.
- `DRAWN` (2) $\to$ Payouts: Winners submit ZK proofs of preimage and nullifiers; no state rollback is possible.

---

## 5. Independent Cryptographic Auditing

The protocol guarantees that no user must trust zkDraw operators or servers. Fairness can be independently proven via:
- **Interactive In-Browser Verifier**: Available at `/verify`, allowing any participant to input on-chain parameters and verify mathematical remainder derivations.
- **Backend Verification Endpoint**: `GET /api/lotteries/:id/verify` returns full proof steps and validation flags.
- **1AM Preprod Explorer**: All smart contract states, transaction hashes, and commitments can be directly inspected on-chain.

---

## 6. Vulnerability Disclosure Policy

If you discover a potential vulnerability or security issue in zkDraw:
1. Please report it privately via GitHub Security Advisories or reach out on our official communication channel.
2. Provide detailed steps to reproduce the issue, including network parameters, transaction payloads, and circuit traces.
3. We follow coordinated disclosure guidelines and will promptly investigate and address confirmed reports.
