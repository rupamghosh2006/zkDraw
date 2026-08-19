# zkDraw Frontend Application

A modern React 19 + TypeScript + Vite decentralized gaming interface built for the Midnight blockchain.

---

## Key Features

- **Midnight DApp Connector**: Connects seamlessly to Midnight Lace wallet extensions with fallback local simulator support.
- **Privacy-Preserving Ticket Picker**: Interactive 1-50 number picker that shields user choices in client-side memory using high-entropy salts and domain-separated ZK commitments.
- **Live Pot & Draw Dashboard**: Real-time lifecycle state visualization (`OPEN` -> `CLOSED` -> `DRAWN`).
- **Independent Cryptographic Verifier**: In-browser verification suite that validates pre-committed entropy hashes, mathematical Euclidean division offsets, and range checks.
- **Confidential Ticket Vault**: Encrypted client-side ticket vault with automated winning detection and zero-knowledge claim nullifier execution.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Build for production
npm run build
```
