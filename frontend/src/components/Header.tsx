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
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Brand Logo with Custom Asset */}
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveTab('lottery')}>
            <div className="relative group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-70 blur-sm group-hover:opacity-100 transition duration-300"></div>
              <div className="relative w-12 h-12 rounded-xl bg-slate-950 p-1 border border-cyan-500/40 flex items-center justify-center overflow-hidden">
                <img
                  src="/logo.png"
                  alt="zkDraw Logo"
                  className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                  onError={(e) => {
                    // Fallback to text if image fails
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-1">
                  <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent">
                    zkDraw
                  </span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 uppercase tracking-wider">
                  <Radio className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                  Midnight Testnet
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Confidential & Provably Fair Gaming
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner">
            <button
              onClick={() => setActiveTab('lottery')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'lottery'
                  ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-cyan-400" />
              Active Pot
            </button>
            <button
              onClick={() => setActiveTab('draw')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'draw'
                  ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Live Draw
            </button>
            <button
              onClick={() => setActiveTab('verify')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'verify'
                  ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verify Fairness
            </button>
            <button
              onClick={() => setActiveTab('my-tickets')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'my-tickets'
                  ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-pink-400" />
              My Vault
              {ticketCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] flex items-center justify-center font-black shadow-sm">
                  {ticketCount}
                </span>
              )}
            </button>
          </nav>

          {/* Wallet Actions */}
          <div className="flex items-center gap-3">
            {wallet ? (
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 pl-3.5 shadow-lg">
                <div className="flex flex-col items-end mr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-200">
                      {wallet.isDemo ? 'Lace Simulator' : wallet.name}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-cyan-400 font-semibold">
                    {shortenAddress(wallet.address)}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-950/50 hover:text-rose-300 hover:border-rose-700/60 border border-slate-700/60 text-xs font-bold text-slate-300 transition-all"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowWalletModal(true)}
                className="cyber-button px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden items-center justify-around border-t border-slate-800/80 bg-slate-950/90 py-2 px-2">
          <button
            onClick={() => setActiveTab('lottery')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              activeTab === 'lottery' ? 'text-cyan-400 bg-cyan-950/50' : 'text-slate-400'
            }`}
          >
            Active Pot
          </button>
          <button
            onClick={() => setActiveTab('draw')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              activeTab === 'draw' ? 'text-cyan-400 bg-cyan-950/50' : 'text-slate-400'
            }`}
          >
            Draw
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              activeTab === 'verify' ? 'text-emerald-400 bg-emerald-950/50' : 'text-slate-400'
            }`}
          >
            Verify
          </button>
          <button
            onClick={() => setActiveTab('my-tickets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
              activeTab === 'my-tickets' ? 'text-purple-400 bg-purple-950/50' : 'text-slate-400'
            }`}
          >
            Vault {ticketCount > 0 && `(${ticketCount})`}
          </button>
        </div>
      </header>

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 sm:p-7 border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Connect Midnight Wallet
                  </h3>
                  <p className="text-xs text-slate-400">
                    Preview / Preprod Network
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
              Connect your Midnight wallet to buy confidential tickets and execute zero-knowledge proofs.
            </p>

            <div className="space-y-3">
              {installedWallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleConnect(w.id)}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/60 hover:bg-slate-800/80 transition-all text-left group"
                >
                  <div>
                    <div className="font-bold text-white group-hover:text-cyan-300">
                      {w.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      v{w.apiVersion} • Installed Midnight Extension
                    </div>
                  </div>
                  <ChevronDown className="w-5 h-5 -rotate-90 text-slate-400 group-hover:text-cyan-400 transition-transform" />
                </button>
              ))}

              {/* Demo Wallet Option */}
              <button
                onClick={() => handleConnect()}
                disabled={isConnecting}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-purple-950/40 border border-cyan-700/40 hover:border-cyan-400 transition-all text-left group shadow-lg"
              >
                <div>
                  <div className="font-bold text-cyan-300 flex items-center gap-2">
                    Midnight Simulator Wallet
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-extrabold uppercase tracking-wider border border-cyan-500/30">
                      Instant Ready
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Deterministic sandbox wallet with simulated tDUST funds
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 -rotate-90 text-cyan-400 transition-transform" />
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Private keys stay on device
              </span>
              <a
                href="https://docs.midnight.network/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-cyan-400 flex items-center gap-1 font-semibold"
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
