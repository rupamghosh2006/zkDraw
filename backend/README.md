# zkDraw Backend Service

The zkDraw backend is a TypeScript Node.js/Express service that orchestrates lottery data, interfaces with Midnight Compact pure circuits, indexes verifiable draw events, and provides public cryptographic verification endpoints.

---

## Key Principles & Privacy Invariants

- **Zero Private Data Exposure**: The backend never receives, logs, or stores raw private lottery numbers, player secret witnesses, or wallet seeds.
- **Non-Authoritative Winning Generation**: The winning number is generated strictly through Compact's cryptographic formulas (`slice<31>(persistentHash(...)) as Field % span`). The backend cannot alter or pick a winner.
- **Independent Verification**: Exposes `/api/lotteries/:id/verify` allowing any observer or frontend client to verify draw commitments, entropy derivations, and range proofs.
- **Decentralized IPFS Storage**: Contract and lottery registry data is persisted to IPFS via **Pinata**, returning verifiable CIDs and allowing public retrieval through IPFS gateways.

---

## API Endpoints

### Health, Storage & Network
- `GET /api/health` — System status, Midnight network, deployed contract address, and Pinata IPFS storage info (CID, gateway URL).
- `GET /api/registry` — Registry of deployed lottery pots with live IPFS CID and storage metadata.

### Lotteries
- `GET /api/lotteries` — List all active and historical lotteries.
- `GET /api/lotteries/:id` — Get detailed public state of a lottery.
- `GET /api/lotteries/:id/status` — Get lightweight status (status, ticketCount, prizePool).
- `POST /api/lotteries/:id/buy-ticket` — Submit an opaque 32-byte ticket commitment.
- `POST /api/lotteries/:id/close` — Close ticket sales (transitions `OPEN` -> `CLOSED`).
- `POST /api/lotteries/:id/draw` — Reveal operator secret and compute deterministic winning number (transitions `CLOSED` -> `DRAWN`).

### Verification
- `GET /api/lotteries/:id/verify` — Independently verify that the winning number was derived correctly from the pre-committed secret and ticket count.
- `POST /api/lotteries/:id/verify-ticket` — Client-assisted ZK ticket verification verifying if a client's private ticket won without disclosing the secret number to others.

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

## Running Locally

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build TypeScript
npm run build

# Start server
npm start
```
