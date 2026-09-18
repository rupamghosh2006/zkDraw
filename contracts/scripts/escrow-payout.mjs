/**
 * escrow-payout.mjs
 *
 * Backend helper script for sending a real tNIGHT unshielded transfer
 * from the Escrow Vault wallet to a winner address.
 *
 * Called as a child process by the backend EscrowWallet class.
 * Reads JSON params from stdin, writes JSON result to stdout.
 *
 * INPUT (stdin JSON):
 * { mnemonic, recipientAddress, amountAtomic, network, indexerUrl, indexerWsUrl, nodeWsUrl }
 *
 * OUTPUT (stdout JSON):
 * { ok: true, txHash: string, escrowAddress: string }
 * { ok: false, error: string }
 */

function output(result) {
  process.stdout.write(JSON.stringify(result) + '\n');
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  let params;
  try {
    const raw = await readStdin();
    params = JSON.parse(raw);
  } catch (e) {
    output({ ok: false, error: 'Failed to parse input: ' + e.message });
    process.exit(1);
  }

  const { mnemonic, recipientAddress, amountAtomic, network, indexerUrl, indexerWsUrl, nodeWsUrl } = params;

  if (!mnemonic || !recipientAddress || !amountAtomic || !network) {
    output({ ok: false, error: 'Missing required params: mnemonic, recipientAddress, amountAtomic, network' });
    process.exit(1);
  }

  const amountBigInt = BigInt(amountAtomic);
  if (amountBigInt <= 0n) {
    output({ ok: false, error: 'Amount must be > 0' });
    process.exit(1);
  }

  try {
    const { WebSocket } = await import('ws');
    globalThis.WebSocket = WebSocket;
    const Rx = await import('rxjs');
    const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
    const { LedgerParameters } = await import('@midnight-ntwrk/midnight-js-protocol/ledger');
    const {
      NoOpTransactionHistoryStorage,
      ShieldedWallet,
      UnshieldedWallet,
      PublicKey,
      WalletFacade,
      createKeystore,
    } = await import('@midnight-ntwrk/wallet-sdk');
    const { WalletSeeds } = await import('@midnight-ntwrk/testkit-js');
    const { SerializedTransaction } = await import('@midnight-ntwrk/wallet-sdk-abstractions');
    const { ApiPromise, WsProvider } = await import('@polkadot/api');
    const { u8aToHex } = await import('@polkadot/util');
    const { nativeToken } = await import('@midnight-ntwrk/midnight-js-types');

    setNetworkId(network);
    const seeds = WalletSeeds.fromMnemonic(mnemonic.trim().replace(/\s+/g, ' '));
    const keystore = createKeystore(seeds.unshielded, network);

    // Fetch ledger parameters for fee estimation
    let currentLedgerParams;
    try {
      const res = await fetch(indexerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ block { ledgerParameters } }' }),
      });
      const json = await res.json();
      const hex = json?.data?.block?.ledgerParameters;
      if (hex) currentLedgerParams = LedgerParameters.deserialize(Buffer.from(hex, 'hex'));
    } catch {}
    if (!currentLedgerParams) currentLedgerParams = LedgerParameters.initialParameters();

    const sdkConfig = {
      indexerClientConnection: { indexerHttpUrl: indexerUrl, indexerWsUrl },
      networkId: network,
      relayURL: new URL(nodeWsUrl),
      txHistoryStorage: new NoOpTransactionHistoryStorage(),
      batchUpdates: { size: 10000, timeout: 50, spacing: 0 },
    };

    const shieldedWallet = ShieldedWallet(sdkConfig).startWithSeed(seeds.shielded);
    const unshieldedWallet = UnshieldedWallet({
      ...sdkConfig,
      txHistoryStorage: new NoOpTransactionHistoryStorage(),
    }).startWithPublicKey(PublicKey.fromKeyStore(keystore));

    const wallet = await WalletFacade.init({
      configuration: sdkConfig,
      shielded: () => shieldedWallet,
      unshielded: () => unshieldedWallet,
    });

    const balanceTx = async (tx) => {
      const recipe = await wallet.balanceUnboundTransaction(tx, {}, {});
      const signed = await wallet.signRecipe(recipe, (payload) => keystore.signData(payload));
      return wallet.finalizeRecipe(signed);
    };

    const submitTx = async (tx) => {
      const provider = new WsProvider(nodeWsUrl);
      const api = await ApiPromise.create({ provider, noInitWarn: true });
      await api.isReady;
      const hexTx = u8aToHex(SerializedTransaction.from(tx));
      const extrinsic = api.tx.midnight.sendMnTransaction(hexTx);
      const txHash = await api.rpc.author.submitExtrinsic(extrinsic.toHex());
      return new Promise((resolve) => {
        let seen = 0;
        api.rpc.chain.subscribeNewHeads(() => {
          if (++seen >= 2) {
            api.disconnect().catch(() => {});
            resolve(txHash.toHex());
          }
        });
      });
    };

    process.stderr.write('[escrow-payout] Starting wallet sync on ' + network + '...\n');
    await wallet.start(null, null);

    // Wait for unshielded wallet sync (up to 90s)
    await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.filter((s) => s.unshielded.progress?.isStrictlyComplete() === true),
        Rx.timeout({
          each: 90_000,
          with: () => Rx.throwError(() => new Error('Unshielded wallet sync timed out')),
        }),
      ),
    );

    const escrowAddress = keystore.getBech32Address().asString();
    process.stderr.write('[escrow-payout] Escrow address: ' + escrowAddress + '\n');
    process.stderr.write('[escrow-payout] Sending ' + amountAtomic + ' atomic tNIGHT to ' + recipientAddress + '\n');

    // Build unshielded transfer
    const nativeTokenType = nativeToken().raw;
    const transferTx = await wallet.buildUnshieldedTransfer([{
      kind: 'unshielded',
      type: nativeTokenType,
      value: amountBigInt,
      recipient: recipientAddress,
    }]);

    const balanced = await balanceTx(transferTx);
    const txHash = await submitTx(balanced);
    await wallet.stop().catch(() => {});

    process.stderr.write('[escrow-payout] Transfer confirmed! TxHash: ' + txHash + '\n');
    output({ ok: true, txHash, escrowAddress });
  } catch (err) {
    process.stderr.write('[escrow-payout] ERROR: ' + err.message + '\n');
    output({ ok: false, error: err.message });
    process.exit(1);
  }
}

main();