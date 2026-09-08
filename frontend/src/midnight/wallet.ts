import type { MidnightNetwork } from './config.js';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

export type WalletInitialApi = {
  readonly name: string;
  readonly icon?: string;
  readonly apiVersion: string;
  connect(network: MidnightNetwork | 'local'): Promise<WalletConnectedApi>;
};

export type WalletConnectedApi = {
  getConnectionStatus(): Promise<{ readonly status: 'connected' | 'disconnected' }>;
  getUnshieldedAddress(): Promise<{ readonly unshieldedAddress: string }>;
  getDustBalance?(): Promise<{ readonly dustBalance: bigint }>;
};

export type WalletOption = {
  readonly id: string;
  readonly name: string;
  readonly apiVersion: string;
  readonly icon?: string;
};

export type ConnectedWallet = {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly network: MidnightNetwork;
  readonly isDemo: boolean;
  /** Live dapp-connector API object. Present for real wallet connections; absent for demo wallets. */
  readonly connectedApi?: ConnectedAPI;
};

declare global {
  interface Window {
    midnight?: Record<string, import('@midnight-ntwrk/dapp-connector-api').InitialAPI>;
  }
}

export const listInstalledWallets = (): WalletOption[] => {
  if (typeof window === 'undefined') return [];
  return Object.entries(window.midnight ?? {}).map(([id, wallet]) => ({
    id,
    name: wallet.name,
    apiVersion: wallet.apiVersion,
    icon: wallet.icon,
  }));
};

export const connectMidnightWallet = async (
  walletId: string,
  network: MidnightNetwork = 'preprod',
): Promise<ConnectedWallet> => {
  const wallet = window.midnight?.[walletId];

  if (!wallet) {
    throw new Error('Selected Midnight wallet extension is not installed or unavailable.');
  }

  const connected = await wallet.connect(network);
  const status = await connected.getConnectionStatus();

  if (status.status !== 'connected') {
    throw new Error('Connection request was rejected by the Midnight wallet.');
  }

  const { unshieldedAddress } = await connected.getUnshieldedAddress();

  return {
    id: walletId,
    name: wallet.name,
    address: unshieldedAddress,
    network,
    isDemo: false,
    connectedApi: connected,
  };
};

export const createDemoWallet = (network: MidnightNetwork = 'preprod'): ConnectedWallet => {
  // Generate deterministic/consistent demo address for local presentation
  const storageKey = `zkdraw_demo_wallet_${network}`;
  let address = localStorage.getItem(storageKey);
  if (!address) {
    const prefix = network === 'preprod' ? 'mn_addr_preprod' : 'mn_addr_preview';
    const randPart = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
    address = `${prefix}1${randPart}`;
    localStorage.setItem(storageKey, address);
  }

  return {
    id: `demo-lace-${network}`,
    name: 'Midnight Lace (Simulator)',
    address,
    network,
    isDemo: true,
  };
};

export const STORAGE_KEY_CONNECTED_WALLET = 'zkdraw_connected_wallet_id';

export const getSavedWalletId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY_CONNECTED_WALLET);
  } catch {
    return null;
  }
};

export const saveConnectedWalletId = (walletId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CONNECTED_WALLET, walletId);
  } catch {}
};

export const clearSavedWalletId = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_CONNECTED_WALLET);
  } catch {}
};

/**
 * Waits up to `timeoutMs` for the Midnight wallet extension to be injected into `window.midnight`.
 */
export const waitForMidnightExtensions = async (
  targetWalletId?: string,
  timeoutMs = 2500,
): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const midnightObj = window.midnight;
    if (midnightObj && Object.keys(midnightObj).length > 0) {
      if (!targetWalletId || midnightObj[targetWalletId]) {
        return true;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return Boolean(
    window.midnight &&
      Object.keys(window.midnight).length > 0 &&
      (!targetWalletId || window.midnight[targetWalletId]),
  );
};

export const autoReconnectMidnightWallet = async (
  network: MidnightNetwork = 'preprod',
): Promise<ConnectedWallet | null> => {
  const savedId = getSavedWalletId();
  if (!savedId) return null;

  if (savedId.startsWith('demo-lace-')) {
    return createDemoWallet(network);
  }

  // Wait for the extension to inject into window.midnight
  const detected = await waitForMidnightExtensions(savedId, 2500);
  if (!detected || !window.midnight?.[savedId]) {
    console.info(`[zkDraw] Saved wallet extension '${savedId}' not detected on page load.`);
    return null;
  }

  try {
    return await connectMidnightWallet(savedId, network);
  } catch (err) {
    console.warn('[zkDraw] Auto-reconnection to Midnight wallet failed:', err);
    return null;
  }
};

export const shortenAddress = (address: string): string => {
  if (!address || address.length < 16) return address;
  return `${address.slice(0, 10)}...${address.slice(-6)}`;
};
