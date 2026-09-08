import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  Award,
  CheckCircle2,
  Sparkles,
  Flame,
  Radio,
} from 'lucide-react';
import {
  listInstalledWallets,
  connectMidnightWallet,
  shortenAddress,
  saveConnectedWalletId,
  clearSavedWalletId,
  type ConnectedWallet,
  type WalletOption,
} from '../midnight/wallet.js';
import {
  getNetworkConfig,
  type MidnightNetwork,
} from '../midnight/config.js';
import { NetworkToggle } from './NetworkToggle.js';

interface HeaderProps {
  activeTab: 'lottery' | 'draw' | 'verify' | 'my-tickets';
  setActiveTab: (tab: 'lottery' | 'draw' | 'verify' | 'my-tickets') => void;
  wallet: ConnectedWallet | null;
  setWallet: (wallet: ConnectedWallet | null) => void;
  ticketCount: number;
  currentNetwork: MidnightNetwork;
  onNetworkChange: (network: MidnightNetwork) => void;
  onToast?: (message: string) => void;
  isCreator?: boolean;
  showWalletModal?: boolean;
  setShowWalletModal?: (show: boolean) => void;
  onInitDraw?: () => void;
  isReconnecting?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  wallet,
  setWallet,
  ticketCount,
  currentNetwork,
  onNetworkChange,
  onToast,
  isCreator,
  showWalletModal: controlledShowWalletModal,
  setShowWalletModal: controlledSetShowWalletModal,
  onInitDraw,
  isReconnecting,
}) => {
  const [internalShowWalletModal, setInternalShowWalletModal] = useState(false);
  const showWalletModal = controlledShowWalletModal !== undefined ? controlledShowWalletModal : internalShowWalletModal;
  const setShowWalletModal = controlledSetShowWalletModal || setInternalShowWalletModal;

  const [installedWallets, setInstalledWallets] = useState<WalletOption[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const netConfig = getNetworkConfig(currentNetwork);

  useEffect(() => {
    // Initial check
    setInstalledWallets(listInstalledWallets());

    // Extensions might inject into window.midnight slightly after window load
    let count = 0;
    const interval = setInterval(() => {
      count++;
      const detected = listInstalledWallets();
      if (detected.length > 0) {
        setInstalledWallets(detected);
        clearInterval(interval);
      } else if (count > 20) {
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // Also refresh detected extensions whenever the wallet selection modal opens
  useEffect(() => {
    if (showWalletModal) {
      setInstalledWallets(listInstalledWallets());
    }
  }, [showWalletModal]);

  const handleConnect = async (walletId: string) => {
    setIsConnecting(true);
    try {
      const connected = await connectMidnightWallet(walletId, currentNetwork);
      saveConnectedWalletId(walletId);
      setWallet(connected);
      setShowWalletModal(false);
      if (onToast) {
        onToast(`Connected ${connected.name} to ${netConfig.name}!`);
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearSavedWalletId();
    setWallet(null);
    if (onToast) {
      onToast('Wallet disconnected');
    }
  };

  return (
    <>
      <header className="border-b border-white/[0.08] bg-black/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3 sm:gap-4">
          {/* Brand Logo & Title */}
          <div
            className="flex items-center gap-3 cursor-pointer group select-none shrink-0"
            onClick={() => setActiveTab('lottery')}
          >
            <div className="w-10 h-10 rounded-xl bg-[#0f0f0f] border border-white/10 p-1 flex items-center justify-center transition-transform group-hover:scale-105 shadow-md">
              <img
                src="/logo.png"
                alt="zkDraw Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  zkDraw
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0f0f0f] text-[#00d4ff] border border-[#00d4ff]/30 uppercase tracking-wider">
                  <Radio className="w-2.5 h-2.5 text-[#00d4ff] animate-pulse" />
                  Midnight
                </span>
              </div>
              <p className="text-[11px] text-[#8b98a5] font-medium hidden sm:block">
                Confidential & Provably Fair Gaming
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-[#0f0f0f] border border-white/[0.08]">
            <button
              onClick={() => setActiveTab('lottery')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'lottery'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Active Pot
            </button>
            <button
              onClick={() => setActiveTab('draw')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'draw'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Live Draw
            </button>
            <button
              onClick={() => setActiveTab('verify')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'verify'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Verify Fairness
            </button>
            <button
              onClick={() => setActiveTab('my-tickets')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'my-tickets'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              My Vault
              {ticketCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#00d4ff] text-black text-[10px] flex items-center justify-center font-black">
                  {ticketCount}
                </span>
              )}
            </button>
          </nav>

          {/* Right Side: Network Switcher + Wallet Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Network Toggle */}
            <NetworkToggle
              currentNetwork={currentNetwork}
              onNetworkChange={onNetworkChange}
            />

            {/* Init Draw button for creator */}
            {isCreator && onInitDraw && (
              <button
                onClick={onInitDraw}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Init Draw</span>
              </button>
            )}

            {/* Wallet Button */}
            {wallet ? (
              <div className="flex items-center gap-2 bg-[#0f0f0f] border border-white/10 rounded-2xl p-1.5 pl-3">
                <div className="flex flex-col items-end mr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#00ba7c] animate-pulse" />
                    <span className="text-xs font-bold text-white max-w-[100px] truncate">
                      {wallet.name}
                    </span>
                    {isCreator && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30 flex items-center gap-0.5">
                        👑 Creator
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-[#00d4ff] font-semibold">
                    {shortenAddress(wallet.address)}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-2.5 py-1.5 rounded-xl bg-[#1a1a1a] hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-700/60 border border-white/10 text-xs font-bold text-[#8b98a5] transition-all"
                  title="Disconnect Wallet"
                >
                  ✕
                </button>
              </div>
            ) : isReconnecting ? (
              <button
                disabled
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl bg-[#0f0f0f] border border-white/10 text-xs sm:text-sm text-[#8b98a5] flex items-center gap-2 cursor-wait"
              >
                <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-ping" />
                <span>Reconnecting...</span>
              </button>
            ) : (
              <button
                onClick={() => setShowWalletModal(true)}
                className="myrad-btn-primary px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex lg:hidden items-center justify-around border-t border-white/[0.08] bg-black py-2.5 px-2">
          <button
            onClick={() => setActiveTab('lottery')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
              activeTab === 'lottery' ? 'text-black bg-white' : 'text-[#8b98a5]'
            }`}
          >
            Active Pot
          </button>
          <button
            onClick={() => setActiveTab('draw')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
              activeTab === 'draw' ? 'text-black bg-white' : 'text-[#8b98a5]'
            }`}
          >
            Draw
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
              activeTab === 'verify' ? 'text-black bg-white' : 'text-[#8b98a5]'
            }`}
          >
            Verify
          </button>
          <button
            onClick={() => setActiveTab('my-tickets')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
              activeTab === 'my-tickets' ? 'text-black bg-white' : 'text-[#8b98a5]'
            }`}
          >
            Vault {ticketCount > 0 && `(${ticketCount})`}
          </button>
        </div>
      </header>

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="myrad-card w-full max-w-md p-6 sm:p-7 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0f0f0f] border border-white/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-[#00d4ff]" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">
                    Connect Midnight Wallet
                  </h3>
                  <p className="text-xs text-[#8b98a5]">
                    Target: <strong className="text-white">{netConfig.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-[#8b98a5] hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* In-Modal Network Selector */}
            <div className="mb-5 p-3 rounded-2xl bg-[#0f0f0f] border border-white/[0.08] flex items-center justify-between">
              <span className="text-xs font-bold text-[#8b98a5]">Target Network:</span>
              <NetworkToggle
                currentNetwork={currentNetwork}
                onNetworkChange={onNetworkChange}
                compact
              />
            </div>

            <p className="text-xs sm:text-sm text-[#8b98a5] mb-5 leading-relaxed">
              Connect your Midnight wallet (1AM / Lace) to submit zero-knowledge ticket commitments and claim confidential lottery prizes.
            </p>

            <div className="space-y-3">
              {installedWallets.length > 0 ? (
                installedWallets.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => handleConnect(w.id)}
                    disabled={isConnecting}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.08] hover:border-[#00d4ff]/60 hover:bg-[#141414] transition-all text-left group"
                  >
                    <div>
                      <div className="font-bold text-white group-hover:text-[#00d4ff] flex items-center gap-2">
                        {w.name}
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#00ba7c]/10 text-[#00ba7c] font-extrabold uppercase border border-[#00ba7c]/30">
                          Detected
                        </span>
                      </div>
                      <div className="text-xs text-[#8b98a5] mt-0.5">
                        v{w.apiVersion} • Midnight DApp Extension
                      </div>
                    </div>
                    <ChevronDown className="w-5 h-5 -rotate-90 text-[#8b98a5] group-hover:text-[#00d4ff] transition-transform" />
                  </button>
                ))
              ) : (
                <div className="p-5 rounded-2xl bg-[#0f0f0f] border border-white/[0.08] text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-center mx-auto text-[#00d4ff]">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-white">No Midnight Wallet Detected</div>
                  <p className="text-xs text-[#8b98a5] max-w-xs mx-auto leading-relaxed">
                    Zero simulated transactions: all proof generation and ticket transactions run directly on-chain. Please install the Midnight Lace wallet extension.
                  </p>
                  <div className="pt-2 flex flex-col gap-2">
                    <a
                      href="https://chromewebstore.google.com/detail/midnight-lace"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00d4ff] text-black font-bold text-xs hover:bg-[#00ba7c] transition-all"
                    >
                      <span>Get Midnight Lace Extension</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setInstalledWallets(listInstalledWallets())}
                      className="text-[11px] text-[#8b98a5] hover:text-white underline pt-1"
                    >
                      Refresh Detected Extensions
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-[#8b98a5]">
              <span className="flex items-center gap-1 text-[#00ba7c] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Private keys stay on device
              </span>
              <a
                href={netConfig.faucetUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white flex items-center gap-1 font-semibold text-[#00d4ff]"
              >
                Faucet Tokens <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
