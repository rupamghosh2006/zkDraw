import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type MidnightNetwork = 'preprod' | 'preview';

export interface NetworkConfig {
  network: MidnightNetwork;
  contractAddress: string;
  indexerUrl: string;
  nodeUrl: string;
  nodeWsUrl: string;
  adminKey?: string;
  escrowAddress: string;
  escrowMnemonic: string;
}

const PREVIEW_DEFAULT_CONTRACT =
  'f1667982258963752afb12360b34cbd7efcd11fa70930644c3cbf7bb8fb173ba';
const PREVIEW_DEFAULT_INDEXER =
  'https://indexer.preview.midnight.network/api/v4/graphql';
const PREVIEW_DEFAULT_NODE =
  'https://rpc.preview.midnight.network';
const PREVIEW_DEFAULT_ADMIN_KEY =
  '495e53af5d3db0c94bde14ceb65a8e036224eb4a086a1c4e9fa2fe5e0ecbbedf';

const PREPROD_DEFAULT_CONTRACT =
  'f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959';
const PREPROD_DEFAULT_INDEXER =
  'https://indexer.preprod.midnight.network/api/v4/graphql';
const PREPROD_DEFAULT_NODE =
  'https://rpc.preprod.midnight.network';
const PREPROD_DEFAULT_ADMIN_KEY =
  'd87e78432a5213ee311c1669d3aa2b5e842d5f800aee69c87d403bc74bba679b';

const activeNetwork = (process.env.MIDNIGHT_NETWORK ?? 'preview') as MidnightNetwork;

// Claim window in ms: how long winners have to submit claims before pot is split/settled
export const ESCROW_CLAIM_WINDOW_MS = Number(process.env.ESCROW_CLAIM_WINDOW_MS ?? 300_000);

const parseTrustProxy = (val: string | undefined): boolean | number | string => {
  if (!val) return 1; // Default to 1 (first proxy hop e.g. Render/Railway/Fly/Nginx/Cloudflare)
  if (val === 'true') return true;
  if (val === 'false') return false;
  const num = Number(val);
  return isNaN(num) ? val : num;
};

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  contractsPath: path.resolve(__dirname, '../../../contracts'),
  network: activeNetwork,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
    maxRead: Number(process.env.RATE_LIMIT_MAX ?? 3000),
    maxWrite: Number(process.env.RATE_LIMIT_MAX_WRITE ?? 120),
  },

  networks: {
    preview: {
      network: 'preview' as const,
      contractAddress:
        process.env.MIDNIGHT_PREVIEW_CONTRACT_ADDRESS ??
        (activeNetwork === 'preview' ? process.env.MIDNIGHT_CONTRACT_ADDRESS : undefined) ??
        PREVIEW_DEFAULT_CONTRACT,
      indexerUrl:
        process.env.MIDNIGHT_PREVIEW_INDEXER_URL ??
        (activeNetwork === 'preview' ? process.env.MIDNIGHT_INDEXER_URL : undefined) ??
        PREVIEW_DEFAULT_INDEXER,
      nodeUrl:
        process.env.MIDNIGHT_PREVIEW_NODE_URL ??
        (activeNetwork === 'preview' ? process.env.MIDNIGHT_NODE_URL : undefined) ??
        PREVIEW_DEFAULT_NODE,
      nodeWsUrl:
        process.env.MIDNIGHT_PREVIEW_NODE_WS ?? 'wss://rpc.preview.midnight.network',
      adminKey:
        process.env.MIDNIGHT_PREVIEW_ADMIN_KEY ?? PREVIEW_DEFAULT_ADMIN_KEY,
      escrowAddress:
        process.env.ESCROW_PREVIEW_ADDRESS ?? '',
      escrowMnemonic:
        process.env.ESCROW_PREVIEW_MNEMONIC ?? '',
    },
    preprod: {
      network: 'preprod' as const,
      contractAddress:
        process.env.MIDNIGHT_PREPROD_CONTRACT_ADDRESS ??
        (activeNetwork === 'preprod' ? process.env.MIDNIGHT_CONTRACT_ADDRESS : undefined) ??
        PREPROD_DEFAULT_CONTRACT,
      indexerUrl:
        process.env.MIDNIGHT_PREPROD_INDEXER_URL ??
        (activeNetwork === 'preprod' ? process.env.MIDNIGHT_INDEXER_URL : undefined) ??
        PREPROD_DEFAULT_INDEXER,
      nodeUrl:
        process.env.MIDNIGHT_PREPROD_NODE_URL ??
        (activeNetwork === 'preprod' ? process.env.MIDNIGHT_NODE_URL : undefined) ??
        PREPROD_DEFAULT_NODE,
      nodeWsUrl:
        process.env.MIDNIGHT_PREPROD_NODE_WS ?? 'wss://rpc.preprod.midnight.network',
      adminKey:
        process.env.MIDNIGHT_PREPROD_ADMIN_KEY ?? PREPROD_DEFAULT_ADMIN_KEY,
      escrowAddress:
        process.env.ESCROW_PREPROD_ADDRESS ?? '',
      escrowMnemonic:
        process.env.ESCROW_PREPROD_MNEMONIC ?? '',
    },
  },

  get contractAddress(): string {
    return this.networks[this.network]?.contractAddress ?? PREVIEW_DEFAULT_CONTRACT;
  },
  get indexerUrl(): string {
    return this.networks[this.network]?.indexerUrl ?? PREVIEW_DEFAULT_INDEXER;
  },
  get nodeUrl(): string {
    return this.networks[this.network]?.nodeUrl ?? PREVIEW_DEFAULT_NODE;
  },
  get escrowAddress(): string {
    return this.networks[this.network]?.escrowAddress ?? '';
  },
  get escrowMnemonic(): string {
    return this.networks[this.network]?.escrowMnemonic ?? '';
  },

  pinata: {
    jwt: process.env.PINATA_JWT,
    apiKey: process.env.PINATA_API_KEY,
    apiSecret: process.env.PINATA_API_SECRET,
    gateway: (process.env.PINATA_GATEWAY || 'gateway.pinata.cloud').replace(/^https?:\/\//, '').replace(/\/$/, ''),
  },
};
