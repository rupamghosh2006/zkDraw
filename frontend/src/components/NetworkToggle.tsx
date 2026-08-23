import React from 'react';
import type { MidnightNetwork } from '../types/index.js';

interface NetworkToggleProps {
  currentNetwork: MidnightNetwork;
  onNetworkChange: (network: MidnightNetwork) => void;
  className?: string;
  compact?: boolean;
}

export const NetworkToggle: React.FC<NetworkToggleProps> = ({
  currentNetwork,
  onNetworkChange,
  className = '',
  compact = false,
}) => {
  return (
    <div
      className={`inline-flex items-center p-1 rounded-2xl bg-[#0a0a0a] border border-white/[0.12] shadow-inner select-none ${className}`}
      role="group"
      aria-label="Midnight Network Selector"
    >
      {/* Preprod Button */}
      <button
        type="button"
        onClick={() => onNetworkChange('preprod')}
        className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all duration-200 ${
          currentNetwork === 'preprod'
            ? 'bg-gradient-to-r from-[#00ba7c]/20 via-[#00ba7c]/15 to-[#00ba7c]/10 text-white border border-[#00ba7c]/40 shadow-sm shadow-[#00ba7c]/20'
            : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04] border border-transparent'
        } ${compact ? 'px-2.5 py-1 text-[11px]' : ''}`}
        title="Switch to Midnight Preprod Testnet (Mined Block #2231587)"
      >
        <span
          className={`w-2 h-2 rounded-full transition-all ${
            currentNetwork === 'preprod'
              ? 'bg-[#00ba7c] shadow-[0_0_8px_#00ba7c] animate-pulse'
              : 'bg-[#536471]'
          }`}
        />
        <span>Preprod</span>
        {currentNetwork === 'preprod' && !compact && (
          <span className="hidden sm:inline-flex items-center text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-[#00ba7c]/20 text-[#00ba7c] border border-[#00ba7c]/30">
            Live
          </span>
        )}
      </button>

      {/* Preview Button */}
      <button
        type="button"
        onClick={() => onNetworkChange('preview')}
        className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all duration-200 ${
          currentNetwork === 'preview'
            ? 'bg-gradient-to-r from-[#00d4ff]/20 via-[#00d4ff]/15 to-[#00d4ff]/10 text-white border border-[#00d4ff]/40 shadow-sm shadow-[#00d4ff]/20'
            : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04] border border-transparent'
        } ${compact ? 'px-2.5 py-1 text-[11px]' : ''}`}
        title="Switch to Midnight Preview Testnet"
      >
        <span
          className={`w-2 h-2 rounded-full transition-all ${
            currentNetwork === 'preview'
              ? 'bg-[#00d4ff] shadow-[0_0_8px_#00d4ff] animate-pulse'
              : 'bg-[#536471]'
          }`}
        />
        <span>Preview</span>
        {currentNetwork === 'preview' && !compact && (
          <span className="hidden sm:inline-flex items-center text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30">
            Testnet
          </span>
        )}
      </button>
    </div>
  );
};
