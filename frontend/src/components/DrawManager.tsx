import React, { useState } from 'react';
import {
  Lock,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Loader2,
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
      <div className="glass-panel rounded-2xl p-12 text-center text-slate-400">
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
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800">
        <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2">
          Lottery Lifecycle & Provable Draw Orchestrator
        </h2>
        <p className="text-sm text-slate-400 mb-8">
          The lottery transitions across immutable states enforced by Midnight's smart contract. The final winner is derived deterministically from the pre-committed seed.
        </p>

        {/* 3-Step Lifecycle Visualizer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {/* Step 1: Open */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              lottery.status === 'OPEN'
                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/50'
                : 'bg-slate-900/40 border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Phase 1
              </span>
              <span className="cyber-badge badge-open">Open</span>
            </div>
            <h4 className="font-bold text-white text-base">Ticket Purchasing</h4>
            <p className="text-xs text-slate-400 mt-1">
              Users submit confidential ticket commitments without exposing their private choices.
            </p>
          </div>

          {/* Step 2: Closed */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              lottery.status === 'CLOSED'
                ? 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/50'
                : 'bg-slate-900/40 border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Phase 2
              </span>
              <span className="cyber-badge badge-closed">Closed</span>
            </div>
            <h4 className="font-bold text-white text-base">Entropy Locked</h4>
            <p className="text-xs text-slate-400 mt-1">
              Ticket sales cease. Operator pre-commitment is locked on-chain.
            </p>
          </div>

          {/* Step 3: Drawn */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              lottery.status === 'DRAWN'
                ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-950/50'
                : 'bg-slate-900/40 border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Phase 3
              </span>
              <span className="cyber-badge badge-drawn">Drawn</span>
            </div>
            <h4 className="font-bold text-white text-base">Verifiable Result</h4>
            <p className="text-xs text-slate-400 mt-1">
              Secret entropy is revealed and verified in ZK circuit to derive winning number.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Card Based on State */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-6">
        {lottery.status === 'OPEN' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Close Lottery & Lock Commitments
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Currently {lottery.ticketCount} tickets registered in this pot.
                </p>
              </div>
              <button
                disabled={loading || lottery.ticketCount === 0}
                onClick={handleCloseLottery}
                className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Close Ticket Sales
              </button>
            </div>
          </div>
        )}

        {lottery.status === 'CLOSED' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Execute Zero-Knowledge Draw
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reveals operator entropy and deterministically executes Compact circuit math.
                </p>
              </div>
              <button
                disabled={loading}
                onClick={handleDrawWinner}
                className="cyber-button px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Reveal Entropy & Draw Winner
              </button>
            </div>
          </div>
        )}

        {lottery.status === 'DRAWN' && (
          <div className="space-y-6">
            <div className="text-center py-6 bg-gradient-to-r from-purple-950/30 via-slate-900/60 to-cyan-950/30 rounded-2xl border border-purple-800/40">
              <span className="text-xs font-bold uppercase tracking-widest text-purple-400">
                Official Winning Result
              </span>
              <div className="mt-2 text-6xl font-black text-white flex items-center justify-center">
                <span className="bg-gradient-to-r from-cyan-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                  {lottery.winningNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Drawn at {new Date(lottery.drawnAt ?? '').toLocaleTimeString()} with {lottery.ticketCount} participants
              </p>
            </div>

            {/* Cryptographic Parameters */}
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs font-semibold text-slate-400 mb-1">
                  Pre-committed Draw Commitment:
                </div>
                <div className="font-mono text-xs text-cyan-300 truncate bg-slate-900 p-2 rounded border border-slate-800">
                  {lottery.drawCommitment}
                </div>
              </div>

              {lottery.entropyRevealed && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-xs font-semibold text-slate-400 mb-1">
                    Revealed Operator Entropy Seed:
                  </div>
                  <div className="font-mono text-xs text-purple-300 truncate bg-slate-900 p-2 rounded border border-slate-800">
                    {lottery.entropyRevealed}
                  </div>
                </div>
              )}
            </div>

            {/* Verification CTA */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={onNavigateToVerify}
                className="cyber-button px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2"
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
