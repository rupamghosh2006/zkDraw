import React, { useState } from 'react';
import {
  Sparkles,
  Ticket,
  Coins,
  Hash,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { initLottery } from '../services/api.js';
import type { Lottery, MidnightNetwork } from '../types/index.js';
import { getNetworkConfig } from '../midnight/config.js';
import type { ConnectedWallet } from '../midnight/wallet.js';

interface InitLotteryModalProps {
  currentNetwork: MidnightNetwork;
  wallet: ConnectedWallet | null;
  onClose: () => void;
  onLotteryCreated: (lottery: Lottery) => void;
  onToast?: (message: string) => void;
}

export const InitLotteryModal: React.FC<InitLotteryModalProps> = ({
  currentNetwork,
  wallet,
  onClose,
  onLotteryCreated,
  onToast,
}) => {
  const netConfig = getNetworkConfig(currentNetwork);

  const [name, setName] = useState(`zkDraw ${netConfig.name} Pot`);
  const [maxTickets, setMaxTickets] = useState<number>(10);
  const [ticketPriceDust, setTicketPriceDust] = useState<string>('1');
  const [rangeMin, setRangeMin] = useState<number>(1);
  const [rangeMax, setRangeMax] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (maxTickets <= 0) {
      setError('Number of tickets must be at least 1.');
      return;
    }
    if (rangeMax <= rangeMin) {
      setError('Max number must be strictly greater than min number.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const priceAtomic = (parseFloat(ticketPriceDust) * 1_000_000).toString();
      const newLottery = await initLottery({
        name,
        network: currentNetwork,
        contractAddress: netConfig.contractAddress,
        ticketPrice: priceAtomic,
        rangeMin,
        rangeMax,
        maxTickets,
        adminKey: wallet?.address || netConfig.defaultLottery.adminKey,
      });

      onLotteryCreated(newLottery);
      if (onToast) {
        onToast(`🎉 Lottery initialized with ${maxTickets} tickets on ${netConfig.name}!`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="myrad-card w-full max-w-lg p-6 sm:p-8 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f0f0f] border border-white/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#00d4ff]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">Initialize Lottery Draw</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#00ba7c]/15 text-[#00ba7c] border border-[#00ba7c]/30">
                  Creator Mode
                </span>
              </div>
              <p className="text-xs text-[#8b98a5]">
                Configure ticket capacity, prices, and provable parameters on {netConfig.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8b98a5] hover:text-white p-1 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleInit} className="space-y-5 pt-5">
          {/* Lottery Name */}
          <div>
            <label className="block text-xs font-bold text-[#8b98a5] uppercase tracking-wider mb-2">
              Lottery Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00d4ff] transition-colors"
              required
            />
          </div>

          {/* Number of Tickets to Init (Creator choice) */}
          <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-[#00d4ff]/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#00d4ff] uppercase tracking-wider flex items-center gap-1.5">
                <Ticket className="w-4 h-4" />
                Total Tickets to Initialize
              </label>
              <span className="text-xs font-mono font-bold text-white bg-black/60 px-2.5 py-0.5 rounded-lg border border-white/10">
                {maxTickets} tickets
              </span>
            </div>
            <p className="text-[11px] text-[#8b98a5]">
              The draw will automatically end when all {maxTickets} tickets are sold.
            </p>
            <div className="flex items-center gap-2 pt-2">
              {[3, 5, 10, 20, 50].map((count) => (
                <button
                  type="button"
                  key={count}
                  onClick={() => setMaxTickets(count)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    maxTickets === count
                      ? 'bg-[#00d4ff] text-black border-[#00d4ff]'
                      : 'bg-[#0a0a0a] text-[#8b98a5] border-white/10 hover:border-white/30'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Price & Number Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#8b98a5] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                Ticket Price (tDUST)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={ticketPriceDust}
                onChange={(e) => setTicketPriceDust(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00d4ff] transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8b98a5] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-purple-400" />
                Number Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={rangeMin}
                  onChange={(e) => setRangeMin(Number(e.target.value))}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00d4ff] transition-colors"
                  required
                />
                <span className="text-xs text-[#8b98a5]">to</span>
                <input
                  type="number"
                  min="2"
                  max="100"
                  value={rangeMax}
                  onChange={(e) => setRangeMax(Number(e.target.value))}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00d4ff] transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          {/* Protocol Guarantee Note */}
          <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-1 text-[11px] text-[#8b98a5]">
            <div className="font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00ba7c]" />
              Provable On-Chain Rules Enforced:
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
              <li>Only you (the creator) can end the draw early before sellout.</li>
              <li>You (the creator) cannot draw tickets from this lottery.</li>
              <li>Any other player can draw exactly 1 ticket.</li>
              <li>The draw automatically closes when all {maxTickets} tickets are sold.</li>
            </ul>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="myrad-btn-secondary flex-1 py-3 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="myrad-btn-primary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Initializing Draw...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Initialize {maxTickets}-Ticket Draw</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
