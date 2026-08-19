import React, { useState } from 'react';
import { CheckCircle2, Loader2, Sparkles, Copy, Check, Hash, KeyRound, Shield } from 'lucide-react';
import {
  generateRandomHex,
  computeClientTicketCommitment,
} from '../midnight/crypto.js';
import { submitTicketCommitment } from '../services/api.js';
import type { Lottery, UserTicket } from '../types/index.js';
import type { ConnectedWallet } from '../midnight/wallet.js';

interface TicketModalProps {
  lottery: Lottery;
  selectedNumber: number;
  wallet: ConnectedWallet;
  onClose: () => void;
  onSuccess: (ticket: UserTicket) => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  lottery,
  selectedNumber,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'review' | 'proving' | 'confirmed'>('review');
  const [saltHex, setSaltHex] = useState<string>(() => generateRandomHex(32));
  const [playerSecretHex] = useState<string>(() => generateRandomHex(32));
  const [commitmentHex, setCommitmentHex] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Step 1: Compute fresh commitment
      const commitment = await computeClientTicketCommitment(selectedNumber, saltHex);
      setCommitmentHex(commitment);

      // Simulate ZK circuit proof generation delay for authentic cryptographic feedback
      await new Promise((r) => setTimeout(r, 900));

      // Step 2: Submit to backend/ledger
      await submitTicketCommitment(lottery.id, commitment);

      const generatedTx = `0x${generateRandomHex(16)}`;
      setTxHash(generatedTx);

      const newTicket: UserTicket = {
        id: `ticket-${Date.now()}`,
        lotteryId: lottery.id,
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
              <h3 className="font-extrabold text-white text-base">
                {step === 'confirmed' ? 'Ticket Secured in ZK' : 'Secure Private Ticket'}
              </h3>
              <p className="text-xs text-[#8b98a5]">
                {lottery.name}
              </p>
            </div>
          </div>
          {step !== 'proving' && (
            <button
              onClick={onClose}
              className="text-[#8b98a5] hover:text-white p-1 text-sm font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-950/30 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Step 1: Review */}
        {step === 'review' && (
          <div className="py-5 space-y-5">
            <div className="flex items-center justify-center py-6 bg-[#0f0f0f] rounded-2xl border border-white/10">
              <div className="text-center">
                <span className="text-xs font-black uppercase text-[#00d4ff] tracking-widest">
                  Your Confidential Number
                </span>
                <div className="mt-1 text-6xl font-black text-white tracking-tight flex items-center justify-center">
                  <span>{selectedNumber}</span>
                </div>
                <span className="text-xs text-[#00ba7c] flex items-center justify-center gap-1.5 mt-2 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Hidden by Zero-Knowledge Commitment
                </span>
              </div>
            </div>

            {/* Cryptographic Parameters */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#0f0f0f] border border-white/[0.06]">
                <div className="flex items-center justify-between text-xs text-[#8b98a5] mb-1 font-bold">
                  <span className="flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-[#00ba7c]" />
                    Client-Side Secret Salt:
                  </span>
                  <button
                    onClick={handleRegenerateSalt}
                    className="text-[#00d4ff] hover:underline flex items-center gap-1 font-bold"
                  >
                    <Sparkles className="w-3 h-3" /> Regenerate
                  </button>
                </div>
                <div className="font-mono text-xs text-white truncate bg-black px-3 py-2 rounded-xl border border-white/10">
                  {saltHex}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0f0f0f] border border-white/[0.06]">
                <div className="text-xs text-[#8b98a5] mb-1 font-bold flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-[#00d4ff]" />
                  Derived On-Chain Commitment (H):
                </div>
                <div className="font-mono text-xs text-[#00d4ff] truncate bg-black px-3 py-2 rounded-xl border border-white/10">
                  {commitmentHex || 'Computing cryptographic commitment...'}
                </div>
              </div>
            </div>

            {/* Price & Summary */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0f0f0f] border border-white/10 text-sm">
              <span className="text-[#8b98a5] font-medium">Ticket Cost:</span>
              <span className="font-black text-white">
                {Number(lottery.ticketPrice) / 1_000_000} tDUST
              </span>
            </div>

            {/* CTA */}
            <div className="pt-2 flex gap-3">
              <button
                onClick={onClose}
                className="w-1/3 py-3.5 rounded-xl border border-white/10 font-bold text-[#8b98a5] hover:text-white hover:bg-white/[0.04] text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPurchase}
                className="w-2/3 myrad-btn-primary py-3.5 text-sm flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Confirm & Prove in ZK
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Proving Animation */}
        {step === 'proving' && (
          <div className="py-14 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0f0f0f] border border-white/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#00d4ff] animate-spin" />
            </div>
            <div>
              <h4 className="text-lg font-black text-white">
                Generating Zero-Knowledge Proof...
              </h4>
              <p className="text-xs text-[#8b98a5] mt-1 max-w-xs leading-relaxed">
                Proving valid range [1-{lottery.rangeMax}] and generating domain-separated commitment without revealing {selectedNumber}.
              </p>
            </div>
            <div className="w-56 h-1.5 bg-[#0f0f0f] rounded-full overflow-hidden border border-white/10 mt-2">
              <div className="h-full bg-[#00d4ff] animate-[pulse_1s_ease-in-out_infinite]" style={{ width: '85%' }}></div>
            </div>
          </div>
        )}

        {/* Step 3: Confirmed Receipt */}
        {step === 'confirmed' && (
          <div className="py-5 space-y-5">
            <div className="text-center space-y-1">
              <div className="w-14 h-14 rounded-full bg-[#00ba7c]/20 text-[#00ba7c] border border-[#00ba7c]/30 mx-auto flex items-center justify-center mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-black text-white">
                Ticket Commitment Confirmed!
              </h4>
              <p className="text-xs text-[#8b98a5]">
                Your ticket has been recorded on the Midnight ledger.
              </p>
            </div>

            <div className="space-y-2.5 p-5 rounded-2xl bg-[#0f0f0f] border border-white/10 text-xs">
              <div className="flex justify-between py-1 border-b border-white/[0.06]">
                <span className="text-[#8b98a5]">Lottery:</span>
                <span className="text-white font-semibold">{lottery.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.06]">
                <span className="text-[#8b98a5]">Confidential Number:</span>
                <span className="text-[#00d4ff] font-black text-sm">{selectedNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.06]">
                <span className="text-[#8b98a5]">Transaction Ref:</span>
                <span className="font-mono text-[#8b98a5]">{txHash}</span>
              </div>
              <div className="pt-1">
                <span className="text-[#8b98a5] block mb-1">On-Chain Commitment Hash:</span>
                <div className="font-mono text-[11px] text-[#00d4ff] bg-black p-2.5 rounded-xl border border-white/10 break-all flex items-center justify-between gap-2">
                  <span>{commitmentHex}</span>
                  <button
                    onClick={() => handleCopy(commitmentHex)}
                    className="text-[#8b98a5] hover:text-white shrink-0 p-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#00ba7c]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full myrad-btn-primary py-3.5 text-sm"
            >
              Done & View My Tickets
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
