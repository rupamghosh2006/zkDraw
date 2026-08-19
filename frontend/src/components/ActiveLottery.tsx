import React, { useState } from 'react';
import {
  Ticket,
  Clock,
  Shuffle,
  Shield,
  Sparkles,
  Flame,
  Zap,
  Lock,
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
      <div className="myrad-card p-16 text-center text-[#8b98a5] border border-white/[0.08] space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[#0f0f0f] border border-white/10 flex items-center justify-center mx-auto animate-pulse">
          <Sparkles className="w-6 h-6 text-[#00d4ff]" />
        </div>
        <h3 className="text-lg font-bold text-white">Connecting to Midnight Network...</h3>
        <p className="text-xs text-[#8b98a5]">Loading active confidential lottery pot</p>
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

  const handlePresetSelect = (num: number) => {
    if (num >= rangeMin && num <= rangeMax) {
      setSelectedNumber(num);
    }
  };

  const formattedPrize = (Number(lottery.prizePool) / 1_000_000).toLocaleString();
  const formattedTicketPrice = (Number(lottery.ticketPrice) / 1_000_000).toString();

  return (
    <div className="space-y-8">
      {/* Top Banner Stats (Myrad Card Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Jackpot Box */}
        <div className="myrad-card-interactive p-6 border border-white/10 relative overflow-hidden group">
          <div className="flex items-center gap-2 text-xs font-black text-[#00d4ff] uppercase tracking-widest mb-2">
            <Flame className="w-4 h-4" />
            Jackpot Pool
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white flex items-baseline gap-2">
            <span>{formattedPrize}</span>
            <span className="text-sm font-bold text-[#00d4ff]">tDUST</span>
          </div>
          <div className="text-[11px] text-[#8b98a5] mt-2 flex items-center gap-1 font-medium">
            <Zap className="w-3 h-3 text-[#00d4ff]" />
            Midnight confidential gaming pool
          </div>
        </div>

        {/* Ticket Price */}
        <div className="myrad-card-interactive p-6 border border-white/10">
          <div className="flex items-center gap-2 text-xs font-black text-[#8b98a5] uppercase tracking-widest mb-2">
            <Ticket className="w-4 h-4 text-purple-400" />
            Ticket Price
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white flex items-baseline gap-2">
            <span>{formattedTicketPrice}</span>
            <span className="text-sm font-bold text-purple-400">tDUST</span>
          </div>
          <div className="text-[11px] text-[#8b98a5] mt-2 font-medium">
            Fixed entry per ticket
          </div>
        </div>

        {/* Total Tickets */}
        <div className="myrad-card-interactive p-6 border border-white/10">
          <div className="flex items-center gap-2 text-xs font-black text-[#8b98a5] uppercase tracking-widest mb-2">
            <Shield className="w-4 h-4 text-[#00ba7c]" />
            Confidential Entries
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white flex items-baseline gap-2">
            <span>{lottery.ticketCount}</span>
            <span className="text-xs font-bold text-[#8b98a5]">commitments</span>
          </div>
          <div className="text-[11px] text-[#8b98a5] mt-2 font-medium">
            Shielded on Midnight ledger
          </div>
        </div>

        {/* Status & Timing */}
        <div className="myrad-card-interactive p-6 border border-white/10">
          <div className="flex items-center gap-2 text-xs font-black text-[#8b98a5] uppercase tracking-widest mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Pot Status
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className={`myrad-badge ${
                lottery.status === 'OPEN'
                  ? 'badge-open'
                  : lottery.status === 'CLOSED'
                  ? 'badge-closed'
                  : 'badge-drawn'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
              {lottery.status}
            </span>
          </div>
          <div className="text-[11px] text-[#8b98a5] mt-2 font-medium">
            {lottery.status === 'OPEN'
              ? 'Accepting confidential tickets'
              : lottery.status === 'CLOSED'
              ? 'Sales closed, drawing winner'
              : `Winning number was ${lottery.winningNumber}`}
          </div>
        </div>
      </div>

      {/* Main Ticket Picker Section */}
      <div className="myrad-card p-6 sm:p-8 border border-white/10 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>Select Your Confidential Number</span>
              <Sparkles className="w-5 h-5 text-[#00d4ff]" />
            </h2>
            <p className="text-xs sm:text-sm text-[#8b98a5] mt-1 max-w-xl">
              Choose any number from {rangeMin} to {rangeMax}. Your number is encrypted into a ZK commitment in your browser before broadcast.
            </p>
          </div>

          {/* Quick Presets & Pickers (Myrad Style Pills) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handlePresetSelect(7)}
              disabled={lottery.status !== 'OPEN'}
              className="px-3.5 py-1.5 rounded-xl bg-[#0f0f0f] hover:bg-[#141414] border border-white/10 text-xs font-bold text-white transition-all"
            >
              Lucky 7
            </button>
            <button
              onClick={() => handlePresetSelect(21)}
              disabled={lottery.status !== 'OPEN'}
              className="px-3.5 py-1.5 rounded-xl bg-[#0f0f0f] hover:bg-[#141414] border border-white/10 text-xs font-bold text-white transition-all"
            >
              Blackjack 21
            </button>
            <button
              onClick={() => handlePresetSelect(42)}
              disabled={lottery.status !== 'OPEN'}
              className="px-3.5 py-1.5 rounded-xl bg-[#0f0f0f] hover:bg-[#141414] border border-white/10 text-xs font-bold text-white transition-all"
            >
              Cosmic 42
            </button>
            <button
              onClick={handleRandomPick}
              disabled={lottery.status !== 'OPEN'}
              className="myrad-btn-secondary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5"
            >
              <Shuffle className="w-3.5 h-3.5 text-[#00d4ff]" />
              Quick Random
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

        {/* Selection Summary & Action Bar */}
        <div className="p-6 rounded-2xl bg-[#0f0f0f] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 flex items-center justify-center">
              <span className="text-3xl font-black text-[#00d4ff]">
                {selectedNumber}
              </span>
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#8b98a5] uppercase tracking-widest">
                Selected Private Number
              </div>
              <div className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Number #{selectedNumber}</span>
                <span className="text-xs text-[#00ba7c] flex items-center gap-1 font-semibold">
                  <Lock className="w-3.5 h-3.5" />
                  Client Witness Only
                </span>
              </div>
            </div>
          </div>

          <div>
            {wallet ? (
              <button
                disabled={lottery.status !== 'OPEN'}
                onClick={() => setShowModal(true)}
                className={`myrad-btn-primary px-8 py-4 text-sm sm:text-base flex items-center justify-center gap-2.5 ${
                  lottery.status !== 'OPEN' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Shield className="w-5 h-5" />
                {lottery.status === 'OPEN'
                  ? `Buy Ticket #${selectedNumber} in ZK`
                  : `Lottery is ${lottery.status}`}
              </button>
            ) : (
              <button
                onClick={onOpenWalletModal}
                className="myrad-btn-white px-8 py-4 text-sm sm:text-base flex items-center justify-center gap-2.5"
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
