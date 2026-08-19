import React, { useState } from 'react';
import { EyeOff, Eye, Lock, ChevronDown, Sparkles, Shield, KeyRound, Database } from 'lucide-react';

export const PrivacyBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="myrad-card p-5 sm:p-6 mb-8 border border-white/[0.08] relative overflow-hidden">
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#0f0f0f] border border-white/10 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[#00d4ff]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-white text-base sm:text-lg tracking-tight">
                Midnight Zero-Knowledge Privacy Architecture
              </span>
              <span className="myrad-badge bg-[#00ba7c]/10 text-[#00ba7c] border border-[#00ba7c]/30 text-[10px]">
                <Sparkles className="w-3 h-3" />
                Proof-Backed Guarantee
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#8b98a5] mt-1 max-w-2xl leading-relaxed">
              Your chosen lottery numbers, high-entropy salts, and player secrets <strong>never leave your browser</strong>. Only opaque 32-byte cryptographic commitments exist on-chain.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="self-end sm:self-auto text-xs font-bold text-[#00d4ff] hover:text-white flex items-center gap-1.5 bg-[#0f0f0f] hover:bg-[#141414] border border-white/10 px-4 py-2 rounded-xl transition-all shadow-sm"
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
        <div className="relative z-10 mt-6 pt-6 border-t border-white/[0.08] grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
          {/* Private Box */}
          <div className="p-5 rounded-2xl bg-[#0f0f0f] border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#00ba7c] font-extrabold text-xs uppercase tracking-wider">
                <EyeOff className="w-4 h-4" />
                Confidential (Client Witness Memory)
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00ba7c]/10 text-[#00ba7c] font-bold border border-[#00ba7c]/20">
                Never Broadcast
              </span>
            </div>
            <ul className="space-y-2 text-xs text-[#8b98a5]">
              <li className="flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-[#00ba7c] shrink-0 mt-0.5" />
                <span><strong className="text-white">Selected Ticket Number:</strong> Picked and proved locally inside the client circuit.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-[#00ba7c] shrink-0 mt-0.5" />
                <span><strong className="text-white">256-bit CSPRNG Salt:</strong> Prevents rainbow table dictionary mapping attacks.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[#00ba7c] shrink-0 mt-0.5" />
                <span><strong className="text-white">Player Secret Witness:</strong> Derives unlinkable one-way prize claim nullifiers.</span>
              </li>
            </ul>
          </div>

          {/* Public Box */}
          <div className="p-5 rounded-2xl bg-[#0f0f0f] border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#00d4ff] font-extrabold text-xs uppercase tracking-wider">
                <Eye className="w-4 h-4" />
                Publicly Verifiable (On-Chain Ledger State)
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00d4ff]/10 text-[#00d4ff] font-bold border border-[#00d4ff]/20">
                Transparent & Fair
              </span>
            </div>
            <ul className="space-y-2 text-xs text-[#8b98a5]">
              <li className="flex items-start gap-2.5">
                <Database className="w-4 h-4 text-[#00d4ff] shrink-0 mt-0.5" />
                <span><strong className="text-white">Ticket Commitments:</strong> 32-byte opaque hashes recorded in contract state.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[#00d4ff] shrink-0 mt-0.5" />
                <span><strong className="text-white">Operator Draw Commitment:</strong> Locked immutably on-chain before ticket closure.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[#00d4ff] shrink-0 mt-0.5" />
                <span><strong className="text-white">Mathematical Winner Derivation:</strong> Verifiable mathematically by any observer.</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
