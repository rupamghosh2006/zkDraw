import React, { useState } from 'react';
import { EyeOff, Eye, Lock, ChevronDown } from 'lucide-react';

export const PrivacyBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-cyan-900/40 bg-gradient-to-r from-cyan-950/20 via-slate-900/40 to-purple-950/20 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm sm:text-base">
                Midnight Privacy & Cryptographic Guarantee
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 uppercase tracking-wider">
                Zero-Knowledge
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Your chosen lottery number and salt remain 100% confidential. Only opaque cryptographic commitments exist on-chain.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="self-end sm:self-auto text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/40 px-3 py-1.5 rounded-lg transition-all"
        >
          {isExpanded ? 'Hide Privacy Matrix' : 'View Privacy Matrix'}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="mt-5 pt-5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
          {/* Private Box */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-900/40 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <EyeOff className="w-4 h-4" />
              Strictly Confidential (Client Witness Only)
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span><strong>Selected Ticket Number:</strong> Kept in your browser memory.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span><strong>High-Entropy Salt:</strong> Prevents rainbow table / brute-force mapping.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span><strong>Player Secret Key:</strong> Generates unlinkable winning prize nullifiers.</span>
              </li>
            </ul>
          </div>

          {/* Public Box */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-cyan-900/40 space-y-2.5">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
              <Eye className="w-4 h-4" />
              Publicly Verifiable (On-Chain Ledger State)
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span><strong>Ticket Commitments:</strong> 32-byte opaque hashes recorded in contract state.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span><strong>Operator Draw Commitment:</strong> Cryptographically locked before closure.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span><strong>Winning Result & Proofs:</strong> Verifiable mathematically by anyone.</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
