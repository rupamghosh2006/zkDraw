# zkDraw: System Architecture

zkDraw is a decentralized, zero-knowledge lottery protocol designed natively for the **Midnight blockchain**. The protocol combines Compact smart contracts, client-side zero-knowledge proofs, provable Euclidean modulus arithmetic, decentralized IPFS storage, and independent cryptographic verifiers to provide mathematically fair and confidential prize draws.

---

## System Context

```mermaid
flowchart TB
    USER["Participant / Creator\n(Browser User)"]

    subgraph ClientTier ["Client Browser & Wallet Tier"]
        UI["React 19 Frontend dApp\n(Vite + TypeScript + Tailwind CSS)\nRoutes: /draws, /create, /vault, /verify"]
        WALLET["Browser Midnight Wallet\n1AM Wallet / Midnight Lace Extension\n(@midnight-ntwrk/dapp-connector-api)"]
        VAULT["Confidential Client Vault\nLocal Storage\n256-bit CSPRNG Salts & Player Keys"]
        PROVER["Midnight Proof Server\nLocal Docker Container (:6300)\nSynthesizes ZK Proofs from Witnesses"]
    end

    subgraph LedgerTier ["Midnight Blockchain Ledger Tier"]
        PREPROD["Midnight Preprod / Preview Network\nSubstrate Node & GraphQL Indexer (v4)"]
        
        subgraph CompactContract ["Compact Smart Contract (zkDraw.compact)"]
            OPEN["openLottery Circuit\nPre-commits S_draw\nConfigures Ticket Price & Capacity"]
            BUY["buyTicket Circuit\nProves Range [1..50]\nEnforces 1 Ticket / Address"]
            CLOSE["closeLottery Circuit\nAuto-Sellout / Creator Early Close\nLocks Ticket Count N"]
            DRAW["drawWinner Circuit\nDiscloses S_draw\nEuclidean Modulus: q*span + offset == E_31"]
            CLAIM["claimPrize Circuit\nPreimage Verification\nRecords Single-Use Claim Nullifier"]
            STATE["Public Ledger State\nCommitments, Nullifiers, Status, Winner"]
        end
    end

    subgraph StorageTier ["Decentralized Storage Tier"]
        PINATA["Pinata IPFS Service\nVerifiable Registry CIDs\nDistributed Immutable Metadata"]
    end

    subgraph BackendTier ["Backend & Verification Tier"]
        API["Node.js / Express & WebSocket Service\nReal-Time WS Server (/ws)\nIndependent Verification API (/api/lotteries/:id/verify)\nCentralized Indexer Sync & Testnet Escrow"]
    end

    USER -->|"Selects lucky number (1..50)"| UI
    UI -->|"Stores secret salt & player key"| VAULT
    UI -->|"Passes private witness (number, salt)"| PROVER
    WALLET <-->|"DApp Connector API"| UI
    PROVER -->|"Synthesized ZK Proof"| WALLET
    WALLET -->|"Signs & submits Substrate extrinsic"| PREPROD

    PREPROD -->|"Executes on-chain circuit"| CompactContract
    OPEN --> STATE
    BUY --> STATE
    CLOSE --> STATE
    DRAW --> STATE
    CLAIM --> STATE

    CompactContract -->|"Emits state events & extrinsic hashes"| PREPROD
    PREPROD -->|"Indexes lottery state"| API
    API <-->|"Pins & fetches contract registry JSON"| PINATA
    UI <-->|"GET /api/lotteries/:id/verify"| API
    UI <-->|"Real-Time Push Events (/ws)"| API
    UI <-->|"Fetches registry CIDs via IPFS gateway"| PINATA
```

---

## Component Responsibilities

| Component | Location | Responsibility |
|:---|:---|:---|
| **Frontend dApp** | `frontend/src/` | React 19 + TypeScript + Vite user interface providing multi-draw discovery (`/draws`), pot initialization (`/create`), confidential ticket purchasing (`/draws/:id`), local salt vault (`/my-tickets`), real-time WebSocket state client, and independent cryptographic verification (`/verify`). |
| **Wallet Connector** | `frontend/src/midnight/` | Manages 1AM and Midnight Lace extension connectivity, network toggle between Preprod and Preview, balance queries, persistent session restoration, and extrinsic signing. |
| **Compact Contract** | `contracts/zkDraw.compact` | Native Midnight zero-knowledge smart contract declaring dual-state transitions across five circuits: `openLottery`, `buyTicket`, `closeLottery`, `drawWinner`, and `claimPrize`. |
| **Proof Server** | Docker container (`:6300`) | Containerized proving service synthesizing zero-knowledge proofs from private witnesses (lucky number, entropy salt, player key, operator seed) without exposing plaintexts. |
| **Independent Verifier** | `backend/src/verification/` & `frontend/src/pages/VerifierPage.tsx` | Mathematical verification engine testing commitment validity, domain-separated entropy derivations, Euclidean division uniqueness, and range compliance. |
| **Pinata IPFS Service** | `backend/src/services/pinata.service.ts` | Decentralized storage integration pinning the contract registry (`zkdraw_contract_registry.json`) to IPFS, retrieving verified CIDs, and unpinning obsolete revisions. |
| **Backend & WS Server** | `backend/src/` | TypeScript Express REST and `ws` WebSocket service providing real-time state broadcasting, centralized 10s on-chain indexer sync, health monitoring, and independent verification endpoints. |

