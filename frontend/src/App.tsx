import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { ContractBanner } from './components/ContractBanner.js';
import { PrivacyBanner } from './components/PrivacyBanner.js';
import { ActiveLottery } from './components/ActiveLottery.js';
import { DrawManager } from './components/DrawManager.js';
import { VerifierView } from './components/VerifierView.js';
import { MyTickets } from './components/MyTickets.js';
import { InitLotteryModal } from './components/InitLotteryModal.js';
import { ToastContainer, type ToastMessage } from './components/Toast.js';
import { fetchLotteries } from './services/api.js';
import type { Lottery, UserTicket, MidnightNetwork } from './types/index.js';
import type { ConnectedWallet } from './midnight/wallet.js';
import { getNetworkConfig } from './midnight/config.js';
import { ExternalLink, Layers } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'lottery' | 'draw' | 'verify' | 'my-tickets'>('lottery');
  const [currentNetwork, setCurrentNetwork] = useState<MidnightNetwork>(() => {
    try {
      const saved = localStorage.getItem('zkdraw_selected_network');
      if (saved === 'preview' || saved === 'preprod') return saved;
    } catch {}
    return 'preprod';
  });
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showInitModal, setShowInitModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const showToast = useCallback((text: string, type: 'success' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const handleDismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Handle network switch
  const handleNetworkChange = useCallback(
    (newNet: MidnightNetwork) => {
      if (newNet === currentNetwork) return;
      setCurrentNetwork(newNet);
      try {
        localStorage.setItem('zkdraw_selected_network', newNet);
      } catch {}

      const netConf = getNetworkConfig(newNet);
      showToast(`Switched active network to ${netConf.name}!`);

      // If wallet was connected on a different network, disconnect it
      if (wallet && wallet.network !== newNet) {
        setWallet(null);
        showToast('Wallet disconnected due to network switch. Please reconnect on new network.');
      }
    },
    [currentNetwork, wallet, showToast],
  );

  // Load active lottery on mount and poll for current network
  const loadLotteryData = useCallback(async () => {
    try {
      const lotteries = await fetchLotteries(currentNetwork);
      if (lotteries.length > 0) {
        setLottery(lotteries[0]);
      }
    } catch (err) {
      console.warn('Could not fetch lotteries:', err);
    }
  }, [currentNetwork]);

  useEffect(() => {
    loadLotteryData();
    const interval = setInterval(loadLotteryData, 4000);
    return () => clearInterval(interval);
  }, [loadLotteryData]);

  // Load tickets from local storage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('zkdraw_user_tickets') ?? '[]');
      setUserTickets(saved);
    } catch {
      // Ignore
    }
  }, []);

  const handleTicketPurchased = (newTicket: UserTicket) => {
    setUserTickets((prev) => [newTicket, ...prev]);
    loadLotteryData();
  };

  const isCreator = Boolean(
    wallet?.address &&
    lottery?.adminKey &&
    wallet.address.toLowerCase() === lottery.adminKey.toLowerCase()
  );

  return (
    <div className="min-h-screen flex flex-col bg-black text-white selection:bg-[#00d4ff]/30 selection:text-[#00d4ff]">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Navbar with Network Toggle */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        wallet={wallet}
        setWallet={setWallet}
        ticketCount={userTickets.length}
        currentNetwork={currentNetwork}
        onNetworkChange={handleNetworkChange}
        onToast={showToast}
        isCreator={isCreator}
        showWalletModal={showWalletModal}
        setShowWalletModal={setShowWalletModal}
        onInitDraw={() => setShowInitModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
        {/* Network & Live Verified Contract Ribbon */}
        <ContractBanner
          network={currentNetwork}
          onNetworkChange={handleNetworkChange}
          onToast={showToast}
        />

        {/* Persistent Privacy Boundary Indicator */}
        <PrivacyBanner />

        {/* Dynamic Views */}
        {activeTab === 'lottery' && (
          <ActiveLottery
            lottery={lottery}
            wallet={wallet}
            onTicketPurchased={handleTicketPurchased}
            onOpenWalletModal={() => setShowWalletModal(true)}
            onInitDraw={() => setShowInitModal(true)}
            currentNetwork={currentNetwork}
            onToast={showToast}
          />
        )}

        {activeTab === 'draw' && (
          <DrawManager
            lottery={lottery}
            wallet={wallet}
            onLotteryUpdated={(updated) => setLottery(updated)}
            onNavigateToVerify={() => setActiveTab('verify')}
            onInitDraw={() => setShowInitModal(true)}
            currentNetwork={currentNetwork}
            onToast={showToast}
          />
        )}

        {activeTab === 'verify' && (
          <VerifierView
            lottery={lottery}
            currentNetwork={currentNetwork}
            onToast={showToast}
          />
        )}

        {activeTab === 'my-tickets' && (
          <MyTickets
            lottery={lottery}
            tickets={userTickets}
            onNavigateToPot={() => setActiveTab('lottery')}
            currentNetwork={currentNetwork}
            onToast={showToast}
          />
        )}
      </main>

      {/* Init Lottery Modal (Creator Mode) */}
      {showInitModal && (
        <InitLotteryModal
          currentNetwork={currentNetwork}
          wallet={wallet}
          onClose={() => setShowInitModal(false)}
          onLotteryCreated={(newLotto) => {
            setLottery(newLotto);
            loadLotteryData();
          }}
          onToast={showToast}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-black py-10 text-xs text-[#8b98a5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0f0f0f] p-1 border border-white/10 flex items-center justify-center shadow-sm">
              <img src="/logo.png" alt="zkDraw" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-extrabold text-white text-sm flex items-center gap-2">
                zkDraw • Confidential & Provably Fair Gaming
              </div>
              <p className="text-[11px] text-[#8b98a5]">
                Native Midnight Compact Smart Contracts & Zero-Knowledge Circuits
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[#8b98a5]">
            <a
              href="https://explorer.1am.xyz/contract/246fee4d100b2e2b6f98587e8a573e54ffc3a9d87e775a65c958a302f138e267?network=preprod"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[#00ba7c] font-semibold hover:underline"
            >
              <Layers className="w-3.5 h-3.5" />
              Preprod Contract ↗
            </a>
            <a
              href="https://explorer.1am.xyz/contract/f1667982258963752afb12360b34cbd7efcd11fa70930644c3cbf7bb8fb173ba?network=preview"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[#00d4ff] font-semibold hover:underline"
            >
              <Layers className="w-3.5 h-3.5" />
              Preview Contract ↗
            </a>
            <a
              href="https://docs.midnight.network/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white flex items-center gap-1 transition-colors"
            >
              Midnight Docs <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
