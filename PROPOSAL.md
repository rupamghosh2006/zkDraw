# zkDraw Product Proposal: Confidential & Provably Fair Lottery on Midnight

## 1. Executive Summary
Traditional online lotteries and on-chain raffle protocols suffer from severe fundamental privacy and trust vulnerabilities:
1. **Public State Exposure**: On transparent blockchains (Ethereum, Solana), purchased ticket numbers are exposed publicly in mempools and ledger state, enabling front-running, copy-trading, statistical manipulation, and identity profiling of high-stake players.
2. **Centralized Randomness / Trusted Operators**: Web2 lotteries rely on black-box RNGs where operators can secretly manipulate draws. Even on-chain VRFs can be prone to withholding attacks or front-running when the winner's ticket data is publicly visible.

**zkDraw** solves this by building natively on **Midnight Network**, combining **Compact zero-knowledge smart contracts**, **private witness state**, and **provably fair arithmetic circuits** to deliver a 100% confidential and mathematically verifiable lottery.

---

## 2. Target Users & Problem Statement
- **Confidential Gamers & Lottery Players**: Want to participate in decentralized prize draws without exposing their lottery numbers, strategies, or wallet balances to public explorers.
- **Fair-Gaming Advocates & Verifiers**: Want mathematical, cryptographic proof that every draw was computed honestly without trusting operators, third-party servers, or closed-source random number generators.
- **dApp Operators & Communities**: Need a turn-key, privacy-first prize pool and lottery protocol for community giveaways, staking rewards, and confidential gaming.

---

## 3. Cryptographic & Privacy Architecture
zkDraw leverages Midnight's dual-state ledger model and ZK circuits:
- **Client-Side Witness Shielding**: Ticket numbers and 256-bit entropy salts are processed strictly as private witnesses inside the user's browser. Only opaque 32-byte commitments are published on-chain.
- **Commit-Reveal Randomness**: The lottery operator pre-commits to an entropy seed before any tickets are sold.
- **Euclidean Modulus Constraints in ZK Circuits**: The winning number is computed using Euclidean division constraints ($q \cdot \text{span} + \text{offset} == E_{31}$), making manipulation mathematically impossible.
- **Unlinkable Nullifier Prize Claims**: Winning payouts are claimed via single-use nullifiers, protecting winner identity and preventing double-claims.

---

## 4. Key Milestones & Deliverables
- **Milestone 1**: Compact Smart Contract with 5 circuits, pure crypto circuits, and 14 comprehensive Vitest tests.
- **Milestone 2**: TypeScript/Express backend with independent cryptographic verifier and REST API.
- **Milestone 3**: React 19 + TypeScript frontend with 1AM / Midnight Lace wallet integration and dark cryptographic UI.
- **Milestone 4**: CI/CD pipeline, Midnight Preprod deployment, comprehensive documentation, and launch kit.
