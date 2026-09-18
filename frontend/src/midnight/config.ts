export type MidnightNetwork = 'preprod' | 'preview';

export interface NetworkConfig {
  id: MidnightNetwork;
  name: string;
  badgeLabel: string;
  contractAddress: string;
  deployedAt: string;
  blockHeight?: string;
  status: 'deployed' | 'configured';
  indexerUrl: string;
  indexerWS: string;
  nodeUrl: string;
  nodeWS: string;
  faucetUrl: string;
  explorerContractUrl: string;
  explorerBaseUrl: string;
  activeCircuits: string[];
  /**
   * Escrow Vault Address — the dedicated backend wallet that collects ticket fees.
   * Ticket payments (tNIGHT) are sent here instead of the draw creator's wallet.
   * Set via ESCROW_{NETWORK}_ADDRESS env var on the backend; fetched at runtime
   * via GET /api/escrow/vault-address. Falls back to this static value.
   */
  escrowAddress: string;
  previousContracts?: Array<{
    period: string;
    contractAddress: string;
    explorerContractUrl: string;
    deployedAt: string;
  }>;
  defaultLottery: {
    id: string;
    name: string;
    ticketPrice: string;
    prizePool: string;
    rangeMin: number;
    rangeMax: number;
    drawCommitment: string;
    drawSecretHex: string;
    adminKey: string;
  };
}

export const NETWORKS: Record<MidnightNetwork, NetworkConfig> = {
  preprod: {
    id: 'preprod',
    name: 'Midnight Preprod',
    badgeLabel: 'Preprod Testnet',
    contractAddress: 'f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959',
    deployedAt: '2026-09-06T06:34:54.668Z',
    blockHeight: '2427315',
    status: 'deployed',
    indexerUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.preprod.midnight.network',
    nodeWS: 'wss://rpc.preprod.midnight.network',
    faucetUrl: 'https://midnight-tmnight-preprod.nethermind.dev/',
    explorerContractUrl:
      'https://explorer.1am.xyz/contract/f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959?network=preprod',
    explorerBaseUrl: 'https://explorer.1am.xyz',
    activeCircuits: [
      'createDraw',
      'buyTicket',
      'drawWinner',
      'claimPrize',
      'closeLottery',
      'verifyWinningTicket',
    ],
    // Escrow Vault Address for preprod — overridden at runtime via GET /api/escrow/vault-address
    // Set ESCROW_PREPROD_ADDRESS on the backend to configure a real vault wallet.
    escrowAddress: import.meta.env.VITE_ESCROW_PREPROD_ADDRESS ?? '',
    previousContracts: [
      {
        period: 'Previous Month (August 2026)',
        contractAddress: '9be7061e20214bc402346c86675914e0373df514a89693b4aadf660ca82579b7',
        explorerContractUrl:
          'https://explorer.1am.xyz/contract/9be7061e20214bc402346c86675914e0373df514a89693b4aadf660ca82579b7?network=preprod',
        deployedAt: '2026-08-23T16:21:18.708Z',
      },
    ],
    defaultLottery: {
      id: 'lottery-preprod-main',
      name: 'zkDraw Preprod Confidential Pot',
      ticketPrice: '1000000', // 1 tNIGHT
      prizePool: '35000000', // 35 tNIGHT jackpot
      rangeMin: 1,
      rangeMax: 50,
      drawCommitment: '5276baff658ca3cfa175da42b94120fafdf6a10335c32176a9fe2448ae26bf0e',
      drawSecretHex: '0dfcc49e9d7fe799d2c7b8266ab095efe0bf60226edafd4723324fc5a8e3ff99',
      adminKey: 'd87e78432a5213ee311c1669d3aa2b5e842d5f800aee69c87d403bc74bba679b',
    },
  },
  preview: {
    id: 'preview',
    name: 'Midnight Preview',
    badgeLabel: 'Preview Testnet',
    contractAddress: 'f1667982258963752afb12360b34cbd7efcd11fa70930644c3cbf7bb8fb173ba',
    deployedAt: '2026-09-06T05:52:52.088Z',
    blockHeight: '742760',
    status: 'deployed',
    indexerUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.preview.midnight.network',
    nodeWS: 'wss://rpc.preview.midnight.network',
    faucetUrl: 'https://midnight-tmnight-preview.nethermind.dev/',
    explorerContractUrl:
      'https://explorer.1am.xyz/contract/f1667982258963752afb12360b34cbd7efcd11fa70930644c3cbf7bb8fb173ba?network=preview',
    explorerBaseUrl: 'https://explorer.1am.xyz',
    activeCircuits: [
      'createDraw',
      'buyTicket',
      'drawWinner',
      'claimPrize',
      'closeLottery',
      'verifyWinningTicket',
    ],
    // Escrow Vault Address for preview — overridden at runtime via GET /api/escrow/vault-address
    // Set ESCROW_PREVIEW_ADDRESS on the backend to configure a real vault wallet.
    escrowAddress: import.meta.env.VITE_ESCROW_PREVIEW_ADDRESS ?? '',
    previousContracts: [
      {
        period: 'Previous Month (August 2026)',
        contractAddress: '818d55c59ca40c32cb4e4585be9b13c116db0262edaffcc2b8c418867f96361b',
        explorerContractUrl:
          'https://explorer.1am.xyz/contract/818d55c59ca40c32cb4e4585be9b13c116db0262edaffcc2b8c418867f96361b?network=preview',
        deployedAt: '2026-08-19T19:49:58.766Z',
      },
    ],
    defaultLottery: {
      id: 'lottery-preview-main',
      name: 'zkDraw Preview Confidential Pot',
      ticketPrice: '1000000',
      prizePool: '25000000',
      rangeMin: 1,
      rangeMax: 50,
      drawCommitment: '48a83c562c0e2cb59f7d1ddcd6ed8dc31fb0afc989ab2ef6a5b09682823b947f',
      drawSecretHex: '63a5afc537996c7fed603aa49157963704ec9456d095f1410d08fa4b63baf297',
      adminKey: '495e53af5d3db0c94bde14ceb65a8e036224eb4a086a1c4e9fa2fe5e0ecbbedf',
    },
  },
};

export function getNetworkConfig(network: MidnightNetwork = 'preprod'): NetworkConfig {
  return NETWORKS[network] ?? NETWORKS.preprod;
}

export function getExplorerContractUrl(contractAddress: string, network: MidnightNetwork = 'preprod'): string {
  return `https://explorer.1am.xyz/contract/${contractAddress}?network=${network}`;
}

export function isCorruptedTxHash(txHash?: string | null): boolean {
  if (!txHash) return true;
  const clean = txHash.replace(/^0x/, '').toLowerCase();
  // 6d69646e is hex for ASCII "midn" (from "midnight:transaction...")
  return clean.startsWith('6d69646e') || !/^[0-9a-fA-F]{64}$/.test(clean);
}

export function getExplorerTxUrl(txHash: string, network: MidnightNetwork = 'preprod'): string {
  const clean = txHash.replace(/^0x/, '');
  return `https://explorer.1am.xyz/tx/${clean}?network=${network}`;
}

export function shortenContractAddress(address: string): string {
  if (!address || address.length < 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}
