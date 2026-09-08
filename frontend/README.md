# zkDraw Frontend Application

A modern React 19 + TypeScript + Vite decentralized gaming interface built for the Midnight blockchain.

---

## Architecture & Page Routes

The frontend is structured into dedicated pages following the **Create → List → Enter → Resolve** lifecycle:

- **`/draws` (Active Draws)**: Dedicated multi-draw listing view showing all active draws simultaneously in a card grid with status filters, creator filtering, search, and real-time capacity progress bars.
- **`/create` (Create Draw)**: Dedicated creation route where connected wallet users configure ticket price (tDUST), number range (1–50), and total ticket supply with live on-chain preview and step-by-step proof progress.
- **`/draws/:id` (Draw Detail)**: Deep-linkable focused view for entering a draw (interactive number picker, real-time client ZK commitment synthesis) and resolving it (creator-only early closure with confirmation dialog, sellout auto-end, Euclidean provable draw, and winner prize claims).
- **`/my-tickets` (My Vault)**: Confidential client-side ticket vault with 256-bit CSPRNG salts, public commitment hashes, on-chain explorer links, and ZK claim nullifier derivation.
- **`/verify` (Fairness Verifier)**: Independent cryptographic verifier checking operator commitment match, domain-separated entropy derivation, Euclidean modulus formula, and range constraint.

---

## Core Business Rules Enforced

1. **Creator Cannot Buy Own Tickets**: If the connected wallet created the draw, the "Buy Ticket" action is disabled with clear feedback ("You created this draw and can't purchase tickets in it"). Creators can freely purchase tickets in any draw created by a different address.
2. **Strict Draw End Conditions**: A draw transitions from `OPEN` to `CLOSED` **only** when either:
   - All available tickets are sold out (`ticketCount >= maxTickets`), or
   - The creator manually ends it early via the "End Draw Early" action (with confirmation dialog).
3. **No Minimum Ticket Threshold or Time Deadlines**: Completely removed from creation and lifecycle rules. Sellout or manual creator closure are the sole triggers.


## Running Locally

```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Build for production
npm run build
```
