# zkDraw Backend Service

The zkDraw backend is a TypeScript Node.js/Express service that orchestrates lottery data, interfaces with Midnight Compact pure circuits, indexes verifiable draw events, provides public cryptographic verification endpoints, and powers real-time state synchronization over **WebSockets**.

---

## Key Principles & Privacy Invariants

- **Zero Private Data Exposure**: The backend never receives, logs, or stores raw private lottery numbers, player secret witnesses, or wallet seeds.
- **Non-Authoritative Winning Generation**: The winning number is generated strictly through Compact's cryptographic formulas (`slice<31>(persistentHash(...)) as Field % span`). The backend cannot alter or pick a winner.
- **Independent Verification**: Exposes `/api/lotteries/:id/verify` allowing any observer or frontend client to verify draw commitments, entropy derivations, and range proofs.
- **Decentralized IPFS Storage**: Contract and lottery registry data is persisted to IPFS via **Pinata**, returning verifiable CIDs and allowing public retrieval through IPFS gateways.
- **Real-Time WebSocket Sync**: Broadcasts instant push notifications (`LOTTERY_UPDATED`, `LOTTERIES_LIST`) to connected clients, completely eliminating client HTTP polling.

---

## Real-Time WebSocket Architecture

The backend includes a high-performance, event-driven WebSocket server (`ws`) listening on `/ws` that shares the primary Node HTTP server port (default `3001`).

### WebSocket Endpoint
```
ws://localhost:3001/ws         (Local development)
wss://zkdraw.onrender.com/ws   (Production / Render PaaS)
```

### Client → Server Messages

| Message Type | Payload | Description |
|:---|:---|:---|
| `SUBSCRIBE_LOTTERIES` | `{ "network": "preprod" \| "preview" }` | Subscribes to live updates across all active lotteries for the chosen network. Immediately returns `LOTTERIES_LIST`. |
| `UNSUBSCRIBE_LOTTERIES` | None | Unsubscribes from global lottery updates. |
| `SUBSCRIBE_LOTTERY` | `{ "lotteryId": "<id>" }` | Subscribes to real-time events for a specific lottery draw. Immediately returns current `LOTTERY_UPDATED`. |
| `UNSUBSCRIBE_LOTTERY` | `{ "lotteryId": "<id>" }` | Unsubscribes from specific lottery events. |
| `PING` | None | Client heartbeat ping. Server replies with `{ "type": "PONG" }`. |

### Server → Client Push Events

| Event Type | Payload | Trigger |
|:---|:---|:---|
| `CONNECTED` | `{ "clientId": "<uuid>" }` | Emitted immediately upon successful socket connection. |
| `PONG` | None | Heartbeat acknowledgement. |
| `LOTTERIES_LIST` | `{ "network": "...", "lotteries": [...] }` | Emitted upon subscription with the full fresh list of lotteries. |
| `LOTTERY_UPDATED` | `{ "lottery": { ... } }` | Emitted instantly when a ticket is purchased, sales close, draw winner is derived, or a new draw is created. |

### Centralized On-Chain Background Sync
Instead of multiple frontend clients polling the Midnight blockchain indexer independently, the backend runs a single, centralized background sync worker (`startBackgroundSync(10_000)`) every 10 seconds. When state transitions occur on-chain (ticket purchases or draw finalization), the backend automatically fans out push updates to all connected WebSocket clients.

---

## API Endpoints

### Health, Storage & Network
- `GET /api/health` — System status, active network, deployed contract address, and Pinata IPFS storage info (CID, gateway URL). *Exempt from rate limits.*
- `GET /api/networks` — Network configurations for Preview and Preprod testnets.
- `GET /api/registry` — Registry of deployed lottery pots with live IPFS CID and storage metadata.

### Lotteries
- `GET /api/lotteries` — List all active and historical lotteries (in-memory cached with 10s TTL).
- `GET /api/lotteries/:id` — Get detailed public state of a lottery.
- `GET /api/lotteries/:id/status` — Get lightweight status (`status`, `ticketCount`, `prizePool`).
- `POST /api/lotteries` — Initialize a new lottery pot with custom ticket supply and price.
- `POST /api/lotteries/deploy` — Deploy a new on-chain zkDraw contract instance.
- `POST /api/lotteries/:id/buy-ticket` — Submit an opaque 32-byte ticket commitment and participant key.
- `POST /api/lotteries/:id/close` — Close ticket sales (transitions `OPEN` -> `CLOSED`).
- `POST /api/lotteries/:id/draw` — Reveal operator secret and compute deterministic winning number (transitions `CLOSED` -> `DRAWN`).

### Verification
- `GET /api/lotteries/:id/verify` — Independently verify that the winning number was derived correctly from the pre-committed secret and ticket count.
- `POST /api/lotteries/:id/verify-ticket` — Client-assisted ZK ticket verification verifying if a client's private ticket won without disclosing the secret number to others.

### Escrow Treasury
- `GET /api/escrow/vault-address` — Returns the testnet escrow vault address.
- `GET /api/escrow/:contractAddress/:drawId` — Query pot balance, payout status, and winner claims.
- `POST /api/escrow/:contractAddress/:drawId/claim` — Register a winning claim nullifier and trigger tNIGHT jackpot disbursement.

---

## Reverse Proxy Support & Scalable Rate Limiting

The backend is hardened for cloud deployments (Render, Railway, Fly.io, Cloudflare, Nginx):

```bash
# Reverse Proxy Trust (1 = trust first proxy hop on Render/Railway/Cloudflare)
TRUST_PROXY=1

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000   # 15 minutes window
RATE_LIMIT_MAX=3000           # 3,000 read requests per 15 min per IP (~200 req/min)
RATE_LIMIT_MAX_WRITE=120      # 120 mutating requests (POST) per 15 min per IP
```

- **Reverse Proxy IP Resolution**: Express is configured with `app.set('trust proxy', config.trustProxy)`, preventing cloud load balancers from collapsing all users into a single shared IP address.
- **Tiered Limiters**: Read requests (`GET`) enjoy a generous quota of 3,000 requests / 15 min, while write requests (`POST`) are protected with strict abuse limits.
- **Health Check Exemption**: Monitoring tools and frontend health probes (`/api/health`) are fully exempt from rate limits.
- **Client 429 Backoff**: Standard `Retry-After` headers are provided on HTTP 429, and the frontend automatically pauses requests during cooldowns.

---

## Decentralized IPFS Storage (Pinata)

The contract registry is pinned to IPFS via Pinata.

Configure in `.env`:
```bash
PINATA_JWT=your_pinata_jwt_token
# or
PINATA_API_KEY=your_api_key
PINATA_API_SECRET=your_api_secret
PINATA_GATEWAY=gateway.pinata.cloud
```
When configured:
- Registry updates are pinned to IPFS via `pinJSONToIPFS` (`zkdraw_contract_registry.json`).
- Reads query the latest pinned CID via Pinata's `pinList` and gateway API.
- Previous obsolete CIDs are unpinned to prevent duplicate storage bloat.
- Local JSON disk cache acts as an offline fallback.

---

## Running Locally & Testing

```bash
# Install dependencies
npm install

# Run automated test suite (35 passing tests)
npm test

# Build TypeScript
npm run build

# Start server
npm start
```
