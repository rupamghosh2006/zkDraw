import React, { useState, useMemo } from 'react';
import {
  Ticket,
  ArrowRight,
  Plus,
  Crown,
  Search,
  CheckCircle2,
  Lock,
  Trophy,
  Radio,
} from 'lucide-react';
import { Link, useLocation } from '../router/index.js';
import type { Lottery, MidnightNetwork } from '../types/index.js';
import { shortenAddress, type ConnectedWallet } from '../midnight/wallet.js';
import { getNetworkConfig } from '../midnight/config.js';
import { isMockLottery } from '../services/api.js';


interface ActiveDrawsPageProps {
  lotteries: Lottery[];
  currentNetwork: MidnightNetwork;
  wallet: ConnectedWallet | null;
  onRefresh?: () => void;
}

export const ActiveDrawsPage: React.FC<ActiveDrawsPageProps> = ({
  lotteries,
  currentNetwork,
  wallet,
}) => {
  const { searchParams } = useLocation();
  const highlightedId = searchParams.get('highlight');
  const netConfig = getNetworkConfig(currentNetwork);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'DRAWN'>('ALL');
  const [creatorOnly, setCreatorOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Check creator match helper
  const isDrawCreator = (draw: Lottery): boolean => {
    if (!wallet?.address) return false;
    const userAddr = wallet.address.toLowerCase();
    const adminKey = draw.adminKey?.toLowerCase();
    const creatorAddr = draw.creatorAddress?.toLowerCase();
    return Boolean((adminKey && adminKey === userAddr) || (creatorAddr && creatorAddr === userAddr));
  };

  // Filtered & sorted lotteries
  const filteredLotteries = useMemo(() => {
    return lotteries.filter((draw) => {
      // Never show mock dummy draws
      if (isMockLottery(draw)) return false;

      // Network match
      if (draw.network && draw.network !== currentNetwork) return false;

      // Status filter
      if (statusFilter !== 'ALL' && draw.status !== statusFilter) return false;

      // Creator filter
      if (creatorOnly && !isDrawCreator(draw)) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = draw.name?.toLowerCase().includes(query);
        const matchesId = draw.id?.toLowerCase().includes(query);
        const matchesDesc = draw.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesDesc) return false;
      }

      return true;
    });
  }, [lotteries, currentNetwork, statusFilter, creatorOnly, searchQuery, wallet?.address]);

  // Overall statistics
  const stats = useMemo(() => {
    const total = lotteries.length;
    const open = lotteries.filter((l) => l.status === 'OPEN').length;
    const myDraws = lotteries.filter(isDrawCreator).length;
    return { total, open, myDraws };
  }, [lotteries, wallet?.address]);

  return (
    <section id="live-draws" className="draws-section space-y-8 max-w-7xl mx-auto py-2 scroll-mt-28">
      {/* Page heading is deliberately simple so the privacy hero remains the focal point. */}
      <div className="draws-divider flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="draws-eyebrow mb-2 text-[10px] font-bold uppercase tracking-[0.16em]">
            {netConfig.name} draws
          </p>
          <h2 className="draws-title text-3xl sm:text-5xl">
            Live confidential draws
          </h2>
          <p className="draws-description mt-2 text-xs leading-5 sm:text-sm">
            Browse, enter, or manage lottery pools with verifiable results.
          </p>
        </div>

        <Link
          to="/create"
          className="myrad-btn-primary inline-flex w-fit items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold shadow-none sm:text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create draw</span>
        </Link>
      </div>

      {/* Stats Ribbon */}
      <div className="draw-stats grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="myrad-card p-4 sm:p-5 border border-white/10">
          <span className="text-[10px] font-extrabold text-[#8b98a5] uppercase tracking-wider block">
            Total Draws
          </span>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {stats.total}
          </div>
          <div className="text-[11px] text-[#8b98a5] mt-1 font-medium flex items-center gap-1">
            <Radio className="w-2.5 h-2.5 text-[#00d4ff] animate-pulse" />
            On {netConfig.name}
          </div>
        </div>

        <div className="myrad-card p-4 sm:p-5 border border-white/10">
          <span className="text-[10px] font-extrabold text-[#8b98a5] uppercase tracking-wider block">
            Currently Open
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#00ba7c] mt-1">
            {stats.open}
          </div>
          <div className="text-[11px] text-[#8b98a5] mt-1 font-medium">
            Ready for player entry
          </div>
        </div>

        <div className="myrad-card p-4 sm:p-5 border border-white/10">
          <span className="text-[10px] font-extrabold text-[#8b98a5] uppercase tracking-wider block">
            Created By You
          </span>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
            {stats.myDraws}
          </div>
          <div className="text-[11px] text-[#8b98a5] mt-1 font-medium">
            {wallet ? 'Operator role active' : 'Connect wallet to view'}
          </div>
        </div>

        <div className="myrad-card p-4 sm:p-5 border border-white/10 hidden lg:block">
          <span className="text-[10px] font-extrabold text-[#8b98a5] uppercase tracking-wider block">
            ZK Integrity
          </span>
          <div className="text-lg font-black text-white mt-1 flex items-center gap-1.5 text-ellipsis">
            <CheckCircle2 className="w-5 h-5 text-[#00ba7c] shrink-0" />
            <span>Compact ZKIR</span>
          </div>
          <div className="text-[11px] text-[#8b98a5] mt-1 font-medium">
            Client-side proof generation
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="draw-filter myrad-card p-4 sm:p-5 border flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'OPEN', 'CLOSED', 'DRAWN'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === status
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-[#0f0f0f] text-[#8b98a5] hover:text-white border border-white/[0.06]'
              }`}
            >
              {status === 'ALL' ? 'All Statuses' : status}
            </button>
          ))}
        </div>

        {/* Creator Toggle & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {wallet && (
            <button
              onClick={() => setCreatorOnly(!creatorOnly)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                creatorOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-[#0f0f0f] text-[#8b98a5] hover:text-white border-white/10'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Created by Me ({stats.myDraws})</span>
            </button>
          )}

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#8b98a5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search draws..."
              className="bg-[#0a0a0a] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-[#8b98a5] focus:outline-none focus:border-[#00d4ff] w-full sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Grid of Draws */}
      {filteredLotteries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLotteries.map((draw) => {
            const isYours = isDrawCreator(draw);
            const isHighlighted = draw.id === highlightedId;
            const maxTickets = draw.maxTickets || 10;
            const soldCount = draw.ticketCount || 0;
            const percentFilled = Math.min(100, Math.round((soldCount / maxTickets) * 100));
            const isSoldOut = soldCount >= maxTickets;
            const formattedPrice = (Number(draw.ticketPrice) / 1_000_000).toString();
            const formattedPrize = (Number(draw.prizePool) / 1_000_000).toLocaleString();

            return (
              <div
                key={draw.id}
                className={`myrad-card-interactive p-6 border flex flex-col justify-between transition-all duration-200 relative group ${
                  isHighlighted
                    ? 'border-[#00d4ff] shadow-xl shadow-[#00d4ff]/15 bg-gradient-to-b from-[#00d4ff]/10 via-[#0a0a0a] to-[#0a0a0a]'
                    : isYours
                    ? 'border-amber-500/30 hover:border-amber-500/60'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div>
                  {/* Top Bar: Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`myrad-badge text-[11px] ${
                          draw.status === 'OPEN'
                            ? 'badge-open'
                            : draw.status === 'CLOSED'
                            ? 'badge-closed'
                            : 'badge-drawn'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        {draw.status}
                      </span>

                      {isYours && (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5" />
                          Yours
                        </span>
                      )}

                      {isHighlighted && (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40">
                          Just Created!
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-[#8b98a5]">
                      #{draw.id.slice(-6)}
                    </span>
                  </div>

                  {/* Draw Title & Description */}
                  <h3 className="text-lg font-black text-white group-hover:text-[#00d4ff] transition-colors leading-snug">
                    {draw.name}
                  </h3>
                  <p className="text-xs text-[#8b98a5] mt-1 line-clamp-2 leading-relaxed">
                    {draw.description || 'Confidential provably fair draw on Midnight'}
                  </p>

                  {/* Pricing & Jackpot Details */}
                  <div className="grid grid-cols-2 gap-3 my-4 p-3.5 rounded-xl bg-[#0f0f0f] border border-white/[0.04]">
                    <div>
                      <span className="text-[10px] text-[#8b98a5] uppercase block font-semibold">
                        Jackpot Pool
                      </span>
                      <div className="text-sm font-black text-white flex items-baseline gap-1 mt-0.5">
                        <span>{formattedPrize}</span>
                        <span className="text-[10px] font-bold text-[#00d4ff]">tNIGHT</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#8b98a5] uppercase block font-semibold">
                        Ticket Price
                      </span>
                      <div className="text-sm font-black text-white flex items-baseline gap-1 mt-0.5">
                        <span>{formattedPrice}</span>
                        <span className="text-[10px] font-bold text-purple-400">tNIGHT</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar (Tickets Sold) */}
                  <div className="space-y-1.5 my-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#8b98a5] flex items-center gap-1">
                        <Ticket className="w-3.5 h-3.5 text-[#00ba7c]" />
                        <span>Draw Capacity:</span>
                      </span>
                      <span className="font-mono font-bold text-white">
                        {soldCount} / {maxTickets} sold
                      </span>
                    </div>

                    <div className="w-full bg-[#141414] h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isSoldOut ? 'bg-amber-400' : 'bg-[#00ba7c]'
                        }`}
                        style={{ width: `${percentFilled}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#8b98a5]">
                      <span>{percentFilled}% filled</span>
                      <span>
                        {isSoldOut
                          ? 'Sold out'
                          : `${Math.max(0, maxTickets - soldCount)} tickets left`}
                      </span>
                    </div>
                  </div>

                  {/* Additional Meta (Creator & Range) */}
                  <div className="pt-2 border-t border-white/[0.06] text-[11px] text-[#8b98a5] flex items-center justify-between">
                    <span>
                      Range: [{draw.rangeMin} .. {draw.rangeMax}]
                    </span>
                    <span className="font-mono">
                      Creator: {shortenAddress(draw.creatorAddress || draw.adminKey || '')}
                    </span>
                  </div>
                </div>

                {/* Card CTA Action Button */}
                <div className="pt-5 mt-3">
                  <Link
                    to={`/draws/${draw.id}`}
                    className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      draw.status === 'OPEN'
                        ? 'myrad-btn-primary'
                        : draw.status === 'DRAWN'
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
                        : 'myrad-btn-secondary'
                    }`}
                  >
                    {draw.status === 'OPEN' ? (
                      <>
                        <span>{isYours ? 'Manage Your Draw' : 'Enter Draw & Pick Number'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    ) : draw.status === 'DRAWN' ? (
                      <>
                        <Trophy className="w-3.5 h-3.5 text-amber-300" />
                        <span>Winning Number #{draw.winningNumber} • View Results</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sales Closed • View Draw</span>
                      </>
                    )}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="myrad-card p-16 text-center border border-white/10 space-y-4 max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#0f0f0f] border border-white/10 text-[#00d4ff] mx-auto flex items-center justify-center">
            <Ticket className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-black text-white">No Draws Found</h3>
          <p className="text-xs sm:text-sm text-[#8b98a5] leading-relaxed">
            {searchQuery || statusFilter !== 'ALL' || creatorOnly
              ? 'No active draws match your current filter criteria. Try resetting filters or search.'
              : `There are currently no active draws registered on ${netConfig.name}. Be the first to create one!`}
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {(searchQuery || statusFilter !== 'ALL' || creatorOnly) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setCreatorOnly(false);
                  setSearchQuery('');
                }}
                className="myrad-btn-secondary px-5 py-2.5 text-xs font-bold"
              >
                Clear Filters
              </button>
            )}
            <Link
              to="/create"
              className="myrad-btn-primary px-6 py-2.5 text-xs font-bold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Draw</span>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
};
