import React, { useState } from 'react';
import {
  Lock,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Trophy,
  Hash,
  KeyRound,
} from 'lucide-react';
import type { Lottery } from '../types/index.js';
import { closeLottery, drawLottery } from '../services/api.js';

interface DrawManagerProps {
  lottery: Lottery | null;
  onLotteryUpdated: (lottery: Lottery) => void;
  onNavigateToVerify: () => void;
}

export const DrawManager: React.FC<DrawManagerProps> = ({
  lottery,
  onLotteryUpdated,
  onNavigateToVerify,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!lottery) {
    return (
      <div className="myrad-card p-12 text-center text-[#8b98a5]">
        Loading draw manager...
      </div>
    );
  }

  const handleCloseLottery = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await closeLottery(lottery.id);
      onLotteryUpdated(res.lottery);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrawWinner = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await drawLottery(lottery.id);
      onLotteryUpdated(res.lottery);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header & Flow Indicator */}
      <div className="myrad-card p-6 sm:p-8 border border-white/10 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#0f0f0f] border border-white/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#00d4ff]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Provable Draw Lifecycle Orchestrator
            </h2>
            <p className="text-xs sm:text-sm text-[#8b98a5]">
              Enforced by Midnight Compact smart contracts and commit-reveal randomness.
            </p>
          </div>
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
                ? 'bg-[#0f0f0f] border-amber-500/60 shadow-lg shadow-amber-500/10'
                : 'bg-[#0a0a0a] border-white/[0.06] opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Phase 2
              </span>
              <span className="myrad-badge badge-closed">Closed</span>
            </div>
            <h4 className="font-bold text-white text-base">Entropy Locked</h4>
            <p className="text-xs text-[#8b98a5] mt-1">
              Ticket sales cease. Operator pre-commitment is locked on-chain.
            </p>
          </div>

          {/* Step 3: Drawn */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              lottery.status === 'DRAWN'
                ? 'bg-[#0f0f0f] border-purple-500/60 shadow-lg shadow-purple-500/10'
                : 'bg-[#0a0a0a] border-white/[0.06] opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Phase 3
              </span>
              <span className="myrad-badge badge-drawn">Drawn</span>
            </div>
            <h4 className="font-bold text-white text-base">Verifiable Result</h4>
            <p className="text-xs text-[#8b98a5] mt-1">
              Secret entropy is revealed and verified in ZK circuit to derive winning number.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Card Based on State */}
      <div className="myrad-card p-6 sm:p-8 border border-white/10 space-y-6">
        {lottery.status === 'OPEN' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Close Lottery & Lock Commitments
                </h3>
                <p className="text-xs text-[#8b98a5] mt-0.5">
                  Currently {lottery.ticketCount} tickets registered in this pot.
                </p>
              </div>
              <button
                disabled={loading || lottery.ticketCount === 0}
                onClick={handleCloseLottery}
                className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Close Ticket Sales
              </button>
            </div>
          </div>
        )}

        {lottery.status === 'CLOSED' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Execute Zero-Knowledge Draw
                </h3>
                <p className="text-xs text-[#8b98a5] mt-0.5">
                  Reveals operator entropy and deterministically executes Compact circuit math.
                </p>
              </div>
              <button
                disabled={loading}
                onClick={handleDrawWinner}
                className="myrad-btn-primary px-7 py-3.5 text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Reveal Entropy & Draw Winner
              </button>
            </div>
          </div>
        )}

        {lottery.status === 'DRAWN' && (
          <div className="space-y-6">
            <div className="text-center py-10 bg-[#0f0f0f] rounded-3xl border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-[#00d4ff]" />
                <span className="text-xs font-black uppercase tracking-widest text-[#00d4ff]">
                  Official Provable Winning Number
                </span>
              </div>
              <div className="mt-2 text-7xl font-black text-white flex items-center justify-center">
                <span>{lottery.winningNumber}</span>
              </div>
              <p className="text-xs text-[#8b98a5] mt-3 font-medium">
                Drawn with {lottery.ticketCount} confidential participants
              </p>
            </div>

            {/* Cryptographic Parameters */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.06]">
                <div className="text-xs font-bold text-[#8b98a5] mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-[#00d4ff]" />
                  Pre-committed On-Chain Hash:
                </div>
                <div className="font-mono text-xs text-[#00d4ff] truncate bg-black p-2.5 rounded-xl border border-white/10">
                  {lottery.drawCommitment}
                </div>
              </div>

              {lottery.entropyRevealed && (
                <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.06]">
                  <div className="text-xs font-bold text-[#8b98a5] mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                    Revealed Operator Entropy Seed:
                  </div>
                  <div className="font-mono text-xs text-purple-300 truncate bg-black p-2.5 rounded-xl border border-white/10">
                    {lottery.entropyRevealed}
                  </div>
                </div>
              )}
            </div>

            {/* Verification CTA */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={onNavigateToVerify}
                className="myrad-btn-white px-7 py-3.5 text-sm flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Independently Verify Draw Fairness
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
