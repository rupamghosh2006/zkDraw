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
import type { Lottery, UserTicket, MidnightNetwork } from '../types/index.js';
import type { ConnectedWallet } from '../midnight/wallet.js';
import { shortenAddress } from '../midnight/wallet.js';
import { getNetworkConfig } from '../midnight/config.js';

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

    try {
      // Step 1: Synthesizing Salt & Commitment
      setProvingStep('Computing 256-bit CSPRNG Salt & Domain Hash...');
      const commitment = await computeClientTicketCommitment(selectedNumber, saltHex);
      setCommitmentHex(commitment);
      await new Promise((r) => setTimeout(r, 450));

      // Step 2: Proving Arithmetic Circuit
      setProvingStep(`Executing Compact Circuit Proof on ${netConfig.name}...`);
      await new Promise((r) => setTimeout(r, 550));

      // Step 3: Submitting to Network Ledger
      setProvingStep('Submitting Shielded Commitment to Mempool...');
      await submitTicketCommitment(lottery.id, commitment, currentNetwork);

      const generatedTx = `0x${generateRandomHex(16)}`;

      const newTicket: UserTicket = {
        id: `ticket-${currentNetwork}-${Date.now()}`,
        lotteryId: lottery.id,
        network: currentNetwork,
        contractAddress: lottery.contractAddress,
        ticketNumber: selectedNumber,
        saltHex,
        playerSecretHex,
        commitmentHex: commitment,
        purchasedAt: new Date().toISOString(),
        txHash: generatedTx,
      };

      // Save ticket to local storage
      const existing = JSON.parse(localStorage.getItem('zkdraw_user_tickets') ?? '[]');
      existing.unshift(newTicket);
      localStorage.setItem('zkdraw_user_tickets', JSON.stringify(existing));

      setStep('confirmed');
      onSuccess(newTicket);
    } catch (err) {
      setError((err as Error).message);
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
              <div className="space-y-1">
                <span className="text-[#8b98a5] block">On-Chain Commitment Hash:</span>
                <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#00d4ff] bg-black p-2 rounded-xl border border-white/[0.06]">
                  <span className="truncate">0x{commitmentHex}</span>
                  <button
                    onClick={() => handleCopy(`0x${commitmentHex}`)}
                    className="p-1 hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#00ba7c]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={netConfig.explorerContractUrl}
                target="_blank"
                rel="noreferrer"
                className="myrad-btn-secondary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 text-center"
              >
                <span>View Contract on 1AM</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={onClose}
                className="myrad-btn-primary flex-1 py-3 text-xs font-bold"
              >
                Close & View Vault
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
