import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';
import { pinataService } from './pinata.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const REGISTRY_FILE = path.join(DATA_DIR, 'contract-registry.json');
export const PINATA_REGISTRY_NAME = 'zkdraw_contract_registry.json';

export interface RegisteredContract {
  id: string;
  contractAddress: string;
  drawId?: number;
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

export interface StorageInfo {
  type: 'pinata' | 'local';
  configured: boolean;
  cid: string | null;
  gatewayUrl: string | null;
  contractsCount: number;
}

export function isMockContract(contract: RegisteredContract): boolean {
  const dummyKey = '00'.repeat(32);
  const zeroKey = '0'.repeat(64);
  const admin = (contract.adminKey || '').toLowerCase();
  const creator = (contract.creatorAddress || '').toLowerCase();
  if (admin === dummyKey || admin === zeroKey || creator === dummyKey || creator === zeroKey) {
    return true;
  }
  return false;
}


export const CANONICAL_CONTRACTS: RegisteredContract[] = [
  {
    id: 'lottery-preprod-main',
    name: 'zkDraw Preprod Confidential Pot',
    description: 'Official zkDraw Preprod testnet confidential lottery pot',
    contractAddress: 'f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959',
    drawId: 0,
    network: 'preprod',
    adminKey: 'd87e78432a5213ee311c1669d3aa2b5e842d5f800aee69c87d403bc74bba679b',
    creatorAddress: 'mn_addr_preprod1mpl8sse22gf7uvguze5a823tt6zz6huqpthxnjragqauwja6v7ds9jt4uk',
    drawCommitment: '5276baff658ca3cfa175da42b94120fafdf6a10335c32176a9fe2448ae26bf0e',
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
    drawId: 0,
    network: 'preview',
    adminKey: '495e53af5d3db0c94bde14ceb65a8e036224eb4a086a1c4e9fa2fe5e0ecbbedf',
    creatorAddress: 'mn_addr_preview1mpl8sse22gf7uvguze5a823tt6zz6huqpthxnjragqauwja6v7ds9n490t',
    drawCommitment: '48a83c562c0e2cb59f7d1ddcd6ed8dc31fb0afc989ab2ef6a5b09682823b947f',
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
  private latestCid: string | null = null;
  private cachedList: RegisteredContract[] | null = null;
  private isInitialized = false;

  constructor() {
    this.kvUrl = process.env.KV_REST_API_URL;
    this.kvToken = process.env.KV_REST_API_TOKEN;
    this.ensureDataDir();
    // Proactively initialize in background
    this.syncFromStorage().catch((err) => {
      console.warn('[RegistryService] Background storage sync warning:', err);
    });
  }

  private ensureDataDir() {
    try {
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!existsSync(REGISTRY_FILE)) {
        this.writeDiskBackup(CANONICAL_CONTRACTS).catch(() => {});
      }
    } catch {
      // Ignored in read-only filesystems
    }
  }

  private async writeDiskBackup(data: RegisteredContract[]): Promise<void> {
    try {
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
      }
      await writeFile(REGISTRY_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn('[RegistryService] Could not write registry to disk:', err);
    }
  }

  private async readDiskBackup(): Promise<RegisteredContract[]> {
    try {
      if (existsSync(REGISTRY_FILE)) {
        const content = await readFile(REGISTRY_FILE, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[RegistryService] Could not read registry from disk:', err);
    }
    return [...CANONICAL_CONTRACTS];
  }

  public async syncFromStorage(): Promise<RegisteredContract[]> {
    let list: RegisteredContract[] = [];

    // 1. Try Pinata IPFS if configured
    if (pinataService.isConfigured()) {
      try {
        const latestPin = await pinataService.getLatestPinByName(PINATA_REGISTRY_NAME);
        if (latestPin) {
          const remoteData = await pinataService.fetchFromGateway<RegisteredContract[]>(latestPin.cid);
          if (Array.isArray(remoteData) && remoteData.length > 0) {
            list = remoteData;
            this.latestCid = latestPin.cid;
            console.log(`[RegistryService] Loaded registry from Pinata IPFS (CID: ${this.latestCid}) with ${list.length} contracts`);
          }
        } else {
          // Pinata is configured, but no registry pinned yet -> Auto-seed from existing local JSON
          console.log('[RegistryService] Pinata configured but no registry pin found. Seeding initial registry to IPFS...');
          const initialData = await this.readDiskBackup();
          const pinRes = await pinataService.pinJSON(initialData, {
            name: PINATA_REGISTRY_NAME,
            keyvalues: { initialSeed: 'true', timestamp: new Date().toISOString() },
          });
          this.latestCid = pinRes.cid;
          list = initialData;
          console.log(`[RegistryService] Seeded registry to Pinata IPFS with CID: ${this.latestCid}`);
        }
      } catch (err) {
        console.warn('[RegistryService] Failed to load/seed registry from Pinata, falling back:', err);
      }
    }

    // 2. Fallback to Cloud KV if available and Pinata didn't return data
    if (list.length === 0 && this.kvUrl && this.kvToken) {
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
        console.warn('[RegistryService] Could not read from cloud KV store, falling back to disk:', err);
      }
    }

    // 3. Fallback to local JSON disk file
    if (list.length === 0) {
      list = await this.readDiskBackup();
    }

    // Filter out mock dummy contracts
    list = list.filter((c) => !isMockContract(c));

    // Guarantee canonical contracts are always present
    for (const canonical of CANONICAL_CONTRACTS) {
      if (!list.some((c) => c.id === canonical.id)) {
        list.unshift(canonical);
      }
    }

    this.cachedList = list;
    this.isInitialized = true;
    return list;
  }

  public async getRegisteredContracts(network?: string): Promise<RegisteredContract[]> {
    let list: RegisteredContract[];

    if (this.cachedList && this.isInitialized) {
      list = this.cachedList;
    } else {
      list = await this.syncFromStorage();
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

  public async registerContract(
    contract: RegisteredContract,
    options: { backgroundSync?: boolean } = {},
  ): Promise<void> {
    const cleanAddr = contract.contractAddress.replace(/^0x/, '').toLowerCase();
    const contractDrawId = contract.drawId ?? 0;
    const current = await this.getRegisteredContracts();
    const existingIndex = current.findIndex(
      (c) =>
        c.id === contract.id ||
        (c.contractAddress.toLowerCase() === cleanAddr && (c.drawId ?? 0) === contractDrawId),
    );

    let updated: RegisteredContract[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...current[existingIndex], ...contract };
    } else {
      updated = [contract, ...current];
    }

    this.cachedList = updated;

    // 1. Asynchronous local JSON disk file backup (non-blocking)
    this.writeDiskBackup(updated).catch((err) => {
      console.warn('[RegistryService] Failed to write registry to disk backup:', err);
    });

    // If running in test environment with a mock contract, keep in-memory only
    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    if (isTest && isMockContract(contract)) {
      return;
    }

    const syncRemoteStorage = async () => {
      // 2. Primary: Pin updated registry to Pinata IPFS
      if (pinataService.isConfigured()) {
        try {
          const pinRes = await pinataService.pinJSON(updated, {
            name: PINATA_REGISTRY_NAME,
            keyvalues: {
              latestContractId: contract.id,
              network: contract.network,
              updatedAt: new Date().toISOString(),
            },
          });
          const prevCid = this.latestCid;
          this.latestCid = pinRes.cid;
          console.log(`[RegistryService] Successfully pinned registry to Pinata IPFS: CID ${this.latestCid}`);

          // Clean up obsolete pin if CID changed
          if (prevCid && prevCid !== pinRes.cid) {
            pinataService.unpin(prevCid).catch((unpinErr) => {
              console.warn(`[RegistryService] Non-critical: Failed to unpin previous CID ${prevCid}:`, unpinErr);
            });
          }
        } catch (pinErr) {
          console.warn('[RegistryService] Failed to pin updated registry to Pinata IPFS:', pinErr);
        }
      }

      // 3. Cloud KV backup
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
          console.warn('[RegistryService] Failed to write to cloud KV store:', err);
        }
      }
    };

    if (options.backgroundSync) {
      // Fire-and-forget in background to keep HTTP latency minimal (<50ms)
      syncRemoteStorage().catch((err) => {
        console.warn('[RegistryService] Background remote storage sync error:', err);
      });
    } else {
      await syncRemoteStorage();
    }
  }

  public getStorageInfo(): StorageInfo {
    const configured = pinataService.isConfigured();
    return {
      type: configured ? 'pinata' : 'local',
      configured,
      cid: this.latestCid,
      gatewayUrl: this.latestCid ? pinataService.getGatewayUrl(this.latestCid) : null,
      contractsCount: this.cachedList?.length ?? 0,
    };
  }

  public getLatestCid(): string | null {
    return this.latestCid;
  }
}

export const registryService = new RegistryService();
