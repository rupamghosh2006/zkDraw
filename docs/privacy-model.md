# zkDraw: Privacy Model & Information Architecture

zkDraw is architected on Midnight's **Dual-State Zero-Knowledge Ledger Model**, enforcing mathematical privacy boundaries that guarantee private player inputs while providing publicly verifiable ledger state.

---

## 1. The Core Privacy Principle

$$\text{Private Inputs} \longrightarrow \text{Zero-Knowledge Proof} \longrightarrow \text{Publicly Verifiable State}$$

No raw user ticket choice, private salt, or player secret key is ever transmitted over the network, stored on backend servers, or published to the Midnight public ledger.

---

## 2. Privacy Boundary Matrix

| Data Item | Client Memory | Backend API | Midnight Ledger | Public Observer |
| :--- | :---: | :---: | :---: | :---: |
| **Selected Ticket Number** | ✅ **Plaintext** | ❌ Never | ❌ Never | ❌ Never |
| **High-Entropy Salt** | ✅ **Plaintext** | ❌ Never | ❌ Never | ❌ Never |
| **Player Secret Key** | ✅ **Plaintext** | ❌ Never | ❌ Never | ❌ Never |
| **Ticket Commitment Hash** | ✅ Plaintext | ✅ Indexed | ✅ **Persistent State** | ✅ Visible |
| **Operator Pre-Commitment** | ✅ Plaintext | ✅ Indexed | ✅ **Persistent State** | ✅ Visible |
| **Operator Entropy Seed** | ❌ (Before Draw) | ❌ (Before Draw) | ✅ **Revealed in Draw** | ✅ Visible after Draw |
| **Winning Number Result** | ❌ (Before Draw) | ❌ (Before Draw) | ✅ **Revealed in Draw** | ✅ Visible after Draw |
| **Claim Nullifier** | ✅ Computed in ZK | ✅ Indexed | ✅ **Persistent State** | ✅ Visible |

---

## 3. Client-Side Cryptographic Witness Execution

When a user purchases a ticket:
1. The client generates a cryptographically secure 256-bit salt: $S_{\text{ticket}} \leftarrow \text{CSPRNG}()$.
2. The client creates a 256-bit player secret key: $K_{\text{player}} \leftarrow \text{CSPRNG}()$.
3. The client executes the domain-separated commitment circuit:
   $$C_{\text{ticket}} = \mathcal{H}\Big(\text{"zkDraw:v1:ticket"} \,\|\, \text{ticketNumber} \,\|\, S_{\text{ticket}}\Big)$$
4. The user's Midnight wallet constructs a zero-knowledge transaction proving:
   - $1 \le \text{ticketNumber} \le 50$ (Range Constraint).
   - $C_{\text{ticket}}$ is a valid commitment to the secret witness without revealing $\text{ticketNumber}$ or $S_{\text{ticket}}$.
5. The public transaction registers $C_{\text{ticket}}$ into `ticketCommitments` on the Midnight smart contract.

---

## 4. Unlinkable Prize Claims via Nullifiers

When claiming a prize:
1. The winning user proves ownership of a winning commitment $C_{\text{ticket}} \in \text{ticketCommitments}$ where $\text{ticketNumber} == \text{winningNumber}$.
2. The user calculates a single-use domain-separated nullifier:
   $$\text{Nullifier} = \mathcal{H}\Big(\text{"zkDraw:v1:claim"} \,\|\, C_{\text{ticket}} \,\|\, K_{\text{player}}\Big)$$
3. The smart contract records the Nullifier into `claimedNullifiers`.
4. Double-claiming the same ticket fails because the nullifier is deterministic per ticket commitment, yet unlinkable to the user's on-chain public address or ticket number.
