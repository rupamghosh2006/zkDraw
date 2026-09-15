import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Clock,
  Shuffle,
  Shield,
  Sparkles,
  Flame,
  Zap,
  Lock,
  Cpu,
  EyeOff,
  Radio,
  Crown,
} from 'lucide-react';
import type { Lottery, UserTicket, MidnightNetwork } from '../types/index.js';
import { shortenAddress, type ConnectedWallet } from '../midnight/wallet.js';
import { TicketModal } from './TicketModal.js';
import {
  getNetworkConfig,
  shortenContractAddress,
} from '../midnight/config.js';
import {
  computeClientTicketCommitment,
  generateRandomHex,
  derivePlayerSecret,
  computeClientParticipantKey,
} from '../midnight/crypto.js';
import { fetchLiveContractState } from '../midnight/contract.js';


interface ActiveLotteryProps {
  lottery: Lottery | null;
  wallet: ConnectedWallet | null;
  onTicketPurchased: (ticket: UserTicket) => void;
  onOpenWalletModal: () => void;
  onInitDraw?: () => void;
  currentNetwork: MidnightNetwork;
  onToast?: (message: string) => void;
}

export const ActiveLottery: React.FC<ActiveLotteryProps> = ({
  lottery,
  wallet,
  onTicketPurchased,
  onOpenWalletModal,
  onInitDraw,
  currentNetwork,
  onToast,
}) => {
  const [selectedNumber, setSelectedNumber] = useState<number>(7);
  const [showModal, setShowModal] = useState(false);
  const [previewSalt] = useState<string>(() => generateRandomHex(32));
  const [previewCommitment, setPreviewCommitment] = useState<string>('');
  const [hasDrawnTicket, setHasDrawnTicket] = useState(false);

  const netConfig = getNetworkConfig(currentNetwork);

  // Check if current user already drew a ticket from this lottery (local storage + on-chain ledger)
  useEffect(() => {
    if (!lottery) return;
    let cancelled = false;

    const checkParticipation = async () => {
      // 1. Check local storage
      let drawn = false;
      try {
        const tickets: UserTicket[] = JSON.parse(localStorage.getItem('zkdraw_user_tickets') ?? '[]');
        drawn = tickets.some((t) => t.lotteryId === lottery.id && t.network === currentNetwork);
      } catch {}

      if (drawn) {
        if (!cancelled) setHasDrawnTicket(true);
        return;
      }

      // 2. Check on-chain / backend ledger participants via deterministic wallet identity
      if (wallet?.address) {
        try {
          const secret = await derivePlayerSecret(wallet.address);
          const pKey = await computeClientParticipantKey(lottery.drawId ?? 0, secret);
          const cleanPKey = pKey.toLowerCase();

          let participants = lottery.participants || [];
          if (participants.length === 0 && lottery.contractAddress) {
            try {
              const live = await fetchLiveContractState(netConfig.indexerUrl, lottery.contractAddress);
              if (live?.participants && live.participants.length > 0) {
                participants = live.participants;
              }
            } catch {}
          }

          const onChainDrawn = participants.some(
            (p) => p.replace(/^0x/, '').toLowerCase() === cleanPKey,
          );
          if (!cancelled && onChainDrawn) {
            setHasDrawnTicket(true);
            return;
          }
        } catch (e) {
          console.warn('Error checking participant key on-chain:', e);
        }
      }


      if (!cancelled) {
        setHasDrawnTicket(false);
      }
    };

    checkParticipation();

    return () => {
      cancelled = true;
    };
  }, [lottery?.id, lottery?.drawId, lottery?.participants, wallet?.address, currentNetwork]);

  // Compute live ZK commitment preview as the user changes selected number
  useEffect(() => {
    computeClientTicketCommitment(selectedNumber, previewSalt).then((res) => {
      setPreviewCommitment(res);
    });
  }, [selectedNumber, previewSalt]);

  if (!lottery) {
    return (
      <div className="myrad-card p-16 text-center text-[#8b98a5] border border-white/[0.08] space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[#0f0f0f] border border-white/10 flex items-center justify-center mx-auto animate-pulse">
          <Sparkles className="w-6 h-6 text-[#00d4ff]" />
        </div>
        <h3 className="text-lg font-bold text-white">Connecting to {netConfig.name}...</h3>
        <p className="text-xs text-[#8b98a5]">Loading confidential lottery pot & circuit parameters</p>
      </div>
    );
  }

  const rangeMin = lottery.rangeMin || 1;
  const rangeMax = lottery.rangeMax || 50;
  const numberOptions = Array.from(
    { length: rangeMax - rangeMin + 1 },
    (_, i) => rangeMin + i,
  );

  const maxTickets = lottery.maxTickets || 10;
  const isSoldOut = lottery.ticketCount >= maxTickets;
  const isAutoClosed = isSoldOut && lottery.status === 'CLOSED';
  const percentFilled = Math.min(100, Math.round((lottery.ticketCount / maxTickets) * 100));

  const isCreator = Boolean(
    wallet?.address &&
    lottery.adminKey &&
    wallet.address.toLowerCase() === lottery.adminKey.toLowerCase()
  );

  const isPurchaseDisabled = lottery.status !== 'OPEN' || isCreator || hasDrawnTicket || isSoldOut;

  const handleRandomPick = () => {
    const random = Math.floor(Math.random() * (rangeMax - rangeMin + 1)) + rangeMin;
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
      {/* Top Banner Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Jackpot Box */}
        <div className="myrad-card-interactive p-6 border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-black text-[#00d4ff] uppercase tracking-widest">
              <Flame className="w-4 h-4" />
              Jackpot Pool
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20">
              {netConfig.badgeLabel}
            </span>
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
            1:1 Shielded Collateral Entry
          </div>
        </div>

        {/* Total Tickets Capacity Box */}
        <div className="myrad-card-interactive p-6 border border-white/10">
          <div className="flex items-center gap-2 text-xs font-black text-[#8b98a5] uppercase tracking-widest mb-2">
            <Shield className="w-4 h-4 text-[#00ba7c]" />
            Draw Capacity
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white flex items-baseline gap-2">
            <span>{lottery.ticketCount}</span>
            <span className="text-xs font-bold text-[#8b98a5]">/ {maxTickets} sold</span>
          </div>
          {/* Visual capacity progress bar */}
          <div className="w-full bg-[#141414] h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isSoldOut ? 'bg-amber-400' : 'bg-[#00ba7c]'
              }`}
              style={{ width: `${percentFilled}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#8b98a5] mt-1.5 font-medium">
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <Radio className="w-2.5 h-2.5 text-[#00ba7c] animate-pulse" />
              {percentFilled}% Filled
            </span>
            <span className="text-[10px]">{Math.max(0, maxTickets - lottery.ticketCount)} left</span>
          </div>
        </div>

        {/* Status & Timing */}
        <div className="myrad-card-interactive p-6 border border-white/10">
          <div className="flex items-center gap-2 text-xs font-black text-[#8b98a5] uppercase tracking-widest mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Draw Status
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
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              {isAutoClosed ? 'AUTO CLOSED' : lottery.status}
            </span>
          </div>
          <div className="text-[11px] text-[#8b98a5] mt-2 font-medium">
            {lottery.status === 'OPEN'
              ? `${Math.max(0, maxTickets - lottery.ticketCount)} tickets remaining`
              : isAutoClosed
              ? 'All tickets sold, sales locked'
              : lottery.status === 'CLOSED'
              ? 'Ended early by creator'
              : `Winning number was #${lottery.winningNumber}`}
          </div>
        </div>
      </div>

      {/* Creator Mode Banner */}
      {isCreator && (
        <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-950/20">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="font-extrabold text-amber-300 text-sm flex items-center gap-2">
                <span>👑 Creator Access Active</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {shortenAddress(lottery.adminKey || '')}
                </span>
              </div>
              <p className="text-xs text-amber-200/80 mt-1 max-w-2xl leading-relaxed">
                As the lottery creator, you are barred by on-chain Compact circuit assertions from drawing tickets.
                You can end ticket sales early or draw the winner in the <strong>Live Draw</strong> tab.
              </p>
            </div>
          </div>
          {onInitDraw && (
            <button
              onClick={onInitDraw}
              className="myrad-btn-primary shrink-0 px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Init Another Draw
            </button>
          )}
        </div>
      )}

      {/* 1 Ticket Limit Reached Banner */}
      {hasDrawnTicket && !isCreator && (
        <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/40 text-purple-200 flex items-center gap-3">
          <Ticket className="w-5 h-5 text-purple-400 shrink-0" />
          <div>
            <div className="font-bold text-purple-300 text-sm">
              🎟️ 1 Ticket Limit Reached
            </div>
            <p className="text-xs text-purple-200/80 mt-0.5">
              Protocol rule: Each participant can draw at most 1 ticket per lottery draw. Your ticket is safely stored in your Vault.
            </p>
          </div>
        </div>
      )}

      {/* Auto-Ended Banner */}
      {isAutoClosed && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 flex items-center gap-3">
          <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div className="font-bold text-emerald-300 text-sm">
              🔒 Draw Ended Automatically
            </div>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              All {maxTickets} tickets have been sold! Ticket sales are automatically closed. Ready for the provable winner draw in the Live Draw tab.
            </p>
          </div>
        </div>
      )}

      {/* Closed Early Banner */}
      {lottery.status === 'CLOSED' && !isSoldOut && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800 text-amber-200 flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="font-bold text-amber-300 text-sm">
              🔒 Draw Ended Early by Creator
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              The creator ended ticket sales early ({lottery.ticketCount} / {maxTickets} tickets sold). Ready for the provable winner draw in the Live Draw tab.
            </p>
          </div>
        </div>
      )}

      {/* Main Ticket Picker Section */}
      <div className="myrad-card p-6 sm:p-8 border border-white/10 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00ba7c]/10 text-[#00ba7c] border border-[#00ba7c]/30">
                {netConfig.name}
              </span>
              <span className="text-xs text-[#8b98a5] font-mono">
                Contract: {shortenContractAddress(lottery.contractAddress)}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>Select Your Confidential Lucky Number</span>
              <Sparkles className="w-5 h-5 text-[#00d4ff]" />
            </h2>
            <p className="text-xs sm:text-sm text-[#8b98a5] mt-1 max-w-xl">
              Choose any number from {rangeMin} to {rangeMax}. Your number is encapsulated into an opaque 32-byte Zero-Knowledge commitment inside your browser before submission.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handlePresetSelect(7)}
              disabled={isPurchaseDisabled}
              className={`px-3.5 py-1.5 rounded-xl bg-[#0f0f0f] border border-white/10 text-xs font-bold text-white transition-all ${
                isPurchaseDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#141414]'
              }`}
            >
              Lucky 7
            </button>
            <button
              onClick={() => handlePresetSelect(21)}
              disabled={isPurchaseDisabled}
              className={`px-3.5 py-1.5 rounded-xl bg-[#0f0f0f] border border-white/10 text-xs font-bold text-white transition-all ${
                isPurchaseDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#141414]'
              }`}
            >
              Blackjack 21
            </button>
            <button
              onClick={() => handlePresetSelect(42)}
              disabled={isPurchaseDisabled}
              className={`px-3.5 py-1.5 rounded-xl bg-[#0f0f0f] border border-white/10 text-xs font-bold text-white transition-all ${
                isPurchaseDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#141414]'
              }`}
            >
              Cosmic 42
            </button>
            <button
              onClick={handleRandomPick}
              disabled={isPurchaseDisabled}
              className={`myrad-btn-secondary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 ${
                isPurchaseDisabled ? 'opacity-40 cursor-not-allowed' : ''
              }`}
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
                  disabled={isPurchaseDisabled}
                  onClick={() => setSelectedNumber(num)}
                  className={`number-grid-cell ${
                    isSelected ? 'selected' : ''
                  } ${
                    isPurchaseDisabled
                      ? 'opacity-40 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Client ZK Commitment Preview Bar */}
        <div className="mb-6 p-4 rounded-2xl bg-[#070707] border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#00d4ff] font-bold">
              <Cpu className="w-3.5 h-3.5" />
              <span>Real-Time Client ZK Circuit Synthesis Preview</span>
            </div>
            <span className="text-[10px] text-[#00ba7c] font-semibold flex items-center gap-1">
              <EyeOff className="w-3 h-3" />
              Computed in Client Memory
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="bg-[#0f0f0f] p-2.5 rounded-xl border border-white/[0.04]">
              <span className="text-[#8b98a5] text-[10px] block font-sans">Circuit Input (Number + Salt)</span>
              <span className="text-white font-bold">Number #{selectedNumber}</span>
              <span className="text-[#8b98a5] text-[10px] block truncate">Salt: 0x{previewSalt.slice(0, 16)}...</span>
            </div>
            <div className="bg-[#0f0f0f] p-2.5 rounded-xl border border-white/[0.04]">
              <span className="text-[#8b98a5] text-[10px] block font-sans">On-Chain Commitment Hash (Public State)</span>
              <span className="text-[#00d4ff] font-semibold truncate block">
                {previewCommitment ? `0x${previewCommitment.slice(0, 24)}...` : 'Computing...'}
              </span>
            </div>
          </div>
        </div>

        {/* Selection Summary & Action Bar */}
        <div className="p-6 rounded-2xl bg-[#0f0f0f] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 flex items-center justify-center shadow-inner">
              <span className="text-3xl font-black text-[#00d4ff]">
                {selectedNumber}
              </span>
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#8b98a5] uppercase tracking-widest">
                Selected Private Choice
              </div>
              <div className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Number #{selectedNumber}</span>
                <span className="text-xs text-[#00ba7c] flex items-center gap-1 font-semibold">
                  <Lock className="w-3.5 h-3.5" />
                  Client Witness Only
                </span>
              </div>
              <p className="text-[11px] text-[#8b98a5] mt-0.5">
                Targeting <strong className="text-white">{netConfig.name}</strong>
              </p>
            </div>
          </div>

          <div>
            {wallet ? (
              <button
                disabled={isPurchaseDisabled}
                onClick={() => setShowModal(true)}
                className={`myrad-btn-primary px-8 py-4 text-sm sm:text-base flex items-center justify-center gap-2.5 ${
                  isPurchaseDisabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Shield className="w-5 h-5" />
                {isCreator
                  ? 'Creator Cannot Draw Tickets'
                  : hasDrawnTicket
                  ? 'Already Drawn 1 Ticket'
                  : isSoldOut
                  ? 'Draw Sold Out (Closed)'
                  : lottery.status === 'OPEN'
                  ? `Buy Ticket #${selectedNumber} in ZK`
                  : `Draw is ${lottery.status}`}
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
            setHasDrawnTicket(true);
            onTicketPurchased(ticket);
            if (onToast) {
              onToast(`Successfully purchased Ticket #${selectedNumber} on ${netConfig.name}!`);
            }
          }}
          currentNetwork={currentNetwork}
        />
      )}
    </div>
  );
};
