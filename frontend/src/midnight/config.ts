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
    contractAddress: '246fee4d100b2e2b6f98587e8a573e54ffc3a9d87e775a65c958a302f138e267',
    deployedAt: '2026-09-06T06:34:54.668Z',
    blockHeight: '2427315',
    status: 'deployed',
    indexerUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.preprod.midnight.network',
    nodeWS: 'wss://rpc.preprod.midnight.network',
    faucetUrl: 'https://midnight-tmnight-preprod.nethermind.dev/',
    explorerContractUrl:
      'https://explorer.1am.xyz/contract/246fee4d100b2e2b6f98587e8a573e54ffc3a9d87e775a65c958a302f138e267?network=preprod',
    explorerBaseUrl: 'https://explorer.1am.xyz',
    activeCircuits: [
      'buyTicket',
      'drawWinner',
      'claimPrize',
      'closeLottery',
      'verifyWinningTicket',
    ],
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
      ticketPrice: '1000000', // 1 tDUST / tNIGHT
      prizePool: '35000000', // 35 tDUST jackpot
      rangeMin: 1,
      rangeMax: 50,
      drawCommitment: '2f95351a0ff6f161d3a92607190651b9406cdb4b0f5b564e5ea4e422d9c6c6b9',
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
      'buyTicket',
      'drawWinner',
      'claimPrize',
      'closeLottery',
      'verifyWinningTicket',
    ],
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
      drawCommitment: '8d2ae517d4e4a91ab5241c42ab697845fcb5473cf6031825efb806c1ae9c9e66',
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

export function getExplorerTxUrl(txHash: string, network: MidnightNetwork = 'preprod'): string {
  const clean = txHash.replace(/^0x/, '');
  return `https://explorer.1am.xyz/tx/${clean}?network=${network}`;
}

export function shortenContractAddress(address: string): string {
  if (!address || address.length < 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}
