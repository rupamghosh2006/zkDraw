# How to Use zkDraw

**zkDraw** is a decentralized, confidential, and mathematically provably fair lottery built natively on the **Midnight blockchain** using zero-knowledge smart contracts.

---

## What You Need

Before playing or running zkDraw, make sure you have:
1. **A Midnight Compatible Wallet**:
   - **1AM Wallet** (Chrome / Brave Extension from [1am.xyz](https://1am.xyz)) or **Midnight Lace Wallet**.
   - Network set to **Midnight Preprod** (or Preview).
   - Some test tokens (**tNIGHT** and **tDUST**) from the Midnight Preprod Faucet.
2. **A Modern Web Browser**: Google Chrome, Brave, Microsoft Edge, or Firefox.

---

## Step-by-Step Guide

### 1. Connect Your Wallet
1. Open the zkDraw application in your browser.
2. Click the **"Connect Wallet"** button in the top navigation bar.
3. Select your installed **1AM Wallet** or **Midnight Lace Wallet** from the list.
4. Approve the connection request in your wallet extension popup.

---

### 2. Pick Your Confidential Lucky Number
1. Navigate to the **"Active Pot"** view.
2. View the current jackpot prize pool and ticket price.
3. Choose your confidential lucky number ($1..50$):
   - Click any number on the interactive grid, OR
   - Click **"Quick Pick"** to randomly select a number.
4. Click **"Buy Ticket in ZK"**.

---

### 3. Generate Zero-Knowledge Commitment & Purchase
1. A confirmation modal will appear showing your selected number and the cryptographic domain separation.
2. Your browser will automatically generate a secure 256-bit salt ($S_{\text{ticket}}$) and player secret ($K_{\text{player}}$).
3. The cryptographic ticket commitment is computed:
   $$C_{\text{ticket}} = \mathcal{H}(\text{"zkDraw:v1:ticket"} \,\|\, \text{number} \,\|\, S_{\text{ticket}})$$
4. Click **"Confirm & Sign in Wallet"**.
5. Approve the transaction in your 1AM/Lace wallet extension.
6. Your ticket receipt is securely stored in your browser's local **Vault** (`My Tickets`).

---

### 4. Wait for the Draw & Reveal
1. Once the ticket sales window closes, the lottery status transitions to `CLOSED`.
2. The lottery operator executes the draw by disclosing the pre-committed entropy seed ($S_{\text{draw}}$).
3. The Midnight smart contract verifies the seed against the on-chain commitment and computes the winning number using Euclidean modulus arithmetic.
4. The winning number and cryptographic proof are published on-chain.

---

### 5. Verify Draw & Check If You Won
1. Go to the **"Verify"** tab in the top navigation.
2. View the full cryptographic proof breakdown:
   - **Operator Draw Commitment**: Pre-committed on-chain before ticket sales started.
   - **Revealed Entropy**: Disclosed seed.
   - **Euclidean Arithmetic Verification**: Proves the mathematical uniqueness of the winning number ($q \cdot \text{span} + \text{offset} == E_{31}$).
3. Check your tickets in **"My Tickets"** to see if your private number matches the winning number without exposing your number to anyone else.

---

## What Gets Proved (and What Stays Private)

| Data Element | Visibility | Where It Lives | Cryptographic Guarantee |
| :--- | :--- | :--- | :--- |
| **Your Selected Number** | 🔒 **Private** | Browser Memory / Local Vault | Never published to ledger or backend |
| **Ticket Salt & Player Secret** | 🔒 **Private** | Browser Local Storage | 256-bit entropy prevents brute-force |
| **Ticket Commitment Hash** | 🌐 **Public** | Midnight On-Chain Ledger | 32-byte opaque SHA-256 hash |
| **Operator Pre-Commitment** | 🌐 **Public** | Midnight On-Chain Ledger | Prevents operator from changing seeds |
| **Winning Number Calculation** | 🌐 **Public & Verifiable** | ZK Arithmetic Circuit | Euclidean division guarantees fairness |

---

## Troubleshooting

### 1. "Wallet Not Detected"
- Ensure your **1AM Wallet** or **Midnight Lace** extension is installed and enabled.
- Refresh the page after unlocking your wallet.

### 2. "Insufficient DUST Balance"
- Preprod transactions require **tDUST** for gas fees.
- Open your 1AM Wallet and click **"Register NIGHT for DUST"** to generate tDUST from your tNIGHT balance.

### 3. "Transaction Rejected"
- Check that your wallet is connected to the **Midnight Preprod** network.
- Ensure your wallet has sufficient tDUST and confirm the popup before the timeout.
