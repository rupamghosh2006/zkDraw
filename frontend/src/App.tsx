import { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { PrivacyBanner } from './components/PrivacyBanner.js';
import { ActiveLottery } from './components/ActiveLottery.js';
import { DrawManager } from './components/DrawManager.js';
import { VerifierView } from './components/VerifierView.js';
import { MyTickets } from './components/MyTickets.js';
import { fetchLotteries } from './services/api.js';
import type { Lottery, UserTicket } from './types/index.js';
import type { ConnectedWallet } from './midnight/wallet.js';
import { createDemoWallet } from './midnight/wallet.js';

export function App() {
  const [activeTab, setActiveTab] = useState<'lottery' | 'draw' | 'verify' | 'my-tickets'>('lottery');
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);

  // Load active lottery on mount and poll
  const loadLotteryData = async () => {
    try {
      const lotteries = await fetchLotteries();
      if (lotteries.length > 0) {
        setLottery(lotteries[0]);
      }
    } catch (err) {
      console.warn('Could not fetch lotteries:', err);
    }
  };

  useEffect(() => {
    loadLotteryData();
    const interval = setInterval(loadLotteryData, 4000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Navbar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        wallet={wallet}
        setWallet={setWallet}
        ticketCount={userTickets.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Persistent Privacy Boundary Indicator */}
        <PrivacyBanner />

        {/* Dynamic Views */}
        {activeTab === 'lottery' && (
          <ActiveLottery
            lottery={lottery}
            wallet={wallet}
            onTicketPurchased={handleTicketPurchased}
            onOpenWalletModal={() => {
              const demo = createDemoWallet('preview');
              setWallet(demo);
            }}
          />
        )}

        {activeTab === 'draw' && (
          <DrawManager
            lottery={lottery}
            onLotteryUpdated={(updated) => setLottery(updated)}
            onNavigateToVerify={() => setActiveTab('verify')}
          />
        )}

        {activeTab === 'verify' && <VerifierView lottery={lottery} />}

        {activeTab === 'my-tickets' && (
          <MyTickets
            lottery={lottery}
            tickets={userTickets}
            onNavigateToPot={() => setActiveTab('lottery')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-medium text-slate-400">
            zkDraw • Confidential & Provably Fair Gaming on Midnight
          </p>
          <p>
            Private Inputs, Publicly Verifiable Correctness • Powered by Compact Smart Contracts & Zero-Knowledge Proofs
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
