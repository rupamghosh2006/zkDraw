import React, { useState, useEffect } from 'react';
import type { MidnightNetwork } from '../types/index.js';
import {
  getNetworkConfig,
  shortenContractAddress,
} from '../midnight/config.js';
import { fetchStorageInfo, type StorageInfo } from '../services/api.js';
import {
  ExternalLink,
  Copy,
  Check,
  Coins,
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
    <section className="protocol-strip mb-7 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`protocol-status-dot ${isPreprod ? 'is-live' : 'is-preview'}`}
        />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#536471]">Protocol status</p>
          <p className="mt-0.5 text-sm font-semibold text-white">
            {netConfig.name}
            <span className="ml-2 text-xs font-medium text-[#8b98a5]">
              {isPreprod ? `Live · Block #${netConfig.blockHeight}` : 'Testnet active'}
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="protocol-contract-chip flex items-center gap-1.5 px-2.5 py-1.5">
            <span className="protocol-contract-address text-xs font-mono font-semibold">
              {shortenContractAddress(netConfig.contractAddress)}
            </span>
            <button
              onClick={handleCopy}
              className="protocol-copy-button p-1 rounded-md transition-colors"
              title="Copy full contract address"
            >
              {copied ? (
                <Check className="protocol-copy-confirmation w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        <a
          href={netConfig.explorerContractUrl}
          target="_blank"
          rel="noreferrer"
          className="protocol-strip-link inline-flex items-center gap-1.5 font-semibold transition-colors"
        >
          <Layers className="protocol-strip-link-icon w-3.5 h-3.5" />
          Contract
          <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href={netConfig.faucetUrl}
          target="_blank"
          rel="noreferrer"
          className="protocol-strip-link hidden sm:inline-flex items-center gap-1.5 font-semibold transition-colors"
        >
          <Coins className="protocol-faucet-icon w-3.5 h-3.5" />
          Test tokens
          <ExternalLink className="w-3 h-3" />
        </a>
        {storageInfo?.cid && (
          <a
            href={storageInfo.gatewayUrl || `https://gateway.pinata.cloud/ipfs/${storageInfo.cid}`}
            target="_blank"
            rel="noreferrer"
            title="Lottery registry pinned to IPFS"
            aria-label="Open the lottery registry on IPFS"
            className="protocol-ipfs-link inline-flex rounded-md p-1 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </section>
  );
};
