import React, { useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Hash,
  KeyRound,
  Shield,
  ExternalLink,
} from 'lucide-react';
import {
  generateRandomHex,
  computeClientTicketCommitment,
} from '../midnight/crypto.js';
import { submitTicketCommitment } from '../services/api.js';
import { buyTicketOnChain } from '../midnight/contract.js';
import type { Lottery, UserTicket, MidnightNetwork } from '../types/index.js';
import type { ConnectedWallet } from '../midnight/wallet.js';
import { shortenAddress } from '../midnight/wallet.js';
import { getNetworkConfig, getExplorerTxUrl } from '../midnight/config.js';

interface TicketModalProps {
  lottery: Lottery;
  selectedNumber: number;
  wallet: ConnectedWallet;
  onClose: () => void;
  onSuccess: (ticket: UserTicket) => void;
  currentNetwork: MidnightNetwork;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  lottery,
  selectedNumber,
  wallet,
  onClose,
  onSuccess,
  currentNetwork,
}) => {
  const [step, setStep] = useState<'review' | 'proving' | 'confirmed'>('review');
  const [provingStep, setProvingStep] = useState<string>('Generating CSPRNG Salt...');
  const [saltHex, setSaltHex] = useState<string>(() => generateRandomHex(32));
  const [playerSecretHex] = useState<string>(() => generateRandomHex(32));
  const [commitmentHex, setCommitmentHex] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const netConfig = getNetworkConfig(currentNetwork);

  // Compute commitment on mount
  React.useEffect(() => {
    computeClientTicketCommitment(selectedNumber, saltHex).then(setCommitmentHex);
  }, [selectedNumber, saltHex]);

  const handleRegenerateSalt = () => {
    const newSalt = generateRandomHex(32);
    setSaltHex(newSalt);
  };

  const handleConfirmPurchase = async () => {
    setStep('proving');
    setError(null);

    // -----------------------------------------------------------------------
    // Guard: demo wallet cannot submit real on-chain transactions
    // -----------------------------------------------------------------------
    if (wallet.isDemo || !wallet.connectedApi) {
      setError(
        'A real Midnight Lace wallet is required to submit on-chain transactions. ' +
        'The simulator cannot broadcast to the network. ' +
        'Please install Midnight Lace and connect a funded testnet wallet.',
      );
      setStep('review');
      return;
    }

    // Guard: creator cannot buy tickets
    if (wallet.address && lottery.adminKey && wallet.address.toLowerCase() === lottery.adminKey.toLowerCase()) {
      setError('The lottery creator cannot draw tickets from this lottery.');
      setStep('review');
      return;
    }

    // Guard: 1 ticket per participant
    const existingTickets = JSON.parse(localStorage.getItem('zkdraw_user_tickets') ?? '[]');
    const alreadyDrawn = existingTickets.some((t: any) => t.lotteryId === lottery.id && t.network === currentNetwork);
    if (alreadyDrawn) {
      setError('You have already drawn 1 ticket from this lottery. Protocol rule: exactly 1 ticket per participant.');
      setStep('review');
      return;
    }

    // Guard: maxTickets sold
    if (lottery.ticketCount >= (lottery.maxTickets || 10)) {
      setError('All tickets have already been sold. The draw has ended automatically.');
      setStep('review');
      return;
    }

    try {
      // Step 1: Compute the local ZK commitment (browser crypto, no network)
      setProvingStep('Computing 256-bit CSPRNG Salt & ticket commitment...');
      const commitment = await computeClientTicketCommitment(selectedNumber, saltHex);
      setCommitmentHex(commitment);
      await new Promise((r) => setTimeout(r, 200));

      // Step 2–8: Real on-chain transaction via dapp-connector-api
      const result = await buyTicketOnChain(
        wallet.connectedApi,
        lottery.contractAddress,
        selectedNumber,
        saltHex,
        playerSecretHex,
        currentNetwork,
        (stepMsg) => setProvingStep(stepMsg),
      );

      setTxHash(result.txHash);
      // Use commitment from the on-chain result (circuit output) for accuracy
      if (result.commitmentHex) setCommitmentHex(result.commitmentHex);

      // Record the ticket locally and sync the backend/localStorage state
      const realTxHash = `0x${result.txHash}`;
      const newTicket: UserTicket = {
        id: `ticket-${currentNetwork}-${Date.now()}`,
        lotteryId: lottery.id,
        network: currentNetwork,
        contractAddress: lottery.contractAddress,
        ticketNumber: selectedNumber,
        saltHex,
        playerSecretHex,
        commitmentHex: result.commitmentHex || commitment,
        purchasedAt: new Date().toISOString(),
        txHash: realTxHash,
      };

      // Persist to localStorage
      const existing = JSON.parse(localStorage.getItem('zkdraw_user_tickets') ?? '[]');
      existing.unshift(newTicket);
      localStorage.setItem('zkdraw_user_tickets', JSON.stringify(existing));

      // Sync commitment to backend so ticket count updates in the UI
      setProvingStep('Syncing on-chain state to app store...');
      await submitTicketCommitment(lottery.id, result.commitmentHex || commitment, undefined, currentNetwork);

      setStep('confirmed');
      onSuccess(newTicket);
    } catch (err) {
      const msg = (err as Error).message ?? 'Unknown error';
      setError(
        msg.length > 300
          ? msg.slice(0, 300) + '...'
          : msg,
      );
      setStep('review');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="myrad-card w-full max-w-lg p-6 sm:p-8 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f0f0f] border border-white/10 p-1 flex items-center justify-center">
              <img src="/logo.png" alt="zkDraw" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">
                  Confidential Ticket Purchase
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00ba7c]/15 text-[#00ba7c] border border-[#00ba7c]/30">
                  {netConfig.name}
                </span>
              </div>
              <p className="text-xs text-[#8b98a5]">
                Midnight Zero-Knowledge Arithmetic Circuit Execution
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#8b98a5] hover:text-white p-1 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Body based on Step */}
        {step === 'review' && (
          <div className="space-y-6 pt-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Selected Number Pill */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-black border border-white/10 flex items-center justify-center font-black text-2xl text-[#00d4ff]">
                  {selectedNumber}
                </div>
                <div>
                  <div className="text-xs font-extrabold text-white">
                    Private Number #{selectedNumber}
                  </div>
                  <div className="text-[11px] text-[#8b98a5]">
                    Valid Range: [{lottery.rangeMin} .. {lottery.rangeMax}] • {shortenAddress(wallet.address)}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-black text-white">1 tDUST</div>
                <div className="text-[11px] text-[#8b98a5] font-mono">{wallet.name}</div>
              </div>
            </div>

            {/* Privacy Breakdown */}
            <div className="space-y-3 p-4 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] text-xs">
              <div className="flex items-center justify-between text-[#8b98a5]">
                <span className="flex items-center gap-1.5 font-medium">
                  <KeyRound className="w-3.5 h-3.5 text-[#00ba7c]" />
                  256-bit CSPRNG Salt:
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateSalt}
                  className="text-[11px] text-[#00d4ff] hover:underline font-bold"
                >
                  Regenerate Salt
                </button>
              </div>
              <div className="font-mono text-[11px] text-white/80 bg-[#0f0f0f] p-2.5 rounded-xl border border-white/[0.04] truncate">
                0x{saltHex}
              </div>

              <div className="flex items-center justify-between text-[#8b98a5] pt-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Hash className="w-3.5 h-3.5 text-[#00d4ff]" />
                  Public Ticket Commitment (Circuit Output):
                </span>
              </div>
              <div className="font-mono text-[11px] text-[#00d4ff] bg-[#0f0f0f] p-2.5 rounded-xl border border-white/[0.04] truncate">
                {commitmentHex ? `0x${commitmentHex}` : 'Computing...'}
              </div>
            </div>

            {/* Notice */}
            <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-white/[0.06] flex items-start gap-2.5 text-xs text-[#8b98a5]">
              <Shield className="w-4 h-4 text-[#00ba7c] shrink-0 mt-0.5" />
              <p>
                This ticket receipt is saved in your browser local storage. Only the 32-byte commitment hash goes on-chain on <strong>{netConfig.name}</strong>.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="myrad-btn-secondary flex-1 py-3 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurchase}
                className="myrad-btn-primary flex-1 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Prove & Purchase in ZK
              </button>
            </div>
          </div>
        )}

        {/* Proving Loader Step */}
        {step === 'proving' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0f0f0f] border border-[#00d4ff]/40 flex items-center justify-center mx-auto text-[#00d4ff] animate-pulse shadow-lg shadow-[#00d4ff]/20">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Synthesizing Zero-Knowledge Witness</h4>
              <p className="text-xs text-[#00d4ff] mt-1 font-mono">{provingStep}</p>
            </div>
            <p className="text-xs text-[#8b98a5] max-w-xs mx-auto leading-relaxed">
              Evaluating Euclidean range constraints and creating persistent domain-separated commitment on {netConfig.name}...
            </p>
          </div>
        )}

        {/* Confirmed Step */}
        {step === 'confirmed' && (
          <div className="space-y-6 pt-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#00ba7c]/10 border border-[#00ba7c]/30 text-[#00ba7c] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-black text-white">
                Ticket Commitment Shielded!
              </h4>
              <p className="text-xs text-[#8b98a5]">
                Your confidential entry has been proved and confirmed on {netConfig.name}.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.08] space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-[#8b98a5]">Private Number:</span>
                <span className="font-extrabold text-[#00d4ff] text-sm">#{selectedNumber}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-[#8b98a5]">Target Network:</span>
                <span className="font-bold text-white">{netConfig.name}</span>
              </div>
              {/* Real on-chain transaction hash */}
              {txHash && (
                <div className="space-y-1 pb-2 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8b98a5] block">On-Chain Transaction:</span>
                    <a
                      href={getExplorerTxUrl(txHash, currentNetwork)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-[#00ba7c] font-semibold flex items-center gap-0.5 hover:underline"
                    >
                      View on Explorer <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#00ba7c] bg-black p-2 rounded-xl border border-[#00ba7c]/20">
                    <span className="truncate">0x{txHash}</span>
                    <button
                      onClick={() => handleCopy(`0x${txHash}`)}
                      className="p-1 hover:text-white"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#00ba7c]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#8b98a5] block">On-Chain Commitment Hash:</span>
                  <span className="text-[10px] text-[#8b98a5] font-sans">ZK State Commitment</span>
                </div>
                <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#00d4ff] bg-black p-2 rounded-xl border border-white/[0.06]">
                  <span className="truncate">0x{commitmentHex}</span>
                  <button
                    onClick={() => handleCopy(`0x${commitmentHex}`)}
                    className="p-1 hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#00ba7c]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-[#8b98a5] pt-0.5 font-sans">
                  The commitment is now in the on-chain <code>ticketCommitments</code> set. Your private number is never revealed.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              {txHash ? (
                <a
                  href={getExplorerTxUrl(txHash, currentNetwork)}
                  target="_blank"
                  rel="noreferrer"
                  className="myrad-btn-secondary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 text-center"
                >
                  <span>View Transaction on 1AM</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <a
                  href={netConfig.explorerContractUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="myrad-btn-secondary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 text-center"
                >
                  <span>View Contract on 1AM</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button
                onClick={onClose}
                className="myrad-btn-primary flex-1 py-3 text-xs font-bold"
              >
                Close &amp; View Vault
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
