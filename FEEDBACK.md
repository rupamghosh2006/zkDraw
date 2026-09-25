# User Feedback & Implemented Improvements

**Navigation**:
* [Level 5 Improvements: Community Feedback Registry (First 50 Users)](#community-feedback-registry)
* [Level 6 Improvements: Launch Feedback Registry & Architectural Enhancements](#level-6-improvements)

---

## Level 5 Improvements: Community Feedback Registry (First 50 Users)
<a id="community-feedback-registry"></a>

> [!NOTE]
> **Scope & Provenance (Level 5 Feedback Iteration)**: Feedback iteration gathered from the first 50 testnet users via our official community feedback form. The issues reported during this phase directly drove the core bug fixes, wallet session persistence, and smart contract sync optimizations resolved below.

The following table records feedback gathered from testnet users via our official community feedback form (**Feedback Iteration for Level 5 from first 50 users**), the corresponding Midnight Preprod wallet address, the reported feedback, the resolving Git commit hash, and a summary of the resolution.

**Source Feedback Spreadsheet**: [zkDraw Community Feedback & Wallet Registry (Google Sheets)](https://docs.google.com/spreadsheets/d/1PrFS50fEocqKxfmoAqTiNGlTYrXJPTpeRqt-vSix-YE)  
**Pre-Launch User Wallets (First 50 Users)**: [USERS.md](USERS.md)

| Name | Preprod Address | Feedback | Git Commit Hash | What I Solved |
|:---|:---|:---|:---|:---|
| Arindam Ghosh | [`mn_addr_preprod17hhujr34dkhlv2qpzdzddvxzuwr8qt4g4wy9jle7v37jedey6glsgp3k35`](https://midnight-preprod.subscan.io/account/mn_addr_preprod17hhujr34dkhlv2qpzdzddvxzuwr8qt4g4wy9jle7v37jedey6glsgp3k35) | When I refreshed your website, my wallet was disconnected from your dApp. | [`7addd2a`](https://github.com/rupamghosh2006/zkDraw/commit/7addd2adb72a0ffb3fe207b1a206086f0c361028) | Implemented persistent wallet session storage and automatic reconnection upon browser refresh. |
| Neha Patel | [`mn_addr_preprod1pjuj0js4qsmtmtxaw8yv2cazzcr6w226z8acer6dz6vtu4cfd0rqkw7rnq`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1pjuj0js4qsmtmtxaw8yv2cazzcr6w226z8acer6dz6vtu4cfd0rqkw7rnq) | After clicking “Initialize another Lottery Draw,” I received a confirmation that the lottery was initialized with 10 tickets on Midnight Preprod. However, the lottery does not appear to have been created. | [`79d5e45`](https://github.com/rupamghosh2006/zkDraw/commit/79d5e4513a330dcfdd3e54b947a72dd329aebcd1), [`0035bf7`](https://github.com/rupamghosh2006/zkDraw/commit/0035bf7c1acd56dbd9d3847099dfde56514d9b62), [`0b0aa90`](https://github.com/rupamghosh2006/zkDraw/commit/0b0aa90177cebcbb18e6eb12f743047dbc008a5d) | Fixed contract deployment state persistence and synced newly initialized draws directly to the on-chain registry. |
| Souvik Chatterjee | [`mn_addr_preprod197sn24zkxhzpn4gqju9gdmsr23pd6yewa7sthrrlxcnpj8gx8xys3rcp9w`](https://midnight-preprod.subscan.io/account/mn_addr_preprod197sn24zkxhzpn4gqju9gdmsr23pd6yewa7sthrrlxcnpj8gx8xys3rcp9w) | I found there are some mock draws. | [`f320be2`](https://github.com/rupamghosh2006/zkDraw/commit/f320be20a30c14c92bd5649ed080c3ebe6e99984) | Removed all mock and static draws to ensure every pot displayed is 100% verified on the Midnight network. |
| Moumita Das | [`mn_addr_preprod1uz2yaj7k7jhu6tegkw904lynj48ql3gyshmpgyxalsppl2n9e8zsuyt2sl`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1uz2yaj7k7jhu6tegkw904lynj48ql3gyshmpgyxalsppl2n9e8zsuyt2sl) | Frontend transaction hash differs from the wallet hash and cannot be verified on the explorer. | [`24e8f37`](https://github.com/rupamghosh2006/zkDraw/commit/24e8f373d6a2b70e96e59d48d58684cfbfb32bc0) | Extracted and sanitized real Substrate extrinsic transaction hashes from wallet receipts for verified explorer tracking. |
| Ritwik Banerjee | [`mn_addr_preprod1tm3szh3stzamu4h28cp3nfzxv2393hfqklaz69d0z8665x0d0h4qs5t5nk`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1tm3szh3stzamu4h28cp3nfzxv2393hfqklaz69d0z8665x0d0h4qs5t5nk) | The navbar and hero section looks messy. | [`acf00ae`](https://github.com/rupamghosh2006/zkDraw/commit/acf00aec46474a2988e9239868dd47e957eef656) | Redesigned the header, brand layout, and hero component with cleaner typography and responsive alignment. |
| Debarati Mitra | [`mn_addr_preprod1jvmx3cajrs6vztl6guv3kwrdhzkzwzecmfgdep6xjmq6q3hnug4ql54gxn`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1jvmx3cajrs6vztl6guv3kwrdhzkzwzecmfgdep6xjmq6q3hnug4ql54gxn) | I found a bug: once you clear your local storage, you can purchase more than one ticket for the same draw. | [`2da7872`](https://github.com/rupamghosh2006/zkDraw/commit/2da787271fef87445b0803eaec8528dd999c5a8f) | Enforced strict one-ticket-per-participant rules via on-chain contract state verification rather than browser cache. |
| Sreya Banerjee | [`mn_addr_preprod1r04jld9ppxud9umcd5agt0jmgszqqftq568ryn0d5p2vf7e8h2qshm4e7u`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1r04jld9ppxud9umcd5agt0jmgszqqftq568ryn0d5p2vf7e8h2qshm4e7u) | All tickets are sold, but executing the draw fails with `Unauthorized: only creator can draw winner` even though I created the draw. | [`a09560e`](https://github.com/rupamghosh2006/zkDraw/commit/a09560e7b7ca920a18299a55a0ddc7aaec1cf1a2), [`2da7872`](https://github.com/rupamghosh2006/zkDraw/commit/2da787271fef87445b0803eaec8528dd999c5a8f) | Fixed creator address resolution and admin authorization key passing so legitimate creators can execute winner draws. |
| Oindrila Ghosh | [`mn_addr_preprod1mwm8k045kmhn6wr5dvmljv2gq5zj8cly673mg9t93wvpfy77kcwqu6gz5q`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1mwm8k045kmhn6wr5dvmljv2gq5zj8cly673mg9t93wvpfy77kcwqu6gz5q) | I have purchased a ticket but no real Night token was deducted. | [`4676bd5`](https://github.com/rupamghosh2006/zkDraw/commit/4676bd5c6938b3c6eb8d36476e899a17af82b17e) | Added real token deductions and on-chain transaction balancing for ticket purchases on Midnight Preprod. |
| Srijan Lahiri | [`mn_addr_preprod10rx5edcew8qg3sd24ksu3u3elkmhlzen975e8ntr5zq8dwuqgj7sx7pvqm`](https://midnight-preprod.subscan.io/account/mn_addr_preprod10rx5edcew8qg3sd24ksu3u3elkmhlzen975e8ntr5zq8dwuqgj7sx7pvqm) | Can you improve the create draw UI flow ? | [`fa8d118`](https://github.com/rupamghosh2006/zkDraw/commit/fa8d1183b8a56620d23f0253b587aa979917e171) | Rebuilt the draw creation workflow with live parameters preview, supply presets, and clear step-by-step guidance. |
---

## Level 6 Improvements: Launch Feedback Registry & Architectural Enhancements
<a id="level-6-improvements"></a>
<a id="level-6-improvements-architectural-enhancements"></a>

> [!NOTE]
> **Scope & Provenance (Level 6 Launch Feedback Iteration)**: Following product launch, 20 testnet users onboarded to evaluate zkDraw on Midnight Preprod. Out of those 20 user submissions, 10 specific feedbacks directly identified critical architectural bottlenecks and UX opportunities. The table below connects those 10 community feedbacks directly to their resolving commits, alongside our deep-dive architectural upgrades.

**Source Feedback Spreadsheet**: [zkDraw Community Feedback & Wallet Registry (Google Sheets)](https://docs.google.com/spreadsheets/d/1PrFS50fEocqKxfmoAqTiNGlTYrXJPTpeRqt-vSix-YE)  
**Launch User Registry (20 Users)**: [LAUNCH_USERS.md](LAUNCH_USERS.md)

### Level 6 Community Feedback Registry (Launch Users)

The following table records the 10 post-launch community feedback items resolved as part of our Level 6 improvements, their Midnight Preprod wallet address, the reported feedback, the resolving Git commit hash, and a summary of the resolution.

| Name | Preprod Address | Feedback | Git Commit Hash | What I Solved |
|:---|:---|:---|:---|:---|
| Riddhima Bose | [`mn_addr_preprod170kt3aqdu5kh087llt6mnxlw3lkl8h7cjqhhq64m6x5mxwhtmz7s6ut2p4`](https://midnight-preprod.subscan.io/account/mn_addr_preprod170kt3aqdu5kh087llt6mnxlw3lkl8h7cjqhhq64m6x5mxwhtmz7s6ut2p4) | The pot amount and ticket count only update when I manually refresh the page, it feels really laggy. | [`e4109e8`](https://github.com/rupamghosh2006/zkDraw/commit/e4109e85353a4e81cec73dca1a5276538e560fb2) | Replaced periodic HTTP polling with real-time bi-directional WebSocket push streaming (`/ws`) for zero-latency state broadcasts of ticket commitments, pot closures, and winner revelations. |
| Soumik Ghosh | [`mn_addr_preprod1qqllxdy2kts2w5v8s02cd0fqtvc23quejcegsun2nal6sctrp5qqk0jr4r`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1qqllxdy2kts2w5v8s02cd0fqtvc23quejcegsun2nal6sctrp5qqk0jr4r) | I bought a ticket on my laptop but when I opened the site on my phone, my receipt and numbers were gone. | [`94ef8d9`](https://github.com/rupamghosh2006/zkDraw/commit/94ef8d9245bada1a260edbd8ddd880fc26650725) | Built decentralized Pinata IPFS Vault Sync (`/api/vault/sync`), allowing users to automatically recover their ticket receipts and numbers across multiple devices via wallet authentication. |
| Aniruddha Sen | [`mn_addr_preprod1flp4ld3u7hvr42ulwp6d23fakvmxrfukf47yf0k4as0av2rgdsjq4rjaxv`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1flp4ld3u7hvr42ulwp6d23fakvmxrfukf47yf0k4as0av2rgdsjq4rjaxv) | Can you please add a dark mode? Using the site at night is really harsh on my eyes. | [`f63f0c0`](https://github.com/rupamghosh2006/zkDraw/commit/f63f0c0219eea04d8b0b1d2c88b5b0d4bb5d0089) | Built a zero-flicker Light & Midnight dual-theme engine persisted in `localStorage` and synchronized via CSS variables with an accessible navbar switcher. |
| Rupa Chakraborty | [`mn_addr_preprod180sggff3kx5f02hfjdd0tl0duxfsty8mkeg59uaa2s9w0hq0rkvslcuflh`](https://midnight-preprod.subscan.io/account/mn_addr_preprod180sggff3kx5f02hfjdd0tl0duxfsty8mkeg59uaa2s9w0hq0rkvslcuflh) | I kept getting a too many requests error while my friends and I were checking the draw at the same time. | [`e4109e8`](https://github.com/rupamghosh2006/zkDraw/commit/e4109e85353a4e81cec73dca1a5276538e560fb2) | Scaled API rate limiting tenfold from 300 to 3,000 requests per 15-minute window and centralized background indexer queries to eliminate 429 Too Many Requests errors. |
| Debosmita Paul | [`mn_addr_preprod1xcepslm667vrm2skd3zp62xvqnmwtzu6m30w9djy590knwhxxh0qsupyf2`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1xcepslm667vrm2skd3zp62xvqnmwtzu6m30w9djy590knwhxxh0qsupyf2) | I'm nervous about my secret numbers being stored somewhere on your servers where someone else could see them. | [`94ef8d9`](https://github.com/rupamghosh2006/zkDraw/commit/94ef8d9245bada1a260edbd8ddd880fc26650725) | Implemented client-side AES-256-GCM encryption using in-browser Web Crypto API; private witness salts and secrets are encrypted with a key derived from the user's wallet address before syncing. |
| Riya Naskar | [`mn_addr_preprod1huulhd09cjnzeaq4sfvp2tl320vz6hnuvamsvy540yx7huaq7ppsn02vaz`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1huulhd09cjnzeaq4sfvp2tl320vz6hnuvamsvy540yx7huaq7ppsn02vaz) | I got confused connecting my wallet, the popup didn't clearly say which extension it wanted or what network to use. | [`9628ab2`](https://github.com/rupamghosh2006/zkDraw/commit/9628ab263b7d65e0958f107d8f44ffa7da986522) | Redesigned wallet connection modal with ARIA compliance (`role="dialog"`), automatic extension detection for 1AM / Lace, network toggle, and direct install guidance. |
| Tithi Banerjee | [`mn_addr_preprod13mmz95tj6x53kpgeyxqzacdc3ewfv8zewqlf6gy0dxl4qpqcd35s35t5ez`](https://midnight-preprod.subscan.io/account/mn_addr_preprod13mmz95tj6x53kpgeyxqzacdc3ewfv8zewqlf6gy0dxl4qpqcd35s35t5ez) | My office uses shared wifi and everyone got blocked from the site at once, even though only one of us was spamming refresh. | [`e4109e8`](https://github.com/rupamghosh2006/zkDraw/commit/e4109e85353a4e81cec73dca1a5276538e560fb2) | Configured Express `trust proxy` setting to correctly resolve client IPs from `X-Forwarded-For` headers across reverse proxies and CDNs, preventing client IP collapsing on shared networks. |
| Shreya Ghosh | [`mn_addr_preprod1h6fafwl6xlshqlec7zqpu4lqzxu5taca35ee9g8mhrlfkw0xznvqswp8k3`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1h6fafwl6xlshqlec7zqpu4lqzxu5taca35ee9g8mhrlfkw0xznvqswp8k3) | The website looks completely broken on my phone, buttons overlap and text runs off the screen. | [`b79c3d2`](https://github.com/rupamghosh2006/zkDraw/commit/b79c3d2d241e4a4865adeeb287197a1781b417fd) | Standardized design system with responsive semantic CSS components (`draws-section`, `hero-container`), resolving all mobile viewport overflows and button clipping. |
| Nandini Das | [`mn_addr_preprod1jkznyldvv23gk2pulwevuau2vnwyzjualfrn08cwr9ralkhx0w6qt3xxpu`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1jkznyldvv23gk2pulwevuau2vnwyzjualfrn08cwr9ralkhx0w6qt3xxpu) | I lost my browser data and now I have no way to prove I bought a ticket or see my chosen numbers. | [`94ef8d9`](https://github.com/rupamghosh2006/zkDraw/commit/94ef8d9245bada1a260edbd8ddd880fc26650725), [`28c18fb`](https://github.com/rupamghosh2006/zkDraw/commit/28c18fb565fd0cad336ab107cb145bb9d7815470) | Integrated multi-tier backup with wallet-authenticated IPFS vault sync and air-gapped offline JSON export/import for complete local recovery after browser data loss. |
| Sohini Choudhury | [`mn_addr_preprod1pvlg77mswcxpyy82krg7umnanx7l9dehdtw7ysr7p4a3zsjzl7uqkjjj88`](https://midnight-preprod.subscan.io/account/mn_addr_preprod1pvlg77mswcxpyy82krg7umnanx7l9dehdtw7ysr7p4a3zsjzl7uqkjjj88) | The way you show my private ticket details versus what's public on the blockchain is confusing, everything looks mixed together. | [`b79c3d2`](https://github.com/rupamghosh2006/zkDraw/commit/b79c3d2d241e4a4865adeeb287197a1781b417fd), [`28c18fb`](https://github.com/rupamghosh2006/zkDraw/commit/28c18fb565fd0cad336ab107cb145bb9d7815470) | Introduced `privacy-detail-card` side-by-side explainer separating confidential witness memory from public ledger state, complete with progressive reveal toggles for sensitive 256-bit salts. |

---

### Deep-Dive: Architectural & Protocol Deliverables

---

### 1. Real-Time WebSocket Infrastructure & Rate-Limit Scaling ([`e4109e85`](https://github.com/rupamghosh2006/zkDraw/commit/e4109e85353a4e81cec73dca1a5276538e560fb2))

* **Core Impact**: Replaced periodic HTTP polling with an event-driven WebSocket pipeline (`/ws`), eliminating client latency and multiplying request throughput tenfold (from 300 to 3,000 req/15min).

* **Key Deliverables**:
  - **Zero-Latency State Broadcasts**: Bi-directional push streaming for ticket commitments, pot closures, and winner revelations across active sessions.
  - **Reverse-Proxy Client IP Resolution**: Configured Express `trust proxy` to prevent client IP collapsing across cloud load balancers and CDNs.
  - **Centralized On-Chain Worker**: Consolidated redundant indexer queries into a single 10-second backend daemon with exponential backoff and reconnect guards.

---

### 2. Decentralized Wallet-Encrypted IPFS Vault Sync ([`94ef8d92`](https://github.com/rupamghosh2006/zkDraw/commit/94ef8d9245bada1a260edbd8ddd880fc26650725))

* **Core Impact**: Enables seamless cross-device ticket receipt restoration via Pinata IPFS while preserving absolute zero-knowledge privacy through client-side encryption.

* **Key Deliverables**:
  - **Client-Side AES-256-GCM Encryption**: Private witness salts ($S_{\text{ticket}}$), chosen numbers, and player secrets are encrypted in-browser using Web Crypto before transmission. Keys are deterministically derived from the authenticated Midnight wallet address ($\text{SHA-256}$).
  - **Decentralized Pinata IPFS Storage (`/api/vault/sync`)**: Pins wallet-indexed ciphertext to IPFS for instant multi-device vault recovery without exposing witnesses to servers or nodes.
  - **Air-Gapped Cold Storage**: Integrated offline JSON export and import capabilities in the Vault UI for local disaster recovery.

---

### 3. Responsive Design System, Dual-Theming & Accessible Web3 UX ([`b79c3d2`](https://github.com/rupamghosh2006/zkDraw/commit/b79c3d2d241e4a4865adeeb287197a1781b417fd), [`f63f0c0`](https://github.com/rupamghosh2006/zkDraw/commit/f63f0c0219eea04d8b0b1d2c88b5b0d4bb5d0089), [`28c18fb`](https://github.com/rupamghosh2006/zkDraw/commit/28c18fb565fd0cad336ab107cb145bb9d7815470), [`9628ab2`](https://github.com/rupamghosh2006/zkDraw/commit/9628ab263b7d65e0958f107d8f44ffa7da986522))

* **Core Impact**: Unified design system across components, introduced a persistent Light/Midnight dual-theme engine, added progressive cryptographic receipt disclosure, and made wallet onboarding WCAG-accessible.

* **Key Deliverables**:
  - **Design System & Privacy Architecture ([`b79c3d2`](https://github.com/rupamghosh2006/zkDraw/commit/b79c3d2d241e4a4865adeeb287197a1781b417fd))**: Transitioned from fragmented inline utilities to semantic CSS components (`draws-section`, `privacy-detail-card`) with a high-contrast palette and side-by-side explainer separating confidential witness memory from public ledger state.
  - **Light & Midnight Theme Engine ([`f63f0c0`](https://github.com/rupamghosh2006/zkDraw/commit/f63f0c0219eea04d8b0b1d2c88b5b0d4bb5d0089))**: Built zero-flicker dual-theme styling synchronized across reloads via `localStorage` and `data-theme`, controlled by accessible navbar switchers.
  - **Private Vault & Interactive Verifier ([`28c18fb`](https://github.com/rupamghosh2006/zkDraw/commit/28c18fb565fd0cad336ab107cb145bb9d7815470))**: Added progressive disclosure (hide/reveal) for sensitive 256-bit salts, real-time ZK proof creation status during prize claims, and an intuitive mathematical verification studio.
  - **Accessible Wallet Connection Modal ([`9628ab2`](https://github.com/rupamghosh2006/zkDraw/commit/9628ab263b7d65e0958f107d8f44ffa7da986522))**: ARIA-compliant dialog (`role="dialog"`) with automatic extension detection (1AM / Lace), in-modal network toggling, store download fallback guidance, and device-key privacy assurances.
