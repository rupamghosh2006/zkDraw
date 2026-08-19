import React, { useState } from 'react';
import {
  Coins,
  Ticket,
  Clock,
  Shuffle,
  Shield,
  Sparkles,
  Flame,
} from 'lucide-react';
import type { Lottery, UserTicket } from '../types/index.js';
import type { ConnectedWallet } from '../midnight/wallet.js';
import { TicketModal } from './TicketModal.js';

interface ActiveLotteryProps {
  lottery: Lottery | null;
  wallet: ConnectedWallet | null;
  onTicketPurchased: (ticket: UserTicket) => void;
  onOpenWalletModal: () => void;
}

export const ActiveLottery: React.FC<ActiveLotteryProps> = ({
  lottery,
  wallet,
  onTicketPurchased,
  onOpenWalletModal,
}) => {
  const [selectedNumber, setSelectedNumber] = useState<number>(7);
  const [showModal, setShowModal] = useState(false);

  if (!lottery) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center text-slate-400">
        Loading active lottery information...
      </div>
    );
  }

  const rangeMin = lottery.rangeMin || 1;
  const rangeMax = lottery.rangeMax || 50;
  const numberOptions = Array.from(
    { length: rangeMax - rangeMin + 1 },
    (_, i) => rangeMin + i,
  );

  const handleRandomPick = () => {
    const random =
      Math.floor(Math.random() * (rangeMax - rangeMin + 1)) + rangeMin;
    setSelectedNumber(random);
  };

  const formattedPrize = (Number(lottery.prizePool) / 1_000_000).toLocaleString();
  const formattedTicketPrice = (Number(lottery.ticketPrice) / 1_000_000).toString();

  return (
    <div className="space-y-8">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Jackpot Box */}
        <div className="glass-panel rounded-2xl p-5 border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 to-slate-900/60 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Coins className="w-24 h-24 text-cyan-400" />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
            <Flame className="w-4 h-4 text-cyan-400" />
            Current Jackpot
          </div>
          <div className="text-3xl font-extrabold text-white flex items-baseline gap-1.5">
            <span>{formattedPrize}</span>
            <span className="text-sm font-semibold text-cyan-400">tDUST</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Midnight confidential gaming pool
          </div>
        </div>

        {/* Ticket Price */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Ticket className="w-4 h-4 text-purple-400" />
            Ticket Price
          </div>
          <div className="text-3xl font-extrabold text-white flex items-baseline gap-1.5">
            <span>{formattedTicketPrice}</span>
            <span className="text-sm font-semibold text-purple-400">tDUST</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Fixed per ticket purchase</div>
        </div>

        {/* Total Tickets */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Ticket Commitments
          </div>
          <div className="text-3xl font-extrabold text-white">
            {lottery.ticketCount}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Registered on Midnight ledger
          </div>
        </div>

        {/* Status & Timing */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Lottery Status
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className={`cyber-badge ${
                lottery.status === 'OPEN'
                  ? 'badge-open'
                  : lottery.status === 'CLOSED'
                  ? 'badge-closed'
                  : 'badge-drawn'
              }`}
            >
              {lottery.status}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {lottery.status === 'OPEN'
              ? 'Accepting confidential entries'
              : lottery.status === 'CLOSED'
              ? 'Ticket sales closed, drawing imminent'
              : `Drawn! Winning # was ${lottery.winningNumber}`}
          </div>
        </div>
      </div>

      {/* Main Ticket Picker Section */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <span>Choose Your Secret Lottery Number</span>
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Select any number between {rangeMin} and {rangeMax}. Your choice is shielded locally and never revealed on-chain.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRandomPick}
              disabled={lottery.status !== 'OPEN'}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-200 flex items-center gap-2 transition-all"
            >
              <Shuffle className="w-4 h-4 text-cyan-400" />
              Quick Random Pick
            </button>
          </div>
        </div>

        {/* Interactive Number Grid */}
        <div className="py-8">
          <div className="flex flex-wrap gap-2.5 justify-center sm:justify-start">
            {numberOptions.map((num) => {
              const isSelected = selectedNumber === num;
              return (
                <button
                  key={num}
                  type="button"
                  disabled={lottery.status !== 'OPEN'}
                  onClick={() => setSelectedNumber(num)}
                  className={`number-grid-cell ${
                    isSelected ? 'selected' : ''
                  } ${
                    lottery.status !== 'OPEN'
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Summary & Buy Action Bar */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/30 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <span className="text-2xl font-black text-cyan-400">
                {selectedNumber}
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Selected Private Number
              </div>
              <div className="text-sm font-semibold text-white">
                Ticket Number #{selectedNumber} (Encrypted locally)
              </div>
            </div>
          </div>

          <div>
            {wallet ? (
              <button
                disabled={lottery.status !== 'OPEN'}
                onClick={() => setShowModal(true)}
                className={`cyber-button px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${
                  lottery.status !== 'OPEN' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Shield className="w-4 h-4" />
                {lottery.status === 'OPEN'
                  ? 'Buy Confidential Ticket'
                  : `Lottery is ${lottery.status}`}
              </button>
            ) : (
              <button
                onClick={onOpenWalletModal}
                className="cyber-button px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                Connect Wallet to Play
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Modal */}
      {showModal && wallet && (
        <TicketModal
          lottery={lottery}
          selectedNumber={selectedNumber}
          wallet={wallet}
          onClose={() => setShowModal(false)}
          onSuccess={(ticket) => {
            onTicketPurchased(ticket);
          }}
        />
      )}
    </div>
  );
};
