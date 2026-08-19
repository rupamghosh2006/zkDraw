import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  Award,
  CheckCircle2,
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
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <span className="font-extrabold text-xl bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  zk
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">
                  zkDraw
                </span>
                <span className="cyber-badge bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                  Midnight
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Confidential & Provably Fair Lottery
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
            <button
              onClick={() => setActiveTab('lottery')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'lottery'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Active Pot
            </button>
            <button
              onClick={() => setActiveTab('draw')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'draw'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Draw Dashboard
            </button>
            <button
              onClick={() => setActiveTab('verify')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'verify'
                  ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Verify Fairness
            </button>
            <button
              onClick={() => setActiveTab('my-tickets')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'my-tickets'
                  ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Award className="w-4 h-4 text-purple-400" />
              My Tickets
              {ticketCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-purple-500/30 text-purple-300 text-xs flex items-center justify-center font-bold">
                  {ticketCount}
                </span>
              )}
            </button>
          </nav>

          {/* Wallet Connector */}
          <div className="flex items-center gap-3">
            {wallet ? (
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 pl-3">
                <div className="flex flex-col items-end mr-1">
                  <span className="text-xs font-semibold text-slate-200">
                    {wallet.isDemo ? 'Demo Wallet' : wallet.name}
                  </span>
                  <span className="font-mono text-[11px] text-cyan-400">
                    {shortenAddress(wallet.address)}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800/50 border border-slate-700/60 text-xs font-semibold text-slate-300 transition-all"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowWalletModal(true)}
                className="cyber-button px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-cyan-400" />
                Connect Midnight Wallet
              </h3>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-300 mb-6">
              Connect your Midnight wallet to buy confidential tickets and verify zero-knowledge draw proofs.
            </p>

            <div className="space-y-3">
              {installedWallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleConnect(w.id)}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/60 hover:bg-slate-800/80 transition-all text-left group"
                >
                  <div>
                    <div className="font-semibold text-white group-hover:text-cyan-300">
                      {w.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      v{w.apiVersion} • Installed Extension
                    </div>
                  </div>
                  <ChevronDown className="w-5 h-5 -rotate-90 text-slate-400 group-hover:text-cyan-400 transition-transform" />
                </button>
              ))}

              {/* Demo Wallet option */}
              <button
                onClick={() => handleConnect()}
                disabled={isConnecting}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-cyan-950/30 to-purple-950/30 border border-cyan-800/40 hover:border-cyan-400/80 transition-all text-left group"
              >
                <div>
                  <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                    Midnight Simulator Wallet
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold uppercase">
                      Ready
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Instant sandbox account with simulated faucet funds
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 -rotate-90 text-cyan-400 transition-transform" />
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Private keys never leave client
              </span>
              <a
                href="https://docs.midnight.network/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-cyan-400 flex items-center gap-1"
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
