import { config } from '../config/index.js';

export interface PinataPinMetadata {
  name?: string;
  keyvalues?: Record<string, string>;
}

export interface PinResult {
  cid: string;
  timestamp: string;
}

export interface LatestPinInfo {
  cid: string;
  datePinned: string;
}

export class PinataService {
  private apiBase = 'https://api.pinata.cloud';

  public isConfigured(): boolean {
    const { jwt, apiKey, apiSecret } = config.pinata;
    return Boolean(jwt || (apiKey && apiSecret));
  }

  public getHeaders(): Record<string, string> {
    const { jwt, apiKey, apiSecret } = config.pinata;
    if (jwt) {
      return {
        Authorization: `Bearer ${jwt}`,
      };
    }
    if (apiKey && apiSecret) {
      return {
        pinata_api_key: apiKey,
        pinata_secret_api_key: apiSecret,
      };
    }
    return {};
  }

  public async testAuthentication(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.apiBase}/data/testAuthentication`, {
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch (err) {
      console.warn('[PinataService] Authentication test failed:', err);
      return false;
    }
  }

  public async pinJSON<T>(
    content: T,
    metadata?: PinataPinMetadata,
  ): Promise<PinResult> {
    if (!this.isConfigured()) {
      throw new Error('Pinata credentials are not configured. Set PINATA_JWT or PINATA_API_KEY/PINATA_API_SECRET.');
    }

    const payload = {
      pinataContent: content,
      pinataMetadata: {
        name: metadata?.name || 'zkdraw_contract_registry.json',
        keyvalues: {
          app: 'zkdraw',
          ...metadata?.keyvalues,
        },
      },
      pinataOptions: {
        cidVersion: 1,
      },
    };

    const res = await fetch(`${this.apiBase}/pinning/pinJSONToIPFS`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to pin JSON to Pinata (${res.status}): ${errorText}`);
    }

    const json = (await res.json()) as { IpfsHash: string; Timestamp: string };
    return {
      cid: json.IpfsHash,
      timestamp: json.Timestamp,
    };
  }

  public async getLatestPinByName(name: string): Promise<LatestPinInfo | null> {
    if (!this.isConfigured()) return null;

    try {
      const url = `${this.apiBase}/data/pinList?metadata[name]=${encodeURIComponent(name)}&status=pinned&pageLimit=10`;
      const res = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        console.warn(`[PinataService] pinList returned HTTP ${res.status}`);
        return null;
      }

      const data = (await res.json()) as {
        count?: number;
        rows?: Array<{
          ipfs_pin_hash: string;
          date_pinned: string;
        }>;
      };

      if (!data.rows || data.rows.length === 0) {
        return null;
      }

      // Sort by date_pinned descending to ensure newest pin
      const sorted = [...data.rows].sort(
        (a, b) => new Date(b.date_pinned).getTime() - new Date(a.date_pinned).getTime(),
      );

      const newest = sorted[0];
      return {
        cid: newest.ipfs_pin_hash,
        datePinned: newest.date_pinned,
      };
    } catch (err) {
      console.warn(`[PinataService] Failed to query latest pin for "${name}":`, err);
      return null;
    }
  }

  public async fetchFromGateway<T>(cid: string, timeoutMs: number = 8000): Promise<T> {
    const cleanCid = cid.trim().replace(/^ipfs:\/\//, '');
    const gateways = [
      `https://${config.pinata.gateway}/ipfs/${cleanCid}`,
      `https://gateway.pinata.cloud/ipfs/${cleanCid}`,
      `https://ipfs.io/ipfs/${cleanCid}`,
      `https://cloudflare-ipfs.com/ipfs/${cleanCid}`,
    ];

    // Remove duplicates
    const uniqueGateways = Array.from(new Set(gateways));

    const fetchGateway = async (gwUrl: string): Promise<T> => {
      const res = await fetch(gwUrl, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: 'application/json',
        },
      });
      if (!res || !res.ok) {
        throw new Error(`Gateway ${gwUrl} returned HTTP ${res?.status ?? 'error'}`);
      }
      return (await res.json()) as T;
    };

    try {
      return await Promise.any(uniqueGateways.map((gw) => fetchGateway(gw)));
    } catch (aggregateErr) {
      throw new Error(`Failed to fetch IPFS CID ${cid} from all gateways: ${(aggregateErr as Error).message}`);
    }
  }

  public async unpin(cid: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const cleanCid = cid.trim().replace(/^ipfs:\/\//, '');
    try {
      const res = await fetch(`${this.apiBase}/pinning/unpin/${cleanCid}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch (err) {
      console.warn(`[PinataService] Failed to unpin ${cid}:`, err);
      return false;
    }
  }

  public getGatewayUrl(cid: string): string {
    const cleanCid = cid.trim().replace(/^ipfs:\/\//, '');
    return `https://${config.pinata.gateway}/ipfs/${cleanCid}`;
  }
}

export const pinataService = new PinataService();
