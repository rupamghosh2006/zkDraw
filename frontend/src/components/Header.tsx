import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
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
import { Link, useLocation } from '../router/index.js';

interface HeaderProps {
  wallet: ConnectedWallet | null;
  setWallet: (wallet: ConnectedWallet | null) => void;
  ticketCount: number;
  currentNetwork: MidnightNetwork;
  onNetworkChange: (network: MidnightNetwork) => void;
  onToast?: (message: string) => void;
  isCreator?: boolean;
  showWalletModal?: boolean;
  setShowWalletModal?: (show: boolean) => void;
  isReconnecting?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  wallet,
  setWallet,
  ticketCount,
  currentNetwork,
  onNetworkChange,
  onToast,
  isCreator,
  showWalletModal: controlledShowWalletModal,
  setShowWalletModal: controlledSetShowWalletModal,
  isReconnecting,
}) => {
  const { pathname } = useLocation();
  const [internalShowWalletModal, setInternalShowWalletModal] = useState(false);
  const showWalletModal = controlledShowWalletModal !== undefined ? controlledShowWalletModal : internalShowWalletModal;
  const setShowWalletModal = controlledSetShowWalletModal || setInternalShowWalletModal;

  const [installedWallets, setInstalledWallets] = useState<WalletOption[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const netConfig = getNetworkConfig(currentNetwork);

  const isDrawsActive = pathname === '/' || pathname === '/draws' || pathname.startsWith('/draws/');
  const isCreateActive = pathname === '/create';
  const isVaultActive = pathname === '/my-tickets';
  const isVerifyActive = pathname.startsWith('/verify');

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
      <header className="celo-header">
        <div className="celo-announcement">Built on Midnight · Zero-knowledge lottery infrastructure for fair play</div>
        <div className="celo-nav max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link
            to="/draws"
            className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
          >
            <div className="celo-brand-mark w-9 h-9 p-1 flex items-center justify-center transition-transform group-hover:scale-105">
              <img
                src="/logo.png"
                alt="zkDraw Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-black">zkDraw</span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-black/65">
                <Radio className="w-2.5 h-2.5 text-black" />
                Midnight
              </span>
            </div>
          </Link>

          {/* Primary navigation keeps the chrome intentionally quiet. */}
          <nav className="hidden lg:flex h-full items-center gap-6">
            <Link
              to="/draws"
              className={`celo-nav-link ${isDrawsActive ? 'is-active' : ''} h-full inline-flex items-center border-b-2 text-sm font-semibold transition-colors ${
                isDrawsActive
                  ? 'border-[#00d4ff] text-white'
                  : 'border-transparent text-[#8b98a5] hover:text-white'
              }`}
            >
              Draws
            </Link>

            <Link
              to="/create"
              className={`celo-nav-link ${isCreateActive ? 'is-active' : ''} h-full inline-flex items-center border-b-2 text-sm font-semibold transition-colors ${
                isCreateActive
                  ? 'border-[#00d4ff] text-white'
                  : 'border-transparent text-[#8b98a5] hover:text-white'
              }`}
            >
              Create
            </Link>

            <Link
              to="/my-tickets"
              className={`celo-nav-link ${isVaultActive ? 'is-active' : ''} h-full inline-flex items-center gap-1.5 border-b-2 text-sm font-semibold transition-colors ${
                isVaultActive
                  ? 'border-[#00d4ff] text-white'
                  : 'border-transparent text-[#8b98a5] hover:text-white'
              }`}
            >
              Vault
              {ticketCount > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-black text-[#f6ff2f] text-[10px] flex items-center justify-center font-black">
                  {ticketCount}
                </span>
              )}
            </Link>

            <Link
              to="/verify"
              className={`celo-nav-link ${isVerifyActive ? 'is-active' : ''} h-full inline-flex items-center border-b-2 text-sm font-semibold transition-colors ${
                isVerifyActive
                  ? 'border-[#00d4ff] text-white'
                  : 'border-transparent text-[#8b98a5] hover:text-white'
              }`}
            >
              Verify
            </Link>
          </nav>

          {/* Network and wallet are the only utility controls in the header. */}
          <div className="flex items-center gap-2 sm:gap-3">
            <NetworkToggle
              currentNetwork={currentNetwork}
              onNetworkChange={onNetworkChange}
              className="network-toggle-celo hidden sm:inline-flex"
              compact
            />

            {wallet ? (
              <div className="celo-wallet flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-1.5">
                <div className="hidden sm:flex flex-col items-end mr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f6ff2f]" />
                    <span className="text-xs font-semibold text-white max-w-[100px] truncate">
                      {wallet.name}
                    </span>
                    {isCreator && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30 flex items-center gap-0.5">
                        👑 Creator
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-white/60 font-medium">
                    {shortenAddress(wallet.address)}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-7 h-7 rounded-full hover:bg-white hover:text-black text-xs font-bold text-white/70 transition-colors"
                  title="Disconnect Wallet"
                >
                  ✕
                </button>
              </div>
            ) : isReconnecting ? (
              <button
                disabled
                className="px-3.5 py-2 rounded-full bg-black text-xs text-white/70 flex items-center gap-2 cursor-wait"
              >
                <span className="w-2 h-2 rounded-full bg-[#f6ff2f] animate-ping" />
                <span>Reconnecting...</span>
              </button>
            ) : (
              <button
                onClick={() => setShowWalletModal(true)}
                className="celo-wallet px-3.5 sm:px-4 py-2 text-xs sm:text-sm flex items-center gap-2 rounded-full font-bold transition-colors"
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">Connect wallet</span>
                <span className="sm:hidden">Connect</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile navigation mirrors the desktop information hierarchy. */}
        <div className="celo-mobile-nav flex lg:hidden items-center justify-around px-2">
          <Link
            to="/draws"
            className={`py-3 text-xs font-semibold border-b-2 ${
              isDrawsActive ? 'text-black border-black' : 'text-black/60 border-transparent'
            }`}
          >
            Draws
          </Link>
          <Link
            to="/create"
            className={`py-3 text-xs font-semibold border-b-2 ${
              isCreateActive ? 'text-black border-black' : 'text-black/60 border-transparent'
            }`}
          >
            Create
          </Link>
          <Link
            to="/my-tickets"
            className={`py-3 text-xs font-semibold flex items-center gap-1 border-b-2 ${
              isVaultActive ? 'text-black border-black' : 'text-black/60 border-transparent'
            }`}
          >
            Vault {ticketCount > 0 && `(${ticketCount})`}
          </Link>
          <Link
            to="/verify"
            className={`py-3 text-xs font-semibold border-b-2 ${
              isVerifyActive ? 'text-black border-black' : 'text-black/60 border-transparent'
            }`}
          >
            Verify
          </Link>
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
