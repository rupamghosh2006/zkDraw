/**
 * escrow-wallet.ts
 *
 * Server-side Escrow Vault Wallet for zkDraw.
 *
 * Handles real tNIGHT transfers from the escrow vault to winners by spawning
 * the contracts workspace escrow-payout.mjs script which has access to the
 * full Midnight Wallet SDK (WalletFacade, WalletSeeds, etc.).
 *
 * When ESCROW_{NETWORK}_MNEMONIC is not configured, the wallet operates in
 * SIMULATION MODE: it records all transfer intents with full detail and returns
 * a simulated tx hash. All escrow state is still tracked correctly.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PayoutResult {
  ok: boolean;
  txHash: string;
  escrowAddress: string;
  isSimulated: boolean;
  error?: string;
}

function getPayoutScriptPath(): string {
  return path.resolve(__dirname, '../../../contracts/scripts/escrow-payout.mjs');
}

function getContractsNodeModules(): string {
  return path.resolve(__dirname, '../../../contracts/node_modules/.bin/node');
}

/**
 * Returns the configured escrow vault bech32 address for the given network.
 * Falls back to empty string in simulation mode.
 */
export function getEscrowAddress(network: 'preprod' | 'preview'): string {
  return config.networks[network]?.escrowAddress ?? '';
}

/**
 * Returns true when the escrow wallet is configured for real transfers
 * (i.e. ESCROW_{NETWORK}_MNEMONIC is set).
 */
export function isEscrowConfigured(network: 'preprod' | 'preview'): boolean {
  return Boolean(config.networks[network]?.escrowMnemonic);
}

/**
 * Spawns the contracts/scripts/escrow-payout.mjs child process to perform a
 * real tNIGHT unshielded transfer from the escrow vault to a winner's address.
 *
 * Falls back to simulation mode when mnemonic is not configured.
 */
export async function sendEscrowPayout(
  recipientAddress: string,
  amountAtomic: bigint,
  network: 'preprod' | 'preview',
): Promise<PayoutResult> {
  const netCfg = config.networks[network];
  const mnemonic = netCfg?.escrowMnemonic;

  // ─── Simulation Mode ──────────────────────────────────────────────────────
  if (!mnemonic) {
    const simHash = `sim_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
    console.warn(
      `[EscrowWallet][SIMULATION] No mnemonic configured for ${network}. ` +
      `Simulating payout of ${amountAtomic} atomic tNIGHT to ${recipientAddress}. ` +
      `Set ESCROW_${network.toUpperCase()}_MNEMONIC in .env to enable real transfers.`,
    );
    return {
      ok: true,
      txHash: simHash,
      escrowAddress: netCfg?.escrowAddress || `[ESCROW_${network.toUpperCase()}_ADDRESS_NOT_CONFIGURED]`,
      isSimulated: true,
    };
  }

  // ─── Real Transfer Mode ───────────────────────────────────────────────────
  return new Promise<PayoutResult>((resolve) => {
    const scriptPath = getPayoutScriptPath();
    const params = {
      mnemonic,
      recipientAddress,
      amountAtomic: amountAtomic.toString(),
      network,
      indexerUrl: netCfg.indexerUrl,
      indexerWsUrl: netCfg.nodeWsUrl.replace('wss://', 'wss://indexer.').replace('rpc.', '').replace('/api/v4/graphql', '') + (netCfg.indexerUrl.endsWith('/graphql') ? '/api/v4/graphql/ws' : ''),
      nodeWsUrl: netCfg.nodeWsUrl,
    };

    // Build indexer WS URL from indexerUrl (HTTP → WS)
    const indexerWsUrl = netCfg.indexerUrl
      .replace(/^https?:\/\//, 'wss://')
      .replace(/\/graphql$/, '/graphql/ws');
    params.indexerWsUrl = indexerWsUrl;

    console.log(`[EscrowWallet] Spawning escrow payout for ${network}: ${amountAtomic} tNIGHT → ${recipientAddress}`);

    const child = spawn('node', ['--experimental-vm-modules', scriptPath], {
      cwd: path.resolve(__dirname, '../../../contracts'),
      env: {
        ...process.env,
        NODE_OPTIONS: '',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => {
      const msg = data.toString();
      stderr += msg;
      // Forward payout script logs to our process stderr
      process.stderr.write(`[escrow-child] ${msg}`);
    });

    // Send params via stdin
    child.stdin.write(JSON.stringify(params));
    child.stdin.end();

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        ok: false,
        txHash: '',
        escrowAddress: netCfg?.escrowAddress ?? '',
        isSimulated: false,
        error: 'Payout script timed out after 3 minutes',
      });
    }, 180_000); // 3-minute timeout

    child.on('close', (code) => {
      clearTimeout(timeout);
      try {
        // Parse last JSON line from stdout
        const lines = stdout.trim().split('\n').filter(Boolean);
        const lastLine = lines[lines.length - 1];
        if (lastLine) {
          const result = JSON.parse(lastLine);
          resolve({
            ok: result.ok,
            txHash: result.txHash ?? '',
            escrowAddress: result.escrowAddress ?? netCfg?.escrowAddress ?? '',
            isSimulated: false,
            error: result.error,
          });
          return;
        }
      } catch {}
      resolve({
        ok: false,
        txHash: '',
        escrowAddress: netCfg?.escrowAddress ?? '',
        isSimulated: false,
        error: `Payout script exited with code ${code}. stderr: ${stderr.slice(-500)}`,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        txHash: '',
        escrowAddress: netCfg?.escrowAddress ?? '',
        isSimulated: false,
        error: `Failed to spawn payout script: ${err.message}`,
      });
    });
  });
}