---

## Lottery Lifecycle & State Machine Pipeline

```mermaid
flowchart LR
    IDLE(["Uninitialized"]) -->|"openLottery(params, C_draw)"| OPEN["OPEN (State: 0)\nTicket Sales Active\nC_draw Immutably Bound"]
    
    OPEN -->|"buyTicket(C_ticket, proof)\n1 ticket per wallet\nCreator barred"| OPEN
    
    OPEN -->|"Auto: ticketCount >= maxTickets\nOR Creator early close"| CLOSED["CLOSED (State: 1)\nTicket Sales Locked\nParticipant Count N Frozen"]
    
    CLOSED -->|"drawWinner(S_draw, q)\nEuclidean Modulus: offset < span\nq * span + offset == E_31"| DRAWN["DRAWN (State: 2)\nWinning Number Published\nJackpot Unlocked"]
    
    DRAWN -->|"claimPrize(proof, Nullifier)\nPreimage matches winner\nNullifier recorded"| SETTLED["SETTLED\nJackpot Disbursed\nReplay Prevented"]
```

1. **Phase 1 (Initialization)**: Creator commits secret seed hash $C_{\text{draw}} = \mathcal{H}(\text{"zkDraw:v1:draw"} \,\|\, S_{\text{draw}})$ and configures ticket price and supply.
2. **Phase 2 (Ticket Purchasing)**: Participants submit range-proven commitments $C_{\text{ticket}}$. The contract verifies that the creator cannot purchase tickets and enforces one ticket per participant.
3. **Phase 3 (State Closure)**: The pot transitions to `CLOSED` upon reaching maximum capacity or when the creator triggers early closure.
4. **Phase 4 (Winner Draw)**: The creator reveals $S_{\text{draw}}$, which is proven against $C_{\text{draw}}$. The ZK circuit computes the winning number remainder via Euclidean division constraints.
5. **Phase 5 (Prize Claim)**: Winners prove ticket ownership and submit a single-use nullifier to claim funds without disclosing their identity.

---

## Provable Random Number Generation Pipeline

```mermaid
flowchart LR
    SEED["Creator Seed S_draw\n(256-bit CSPRNG)"] -->|"SHA-256 with domain tag"| COMMIT["Commitment C_draw\n(Published at Pot Init)"]
    
    SEED -->|"Disclosed in drawWinner circuit"| REVEAL["Reveal & Verify\nAssert H(tag || S_draw) == C_draw"]
    N_TICKETS["Locked Ticket Count N\n(Frozen at Closure)"] --> REVEAL
    
    REVEAL -->|"H(tag || S_draw || N)"| ENTROPY["Derived Entropy E\n(256-bit Output)"]
    ENTROPY -->|"slice<31>(E, 0)"| FIELD["Field Element E_31\n(248 bits < MAX_FIELD)"]
    
    FIELD -->|"Euclidean Division Theorem"| CONSTRAINTS["Arithmetic Constraints:\nq * span + offset == E_31\noffset < span"]
    
    CONSTRAINTS -->|"winningNumber = rangeMin + offset"| WINNER["Deterministic Winner\n(Unique Remainder)"]
```

- **Commitment Integrity**: $S_{\text{draw}}$ is generated and locked before any ticket is purchased.
- **Dynamic Salt Inclusion**: The locked ticket count $N$ is hashed into the entropy, preventing precomputation even if the seed were compromised.
- **Euclidean Remainder Uniqueness**: Given positive integers $E_{31}$ and $\text{span}$, the quotient $q$ and remainder $\text{offset}$ are uniquely determined ($0 \le \text{offset} < \text{span}$), preventing the operator from selecting an arbitrary winner.

---

## Confidential Ticket Commitment & Claim Pipeline

