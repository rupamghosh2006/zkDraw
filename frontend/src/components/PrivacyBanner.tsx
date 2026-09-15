import React, { useState } from 'react';
import { EyeOff, Eye, Lock, ChevronDown, Sparkles, Shield, KeyRound, Database } from 'lucide-react';

export const PrivacyBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="relative mb-10 overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.045] via-[#0a0a0a] to-[#00ba7c]/[0.07] px-6 py-8 sm:px-9 sm:py-10">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#00ba7c]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-px w-1/2 bg-gradient-to-r from-transparent via-[#00d4ff]/30 to-transparent" />

      <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end">
        <div className="max-w-3xl">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#00ba7c]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00ba7c]" />
            Privacy first
          </div>
          <h1 className="max-w-2xl text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.05]">
            Confidential entry. <span className="text-[#8b98a5]">Provable outcomes.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#a8b3bd] sm:text-base">
            Pick a number privately, submit a zero-knowledge commitment, and verify the result on-chain—without exposing your entry.
          </p>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="justify-self-start lg:justify-self-end inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-white/20 hover:bg-white/[0.06]"
        >
          <Lock className="w-3.5 h-3.5 text-[#00d4ff]" />
          {isExpanded ? 'Hide privacy details' : 'How privacy works'}
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#8b98a5] transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="relative z-10 mt-8 grid grid-cols-1 gap-4 border-t border-white/[0.08] pt-6 md:grid-cols-2 animate-in fade-in duration-200">
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
    </section>
  );
};
