# zkDraw

<div align="center">
  <img src="assets/logo.png" alt="zkDraw Logo" width="400" />

  [![CI](https://github.com/rupamghosh2006/zkDraw/actions/workflows/ci.yml/badge.svg)](https://github.com/rupamghosh2006/zkDraw/actions/workflows/ci.yml)
  ![Midnight](https://img.shields.io/badge/Midnight-Preprod%20%7C%20Preview-06b6d4?style=flat&logo=blockchain&logoColor=white)
  ![Storage](https://img.shields.io/badge/Storage-IPFS%20via%20Pinata-a855f7?style=flat&logo=ipfs&logoColor=white)
  ![Contracts Tests](https://img.shields.io/badge/Contracts%20Tests-17%2F17%20Passing-emerald?style=flat&logo=vitest&logoColor=white)
  ![Backend Tests](https://img.shields.io/badge/Backend%20Tests-30%2F30%20Passing-emerald?style=flat&logo=vitest&logoColor=white)
  ![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61dafb?style=flat&logo=react&logoColor=white)
  [![X (Twitter)](https://img.shields.io/badge/X-@zkdraw__midnight-black?style=flat&logo=x&logoColor=white)](https://x.com/zkdraw_midnight)


  <p align="center">
    <strong>Decentralized, privacy-preserving, and mathematically provably fair lottery built natively on the Midnight blockchain using Compact smart contracts and zero-knowledge proofs.</strong>
  </p>

</div>

---

## Submission Checklist

| Requirement | Status | Evidence / Details |
|:---|:---:|:---|
| Public GitHub repository with updated documentation | Done | [rupamghosh2006/zkDraw](https://github.com/rupamghosh2006/zkDraw) with architecture diagrams, cryptographic specs, and setup instructions. |
| Live demo link | Done | [zk-draw-gamma.vercel.app](https://zk-draw-gamma.vercel.app/) hosted on Vercel. See [Live Demo](#live-demo). |
| Demo video showing full MVP functionality | Done | [Watch zkDraw MVP Demo Walkthrough](https://res.cloudinary.com/ddp0nf4uv/video/upload/v1789740395/zkDraw1_umb5eq.mp4). See [Demo Video](#demo-video). |
| Contract addresses (Preprod & Preview) | Done | Preprod [`f735bb89...`](https://explorer.1am.xyz/contract/f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959?network=preprod) and Preview [`f1667982...`](https://explorer.1am.xyz/contract/f1667982258963752afb12360b34cbd7efcd11fa70930644c3cbf7bb8fb173ba?network=preview). See [Contract Address](#contract-address). |
| List of 50 Preprod user wallet addresses (verifiable on-chain) | Done | 50 on-chain verifiable testnet addresses documented in [docs/PREPROD_WALLETS.md](docs/PREPROD_WALLETS.md). |
| Feedback documentation or link to feedback document | Done | Testnet user feedback, community evaluation, and UX analysis in [docs/FEEDBACK.md](docs/FEEDBACK.md). |
| Midnight privacy model | Done | Dual-state ledger, confidential witness commitments, and Euclidean division circuits. See [Privacy Model](#privacy-model) and [docs/privacy-model.md](docs/privacy-model.md). |
| Product overview & architecture | Done | Decentralized, zero-knowledge provably fair lottery. See [Overview](#what-this-product-does). |
| Tech stack specification | Done | Compact smart contracts, Midnight Proof Server, Express API, React 19 dApp. See [Tech Stack](#tech-stack). |
| Local setup & reproduction guide | Done | Node.js, Docker Proof Server, and step-by-step local run instructions. See [Local Setup](#setup--run-locally). |
| Automated test suites (47 passing tests) | Done | 17 Compact contract tests + 30 backend verifier tests passing. See [Testing](#run-tests). |
| CI/CD workflow with automated checks | Done | GitHub Actions [ci.yml](.github/workflows/ci.yml) compiles, tests, and builds on push and PR. See [CI/CD](#cicd). |
| Comprehensive usage guide | Done | Non-technical step-by-step user guide in [docs/USAGE.md](docs/USAGE.md). See [Usage Guide](#usage-guide). |
| Product proposal submitted for approval | Done | Complete product proposal submitted in [PROPOSAL.md](PROPOSAL.md). |
| Official Product X Profile | Done | Official announcement and community channel at [@zkdraw_midnight](https://x.com/zkdraw_midnight). See [Product X Profile](#product-x-profile). |
| Minimum 20 meaningful commits | Done | 30+ meaningful commits across contract development, test suites, cryptographic verifier, and frontend UI. |

## Live Demo
**Live DApp**: [https://zk-draw-gamma.vercel.app/](https://zk-draw-gamma.vercel.app/)

---

## Demo Video
**Watch the MVP Demo Walkthrough**: [https://res.cloudinary.com/ddp0nf4uv/video/upload/v1789740395/zkDraw1_umb5eq.mp4](https://res.cloudinary.com/ddp0nf4uv/video/upload/v1789740395/zkDraw1_umb5eq.mp4)

<div align="center">
  <video src="https://res.cloudinary.com/ddp0nf4uv/video/upload/v1789740395/zkDraw1_umb5eq.mp4" controls width="850">
    Your browser does not support the video tag.
  </video>
</div>

---

## Contract Address

### Latest Deployed Contracts (September 2026)

| Network | Contract Address | Deployment TX / Block | Explorer | Status |
|:---|:---|:---|:---|:---|
| **Preprod** | `f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959` | Extrinsic `0xa427c7...` (Block #2427315) | [**View on 1AM Preprod Explorer ↗**](https://explorer.1am.xyz/contract/f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959?network=preprod) | **LIVE & ACTIVE** |
| **Preview** | `f1667982258963752afb12360b34cbd7efcd11fa70930644c3cbf7bb8fb173ba` | Extrinsic `0xbc23aa...` (Block #742760) | [**View on 1AM Preview Explorer ↗**](https://explorer.1am.xyz/contract/f1667982258963752afb12360b34cbd7efcd11fa70930644c3cbf7bb8fb173ba?network=preview) | **LIVE & ACTIVE** |

### Previous Month Contract Addresses (August 2026)

| Network | Contract Address | Explorer | Status |
|:---|:---|:---|:---|
| **Preprod** | `9be7061e20214bc402346c86675914e0373df514a89693b4aadf660ca82579b7` | [View on 1AM Preprod Explorer ↗](https://explorer.1am.xyz/contract/9be7061e20214bc402346c86675914e0373df514a89693b4aadf660ca82579b7?network=preprod) | Archived (August 2026) |
| **Preview** | `818d55c59ca40c32cb4e4585be9b13c116db0262edaffcc2b8c418867f96361b` | [View on 1AM Explorer ↗](https://explorer.1am.xyz/contract/818d55c59ca40c32cb4e4585be9b13c116db0262edaffcc2b8c418867f96361b?network=preview) | Archived (August 2026) |

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 zkDraw — Compact Smart Contracts on Midnight Testnet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Contract Source  : ./contracts/zkDraw.compact
 Managed Bindings : ./contracts/managed/zkDraw/contract/index.js

 [Latest Deployments - September 2026]
 Preprod Contract : f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959
 Preview Contract : f1667982258963752afb12360b34cbd7efcd11fa70930644c3cbf7bb8fb173ba
 Deployed At      : 2026-09-06 (Preprod: Block #2427315 | Preview: Block #742760)

 [Previous Month Deployments - August 2026]
 Preprod Contract : 9be7061e20214bc402346c86675914e0373df514a89693b4aadf660ca82579b7
 Preview Contract : 818d55c59ca40c32cb4e4585be9b13c116db0262edaffcc2b8c418867f96361b
 Deployed At      : 2026-08-23T16:21:18.708Z

 Active Circuits  : buyTicket, drawWinner, claimPrize, closeLottery, verifyWinningTicket
 Ticket Price     : 1,000,000 tDUST  |  Range: 1–50
 Rules            : Creator inits & chooses maxTickets; Creator barred from drawing;
                    1 ticket per participant; Auto-closes on sellout
 Status           : 100% On-Chain Verifiable Dual-State Machine (Zero Mocking)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

<div align="center">
  <img src="assets/preview_deployment.png" alt="Midnight Preview Contract Deployment" width="850" />
  <img src="assets/preprod_deployment.png" alt="Midnight Preprod Contract Deployment" width="850" />
</div>

---

## What This Product Does

Traditional on-chain lotteries and raffles force players to expose their chosen numbers publicly on transparent ledgers. This exposure enables malicious actors, bots, and operators to front-run ticket entries, copy winning strategies, and profile high-stakes participants. Furthermore, Web2 lotteries rely on black-box random number generators where players have zero mathematical guarantee of fairness.

**zkDraw** solves these issues by leveraging Midnight Network's dual-state architecture and Compact zero-knowledge smart contracts. Players select their secret lucky numbers in complete privacy. High-entropy salts ($256\text{-bit}$) and domain-separated ZK commitments ensure that neither the operator, other players, nor blockchain observers can see chosen ticket numbers before or after the draw.

The winning number is generated deterministically through an on-chain commit-reveal protocol verified inside ZK arithmetic circuits using Euclidean modulus constraints. Any participant or observer can independently verify the cryptographic fairness of the draw without trusting intermediaries.

---

## Privacy Model

- **What is PUBLIC (on-chain, anyone can see)**:
  - Total jackpot prize pool and ticket price.
  - Number of confidential ticket commitments purchased.
  - 32-byte opaque ticket commitment hashes ($C_{\text{ticket}}$).
  - Operator pre-committed draw seed hash ($C_{\text{draw}}$).
  - Disclosed entropy seed and winning number ($W$) once the draw is executed.
  - Lottery status (`OPEN`, `CLOSED`, `DRAWN`).

- **What is PRIVATE (private witness, never on-chain)**:
  - The player's actual chosen lottery number ($1..50$).
  - The player's secret 256-bit salt ($S_{\text{ticket}}$).
  - The player's private claim key / player secret ($K_{\text{player}}$).
  - Operator draw secret ($S_{\text{draw}}$) while ticket sales are active.

- **What the user PROVES without revealing**:
  - **At Ticket Purchase**: The player proves that their chosen number falls within the valid range ($1 \le \text{num} \le 50$) and matches the published 32-byte commitment hash, without disclosing the number.
  - **At Draw Execution**: The operator proves that the revealed seed matches the initial on-chain commitment and that the winning number satisfies Euclidean division constraints ($q \cdot \text{span} + \text{offset} == E_{31}$ where $\text{offset} < \text{span}$).
  - **At Prize Claim**: The winner proves knowledge of the winning ticket preimage and computes an unlinkable claim nullifier without revealing their identity or linking multiple wins.

---

## Tech Stack

- **Smart Contracts**: Compact (`.compact`), Compact Pure Circuits, Compact Runtime (`@midnight-ntwrk/compact-runtime`)
- **Zero-Knowledge Infrastructure**: Midnight Docker Proof Server (`midnightntwrk/proof-server`), Proving & Verification Keys
- **Blockchain & Network**: Midnight Preprod Testnet, Substrate Extrinsics, Midnight Indexer (GraphQL v4), Polkadot API
- **Wallets & Connectors**: 1AM Wallet, Midnight Lace Wallet, `@midnight-ntwrk/dapp-connector-api`
- **Decentralized Storage**: IPFS via Pinata (`pinJSONToIPFS`, IPFS Gateways, verifiable CIDs)
- **Backend API**: Node.js, Express, TypeScript, Vitest, Web Crypto
- **Frontend dApp**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`)


---

## Prerequisites

- **Node.js**: v20.x or v22.x LTS
- **Docker Desktop**: Required to run the local Midnight ZK Proof Server container
- **Midnight Wallet**: **1AM Wallet** (Chrome/Brave Extension) or **Midnight Lace Wallet** with Preprod tNIGHT and tDUST tokens

---

## Setup & Run Locally

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/rupamghosh2006/zkDraw.git
cd zkDraw
npm install
cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Start the Midnight Proof Server (Docker)
```bash
docker run -d -p 6300:6300 --name zkdraw-proof-server midnightntwrk/proof-server:latest
```

### 3. Compile the Compact Contract
```bash
cd contracts
npm run compile
cd ..
```

### 4. Start Backend API Server
```bash
cd backend
npm run dev
```

### 5. Start Frontend DApp
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Run Tests

### Run Contract Test Suite (17 Tests)
```bash
cd contracts
npm test
```
<div align="center">
  <img src="assets/contracts_test_passsing.png" alt="Contracts Tests 17/17 Passing" width="850" />
</div>

### Run Backend & Cryptographic Verifier Tests (21 Tests)
```bash
cd backend
npm test
```
<div align="center">
  <img src="assets/backend_test_passing.png" alt="Backend Tests 18/18 Passing" width="850" />
</div>

### Frontend Build & Typecheck
```bash
cd frontend
npm run build
```
<div align="center">
  <img src="assets/frontend_test_passing.png" alt="Frontend Build Passing" width="850" />
</div>

---

## CI/CD

Continuous Integration is configured via GitHub Actions in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
On every push and pull request to `main`, the workflow automatically:
1. Installs dependencies across contracts, backend, and frontend.
2. Compiles the Compact smart contract.
3. Runs the full Vitest contract test suite.
4. Runs the backend verifier test suite.
5. Builds the frontend with TypeScript checks (`npm run build`).

<div align="center">
  <img src="assets/ci-cd_passing.png" alt="GitHub Actions CI/CD Passing" width="850" />
</div>

---

## Usage Guide
See [docs/USAGE.md](docs/USAGE.md) for a comprehensive, non-technical step-by-step user guide.

---

## Product X Profile
**Official X (formerly Twitter)**: [@zkdraw_midnight](https://x.com/zkdraw_midnight)
