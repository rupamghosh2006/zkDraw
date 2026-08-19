import React, { useState } from 'react';
import { EyeOff, Eye, Lock, ChevronDown, Sparkles, Shield, KeyRound, Database } from 'lucide-react';

export const PrivacyBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-cyan-900/50 bg-gradient-to-r from-cyan-950/25 via-slate-900/40 to-purple-950/25 mb-8 relative overflow-hidden">
      {/* Background radiant ambient blur */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/10">
            <Lock className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-white text-base sm:text-lg tracking-tight">
                Midnight Zero-Knowledge Privacy Architecture
              </span>
              <span className="cyber-badge bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px]">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Proof-Backed Guarantee
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Your chosen lottery numbers, high-entropy salts, and player secrets <strong>never leave your browser</strong>. Only opaque 32-byte cryptographic commitments exist on-chain.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="self-end sm:self-auto text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-800/50 px-4 py-2 rounded-xl transition-all shadow-sm"
        >
          {isExpanded ? 'Hide Privacy Matrix' : 'Explore Privacy Matrix'}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="relative z-10 mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
          {/* Private Box */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-emerald-900/40 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                <EyeOff className="w-4 h-4" />
                Confidential (Client Witness Memory)
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                Never Broadcast
              </span>
            </div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Selected Ticket Number:</strong> Picked and proved locally inside the client circuit.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>256-bit CSPRNG Salt:</strong> Prevents rainbow table dictionary mapping attacks.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Player Secret Witness:</strong> Derives unlinkable one-way prize claim nullifiers.</span>
              </li>
            </ul>
          </div>

          {/* Public Box */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-cyan-900/40 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-extrabold text-xs uppercase tracking-wider">
                <Eye className="w-4 h-4" />
                Publicly Verifiable (On-Chain Ledger State)
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20">
                Transparent & Fair
              </span>
            </div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <Database className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>Ticket Commitments:</strong> 32-byte opaque hashes recorded in contract state.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>Operator Draw Commitment:</strong> Locked immutably on-chain before ticket closure.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>Mathematical Winner Derivation:</strong> Verifiable mathematically by any observer.</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
