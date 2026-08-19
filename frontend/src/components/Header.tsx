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
  createDemoWallet,
  shortenAddress,
  type ConnectedWallet,
  type WalletOption,
} from '../midnight/wallet.js';

interface HeaderProps {
  activeTab: 'lottery' | 'draw' | 'verify' | 'my-tickets';
  setActiveTab: (tab: 'lottery' | 'draw' | 'verify' | 'my-tickets') => void;
  wallet: ConnectedWallet | null;
  setWallet: (wallet: ConnectedWallet | null) => void;
  ticketCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  wallet,
  setWallet,
  ticketCount,
}) => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [installedWallets, setInstalledWallets] = useState<WalletOption[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    setInstalledWallets(listInstalledWallets());
  }, []);

  const handleConnect = async (walletId?: string) => {
    setIsConnecting(true);
    try {
      if (walletId) {
        const connected = await connectMidnightWallet(walletId, 'preview');
        setWallet(connected);
      } else {
        const demo = createDemoWallet('preview');
        setWallet(demo);
      }
      setShowWalletModal(false);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setWallet(null);
  };

  return (
    <>
      <header className="border-b border-white/[0.08] bg-black/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Brand Logo (Myrad Style) */}
          <div
            className="flex items-center gap-3 cursor-pointer group select-none"
            onClick={() => setActiveTab('lottery')}
          >
            <div className="w-10 h-10 rounded-xl bg-[#0f0f0f] border border-white/10 p-1 flex items-center justify-center transition-transform group-hover:scale-105">
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

          {/* Nav Tabs (Myrad Pill Bar) */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-[#0f0f0f] border border-white/[0.08]">
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

          {/* Wallet Actions */}
          <div className="flex items-center gap-3">
            {wallet ? (
              <div className="flex items-center gap-2 bg-[#0f0f0f] border border-white/10 rounded-2xl p-1.5 pl-3.5">
                <div className="flex flex-col items-end mr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#00ba7c] animate-pulse"></span>
                    <span className="text-xs font-bold text-white">
                      {wallet.isDemo ? 'Lace Simulator' : wallet.name}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[#00d4ff] font-semibold">
                    {shortenAddress(wallet.address)}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-xl bg-[#1a1a1a] hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-700/60 border border-white/10 text-xs font-bold text-[#8b98a5] transition-all"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowWalletModal(true)}
                className="myrad-btn-primary px-5 py-2.5 text-xs sm:text-sm flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden items-center justify-around border-t border-white/[0.08] bg-black py-2.5 px-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="myrad-card w-full max-w-md p-6 sm:p-7 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
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
                    Preview / Preprod Network
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-[#8b98a5] hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#8b98a5] mb-6 leading-relaxed">
              Connect your Midnight wallet to buy confidential tickets and execute zero-knowledge proofs.
            </p>

            <div className="space-y-3">
              {installedWallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleConnect(w.id)}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.08] hover:border-[#00d4ff]/60 hover:bg-[#141414] transition-all text-left group"
                >
                  <div>
                    <div className="font-bold text-white group-hover:text-[#00d4ff]">
                      {w.name}
                    </div>
                    <div className="text-xs text-[#8b98a5]">
                      v{w.apiVersion} • Installed Midnight Extension
                    </div>
                  </div>
                  <ChevronDown className="w-5 h-5 -rotate-90 text-[#8b98a5] group-hover:text-[#00d4ff] transition-transform" />
                </button>
              ))}

              {/* Demo Wallet Option */}
              <button
                onClick={() => handleConnect()}
                disabled={isConnecting}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#0f0f0f] border border-[#00d4ff]/30 hover:border-[#00d4ff] hover:bg-[#141414] transition-all text-left group shadow-lg"
              >
                <div>
                  <div className="font-bold text-[#00d4ff] flex items-center gap-2">
                    Midnight Simulator Wallet
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#00d4ff]/10 text-[#00d4ff] font-extrabold uppercase tracking-wider border border-[#00d4ff]/30">
                      Instant Ready
                    </span>
                  </div>
                  <div className="text-xs text-[#8b98a5] mt-0.5">
                    Deterministic sandbox wallet with simulated tDUST funds
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 -rotate-90 text-[#00d4ff] transition-transform" />
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-white/[0.08] flex items-center justify-between text-xs text-[#8b98a5]">
              <span className="flex items-center gap-1 text-[#00ba7c] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Private keys stay on device
              </span>
              <a
                href="https://docs.midnight.network/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white flex items-center gap-1 font-semibold"
              >
                Midnight Docs <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
