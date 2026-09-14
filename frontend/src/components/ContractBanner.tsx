import React, { useState, useEffect } from 'react';
import type { MidnightNetwork } from '../types/index.js';
import {
  getNetworkConfig,
  shortenContractAddress,
} from '../midnight/config.js';
import { fetchStorageInfo, type StorageInfo } from '../services/api.js';
import {
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Cpu,
  Coins,
  Radio,
  Layers,
  Globe,
} from 'lucide-react';


interface ContractBannerProps {
  network: MidnightNetwork;
  onNetworkChange?: (network: MidnightNetwork) => void;
  onToast?: (message: string) => void;
}

export const ContractBanner: React.FC<ContractBannerProps> = ({
  network,
  onToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const netConfig = getNetworkConfig(network);

  useEffect(() => {
    fetchStorageInfo().then((info) => {
      if (info) setStorageInfo(info);
    });
  }, []);


  const handleCopy = () => {
    navigator.clipboard.writeText(netConfig.contractAddress);
    setCopied(true);
    if (onToast) {
      onToast(`Copied ${netConfig.name} Contract Address to clipboard!`);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const isPreprod = network === 'preprod';

  return (
    <div className="myrad-card p-4 sm:p-5 mb-8 border border-white/10 bg-gradient-to-r from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a] shadow-lg relative overflow-hidden">
      {/* Background Subtle Accent Glow */}
      <div
        className={`absolute -right-16 -top-16 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 ${
          isPreprod ? 'bg-[#00ba7c]' : 'bg-[#00d4ff]'
        }`}
      />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Network & Contract Info */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                isPreprod
                  ? 'bg-[#00ba7c]/10 border-[#00ba7c]/30 text-[#00ba7c]'
                  : 'bg-[#00d4ff]/10 border-[#00d4ff]/30 text-[#00d4ff]'
              }`}
            >
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-sm sm:text-base">
                  {netConfig.name}
                </span>
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isPreprod
                      ? 'bg-[#00ba7c]/15 text-[#00ba7c] border-[#00ba7c]/30'
                      : 'bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/30'
                  }`}
                >
                  {isPreprod ? `Live • Block #${netConfig.blockHeight}` : 'Active Testnet'}
                </span>
              </div>
              <p className="text-[11px] text-[#8b98a5] font-medium hidden sm:block">
                On-Chain Compact Smart Contract State Machine
              </p>
            </div>
          </div>

          {/* Contract Address Pill */}
          <div className="flex items-center gap-2 bg-[#000000]/80 border border-white/10 rounded-xl px-3 py-1.5 backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00ba7c]" />
            <span className="text-xs font-mono font-semibold text-[#00d4ff] selection:bg-[#00d4ff]/30">
              {shortenContractAddress(netConfig.contractAddress)}
            </span>
            <button
              onClick={handleCopy}
              className="p-1 text-[#8b98a5] hover:text-white hover:bg-white/10 rounded-md transition-colors"
              title="Copy full contract address"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#00ba7c]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Explorer Link */}
          <a
            href={netConfig.explorerContractUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0f0f0f] hover:bg-[#141414] border border-white/10 text-xs font-bold text-white hover:text-[#00d4ff] hover:border-[#00d4ff]/40 transition-all shadow-sm group"
          >
            <Layers className="w-3.5 h-3.5 text-[#00d4ff] group-hover:scale-110 transition-transform" />
            <span>1AM Explorer</span>
            <ExternalLink className="w-3 h-3 text-[#8b98a5] group-hover:text-white" />
          </a>

          {/* Faucet Link */}
          <a
            href={netConfig.faucetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0f0f0f] hover:bg-[#141414] border border-white/10 text-xs font-bold text-[#8b98a5] hover:text-white hover:border-white/20 transition-all shadow-sm"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Get tNIGHT Faucet</span>
            <ExternalLink className="w-3 h-3 text-[#8b98a5]" />
          </a>

          {/* IPFS / Pinata Storage Badge */}
          {storageInfo?.cid ? (
            <a
              href={storageInfo.gatewayUrl || `https://gateway.pinata.cloud/ipfs/${storageInfo.cid}`}
              target="_blank"
              rel="noreferrer"
              title={`Registry pinned to IPFS via Pinata (CID: ${storageInfo.cid})`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f0f0f] hover:bg-[#141414] border border-[#a855f7]/30 text-xs font-bold text-[#c084fc] hover:text-white transition-all shadow-sm group"
            >
              <Globe className="w-3.5 h-3.5 text-[#c084fc] group-hover:scale-110 transition-transform" />
              <span>IPFS • Pinata</span>
              <ExternalLink className="w-3 h-3 text-[#8b98a5] group-hover:text-white" />
            </a>
          ) : storageInfo?.configured ? (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f0f0f] border border-[#a855f7]/20 text-[11px] font-bold text-[#c084fc]">
              <Globe className="w-3 h-3 text-[#c084fc]" />
              <span>Pinata IPFS</span>
            </div>
          ) : null}

          {/* Active Circuits Badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f0f0f] border border-white/[0.06] text-[11px] font-bold text-[#00ba7c]">
            <Cpu className="w-3 h-3" />
            <span>5 Circuits Active</span>
          </div>

        </div>
      </div>
    </div>
  );
};
