# User Feedback & Implemented Improvements

The following table records feedback gathered from testnet users via our official community feedback form, the corresponding Midnight Preprod wallet address, the reported feedback, the resolving Git commit hash, and a summary of the resolution.

**Source Feedback Spreadsheet**: [zkDraw Community Feedback & Wallet Registry (Google Sheets)](https://docs.google.com/spreadsheets/d/1PaUF4nVu9ry0n9u1R3Gz_hKqQ7Qs76mjG-tgGFE9-Y4/edit?usp=sharing)

| Name | Preprod Address | Feedback | Git Commit Hash | What I Solved |
|:---|:---|:---|:---|:---|
| Arindam Ghosh | `mn_addr_preprod17hhujr34dkhlv2qpzdzddvxzuwr8qt4g4wy9jle7v37jedey6glsgp3k35` | When I refreshed your website, my wallet was disconnected from your dApp. | [`7addd2a`](https://github.com/rupamghosh2006/zkDraw/commit/7addd2adb72a0ffb3fe207b1a206086f0c361028) | Implemented persistent wallet session storage and automatic reconnection upon browser refresh. |
| Neha Patel | `mn_addr_preprod1pjuj0js4qsmtmtxaw8yv2cazzcr6w226z8acer6dz6vtu4cfd0rqkw7rnq` | After clicking “Initialize another Lottery Draw,” I received a confirmation that the lottery was initialized with 10 tickets on Midnight Preprod. However, the lottery does not appear to have been created. | [`79d5e45`](https://github.com/rupamghosh2006/zkDraw/commit/79d5e4513a330dcfdd3e54b947a72dd329aebcd1), [`0035bf7`](https://github.com/rupamghosh2006/zkDraw/commit/0035bf7c1acd56dbd9d3847099dfde56514d9b62), [`0b0aa90`](https://github.com/rupamghosh2006/zkDraw/commit/0b0aa90177cebcbb18e6eb12f743047dbc008a5d) | Fixed contract deployment state persistence and synced newly initialized draws directly to the on-chain registry. |
| Souvik Chatterjee | `mn_addr_preprod197sn24zkxhzpn4gqju9gdmsr23pd6yewa7sthrrlxcnpj8gx8xys3rcp9w` | I found there are some mock draws. | [`f320be2`](https://github.com/rupamghosh2006/zkDraw/commit/f320be20a30c14c92bd5649ed080c3ebe6e99984) | Removed all mock and static draws to ensure every pot displayed is 100% verified on the Midnight network. |
| Moumita Das | `mn_addr_preprod1uz2yaj7k7jhu6tegkw904lynj48ql3gyshmpgyxalsppl2n9e8zsuyt2sl` | Frontend transaction hash differs from the wallet hash and cannot be verified on the explorer. | [`24e8f37`](https://github.com/rupamghosh2006/zkDraw/commit/24e8f373d6a2b70e96e59d48d58684cfbfb32bc0) | Extracted and sanitized real Substrate extrinsic transaction hashes from wallet receipts for verified explorer tracking. |
| Ritwik Banerjee | `mn_addr_preprod1tm3szh3stzamu4h28cp3nfzxv2393hfqklaz69d0z8665x0d0h4qs5t5nk` | The navbar and hero section looks messy. | [`acf00ae`](https://github.com/rupamghosh2006/zkDraw/commit/acf00aec46474a2988e9239868dd47e957eef656) | Redesigned the header, brand layout, and hero component with cleaner typography and responsive alignment. |
| Debarati Mitra | `mn_addr_preprod1jvmx3cajrs6vztl6guv3kwrdhzkzwzecmfgdep6xjmq6q3hnug4ql54gxn` | I found a bug: once you clear your local storage, you can purchase more than one ticket for the same draw. | [`2da7872`](https://github.com/rupamghosh2006/zkDraw/commit/2da787271fef87445b0803eaec8528dd999c5a8f) | Enforced strict one-ticket-per-participant rules via on-chain contract state verification rather than browser cache. |
| Sreya Banerjee | `mn_addr_preprod1r04jld9ppxud9umcd5agt0jmgszqqftq568ryn0d5p2vf7e8h2qshm4e7u` | All tickets are sold, but executing the draw fails with `Unauthorized: only creator can draw winner` even though I created the draw. | [`a09560e`](https://github.com/rupamghosh2006/zkDraw/commit/a09560e7b7ca920a18299a55a0ddc7aaec1cf1a2), [`2da7872`](https://github.com/rupamghosh2006/zkDraw/commit/2da787271fef87445b0803eaec8528dd999c5a8f) | Fixed creator address resolution and admin authorization key passing so legitimate creators can execute winner draws. |
| Oindrila Ghosh | `mn_addr_preprod1mwm8k045kmhn6wr5dvmljv2gq5zj8cly673mg9t93wvpfy77kcwqu6gz5q` | I have purchased a ticket but no real Night token was deducted. | [`4676bd5`](https://github.com/rupamghosh2006/zkDraw/commit/4676bd5c6938b3c6eb8d36476e899a17af82b17e) | Added real token deductions and on-chain transaction balancing for ticket purchases on Midnight Preprod. |
| Srijan Lahiri | `mn_addr_preprod10rx5edcew8qg3sd24ksu3u3elkmhlzen975e8ntr5zq8dwuqgj7sx7pvqm` | Can you improve the create draw UI flow ? | [`fa8d118`](https://github.com/rupamghosh2006/zkDraw/commit/fa8d1183b8a56620d23f0253b587aa979917e171) | Rebuilt the draw creation workflow with live parameters preview, supply presets, and clear step-by-step guidance. |
---

## Level 6 Improvements

### Real-Time WebSocket Architecture & Backend Rate-Limit Scaling ([`e4109e85353a4e81cec73dca1a5276538e560fb2`](https://github.com/rupamghosh2006/zkDraw/commit/e4109e85353a4e81cec73dca1a5276538e560fb2))

Resolves user feedback regarding HTTP 429 (`"Too many requests, please try again later."`) rate limiting and migrates the protocol to a high-throughput, event-driven WebSocket architecture:

1. **Bi-Directional WebSocket Synchronization (`/ws`)**:
   - Implemented native `ws` WebSocket server attached to the primary Node HTTP server on path `/ws` (sharing port `3001`).
   - Replaced frontend interval polling (3.5s interval) with real-time push notifications (`LOTTERY_UPDATED`, `LOTTERIES_LIST`).
   - UI reflects ticket purchases, pot closures, and revealed winning numbers in 0ms without page reloads.

2. **Reverse-Proxy IP Collapsing Resolution**:
   - Configured `app.set('trust proxy', config.trustProxy ?? 1)` in Express so cloud load balancers (Render, Railway, Fly, Nginx, Cloudflare) forward client IP addresses via `X-Forwarded-For` instead of grouping all global visitors under a single internal proxy IP.

3. **Production Rate-Limit Hardening & Health Exemption**:
   - Increased read request quota tenfold from 300 to 3,000 requests per 15 minutes (`RATE_LIMIT_MAX`).
   - Exempted health check probes (`/api/health`) and `OPTIONS` preflight requests from consuming rate limit tokens.
   - Added environment configuration options: `TRUST_PROXY`, `RATE_LIMIT_MAX`, `RATE_LIMIT_MAX_WRITE`, and `RATE_LIMIT_WINDOW_MS`.

4. **Centralized Background On-Chain Sync**:
   - Replaced redundant client polling against the Midnight indexer with a single centralized server-side sync worker running every 10 seconds, multicasting state diffs across active subscriptions.

5. **Client Resilience & Backoff Guards**:
   - Implemented `wsClient` with automatic reconnection and exponential backoff (1s to 15s).
   - Added a 60s fallback poll that only activates if WebSockets disconnect and the browser tab is active.
   - Implemented HTTP 429 cooldown backoff in `api.ts` to prevent cascading retry loops.
