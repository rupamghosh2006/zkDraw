# zkDraw — Brand Identity & Visual Design Brief

## 1. Brand Essence & Vision

**zkDraw** is the provably fair lottery built natively on the **Midnight Network**. Players pick a number that only they know. Zero-knowledge proofs keep that pick private, and every outcome stays independently verifiable onchain.

Most lotteries ask you to trust the operator. Most onchain lotteries ask you to expose your pick. zkDraw does neither: **private picks, publicly fair.**

**One-line pitch:** A lottery that keeps your pick private without asking you to trust the operator.

**Positioning:** zkDraw is a working, open-source demonstration of what confidential smart contracts make possible. It should feel like a confident, playful product — not a cryptography paper and not a casino.

**Technology identity:** Written in **Compact** (Midnight's ZK-native smart-contract language), with a **React 19 / TypeScript / Vite** frontend, a **Node.js / Express** verification backend, and proofs synthesized locally by a **Midnight Proof Server** (Docker). The brand should reflect this engineering rigour without hiding behind it.

---

## 2. Core Brand Attributes

- **Private by construction** — Chosen numbers are held as private witnesses and published only as commitments. Neither the operator, other players, nor chain observers can see a pick before or after the draw.
- **Publicly fair** — The winning number comes from an onchain commit-reveal protocol checked inside ZK circuits. Anyone can verify it. No trusted party.
- **Built-in fairness rules** — One ticket per player. The creator cannot enter their own draw. Draws close automatically on sellout.
- **Open and native** — Open-source, written in Compact, live on Midnight Preprod and Preview, connected through the 1AM and Lace wallets.
- **Playful, not predatory** — The tone is bright and inviting. It never pressures, never promises winnings, never glamorises risk.

### Messaging pillars (the four proof cards)

These four cards are the brand's core visual and verbal device. They appear in the hero, the banner, and campaign assets — always in this order.

| Card | Label | Word | Meaning |
| --- | --- | --- | --- |
| Pink | Witness | **Private** | Your pick never leaves your device in the clear |
| Indigo | Proof | **Verified** | A ZK proof shows the pick is valid |
| Green | Draw | **Fairness** | The winning number is generated and checked in-circuit |
| White | Results | **Onchain** | Anyone can audit the outcome |

---

## 3. Visual Identity & Color System

| Role | Color Name | Hex Code | Purpose & Application |
| --- | --- | --- | --- |
| **Signature** | Volt Yellow | `#F3FF2F` | Page canvas on marketing surfaces, banner background, header bar. The brand's loudest color. |
| **Ink** | Ink Black | `#0D0D0D` | Headlines, body text, primary buttons, footer and dark panels. |
| **Witness** | Ticket Pink | `#F872D2` | "Private" card, lottery balls, highlights on draw cards. |
| **Proof** | Circuit Indigo | `#6E6EFF` | "Verified" card, selected states, offset shadows behind dark panels. |
| **Fairness** | Verified Green | `#74D9A0` | "Fairness" card, success and verified states, live-status dots (`#1FBF7A` for small dots). |
| **Surface** | Paper | `#F2F1EA` | Page background for the app (Light theme), form surfaces. |
| **Surface** | White | `#FFFFFF` | "Onchain" card, inputs, pills. |

**Themes:** the app ships a **Light** and a **Midnight** (dark) theme. In Midnight, Ink becomes the canvas and Volt Yellow becomes the accent; card colors stay unchanged.

### Color rules

- Yellow is a canvas or a single accent — never body text on white.
- Pink, Indigo, and Green each belong to one pillar. Don't reuse them for unrelated meanings.
- Use Ink text on Pink, Green, and Yellow surfaces. Indigo may carry white text only at large sizes (≥ 24 px bold, ~3.9:1 contrast); use Ink for small text on Indigo.
- Cards use flat fills, a hard black outline only on the white card, and a hard offset shadow instead of a soft blur.
- Never mix two accent colors on the same card face.

### Accessibility targets

| Pairing | Contrast | WCAG level |
| --- | --- | --- |
| Ink on Yellow | 16.7:1 | AAA |
| Ink on Paper | 17.1:1 | AAA |
| Ink on Pink | 4.6:1 | AA (body) |
| Ink on Green | 7.5:1 | AA large / AAA body |
| White on Ink | 19.1:1 | AAA |
| White on Indigo | 3.9:1 | AA large only |

Minimum touch target: 44 × 44 px. All interactive elements must have visible focus rings (2 px solid Ink Black, 2 px offset).

---

## 4. Typography & Layout Principles

- **Wordmark & Headlines** — Bold, high-contrast display serif, tightly tracked (−2 % to −3 %). Headlines often split into two lines: the first roman, the second *italic* ("Private picks. / *Publicly fair.*").
- **Interface text** — Clean grotesque sans-serif (medium and bold weights), sentence case. Labels stay small and quiet.
- **Data & Crypto** — Monospace for ticket math, block numbers, contract addresses, hashes and commitments (`10 tickets × 1 tNIGHT`, `#2427315`). These are treated as trustworthy artefacts, not decoration.
- **Big numerals** — Large serif numerals (`10 tNIGHT`, `01`, `42`) are used as graphic elements, often cropped or tinted inside cards.

### Type scale (reference)

| Role | Size | Weight | Family |
| --- | --- | --- | --- |
| Display hero | 72–96 px | Black (900) | Display serif |
| Section headline | 36–48 px | Bold (700) | Display serif |
| Card label | 13–14 px | Medium (500) | Grotesque sans |
| Body / paragraph | 16 px | Regular (400) | Grotesque sans |
| Monospace data | 13–14 px | Regular (400) | Monospace |
| Step numerals | 64–80 px | Bold (700) | Display serif |

### Layout

- Left-aligned text. One big idea per surface.
- Tilted, overlapping card stacks (−9° to +8°) for hero moments; lottery balls as supporting shapes.
- Numbered steps (01, 02, 03) only for the real Create flow: **Identity → Prize pool → Winning number.**
- Live preview panel on the Create page uses an Ink panel with an Indigo offset shadow.
- Keep critical content out of the bottom-left 400 × 170 px of the X banner (profile picture area).

### Design tokens (hard numbers)

| Token | Value |
| --- | --- |
| Card border radius | 12 px |
| Card border (white card only) | 2 px solid `#0D0D0D` |
| Hard offset shadow | `4px 4px 0px #0D0D0D` |
| Hero card tilt range | −9° … +8° |
| Section max-width | 1200 px |
| Content gutter | 24 px (mobile) / 48 px (desktop) |
| Lottery ball diameter | 48 px (UI) / 96 px (hero graphic) |

### Primary navigation

**Draws · Create · Vault · Verify**

---

## 5. Iconography & Motion

### Iconography

- Use **outline-style icons** at 20–24 px, 2 px stroke, square caps. Prefer geometric shapes over realistic pictograms.
- The four pillar cards are the main illustrative system — use them instead of custom icons wherever possible.
- Lottery balls: flat circle, white centre with a bold serif numeral, colored ring matching the pillar palette. No glossy highlights or 3-D rendering.
- **Avoid**: emojis as UI icons, neon glows, gradients, 3-D rendered objects, dice/slot-machine imagery.

### Motion principles

- **Purposeful and fast.** Transitions communicate state, not decoration.
- Card stack: on-load, cards animate in staggered (60 ms apart), each rotating from 0° to its resting tilt over 300 ms (`ease-out`).
- Status dot (live draw): 1 s breathing pulse (`opacity 0.4 → 1 → 0.4`, `ease-in-out`, loop).
- Button press: 2 px downward translate + shadow collapse on `mousedown` (50 ms), reverse on release (100 ms). Mirrors the hard-shadow "press" feel of neo-brutalist UI.
- Page transitions: 200 ms fade (opacity only). No slide or scale across primary routes.
- **Respect `prefers-reduced-motion`**: disable all decorative animation; retain functional transitions (route change, modal open).

---

## 6. Voice & Copy

**Voice:** clear, confident, a little playful. Explain privacy in plain words first, cryptography second.

| Do | Don't |
| --- | --- |
| "Private picks. Publicly fair." | "Guaranteed winners" or "Get rich" |
| "Your number stays secret. The result stays checkable." | Jargon-first openers ("Groth16 zk-SNARK commitments…") |
| "Live on Midnight Preprod + Preview" | Implying real-money stakes on testnet |
| "Create a draw", "Buy a ticket", "Verify a result" | Vague verbs ("Submit", "Proceed") |
| "Your pick never leaves your device." | "We protect your privacy" (passive, untestable claim) |
| "Anyone can run the math." | "Trust us, it's fair" |

**Testnet honesty:** always label the network (Preprod / Preview) and refer to tNIGHT / tDUST as test tokens until mainnet.

**Error & empty states:** use plain language. "No draws open yet — create the first one." not "No results found." Never blame the user.

**Hashtags:** `#MidnightNetwork` `#ZK` (`#BuildInPublic` for dev updates).

---

## 7. Design Prompt (paste into any AI design tool)

```
Design for zkDraw, a zero-knowledge lottery on the Midnight Network.
Tagline: "Private picks. Publicly fair."
Tech: Compact smart contracts, React 19/TypeScript/Vite frontend,
      client-side ZK proofs via Midnight Proof Server.

Mood: bright, confident, playful, trustworthy. Neo-brutalist editorial
with flat color, hard offset shadows (4px 4px 0px #0D0D0D) and no soft
gradients or glows.

Palette:
  Volt Yellow   #F3FF2F — canvas / hero background
  Ink Black     #0D0D0D — text, borders, shadows
  Ticket Pink   #F872D2 — "Private" pillar
  Circuit Indigo #6E6EFF — "Verified" pillar
  Verified Green #74D9A0 — "Fairness" pillar
  Paper         #F2F1EA — app background (light theme)
  White         #FFFFFF — "Onchain" card, inputs

Type: heavy high-contrast display serif (900 weight), tight tracking
(-2% to -3%), roman first line and italic second line for headlines;
clean grotesque sans for UI labels (500/700 weight); monospace for
hashes, block numbers, and ticket math. Large cropped serif numerals
as graphic elements.

Signature motif: four tilted, overlapping cards (12 px radius, 2 px
hard border on white card, 4px hard offset shadow), always in this
order — Witness/Private (pink), Proof/Verified (indigo), Draw/Fairness
(green), Results/Onchain (white with black outline). Supporting shapes:
flat lottery balls (white center, colored ring, bold serif number).

Card tilt: -9° to +8°. Stagger on-load animation: 60 ms apart,
300 ms ease-out per card.

Layout: left-aligned text, generous whitespace, one focal idea per
surface. Content max-width 1200 px. 24 px mobile gutter, 48 px desktop.

X banner safe zone: bottom-left 400×170 px must remain clear (profile
picture overlap area).

Avoid: casino imagery (slot machines, dice-heavy scenes, gold coins),
neon cyberpunk, dark-mode-only looks, stock crypto visuals, soft
gradient backgrounds, 3-D rendered objects, promises of winnings,
any implication of real-money stakes on testnet.
```

---

## 8. Quick Reference

| Item | Value |
| --- | --- |
| Product | zkDraw |
| Network | Midnight (Preprod + Preview) |
| Smart-contract language | Compact |
| Frontend stack | React 19 · TypeScript · Vite · Tailwind CSS |
| Backend | Node.js / Express |
| Proof server | Midnight Proof Server (Docker `:6300`) |
| Wallets | 1AM Wallet, Midnight Lace |
| Repo | <https://github.com/rupamghosh2006/zkDraw> |
| Live app | <https://zk-draw-gamma.vercel.app> |
| X | <https://x.com/zkdraw_midnight> |
| Draw rules | 1 ticket per player · creator cannot enter · auto-close on sellout · winning range 1–50 |
| Tagline | Private picks. Publicly fair. |
| WCAG target | AA (body text), AAA for primary pairings |
