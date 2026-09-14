import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PinataService } from '../src/services/pinata.service.js';
import { RegistryService, PINATA_REGISTRY_NAME, type RegisteredContract } from '../src/services/registry.service.js';
import { config } from '../src/config/index.js';


describe('Pinata IPFS Service & Registry Integration', () => {
  const originalEnv = { ...process.env };
  const originalPinataConfig = { ...config.pinata };

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    config.pinata = { ...originalPinataConfig };
  });

  describe('PinataService Authentication & Configuration', () => {
    it('detects unconfigured state when no credentials provided', () => {
      config.pinata = {
        jwt: undefined,
        apiKey: undefined,
        apiSecret: undefined,
        gateway: 'gateway.pinata.cloud',
      };
      const service = new PinataService();
      expect(service.isConfigured()).toBe(false);
      expect(service.getHeaders()).toEqual({});
    });

    it('generates Bearer auth header when PINATA_JWT is provided', () => {
      config.pinata = {
        jwt: 'test-jwt-token-xyz',
        apiKey: undefined,
        apiSecret: undefined,
        gateway: 'gateway.pinata.cloud',
      };
      const service = new PinataService();
      expect(service.isConfigured()).toBe(true);
      expect(service.getHeaders()).toEqual({
        Authorization: 'Bearer test-jwt-token-xyz',
      });
    });

    it('generates API key and secret headers when key pair is provided', () => {
      config.pinata = {
        jwt: undefined,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        gateway: 'gateway.pinata.cloud',
      };
      const service = new PinataService();
      expect(service.isConfigured()).toBe(true);
      expect(service.getHeaders()).toEqual({
        pinata_api_key: 'test-api-key',
        pinata_secret_api_key: 'test-api-secret',
      });
    });
  });

  describe('PinataService IPFS Operations', () => {
    it('successfully pins JSON to IPFS via Pinata API', async () => {
      config.pinata = {
        jwt: 'mock-jwt',
        apiKey: undefined,
        apiSecret: undefined,
        gateway: 'gateway.pinata.cloud',
      };

      const mockResponse = {
        IpfsHash: 'bafkreigh2akiscaildcqabsyg3dfr6chu3fgjh35zx6vdnsam5zk22vcke',
        PinSize: 512,
        Timestamp: '2026-09-15T00:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const service = new PinataService();
      const testData = [{ id: 'test-pot-1', name: 'Test Pot' }];
      const result = await service.pinJSON(testData, { name: 'zkdraw_contract_registry.json' });

      expect(result.cid).toBe(mockResponse.IpfsHash);
      expect(result.timestamp).toBe(mockResponse.Timestamp);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('retrieves the latest pin info by name', async () => {
      config.pinata = {
        jwt: 'mock-jwt',
        apiKey: undefined,
        apiSecret: undefined,
        gateway: 'gateway.pinata.cloud',
      };

      const mockPinList = {
        count: 2,
        rows: [
          {
            ipfs_pin_hash: 'bafk-older-cid',
            date_pinned: '2026-09-10T12:00:00Z',
          },
          {
            ipfs_pin_hash: 'bafk-newer-cid',
            date_pinned: '2026-09-14T18:00:00Z',
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockPinList), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const service = new PinataService();
      const latest = await service.getLatestPinByName(PINATA_REGISTRY_NAME);

      expect(latest).not.toBeNull();
      expect(latest?.cid).toBe('bafk-newer-cid');
    });

    it('fetches JSON content via IPFS gateway', async () => {
      config.pinata = {
        jwt: 'mock-jwt',
        apiKey: undefined,
        apiSecret: undefined,
        gateway: 'custom.mypinata.cloud',
      };

      const mockPayload = [{ id: 'pot-42', name: 'Decentralized Pot' }];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const service = new PinataService();
      const data = await service.fetchFromGateway<typeof mockPayload>('bafk-sample-cid');

      expect(data).toEqual(mockPayload);
      expect(service.getGatewayUrl('bafk-sample-cid')).toBe('https://custom.mypinata.cloud/ipfs/bafk-sample-cid');
    });
  });

  describe('RegistryService Pinata Storage Flow', () => {
    it('pins to Pinata upon registerContract when configured', async () => {
      config.pinata = {
        jwt: 'mock-jwt',
        apiKey: undefined,
        apiSecret: undefined,
        gateway: 'gateway.pinata.cloud',
      };

      const pinnedCid = 'bafkrei-new-registry-cid';

      // Mock fetch:
      // 1. pinList check during sync
      // 2. pinJSON during register
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/data/pinList')) {
          return new Response(JSON.stringify({ count: 0, rows: [] }), { status: 200 });
        }
        if (urlStr.includes('/pinning/pinJSONToIPFS')) {
          return new Response(
            JSON.stringify({ IpfsHash: pinnedCid, Timestamp: new Date().toISOString() }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 200 });
      });

      const registry = new RegistryService();
      const newContract: RegisteredContract = {
        id: 'lottery-pinata-test',
        name: 'Pinata IPFS Test Pot',
        contractAddress: 'f1667982258963752afb12360b34cbd7efcd11fa70930644c3cbf7bb8fb173ba',
        drawId: 99,
        network: 'preview',
        deployedAt: new Date().toISOString(),
        adminKey: '00'.repeat(32),
        creatorAddress: '00'.repeat(32),
        drawCommitment: '11'.repeat(32),
        ticketPrice: '1000000',
        rangeMin: 1,
        rangeMax: 50,
        maxTickets: 5,
      };

      await registry.registerContract(newContract);

      const storageInfo = registry.getStorageInfo();
      expect(storageInfo.type).toBe('pinata');
      expect(storageInfo.configured).toBe(true);
      expect(storageInfo.cid).toBe(pinnedCid);
      expect(storageInfo.gatewayUrl).toContain(pinnedCid);
    });
  });

  describe('REST Endpoints with Storage Info', () => {
    const app = createApp();

    it('exposes storage metadata on GET /api/health', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.storage).toBeDefined();
      expect(typeof res.body.storage.type).toBe('string');
      expect(typeof res.body.storage.configured).toBe('boolean');
    });

    it('returns registry list and storage info on GET /api/registry', async () => {
      const res = await request(app).get('/api/registry');
      expect(res.status).toBe(200);
      expect(res.body.storage).toBeDefined();
      expect(res.body.count).toBeGreaterThan(0);
      expect(Array.isArray(res.body.contracts)).toBe(true);
    });
  });
});