```mermaid
flowchart LR
    subgraph ClientSecret ["Client-Side Witness (Never Leaves Browser)"]
        NUM["Chosen Number\n(1 <= num <= 50)"]
        SALT["Secret Salt S_ticket\n(256-bit CSPRNG)"]
        KEY["Player Secret K_player\n(256-bit Private Key)"]
    end

    subgraph ProofGeneration ["Zero-Knowledge Proof Generation"]
        NUM --> HASH["Compute Commitment\nC = H(tag || num || S_ticket)"]
        SALT --> HASH
        HASH --> ZK_PROOF["ZK Circuit Proof:\n1. 1 <= num <= 50\n2. H(tag || num || salt) == C"]
    end

    subgraph OnChainPurchase ["Midnight Public Ledger"]
        ZK_PROOF -->|"buyTicket Extrinsic"| LEDGER["Record Commitment C\nRecord Participant Key\nIncrement ticketCount"]
    end

    subgraph PrizeClaim ["Prize Claim & Payout"]
        LEDGER --> CLAIM_CHECK["claimPrize Circuit:\n1. num == winningNumber\n2. C in ticketCommitments"]
        NUM --> CLAIM_CHECK
        SALT --> CLAIM_CHECK
        KEY --> NULLIFIER["Compute Nullifier:\nH(tag || C || K_player)"]
        CLAIM_CHECK --> NULLIFIER
        NULLIFIER -->|"Record Nullifier"| PAYOUT["Disburse Jackpot\nBlock Replay Claims"]
    end
```

---

## Real-Time WebSocket State Synchronization Pipeline

```mermaid
flowchart TD
    subgraph Browser ["Connected Browsers"]
        C1["Client 1\n(ActiveDrawsPage)"]
        C2["Client 2\n(DrawDetailPage: #0)"]
        C3["Client N\n(Auditor / Verifier)"]
    end

    subgraph WsServer ["Backend WebSocket Hub (/ws)"]
        HUB["ZkDrawWebSocketServer\nClient Registry & Topic Subscriptions"]
        PING["30s Heartbeat Monitor\nPing / Pong Keep-Alive"]
    end

    subgraph TriggerSources ["Event & Sync Triggers"]
        MUTATION["Mutations:\nbuyTicket, closeLottery, drawWinner"]
        BG_SYNC["Centralized Sync Worker\nRuns every 10s on Server"]
    end

    subgraph OnChain ["Midnight Blockchain"]
        INDEXER["GraphQL Indexer v4"]
    end

    C1 -->|"SUBSCRIBE_LOTTERIES"| HUB
    C2 -->|"SUBSCRIBE_LOTTERY (drawId: 0)"| HUB
    C3 -->|"SUBSCRIBE_LOTTERIES"| HUB

    MUTATION -->|"Immediate Event Push"| HUB
    INDEXER -->|"10s Poll (1 request total)"| BG_SYNC
    BG_SYNC -->|"State Diff Detected"| HUB

    HUB ==>|"Push: LOTTERY_UPDATED"| C1
    HUB ==>|"Push: LOTTERY_UPDATED"| C2
    HUB ==>|"Push: LOTTERIES_LIST"| C3
```

- **Zero-Polling Client Model**: Replaces client-side interval polling with bi-directional persistent WebSockets. Clients receive instant push notifications for ticket sales, pot capacity changes, and draw conclusions.
- **Centralized On-Chain Worker**: Rather than $N$ browser clients simultaneously querying the Midnight indexer or REST endpoints every few seconds, the backend executes a single query every 10 seconds and multicasts diffs across active subscriptions.
- **Cloud Scaling & Reverse Proxy Protection**: Express sets `trust proxy: 1` and uses tiered rate limiters (3,000 requests/15m read, 120/15m write, health-check exemption), resolving reverse-proxy IP collapsing and HTTP 429 errors.

---

## Key Architectural Invariants

1. **Zero Witness Exposure**: Uncommitted lucky numbers and 256-bit salts reside exclusively in client memory and local vault storage; they are never sent to backend APIs, mempools, or block explorers.
2. **Mathematical Determinism**: The winning number is generated strictly through Euclidean division constraints inside ZK circuits, preventing operator manipulation or front-running.
3. **Sybil & Replay Resistance**: On-chain participant key tracking ensures exactly one ticket per wallet address, and deterministic single-use nullifiers guarantee jackpot prizes cannot be double-claimed.
4. **Decentralized Storage Resilience**: Contract registries are pinned to IPFS via Pinata with verifiable CIDs, removing single-point-of-failure dependencies on centralized databases.
5. **Auditable Verification**: Any observer can independently execute the verification algorithm in-browser or programmatically via REST API to validate draw honesty.
6. **Real-Time Push Synchronization**: UI states reflect live on-chain and off-chain transitions in 0ms via persistent WebSockets, eliminating polling spam and client rate-limit exhaustion.
