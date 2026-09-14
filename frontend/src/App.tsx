import { useState, useEffect, useCallback } from 'react';
import { RouterProvider, useLocation, useNavigate } from './router/index.js';
import { Header } from './components/Header.js';
import { ContractBanner } from './components/ContractBanner.js';
import { PrivacyBanner } from './components/PrivacyBanner.js';
import { ToastContainer, type ToastMessage } from './components/Toast.js';
import { CreateDrawPage } from './pages/CreateDrawPage.js';
import { ActiveDrawsPage } from './pages/ActiveDrawsPage.js';
import { DrawDetailPage } from './pages/DrawDetailPage.js';
import { MyVaultPage } from './pages/MyVaultPage.js';
import { VerifierPage } from './pages/VerifierPage.js';
import { fetchLotteries, isMockLottery } from './services/api.js';
import type { Lottery, UserTicket, MidnightNetwork } from './types/index.js';

import {
  type ConnectedWallet,
  autoReconnectMidnightWallet,
  connectMidnightWallet,
  saveConnectedWalletId,
  clearSavedWalletId,
  getSavedWalletId,
} from './midnight/wallet.js';
import { getNetworkConfig } from './midnight/config.js';
import { ExternalLink, Layers } from 'lucide-react';

function AppContent() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [currentNetwork, setCurrentNetwork] = useState<MidnightNetwork>(() => {
    try {
      const saved = localStorage.getItem('zkdraw_selected_network');
      if (saved === 'preview' || saved === 'preprod') return saved;
    } catch {}
    return 'preprod';
  });

  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [isReconnectingWallet, setIsReconnectingWallet] = useState<boolean>(() => {
    return Boolean(getSavedWalletId());
  });
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
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

  // One-time cleanup to ensure no mock test data remains in client localStorage
  useEffect(() => {
    try {
      const networks: MidnightNetwork[] = ['preprod', 'preview'];
      for (const net of networks) {
        const key = `zkdraw_lotteries_${net}_v3`;
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter((l) => !isMockLottery(l));
            localStorage.setItem(key, JSON.stringify(clean));
          }
        }
      }
    } catch {}
  }, []);


  // Auto-reconnect wallet on initial mount if previously connected
  useEffect(() => {
    let cancelled = false;

    const reconnect = async () => {
      const savedId = getSavedWalletId();
      if (!savedId) {
        setIsReconnectingWallet(false);
        return;
      }

      try {
        const reconnected = await autoReconnectMidnightWallet(currentNetwork);
        if (!cancelled && reconnected) {
          setWallet(reconnected);
        }
      } catch (err) {
        console.warn('Auto-reconnect error:', err);
      } finally {
        if (!cancelled) {
          setIsReconnectingWallet(false);
        }
      }
    };

    reconnect();

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle network switch
  const handleNetworkChange = useCallback(
    async (newNet: MidnightNetwork) => {
      if (newNet === currentNetwork) return;
      setCurrentNetwork(newNet);
      try {
        localStorage.setItem('zkdraw_selected_network', newNet);
      } catch {}

      const netConf = getNetworkConfig(newNet);
      showToast(`Switched active network to ${netConf.name}!`);

      // If wallet is connected, attempt to reconnect it on the new network
      if (wallet) {
        try {
          const reconnected = await connectMidnightWallet(wallet.id, newNet);
          setWallet(reconnected);
          saveConnectedWalletId(wallet.id);
          showToast(`Wallet reconnected on ${netConf.name}!`);
        } catch {
          setWallet(null);
          clearSavedWalletId();
          showToast('Wallet disconnected due to network switch. Please reconnect on new network.');
        }
      }
    },
    [currentNetwork, wallet, showToast],
  );

  // Load all lotteries for active network and poll regularly
  const loadLotteries = useCallback(async () => {
    try {
      const list = await fetchLotteries(currentNetwork);
      setLotteries(list);
    } catch (err) {
      console.warn('Could not fetch lotteries:', err);
    }
  }, [currentNetwork]);

  useEffect(() => {
    loadLotteries();
    const interval = setInterval(loadLotteries, 3500);
    return () => clearInterval(interval);
  }, [loadLotteries]);

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
    loadLotteries();
  };

  const handleLotteryCreated = (newLotto: Lottery) => {
    setLotteries((prev) => [newLotto, ...prev]);
    loadLotteries();
  };

  const handleLotteryUpdated = (updatedLotto: Lottery) => {
    setLotteries((prev) =>
      prev.map((l) => (l.id === updatedLotto.id ? updatedLotto : l)),
    );
    loadLotteries();
  };

  const isCreatorOfAny = Boolean(
    wallet?.address &&
      lotteries.some((l) => {
        const userAddr = wallet.address.toLowerCase();
        return (
          l.adminKey?.toLowerCase() === userAddr ||
          l.creatorAddress?.toLowerCase() === userAddr
        );
      }),
  );

  return (
    <div className="min-h-screen flex flex-col bg-black text-white selection:bg-[#00d4ff]/30 selection:text-[#00d4ff]">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Primary Navigation Header */}
      <Header
        wallet={wallet}
        setWallet={setWallet}
        ticketCount={userTickets.length}
        currentNetwork={currentNetwork}
        onNetworkChange={handleNetworkChange}
        onToast={showToast}
        isCreator={isCreatorOfAny}
        showWalletModal={showWalletModal}
        setShowWalletModal={setShowWalletModal}
        isReconnecting={isReconnectingWallet}
      />

      {/* Main Content View with Routes */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
        {/* Network & Live Verified Contract Ribbon */}
        <ContractBanner
          network={currentNetwork}
          onNetworkChange={handleNetworkChange}
          onToast={showToast}
        />

        {/* Persistent Privacy Boundary Indicator */}
        <PrivacyBanner />

        {/* Route-driven Pages */}
        {(pathname === '/' || pathname === '/draws') && (
          <ActiveDrawsPage
            lotteries={lotteries}
            currentNetwork={currentNetwork}
            wallet={wallet}
            onRefresh={loadLotteries}
          />
        )}

        {pathname.startsWith('/draws/') && (
          <DrawDetailPage
            currentNetwork={currentNetwork}
            wallet={wallet}
            onTicketPurchased={handleTicketPurchased}
            onOpenWalletModal={() => setShowWalletModal(true)}
            onLotteryUpdated={handleLotteryUpdated}
            onToast={showToast}
          />
        )}

        {pathname === '/create' && (
          <CreateDrawPage
            currentNetwork={currentNetwork}
            wallet={wallet}
            onLotteryCreated={handleLotteryCreated}
            onOpenWalletModal={() => setShowWalletModal(true)}
            onToast={showToast}
          />
        )}

        {pathname === '/my-tickets' && (
          <MyVaultPage
            tickets={userTickets}
            lotteries={lotteries}
            currentNetwork={currentNetwork}
            wallet={wallet}
            onOpenWalletModal={() => setShowWalletModal(true)}
            onToast={showToast}
          />
        )}

        {pathname.startsWith('/verify') && (
          <VerifierPage
            lotteries={lotteries}
            currentNetwork={currentNetwork}
            onToast={showToast}
          />
        )}

        {/* Fallback redirect if unknown route */}
        {pathname !== '/' &&
          pathname !== '/draws' &&
          !pathname.startsWith('/draws/') &&
          pathname !== '/create' &&
          pathname !== '/my-tickets' &&
          !pathname.startsWith('/verify') && (
            <div className="text-center py-16 space-y-4">
              <h2 className="text-2xl font-bold text-white">Page Not Found</h2>
              <p className="text-xs text-[#8b98a5]">The requested route does not exist.</p>
              <button
                onClick={() => navigate('/draws')}
                className="myrad-btn-primary px-6 py-2.5 text-xs font-bold"
              >
                Go to Active Draws
              </button>
            </div>
          )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-black py-10 text-xs text-[#8b98a5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0f0f0f] p-1 border border-white/10 flex items-center justify-center shadow-sm">
              <img src="/logo.png" alt="zkDraw" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-extrabold text-white text-sm flex items-center gap-2">
                zkDraw • Confidential &amp; Provably Fair Gaming
              </div>
              <p className="text-[11px] text-[#8b98a5]">
                Native Midnight Compact Smart Contracts &amp; Zero-Knowledge Circuits
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[#8b98a5]">
            <a
              href="https://explorer.1am.xyz/contract/f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959?network=preprod"
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

export function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}

export default App;
