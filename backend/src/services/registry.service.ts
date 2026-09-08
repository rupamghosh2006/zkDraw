import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const REGISTRY_FILE = path.join(DATA_DIR, 'contract-registry.json');

export interface RegisteredContract {
  id: string;
  contractAddress: string;
  network: 'preprod' | 'preview';
  name: string;
  description?: string;
  deployedAt: string;
  txHash?: string;
  adminKey: string;
  creatorAddress: string;
  drawSecretHex?: string;
  drawCommitment: string;
  ticketPrice?: string;
  rangeMin?: number;
  rangeMax?: number;
  maxTickets?: number;
}

const CANONICAL_CONTRACTS: RegisteredContract[] = [
  {
    id: 'lottery-preprod-main',
    name: 'zkDraw Preprod Confidential Pot',
    description: 'Official zkDraw Preprod testnet confidential lottery pot',
    contractAddress: '246fee4d100b2e2b6f98587e8a573e54ffc3a9d87e775a65c958a302f138e267',
    network: 'preprod',
    adminKey: 'd87e78432a5213ee311c1669d3aa2b5e842d5f800aee69c87d403bc74bba679b',
    creatorAddress: 'd87e78432a5213ee311c1669d3aa2b5e842d5f800aee69c87d403bc74bba679b',
    drawCommitment: '2f95351a0ff6f161d3a92607190651b9406cdb4b0f5b564e5ea4e422d9c6c6b9',
    drawSecretHex: '0dfcc49e9d7fe799d2c7b8266ab095efe0bf60226edafd4723324fc5a8e3ff99',
    deployedAt: '2026-09-06T06:34:54.668Z',
    ticketPrice: '1000000',
    rangeMin: 1,
    rangeMax: 50,
    maxTickets: 10,
  },
  {
    id: 'lottery-preview-main',
    name: 'zkDraw Preview Confidential Pot',
    description: 'Official zkDraw Preview testnet confidential lottery pot',
    contractAddress: 'f1667982258963752afb12360b34cbd7efcd11fa70930644c3cbf7bb8fb173ba',
    network: 'preview',
    adminKey: '495e53af5d3db0c94bde14ceb65a8e036224eb4a086a1c4e9fa2fe5e0ecbbedf',
    creatorAddress: '495e53af5d3db0c94bde14ceb65a8e036224eb4a086a1c4e9fa2fe5e0ecbbedf',
    drawCommitment: '8d2ae517d4e4a91ab5241c42ab697845fcb5473cf6031825efb806c1ae9c9e66',
    drawSecretHex: '63a5afc537996c7fed603aa49157963704ec9456d095f1410d08fa4b63baf297',
    deployedAt: '2026-09-06T06:34:54.668Z',
    ticketPrice: '1000000',
    rangeMin: 1,
    rangeMax: 50,
    maxTickets: 10,
  },
];

export class RegistryService {
  private kvUrl?: string;
  private kvToken?: string;

  constructor() {
    this.kvUrl = process.env.KV_REST_API_URL;
    this.kvToken = process.env.KV_REST_API_TOKEN;
    this.ensureDataDir();
  }

  private ensureDataDir() {
    try {
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!existsSync(REGISTRY_FILE)) {
        writeFileSync(REGISTRY_FILE, JSON.stringify(CANONICAL_CONTRACTS, null, 2), 'utf8');
      }
    } catch (e) {
      // Ignored in read-only filesystems
    }
  }

  public async getRegisteredContracts(network?: string): Promise<RegisteredContract[]> {
    let list: RegisteredContract[] = [];

    if (this.kvUrl && this.kvToken) {
      try {
        const res = await fetch(`${this.kvUrl}/get/zkdraw_contract_registry`, {
          headers: { Authorization: `Bearer ${this.kvToken}` },
        });
        if (res.ok) {
          const json = (await res.json()) as { result?: string };
          if (json.result) {
            list = JSON.parse(json.result);
          }
        }
      } catch (err) {
        console.warn('Could not read from cloud KV store, falling back to disk:', err);
      }
    }

    if (list.length === 0) {
      try {
        if (existsSync(REGISTRY_FILE)) {
          const content = readFileSync(REGISTRY_FILE, 'utf8');
          list = JSON.parse(content);
        }
      } catch (err) {
        console.warn('Could not read registry from disk:', err);
      }
    }

    if (list.length === 0) {
      list = [...CANONICAL_CONTRACTS];
    } else {
      // Guarantee canonical contracts are always present
      for (const canonical of CANONICAL_CONTRACTS) {
        if (!list.some((c) => c.id === canonical.id)) {
          list.unshift(canonical);
        }
      }
    }

    if (network) {
      return list.filter((c) => c.network === network);
    }
    return list;
  }

  public async getRegisteredContractById(id: string): Promise<RegisteredContract | null> {
    const list = await this.getRegisteredContracts();
    return list.find((c) => c.id === id) ?? null;
  }

  public async getRegisteredContractByAddress(address: string): Promise<RegisteredContract | null> {
    const cleanAddr = address.replace(/^0x/, '').toLowerCase();
    const list = await this.getRegisteredContracts();
    return list.find((c) => c.contractAddress.toLowerCase() === cleanAddr) ?? null;
  }

  public async registerContract(contract: RegisteredContract): Promise<void> {
    const cleanAddr = contract.contractAddress.replace(/^0x/, '').toLowerCase();
    const current = await this.getRegisteredContracts();
    const existingIndex = current.findIndex((c) => c.contractAddress.toLowerCase() === cleanAddr);

    let updated: RegisteredContract[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...current[existingIndex], ...contract };
    } else {
      updated = [contract, ...current];
    }

    if (this.kvUrl && this.kvToken) {
      try {
        await fetch(`${this.kvUrl}/set/zkdraw_contract_registry`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.kvToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(JSON.stringify(updated)),
        });
      } catch (err) {
        console.warn('Failed to write to cloud KV store:', err);
      }
    }

    try {
      this.ensureDataDir();
      writeFileSync(REGISTRY_FILE, JSON.stringify(updated, null, 2), 'utf8');
    } catch (err) {
      console.warn('Failed to write registry to disk:', err);
    }
  }
}

export const registryService = new RegistryService();
