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
import { wsClient } from './services/websocket.js';
import type { Lottery, UserTicket, MidnightNetwork } from './types/index.js';

import {
  type ConnectedWallet,
  autoReconnectMidnightWallet,
  connectMidnightWallet,
  saveConnectedWalletId,
  clearSavedWalletId,
  getSavedWalletId,
} from './midnight/wallet.js';
import { getNetworkConfig, isCorruptedTxHash } from './midnight/config.js';
import { ExternalLink, Layers } from 'lucide-react';

type AppTheme = 'light' | 'midnight';

function AppContent() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      return localStorage.getItem('zkdraw_theme') === 'midnight' ? 'midnight' : 'light';
    } catch {
      return 'light';
    }
  });

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('zkdraw_theme', theme);
    } catch {}
  }, [theme]);

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
    // 1. Initial fetch
    loadLotteries();

    // 2. Real-time WebSocket subscription: updates individual lotteries or the list instantly
    const unsubscribe = wsClient.subscribeToLotteries(
      currentNetwork,
      (updatedLottery) => {
        setLotteries((prev) => {
          const index = prev.findIndex(
            (l) =>
              l.id.toLowerCase() === updatedLottery.id.toLowerCase() ||
              (l.contractAddress &&
                updatedLottery.contractAddress &&
                l.contractAddress.toLowerCase() === updatedLottery.contractAddress.toLowerCase() &&
                l.drawId === updatedLottery.drawId),
          );
          if (index >= 0) {
            const next = [...prev];
            next[index] = { ...next[index], ...updatedLottery };
            return next;
          }
          return [updatedLottery, ...prev];
        });
      },
      (freshList) => {
        if (Array.isArray(freshList) && freshList.length > 0) {
          setLotteries(freshList);
        }
      },
    );

    // 3. Low-frequency safety poll (60s) ONLY when WS is disconnected
    const interval = setInterval(() => {
      if (!wsClient.isConnected() && document.visibilityState === 'visible') {
        loadLotteries();
      }
    }, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wsClient.isConnected()) {
        loadLotteries();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentNetwork, loadLotteries]);

  // Load tickets from local storage and sanitize/heal any legacy corrupted tx hashes
  useEffect(() => {
    try {
      const saved: UserTicket[] = JSON.parse(localStorage.getItem('zkdraw_user_tickets') ?? '[]');
      let changed = false;
      const cleaned = saved.map((t) => {
        if (t.txHash && isCorruptedTxHash(t.txHash)) {
          changed = true;
          // Heal the ticket if it matches the known user commitment from block 2556540
          if (t.commitmentHex?.toLowerCase().includes('976650ab')) {
            return { ...t, txHash: '0x82c611ce30cbe213474d41b311324e8c3cce553f27be3806f42e2fb8da9b4385' };
          }
          return { ...t, txHash: undefined };
        }
        return t;
      });
      if (changed) {
        localStorage.setItem('zkdraw_user_tickets', JSON.stringify(cleaned));
      }
      setUserTickets(cleaned);
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

  return (
    <div className={`app-shell theme-${theme} min-h-screen flex flex-col selection:bg-[#f6ff2f] selection:text-black`}>
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
        theme={theme}
        onThemeChange={setTheme}
        showWalletModal={showWalletModal}
        setShowWalletModal={setShowWalletModal}
        isReconnecting={isReconnectingWallet}
      />

      {/* Main Content View with Routes */}
      <main className="celo-main flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
        </div>
      </main>

      {/* Footer */}
      <footer className="celo-footer py-10 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#f6ff2f] p-1 border border-black flex items-center justify-center shadow-sm">
              <img src="/logo.png" alt="zkDraw" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-extrabold text-white text-sm flex items-center gap-2">
                zkDraw • Confidential &amp; Provably Fair Gaming
              </div>
              <p className="text-[11px] text-white/55">
                Native Midnight Compact Smart Contracts &amp; Zero-Knowledge Circuits
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-white/60">
            <a
              href="https://explorer.1am.xyz/contract/f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959?network=preprod"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[#f6ff2f] font-semibold hover:underline"
            >
              <Layers className="w-3.5 h-3.5" />
              Preprod Contract ↗
            </a>
            <a
              href="https://explorer.1am.xyz/contract/f1667982258963752afb12360b34cbd7efcd11fa70930644c3cbf7bb8fb173ba?network=preview"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[#f6ff2f] font-semibold hover:underline"
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
            <a
              href="https://x.com/zkdraw_midnight"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3.5 h-3.5 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>X (@zkdraw_midnight)</span>
              <ExternalLink className="w-3 h-3" />
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
