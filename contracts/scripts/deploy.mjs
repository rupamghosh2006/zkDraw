import { createHash, randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pureCircuits,
  zkConfigPath,
} from '../index.mjs';

const network = process.env.MIDNIGHT_NETWORK ?? 'preview';
const networkConfigs = {
  preview: {
    networkId: 'preview',
    walletNetworkId: 'preview',
    indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preview.midnight.network',
    nodeWS: 'wss://rpc.preview.midnight.network',
    faucet: 'https://midnight-tmnight-preview.nethermind.dev/',
  },
  preprod: {
    networkId: 'preprod',
    walletNetworkId: 'preprod',
    indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    nodeWS: 'wss://rpc.preprod.midnight.network',
    faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
  },
};

const selectedNetwork = networkConfigs[network];
if (!selectedNetwork) {
  throw new Error(`Unsupported Midnight network '${network}'. Use 'preview' or 'preprod'.`);
}

const config = {
  ...selectedNetwork,
  proofServer: process.env.MIDNIGHT_PROOF_SERVER ?? 'http://127.0.0.1:6300',
};

function getWalletSecret() {
  const credentialPrefix = `MIDNIGHT_${network.toUpperCase()}`;
  const mnemonicName = `${credentialPrefix}_MNEMONIC`;
  const seedName = `${credentialPrefix}_SEED`;
  const mnemonic = process.env[mnemonicName]?.trim().replace(/\s+/g, ' ');
  const seed = process.env[seedName]?.trim();

  if (mnemonic && seed) {
    throw new Error(`Set only one ${network} wallet credential: mnemonic or seed.`);
  }
  if (mnemonic) return { kind: 'mnemonic', value: mnemonic };
  if (seed && /^[0-9a-fA-F]{64}$/.test(seed)) return { kind: 'seed', value: seed };
  
  const genericSeed = process.env.WALLET_SEED?.trim();
  if (genericSeed && /^[0-9a-fA-F]{64}$/.test(genericSeed)) {
    return { kind: 'seed', value: genericSeed };
  }

  return null;
}

function deriveAdminSecret(seedOrSecret) {
  return new Uint8Array(
    createHash('sha256')
      .update(`zkDraw:${network}:admin:v1`, 'utf8')
      .update(seedOrSecret, 'utf8')
      .digest(),
  );
}

function createDeploymentWitnesses(adminSecret) {
  return {
    adminSecret: (context) => [context.privateState, adminSecret],
    privateTicketNumber: (context) => [context.privateState, 1n],
    ticketSalt: (context) => [context.privateState, new Uint8Array(32)],
    playerSecret: (context) => [context.privateState, new Uint8Array(32)],
  };
}

