# zkDraw: Threat Model & Security Architecture

This document analyzes attack vectors, threat surfaces, adversary capabilities, and cryptographic countermeasures implemented in zkDraw on the Midnight blockchain.

---

## 1. Threat Vectors & Countermeasures

### Threat 1: Operator Attempts to Alter the Winning Number
- **Vector**: The operator attempts to publish a favorable winning number to reward a specific participant or colluding address.
- **Countermeasure**: The operator must disclose $S_{\text{draw}}$. The on-chain circuit verifies $C_{\text{draw}} == \mathcal{H}(S_{\text{draw}})$ and forces $(q \cdot \text{span}) + \text{offset} == \text{Field}(E_{31})$. Euclidean division guarantees that only one exact number satisfies this constraint. Any manipulated number fails the circuit assertion.

### Threat 2: Front-Running Ticket Choices
- **Vector**: A malicious observer monitors the mempool to see participant ticket choices and pick winning combinations or block player numbers.
- **Countermeasure**: Player numbers are never sent to the network. Mempool transactions contain only opaque 256-bit commitments $C_{\text{ticket}} = \mathcal{H}(\text{"zkDraw:v1:ticket"} \,\|\, \text{number} \,\|\, \text{salt})$. Because the salt has 256 bits of entropy, commitments are computationally indistinguishable from random noise.

### Threat 3: Offline Dictionary / Rainbow Table Attacks on Commitments
- **Vector**: An adversary tries to precompute hashes for numbers $1..50$ to uncover what number was purchased.
- **Countermeasure**: Each ticket uses a 256-bit cryptographically secure random salt generated client-side ($2^{256}$ search space), making brute-force dictionary precomputation computationally infeasible.

### Threat 4: Double-Claiming Winning Prizes
- **Vector**: A winner tries to claim the jackpot multiple times using the same winning ticket.
- **Countermeasure**: The `claimPrize` circuit derives a deterministic domain-separated nullifier:
  $$\text{Nullifier} = \mathcal{H}(\text{"zkDraw:v1:claim"} \,\|\, C_{\text{ticket}} \,\|\, K_{\text{player}})$$
  and verifies that `!claimedNullifiers.member(nullifier)`. Upon successful claim, the nullifier is stored in `claimedNullifiers`, permanently blocking any subsequent claim for that ticket.

### Threat 5: Non-Winners Attempting to Claim
- **Vector**: An attacker tries to claim a prize without holding a ticket for the drawn number.
- **Countermeasure**: The `claimPrize` circuit requires private witnesses for `privateTicketNumber` and `ticketSalt`, computes the commitment $C$, and asserts that:
  1. $C \in \text{ticketCommitments}$ (Must exist on the ledger).
  2. $\text{privateTicketNumber} == \text{winningNumber}$ (Must equal the drawn number).
  If either condition fails, the ZK proof cannot be created.

### Threat 6: Duplicate Ticket Commitment Injection
- **Vector**: An adversary copies an existing commitment from the ledger to submit a duplicate entry.
- **Countermeasure**: The contract checks `assert(!ticketCommitments.member(commitment))` in `buyTicket()`, instantly reverting any duplicate commitment.

---

## 2. Security Invariants Checklist

- [x] Zero raw private inputs on the public ledger.
- [x] Pre-committed operator entropy bound by one-way hash.
- [x] Mathematical Euclidean uniqueness for winning derivation.
- [x] Single-use unlinkable prize claim nullifiers.
- [x] Strict state machine progression (`OPEN` $\to$ `CLOSED` $\to$ `DRAWN`).
- [x] Client-side ZK witness generation with 256-bit CSPRNG salts.
