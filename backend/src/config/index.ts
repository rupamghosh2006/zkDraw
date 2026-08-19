import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  network: process.env.MIDNIGHT_NETWORK ?? 'preview',
  contractAddress:
    process.env.MIDNIGHT_CONTRACT_ADDRESS ??
    '9d805bd89a06638928a7b1301bc4d731d747d4252ad7bd4cbf03b011b97d43f2',
  indexerUrl:
    process.env.MIDNIGHT_INDEXER_URL ??
    'https://indexer.preview.midnight.network/api/v4/graphql',
  nodeUrl:
    process.env.MIDNIGHT_NODE_URL ??
    'https://rpc.preview.midnight.network',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  contractsPath: path.resolve(__dirname, '../../../contracts'),
};
