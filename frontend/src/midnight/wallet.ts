export type WalletInitialApi = {
  readonly name: string;
  readonly icon?: string;
  readonly apiVersion: string;
  connect(network: 'preview' | 'preprod' | 'local'): Promise<WalletConnectedApi>;
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
};

export type ConnectedWallet = {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly network: string;
  readonly isDemo: boolean;
};

declare global {
  interface Window {
    midnight?: Record<string, WalletInitialApi>;
  }
}

export const listInstalledWallets = (): WalletOption[] => {
  if (typeof window === 'undefined') return [];
  return Object.entries(window.midnight ?? {}).map(([id, wallet]) => ({
    id,
    name: wallet.name,
    apiVersion: wallet.apiVersion,
  }));
};

export const connectMidnightWallet = async (
  walletId: string,
  network: 'preview' | 'preprod' | 'local' = 'preview',
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
  };
};

export const createDemoWallet = (network = 'preview'): ConnectedWallet => {
  // Generate deterministic/consistent demo address for local presentation
  const savedAddress = localStorage.getItem('zkdraw_demo_wallet_address');
  const address =
    savedAddress ??
    `mn_addr_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
  if (!savedAddress) {
    localStorage.setItem('zkdraw_demo_wallet_address', address);
  }

  return {
    id: 'demo-lace',
    name: 'Midnight Lace (Simulator)',
    address,
    network,
    isDemo: true,
  };
};

export const shortenAddress = (address: string): string => {
  if (!address || address.length < 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
};
