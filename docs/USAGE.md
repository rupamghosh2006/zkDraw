# How to Use zkDraw

zkDraw is a decentralized, confidential, and mathematically provably fair lottery built natively on the Midnight blockchain using Compact smart contracts and zero-knowledge proofs.

---

## What You Need

Before playing or creating draws on zkDraw, ensure you have:
1. **A Midnight-Compatible Wallet**:
   - **1AM Wallet** (Chrome/Brave extension from [1am.xyz](https://1am.xyz)) or **Midnight Lace Wallet**.
   - Network configured to **Midnight Preprod** (or Preview).
   - Testnet tokens (**tNIGHT** and **tDUST**) from the Midnight Preprod Faucet.
2. **A Modern Web Browser**: Google Chrome, Brave, Microsoft Edge, or Firefox.

---

## Token Economics: NIGHT vs. DUST

| Token | Purpose in zkDraw | Transferable? |
|:---|:---|:---|
| **tNIGHT** | **Ticket Entry & Jackpot Pool**: Transferred when purchasing a ticket to fund the jackpot. | Yes |
| **tDUST** | **Network Gas**: Consumed by the Midnight network to process ZK proofs and state changes (~0.01–0.05 tDUST per transaction). | Gas resource |

---

## Application Navigation & Pages

The application is organized into dedicated views:
- **Active Draws (`/draws`)**: Browse all active, closed, and resolved draws with status filters, creator filtering, search, and live capacity progress bars.
- **Create Draw (`/create`)**: Launch a custom on-chain lottery pot by configuring ticket price, capacity ($2..100$ tickets), and number range ($1..50$).
- **Draw Detail (`/draws/:id`)**: Focused interface for purchasing confidential tickets, monitoring participant count, ending the draw, and executing the provable winner draw.
- **My Vault (`/my-tickets`)**: Confidential client vault holding secret 256-bit salts, receipt hashes, explorer links, and ZK prize claim tools.
- **Fairness Verifier (`/verify`)**: Independent cryptographic verifier checking operator commitments, entropy derivations, Euclidean division modulus formulas, and range constraints.

---

## Step-by-Step Guide

### 1. Connect Your Wallet
1. Open the zkDraw application at [https://zk-draw-gamma.vercel.app/](https://zk-draw-gamma.vercel.app/).
2. Click **"Connect wallet"** in the top navigation bar.
3. Select your installed **1AM Wallet** or **Midnight Lace Wallet**.
4. Approve the connection request in the wallet extension popup.
5. Use the theme toggle to switch between **Light** and **Midnight** themes as desired.

---

### 2. Create a Custom Draw (Optional)
Any connected user can launch a new provable lottery pot:
1. Navigate to **"Create"** in the navigation header.
2. Configure your pot parameters:
   - **Ticket Price**: In tDUST/tNIGHT (e.g., 1,000,000 atomic units).
   - **Ticket Supply**: Total tickets available ($2 \le \text{maxTickets} \le 100$).
   - **Number Range**: Lucky number range ($1..50$).
3. Review the on-chain pot preview and submit the initialization transaction.
4. The contract securely generates and pre-commits your secret draw entropy seed ($S_{\text{draw}}$) on-chain.

*Note: The creator is barred from purchasing tickets in their own pot to eliminate conflicts of interest.*

---

### 3. Enter an Active Draw
1. Navigate to **"Draws"** and select any open lottery pot.
2. Choose your confidential lucky number ($1..50$):
   - Click any number on the interactive grid, OR
   - Click **"Quick Pick"** to randomly select a valid number.
3. Click **"Buy Ticket in ZK"**.
4. In the confirmation modal:
   - Your browser automatically generates a cryptographically secure 256-bit salt ($S_{\text{ticket}}$) and player secret ($K_{\text{player}}$).
   - The opaque ticket commitment is derived:
     $$C_{\text{ticket}} = \mathcal{H}(\text{"zkDraw:v1:ticket"} \,\|\, \text{number} \,\|\, S_{\text{ticket}})$$
5. Click **"Confirm & Sign in Wallet"** and approve the transaction.
6. The ticket receipt with its secret salt is securely saved to your local **Vault** (`/my-tickets`). Only 1 ticket per wallet address is allowed per pot.

---

### 4. Draw Resolution & Winner Selection
A draw transitions from `OPEN` to `CLOSED` under two conditions:
- **Sellout**: When all available tickets are purchased (`ticketCount >= maxTickets`), the pot auto-closes.
- **Creator Early Closure**: The creator can manually end the draw early using the "End Draw Early" action with confirmation.

Once closed, the creator executes the draw:
1. The creator clicks **"Draw Winner"**.
2. The creator discloses the pre-committed entropy seed ($S_{\text{draw}}$).
3. The Compact contract verifies the seed against the on-chain commitment and computes the winning number inside the ZK circuit using Euclidean division arithmetic.
4. The winning number is published on-chain, and the pot transitions to `DRAWN`.

---

### 5. Claiming Your Prize
1. Navigate to **"Vault"** (`/my-tickets`).
2. If your confidential number matches the published winning number, the ticket displays a **"Claim Prize"** option.
3. Generating the claim proof computes an unlinkable single-use nullifier:
   $$\text{Nullifier} = \mathcal{H}(\text{"zkDraw:v1:claim"} \,\|\, C_{\text{ticket}} \,\|\, K_{\text{player}})$$
4. Submit the transaction to claim the jackpot. The nullifier prevents double-claims while keeping your identity confidential.

---

### 6. Independent Cryptographic Verification
1. Navigate to **"Verify"** (`/verify`).
2. Select any drawn lottery pot or input custom parameters:
   - **Operator Draw Commitment**: Pre-committed on-chain before ticket sales opened.
   - **Disclosed Entropy Seed**: Operator seed revealed upon draw execution.
   - **Ticket Count**: Total tickets locked at closure.
   - **Euclidean Modulus Constraints**: Proves that $(q \cdot \text{span}) + \text{offset} == E_{31}$ where $\text{offset} < \text{span}$.
3. Click **"Run Independent Cryptographic Verification"** to mathematically verify fairness without trusting servers or operators.

---

## What Gets Proved vs. What Stays Private

| Data Element | Visibility | Where It Lives | Cryptographic Guarantee |
|:---|:---|:---|:---|
| **Your Selected Number** | Private | Browser Memory / Local Vault | Never published to ledger, mempool, or backend |
| **Ticket Salt & Player Secret** | Private | Browser Local Storage | 256-bit CSPRNG entropy prevents dictionary attacks |
| **Ticket Commitment Hash** | Public | Midnight On-Chain Ledger | 32-byte opaque SHA-256 hash |
| **Operator Pre-Commitment** | Public | Midnight On-Chain Ledger | Binds the operator to the seed before sales open |
| **Winning Number Calculation** | Public & Verifiable | ZK Arithmetic Circuit | Euclidean division guarantees unique mathematical remainder |
| **Prize Claim Nullifier** | Public | Midnight On-Chain Ledger | Single-use deterministic nullifier prevents double claims |

---

## Troubleshooting

### 1. "Wallet Not Detected"
- Ensure your **1AM Wallet** or **Midnight Lace** extension is installed and unlocked.
- Refresh the page or click "Refresh Detected Extensions" in the wallet connection modal.

### 2. "You created this draw and can't purchase tickets in it"
- As part of the fairness protocol, creators are prevented from purchasing tickets in draws they created. Connect with a different wallet to participate.

### 3. "Already purchased a ticket for this draw"
- Each participant address is limited to one ticket per draw on-chain to maintain fair odds and prevent sybil attacks.

### 4. "Insufficient DUST Balance"
- Preprod transactions require **tDUST** for zero-knowledge proving and gas.
- Open your 1AM Wallet and use the faucet or convert tNIGHT to tDUST before signing.

