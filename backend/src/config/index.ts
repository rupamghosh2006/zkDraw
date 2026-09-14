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
  adminKey?: string;
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

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  contractsPath: path.resolve(__dirname, '../../../contracts'),
  network: activeNetwork,

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
      adminKey:
        process.env.MIDNIGHT_PREVIEW_ADMIN_KEY ?? PREVIEW_DEFAULT_ADMIN_KEY,
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
      adminKey:
        process.env.MIDNIGHT_PREPROD_ADMIN_KEY ?? PREPROD_DEFAULT_ADMIN_KEY,
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

  pinata: {
    jwt: process.env.PINATA_JWT,
    apiKey: process.env.PINATA_API_KEY,
    apiSecret: process.env.PINATA_API_SECRET,
    gateway: (process.env.PINATA_GATEWAY || 'gateway.pinata.cloud').replace(/^https?:\/\//, '').replace(/\/$/, ''),
  },
};

