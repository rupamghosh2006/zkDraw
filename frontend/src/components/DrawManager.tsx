import React, { useState } from 'react';
import {
  Lock,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Trophy,
  ExternalLink,
  Layers,
} from 'lucide-react';
import type { Lottery, MidnightNetwork } from '../types/index.js';
import { closeLottery, drawLottery } from '../services/api.js';
import { getNetworkConfig } from '../midnight/config.js';
import type { ConnectedWallet } from '../midnight/wallet.js';
import { closeLotteryOnChain, drawWinnerOnChain, resolveCreatorAdminAndDrawSecret } from '../midnight/contract.js';
import { hexToBytes } from '../midnight/crypto.js';
import { pureCircuits } from '../contract/index.js';

interface DrawManagerProps {
  lottery: Lottery | null;
  wallet: ConnectedWallet | null;
  onLotteryUpdated: (lottery: Lottery) => void;
  onNavigateToVerify: () => void;
  onInitDraw?: () => void;
  currentNetwork: MidnightNetwork;
  onToast?: (message: string) => void;
}

export const DrawManager: React.FC<DrawManagerProps> = ({
  lottery,
  wallet,
  onLotteryUpdated,
  onNavigateToVerify,
  onInitDraw,
  currentNetwork,
  onToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [provingStep, setProvingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const netConfig = getNetworkConfig(currentNetwork);

  if (!lottery) {
    return (
      <div className="myrad-card p-12 text-center text-[#8b98a5]">
        Loading draw manager for {netConfig.name}...
      </div>
    );
  }

  const isAutoEnded = lottery.ticketCount >= (lottery.maxTickets || 10) && lottery.status === 'CLOSED';

  const handleCloseLottery = async () => {
    if (!wallet?.connectedApi) {
      setError(
        'A real Midnight Lace or 1AM wallet is required to submit on-chain transactions. ' +
        'Please connect a funded Midnight wallet.',
      );
      return;
    }

    setLoading(true);
    setError(null);
    setProvingStep('Initiating on-chain closeLottery transaction...');

    try {
      const resolved = await resolveCreatorAdminAndDrawSecret(
        lottery,
        wallet,
        currentNetwork,
        (s) => setProvingStep(s),
      );

      const res = await closeLotteryOnChain(
        wallet.connectedApi,
        lottery.contractAddress,
        lottery.drawId ?? 0,
        resolved.adminSecretHex,
        currentNetwork,
        (s: string) => setProvingStep(s),
      );
      const updated = await closeLottery(lottery.id, currentNetwork);
      onLotteryUpdated(updated.lottery);
      if (onToast) {
        onToast(`On-chain transaction confirmed (${res.txHash.slice(0, 10)}...)! Ticket sales ended.`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setProvingStep('');
    }
  };

  const handleDrawWinner = async () => {
    if (!wallet?.connectedApi) {
      setError(
        'A real Midnight Lace or 1AM wallet is required to submit on-chain transactions. ' +
        'Please connect a funded Midnight wallet.',
      );
      return;
    }

    setLoading(true);
    setError(null);
    setProvingStep('Deriving winning entropy and mathematical quotient...');

    try {
      const resolved = await resolveCreatorAdminAndDrawSecret(
        lottery,
        wallet,
        currentNetwork,
        (s) => setProvingStep(s),
      );

      const secretHex = resolved.drawSecretHex;
      const secretBytes = hexToBytes(secretHex);
      const drawIdBig = BigInt(lottery.drawId ?? 0);

      const entropyBytes = pureCircuits.deriveWinningEntropy(
        drawIdBig,
        secretBytes,
        BigInt(lottery.ticketCount),
      );

      const sliced = entropyBytes.slice(0, 31);
      let entropyField = 0n;
      for (let i = sliced.length - 1; i >= 0; i -= 1) {
        entropyField = entropyField * 256n + BigInt(sliced[i]);
      }

      const span = BigInt(lottery.rangeMax - lottery.rangeMin + 1);
      const quotient = entropyField / span;
      const offset = entropyField % span;
      const winningNumber = lottery.rangeMin + Number(offset);

      setProvingStep('Submitting on-chain drawWinner circuit proof to Midnight...');
      const res = await drawWinnerOnChain(
        wallet.connectedApi,
        lottery.contractAddress,
        lottery.drawId ?? 0,
        resolved.adminSecretHex,
        secretHex,
        winningNumber,
        quotient,
        currentNetwork,
        (s: string) => setProvingStep(s),
      );

      const updated = await drawLottery(lottery.id, currentNetwork);
      onLotteryUpdated(updated.lottery);
      if (onToast) {
        onToast(`Winning Number #${res.winningNumber} drawn on ${netConfig.name} on-chain.`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setProvingStep('');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header & Flow Indicator */}
      <div className="myrad-card p-6 sm:p-8 border border-white/10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f0f0f] border border-white/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#00d4ff]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Provable Draw Lifecycle Orchestrator
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#00ba7c]/15 text-[#00ba7c] border border-[#00ba7c]/30">
                  {netConfig.name}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#8b98a5]">
                Enforced by Midnight Compact smart contracts and commit-reveal randomness.
              </p>
            </div>
          </div>

          <a
            href={netConfig.explorerContractUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f0f0f] hover:bg-[#141414] border border-white/10 text-xs font-bold text-[#8b98a5] hover:text-white transition-all self-start sm:self-auto"
          >
            <Layers className="w-3.5 h-3.5 text-[#00d4ff]" />
            <span>Contract State</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* 3-Step Lifecycle Visualizer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {/* Step 1: Open */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              lottery.status === 'OPEN'
                ? 'bg-[#0f0f0f] border-[#00d4ff]/60 shadow-lg shadow-[#00d4ff]/10'
                : 'bg-[#0a0a0a] border-white/[0.06] opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00d4ff]">
                Phase 1
              </span>
              <span className="myrad-badge badge-open">Open</span>
            </div>
            <h4 className="font-bold text-white text-base">Ticket Purchasing</h4>
            <p className="text-xs text-[#8b98a5] mt-1">
              Users submit confidential ticket commitments without exposing their private choices.
            </p>
          </div>

          {/* Step 2: Closed */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              lottery.status === 'CLOSED'
                ? 'bg-[#0f0f0f] border-amber-400/60 shadow-lg shadow-amber-400/10'
                : 'bg-[#0a0a0a] border-white/[0.06] opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Phase 2
              </span>
              <span className="myrad-badge badge-closed">Closed</span>
            </div>
            <h4 className="font-bold text-white text-base">Entropy Reveal</h4>
            <p className="text-xs text-[#8b98a5] mt-1">
              Ticket sales are locked. The contract prepares to reveal the pre-committed operator seed.
            </p>
          </div>

          {/* Step 3: Drawn */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              lottery.status === 'DRAWN'
                ? 'bg-[#0f0f0f] border-purple-400/60 shadow-lg shadow-purple-400/10'
                : 'bg-[#0a0a0a] border-white/[0.06] opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Phase 3
              </span>
              <span className="myrad-badge badge-drawn">Drawn</span>
            </div>
            <h4 className="font-bold text-white text-base">Provable Winner</h4>
            <p className="text-xs text-[#8b98a5] mt-1">
              Winning number is mathematically computed and proved on-chain via Euclidean division.
            </p>
          </div>
        </div>
      </div>

      {/* Proving Step Progress Banner */}
      {provingStep && (
        <div className="p-4 rounded-2xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-white text-xs flex items-center gap-3 animate-pulse">
          <Loader2 className="w-5 h-5 text-[#00d4ff] animate-spin shrink-0" />
          <div>
            <div className="font-bold text-[#00d4ff]">On-Chain Transaction in Progress</div>
            <div className="text-[11px] text-[#8b98a5]">{provingStep}</div>
          </div>
        </div>
      )}

      {/* Auto-Ended Alert if Sellout Reached */}
      {isAutoEnded && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div className="font-bold text-emerald-300">Draw Ended Automatically</div>
            <div className="text-[11px] text-emerald-200/80">
              All {lottery.maxTickets || 10} tickets were sold! Ticket sales have automatically locked. Ready to execute provable draw.
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Close Lottery Panel */}
        <div className="myrad-card p-6 border border-white/10 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8b98a5] uppercase tracking-wider">
                Step 1: End Draw Early (Creator Only)
              </span>
              <span className="text-xs text-white font-mono font-semibold">
                {lottery.ticketCount} / {lottery.maxTickets || 10} tickets
              </span>
            </div>
            <h3 className="text-lg font-black text-white">End Ticket Sales</h3>
            <p className="text-xs text-[#8b98a5] leading-relaxed">
              Only the lottery creator can end the draw before all {lottery.maxTickets || 10} tickets are sold. If all tickets sell out, it ends automatically.
            </p>
          </div>

          <button
            onClick={handleCloseLottery}
            disabled={loading || lottery.status !== 'OPEN' || lottery.ticketCount === 0}
            className={`myrad-btn-secondary w-full py-3.5 text-xs font-bold flex items-center justify-center gap-2 ${
              lottery.status !== 'OPEN' || lottery.ticketCount === 0 ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4 text-amber-400" />
            )}
            End Draw Early (On-Chain)
          </button>
        </div>

        {/* Execute Draw Panel */}
        <div className="myrad-card p-6 border border-white/10 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8b98a5] uppercase tracking-wider">
                Step 2: Circuit Execution
              </span>
              <span className="text-xs text-[#00ba7c] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Pure ZK Math
              </span>
            </div>
            <h3 className="text-lg font-black text-white">Execute Provable Draw</h3>
            <p className="text-xs text-[#8b98a5] leading-relaxed">
              Reveals the pre-committed operator seed hash and derives winning number W through Euclidean field modulus.
            </p>
          </div>

          <button
            onClick={handleDrawWinner}
            disabled={loading || lottery.status !== 'CLOSED'}
            className={`myrad-btn-primary w-full py-3.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 ${
              lottery.status !== 'CLOSED' ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Execute Draw on {netConfig.name}
          </button>
        </div>
      </div>

      {/* Result Card if DRAWN */}
      {lottery.status === 'DRAWN' && (
        <div className="myrad-card p-8 border border-purple-500/30 bg-gradient-to-b from-[#12081f] to-[#0a0a0a] shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-3xl bg-purple-950/60 border border-purple-500/40 text-purple-300 flex items-center justify-center font-black text-4xl shadow-inner shadow-purple-500/20">
                {lottery.winningNumber}
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-extrabold text-purple-400 uppercase tracking-widest mb-1">
                  <Trophy className="w-4 h-4" />
                  Official Winning Number
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Lucky Number #{lottery.winningNumber}
                </h3>
                <p className="text-xs text-[#8b98a5] mt-1">
                  Proved on {netConfig.name} via Compact Pure Circuit
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 self-start sm:self-center">
              <button
                onClick={onNavigateToVerify}
                className="myrad-btn-white px-5 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-black" />
                Verify Circuit Math
                <ArrowRight className="w-4 h-4" />
              </button>
              {onInitDraw && (
                <button
                  onClick={onInitDraw}
                  className="myrad-btn-primary px-5 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Init New Draw
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
