# zkDraw: Confidential & Provably Fair Lottery on Midnight

<div align="center">

[![zkDraw CI/CD Pipeline](https://github.com/rupamghosh2006/zkDraw/actions/workflows/ci.yml/badge.svg)](https://github.com/rupamghosh2006/zkDraw/actions/workflows/ci.yml)
![Midnight](https://img.shields.io/badge/Midnight-Preview%20%7C%20Preprod-06b6d4?style=flat&logo=blockchain&logoColor=white)
![Contracts Tests](https://img.shields.io/badge/Contracts%20Tests-14%2F14%20Passing-emerald?style=flat&logo=vitest&logoColor=white)
![Backend Tests](https://img.shields.io/badge/Backend%20Tests-18%2F18%20Passing-emerald?style=flat&logo=vitest&logoColor=white)
![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61dafb?style=flat&logo=react&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-purple.svg)

<p align="center">
  <strong>Decentralized, privacy-preserving, and mathematically provably fair lottery built natively on the Midnight blockchain using Compact smart contracts and zero-knowledge proofs.</strong>
</p>

</div>

---

## 🌟 Key Features & Cryptographic Architecture

- **Confidential Ticket Purchases**: Players select their secret lottery number ($1..50$). High-entropy salts ($256\text{-bit}$) and domain-separated ZK commitments shield user numbers from the ledger, backend, and observers.
- **Provably Fair Commit-Reveal Randomness**: The lottery operator pre-commits to an entropy seed before any tickets are sold. The winning number is generated deterministically in ZK arithmetic circuits using Compact pure circuits.
- **Euclidean Modulus Proofs**: Remainder uniqueness is mathematically enforced in ZK arithmetic circuits ($q \cdot \text{span} + \text{offset} == E_{31}$ where $\text{offset} < \text{span}$), guaranteeing the operator cannot manipulate the outcome.
- **Zero-Knowledge Prize Claims**: Winners claim prizes using unlinkable, single-use nullifiers, preventing double-claims while concealing player identity and public wallet linkage.
- **Independent Verification Suite**: In-browser and API verification engine allows any participant or observer to verify draw correctness without trusted intermediaries.

---

## 📁 Repository Structure

```
zkDraw/
├── .github/workflows/       # Automated CI/CD pipelines (Contracts, Backend, Frontend)
│   └── ci.yml
├── contracts/               # Phase 1: Midnight Compact Smart Contracts & Tests
│   ├── zkDraw.compact       # Compact smart contract (5 circuits + pure crypto)
│   ├── managed/zkDraw/      # Compiled ZK-IR, proving keys, verification keys
│   ├── scripts/             # Compilation and deployment scripts
│   ├── src/                 # TypeScript entry point
│   ├── tests/               # 14/14 Comprehensive contract & simulation tests
│   ├── package.json
│   └── tsconfig.json
├── backend/                 # Phase 2: TypeScript/Express Backend & Verifier
│   ├── src/
│   │   ├── midnight/        # Contract client & Compact pure circuits bridge
│   │   ├── verification/    # Independent cryptographic draw & ticket verifier
│   │   ├── services/        # Lottery state machine & indexing
│   │   ├── controllers/     # Health, Lottery, and Verification endpoints
│   │   ├── routes/          # Express REST API routes
│   │   ├── middleware/      # Rate limiting, validation & error handlers
│   │   └── app.ts
│   ├── tests/               # 18/18 API & Cryptographic verifier test suite
│   ├── package.json
│   └── tsconfig.json
├── frontend/                # Phase 3: React 19 + Vite + TypeScript DApp
│   ├── src/
│   │   ├── components/      # ActiveLottery, DrawManager, VerifierView, MyTickets
│   │   ├── midnight/        # Midnight Lace wallet connector & Web Crypto
│   │   ├── services/        # Backend API consumer
│   │   ├── App.tsx          # Main application container
│   │   └── styles.css       # Dark cryptographic design system
│   ├── package.json
│   └── vite.config.ts
├── docs/                    # Security, Privacy & Fairness Documentation
│   ├── privacy-model.md     # Dual-state ledger model & privacy boundaries
│   ├── fairness-model.md    # Euclidean modulus proofs & mathematical derivation
│   └── threat-model.md      # Attack surfaces & cryptographic countermeasures
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- (Optional for contract compilation) WSL Ubuntu with Compact Compiler `compactc` v0.31.1

---

### Step 1: Run Contract Tests (Phase 1)

```bash
cd contracts
npm install
npm test
```
*Passes 14/14 tests covering full lifecycle, out-of-range bounds, tampered secrets, duplicate commitments, unauthorized actions, and privacy guarantees.*

---

### Step 2: Run Backend Service (Phase 2)

```bash
cd ../backend
npm install
npm test
npm run build
npm start
```
*Runs on `http://localhost:3001` with 18/18 passing tests.*

---

### Step 3: Run Frontend DApp (Phase 3)

```bash
cd ../frontend
npm install
npm run build
npm run dev
```
*Accessible at `http://localhost:5173`.*

---

## 🔒 Privacy & Fairness Invariant Summary

1. **Confidential Numbers**: Raw ticket numbers and salts are never published to the public ledger or server logs.
2. **Deterministic Fairness**: For any committed operator seed $S$ and ticket count $N$, exactly one valid winning number exists:
   $$\text{winningNumber} = \text{rangeMin} + \Big(\text{slice}_{31}(\mathcal{H}(S, N)) \pmod{\text{rangeMax} - \text{rangeMin} + 1}\Big)$$
3. **Unlinkable Claims**: Claim nullifiers $\mathcal{H}(\text{"zkDraw:v1:claim"} \,\|\, C \,\|\, K)$ prevent double claims without exposing which public wallet purchased the winning ticket.

---

## 📄 License

MIT © [Rupam Ghosh](https://github.com/rupamghosh2006)