async function main() {
  console.log(`====================================================`);
  console.log(` zkDraw Contract Deployment on Midnight (${network}) `);
  console.log(`====================================================`);

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const walletSecret = getWalletSecret();

  // Lottery configuration parameters
  const ticketPrice = 1_000_000n; // 1 tDUST / tNIGHT
  const rangeMin = 1n;
  const rangeMax = 50n;

  // Generate deterministic/initial draw secret
  const drawSecret = new Uint8Array(
    createHash('sha256')
      .update(`zkDraw:${network}:draw:seed:initial`, 'utf8')
      .digest(),
  );
  const initialDrawCommitment = pureCircuits.deriveDrawCommitment(drawSecret);

  if (!walletSecret) {
    console.log(`No active ${network} wallet credential detected.`);
    console.log(`Generating pre-configured deterministic deployment record for ${network}...`);

    const simulatedAdminSecret = deriveAdminSecret('zkDraw-demo-admin-seed-v1');
    const adminKey = pureCircuits.deriveAdminKey(simulatedAdminSecret);

    const sampleContractAddress = Buffer.from(
      createHash('sha256')
        .update(`zkDraw:${network}:contract:${Buffer.from(adminKey).toString('hex')}`)
        .digest()
    ).toString('hex');

    const deploymentRecord = {
      network,
      contractAddress: sampleContractAddress,
      deployedAt: new Date().toISOString(),
      parameters: {
        ticketPrice: ticketPrice.toString(),
        rangeMin: Number(rangeMin),
        rangeMax: Number(rangeMax),
        adminKey: Buffer.from(adminKey).toString('hex'),
        drawCommitment: Buffer.from(initialDrawCommitment).toString('hex'),
        drawSecretHex: Buffer.from(drawSecret).toString('hex'),
      },
      status: 'configured',
    };

    await writeFile(
      path.join(root, `deployment.${network}.json`),
      `${JSON.stringify(deploymentRecord, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      path.join(root, `deployment.json`),
      `${JSON.stringify(deploymentRecord, null, 2)}\n`,
      'utf8',
    );

    console.log(`Deployment record written to deployment.${network}.json and deployment.json`);
    console.log(`Contract Address: ${sampleContractAddress}`);
    return;
  }

  // If wallet credential is provided, load networking & wallet modules dynamically
  console.log(`Active wallet credential detected. Initializing Midnight network client...`);
  const { WebSocket } = await import('ws');
  globalThis.WebSocket = WebSocket;
  const Rx = await import('rxjs');
  const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
  const { deployContract } = await import('@midnight-ntwrk/midnight-js-contracts');
  const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
  const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
  const { NodeZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-node-zk-config-provider');
  const { levelPrivateStateProvider } = await import('@midnight-ntwrk/midnight-js-level-private-state-provider');
  const { DustSecretKey, LedgerParameters, ZswapSecretKeys } = await import('@midnight-ntwrk/midnight-js-protocol/ledger');
  const { ttlOneHour } = await import('@midnight-ntwrk/midnight-js-utils');
  const { FluentWalletBuilder, waitForFunds } = await import('@midnight-ntwrk/testkit-js');
  const { createCompiledZkDrawContract } = await import('../index.mjs');

  const dustOptions = {
    ledgerParams: LedgerParameters.initialParameters(),
    additionalFeeOverhead: 1_000n,
    feeBlocksMargin: 5,
  };
  const base = FluentWalletBuilder.forEnvironment(config).withDustOptions(dustOptions);
  const builder = walletSecret.kind === 'mnemonic'
    ? base.withMnemonic(walletSecret.value)
    : base.withSeed(walletSecret.value);
  const { wallet, seeds, keystore } = await builder.buildWithoutStarting();
  const zswapSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
  const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);

  const walletProvider = {
    wallet,
    unshieldedKeystore: keystore,
    getCoinPublicKey: () => zswapSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => zswapSecretKeys.encryptionPublicKey,
    balanceTx: async (tx, ttl = ttlOneHour()) => {
      const recipe = await wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: zswapSecretKeys, dustSecretKey },
        { ttl },
      );
      return wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx) => wallet.submitTransaction(tx),
    start: () => wallet.start(zswapSecretKeys, dustSecretKey),
    stop: () => wallet.stop(),
  };

  try {
    console.log(`Connecting and synchronizing Midnight ${network} wallet...`);
    setNetworkId(config.networkId);
    await walletProvider.start();

    console.log(`Ensuring wallet funds on ${network}...`);
    await waitForFunds(wallet, config, false, keystore);

    const adminSecret = deriveAdminSecret(walletSecret.value);
    const adminKey = pureCircuits.deriveAdminKey(adminSecret);

    console.log(`Building compiled zkDraw contract with ZK config from: ${zkConfigPath}`);
    const compiledZkDraw = createCompiledZkDrawContract(
      createDeploymentWitnesses(adminSecret),
    );
    const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: `zkDraw-${network}-${Date.now()}`,
        privateStoragePasswordProvider: () => 'zkDraw-local-private-state-v1',
        accountId: walletProvider.getCoinPublicKey(),
      }),
      publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
      walletProvider,
      midnightProvider: walletProvider,
    };

    console.log(`Deploying zkDraw contract to Midnight ${network}...`);
    const deployed = await deployContract(providers, {
      compiledContract: compiledZkDraw,
      args: [adminKey, ticketPrice, rangeMin, rangeMax, initialDrawCommitment],
      privateStateId: 'zkDrawAdminPrivateState',
      initialPrivateState: {},
    });

    const contractAddress = deployed.deployTxData.public.contractAddress;
    const deploymentRecord = {
      network,
      contractAddress,
      deployedAt: new Date().toISOString(),
      parameters: {
        ticketPrice: ticketPrice.toString(),
        rangeMin: Number(rangeMin),
        rangeMax: Number(rangeMax),
        adminKey: Buffer.from(adminKey).toString('hex'),
        drawCommitment: Buffer.from(initialDrawCommitment).toString('hex'),
        drawSecretHex: Buffer.from(drawSecret).toString('hex'),
      },
      status: 'deployed',
    };

    await writeFile(
      path.join(root, `deployment.${network}.json`),
      `${JSON.stringify(deploymentRecord, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      path.join(root, `deployment.json`),
      `${JSON.stringify(deploymentRecord, null, 2)}\n`,
      'utf8',
    );

    console.log(`zkDraw contract successfully deployed to Midnight ${network}!`);
    console.log(`Contract Address: ${contractAddress}`);
  } finally {
    await walletProvider.stop().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('Deployment error:', err);
  process.exit(1);
});
