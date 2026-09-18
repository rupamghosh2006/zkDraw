# zkDraw: Privacy Model & Information Architecture

zkDraw is architected on Midnight's **Dual-State Zero-Knowledge Ledger Model**, enforcing strict cryptographic privacy boundaries that protect private player witnesses while maintaining publicly verifiable, trustless ledger state.

---

## 1. The Core Privacy Principle

$$\text{Private Inputs} \longrightarrow \text{Zero-Knowledge Proof} \longrightarrow \text{Publicly Verifiable State}$$

No raw player ticket choice, private salt, or player secret key is ever transmitted across the network, stored on backend servers, or recorded in the Midnight public ledger.

---

## 2. Privacy Boundary Matrix

| Data Item | Client Memory | Backend API | Midnight Ledger | Public Observer |
|:---|:---:|:---:|:---:|:---:|
| **Selected Ticket Number** | Plaintext (Vault) | Never | Never | Never |
| **High-Entropy Salt ($S_{\text{ticket}}$)** | Plaintext (Vault) | Never | Never | Never |
| **Player Secret Key ($K_{\text{player}}$)** | Plaintext (Vault) | Never | Never | Never |
| **Ticket Commitment Hash ($C_{\text{ticket}}$)** | Plaintext | Indexed | Persistent State | Visible on Explorer |
| **Creator Draw Pre-Commitment ($C_{\text{draw}}$)** | Plaintext | Indexed | Persistent State | Visible on Explorer |
| **Creator Entropy Seed ($S_{\text{draw}}$)** | Hidden before draw | Hidden before draw | Revealed in Draw | Visible after Draw |
| **Winning Number Result** | Hidden before draw | Hidden before draw | Revealed in Draw | Visible after Draw |
| **Prize Claim Nullifier** | Computed in ZK | Indexed | Persistent State | Visible on Explorer |

---

## 3. Client-Side Cryptographic Witness Execution

When a participant purchases a ticket:
1. The client generates a cryptographically secure 256-bit salt: $S_{\text{ticket}} \leftarrow \text{CSPRNG}()$.
2. The client creates a 256-bit player secret key: $K_{\text{player}} \leftarrow \text{CSPRNG}()$.
3. The client executes the domain-separated commitment circuit:
   $$C_{\text{ticket}} = \mathcal{H}\Big(\text{"zkDraw:v1:ticket"} \,\|\, \text{ticketNumber} \,\|\, S_{\text{ticket}}\Big)$$
4. The user's Midnight wallet constructs a zero-knowledge transaction proving:
   - $1 \le \text{ticketNumber} \le 50$ (Range Constraint).
   - $C_{\text{ticket}}$ is a valid commitment to the secret witness without revealing $\text{ticketNumber}$ or $S_{\text{ticket}}$.
   - The participant has not already purchased a ticket for this specific draw.
5. The public transaction registers $C_{\text{ticket}}$ into `ticketCommitments` on the Midnight smart contract and updates the participant tally.

---

## 4. Unlinkable Prize Claims via Nullifiers

When claiming a prize:
1. The winning participant proves knowledge of the preimage for a registered commitment $C_{\text{ticket}} \in \text{ticketCommitments}$ where $\text{ticketNumber} == \text{winningNumber}$.
2. The participant derives a single-use domain-separated nullifier:
   $$\text{Nullifier} = \mathcal{H}\Big(\text{"zkDraw:v1:claim"} \,\|\, C_{\text{ticket}} \,\|\, K_{\text{player}}\Big)$$
3. The smart contract verifies that `!claimedNullifiers.member(Nullifier)`.
4. Upon successful verification, the contract records the Nullifier into `claimedNullifiers` and authorizes the jackpot payout.
5. Double-claiming fails because the nullifier is deterministic per ticket commitment, yet computationally unlinkable to the user's public address or secret ticket number.

