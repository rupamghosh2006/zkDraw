import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Ticket,
  Shield,
  Crown,
  Lock,
  Trophy,
  AlertTriangle,
  ExternalLink,
  Shuffle,
  Cpu,
  EyeOff,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { useParams, Link } from '../router/index.js';
import type { Lottery, UserTicket, MidnightNetwork } from '../types/index.js';
import {
  fetchLotteryById,
  closeLottery,
  drawLottery,
} from '../services/api.js';
import { shortenAddress, type ConnectedWallet } from '../midnight/wallet.js';
import {
  getNetworkConfig,
  getExplorerContractUrl,
  shortenContractAddress,
} from '../midnight/config.js';
import {
  computeClientTicketCommitment,
  generateRandomHex,
  hexToBytes,
  derivePlayerSecret,
  computeClientParticipantKey,
} from '../midnight/crypto.js';
import { closeLotteryOnChain, drawWinnerOnChain, deriveAdminSecretFromWallet } from '../midnight/contract.js';
import { pureCircuits } from '../contract/index.js';
import { TicketModal } from '../components/TicketModal.js';

interface DrawDetailPageProps {
  currentNetwork: MidnightNetwork;
  wallet: ConnectedWallet | null;
  onTicketPurchased: (ticket: UserTicket) => void;
  onOpenWalletModal: () => void;
  onLotteryUpdated: (lottery: Lottery) => void;
  onToast?: (message: string) => void;
}

export const DrawDetailPage: React.FC<DrawDetailPageProps> = ({
  currentNetwork,
  wallet,
  onTicketPurchased,
  onOpenWalletModal,
  onLotteryUpdated,
  onToast,
}) => {
  const { id } = useParams<{ id: string }>();
  const netConfig = getNetworkConfig(currentNetwork);

  const [draw, setDraw] = useState<Lottery | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNumber, setSelectedNumber] = useState<number>(7);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [previewSalt] = useState<string>(() => generateRandomHex(32));
  const [previewCommitment, setPreviewCommitment] = useState<string>('');
  const [hasDrawnTicket, setHasDrawnTicket] = useState(false);

  // Lifecycle execution states
  const [actionLoading, setActionLoading] = useState(false);
  const [provingStep, setProvingStep] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Load draw data by ID
  const loadDraw = async () => {
    if (!id) return;
    try {
      const data = await fetchLotteryById(id, currentNetwork);
      setDraw(data);
      if (data && selectedNumber < data.rangeMin) {
        setSelectedNumber(data.rangeMin);
      }
    } catch (err) {
      console.warn('Failed to load draw detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDraw();
    const interval = setInterval(loadDraw, 3500);
    return () => clearInterval(interval);
  }, [id, currentNetwork]);

  // Check if player has already drawn a ticket in this draw (local storage + on-chain ledger)
  useEffect(() => {
    if (!draw) return;
    let cancelled = false;

    const checkParticipation = async () => {
      // 1. Check local storage
      let alreadyDrawn = false;
      try {
        const tickets: UserTicket[] = JSON.parse(localStorage.getItem('zkdraw_user_tickets') ?? '[]');
        alreadyDrawn = tickets.some((t) => t.lotteryId === draw.id && t.network === currentNetwork);
      } catch {}

      if (alreadyDrawn) {
        if (!cancelled) setHasDrawnTicket(true);
        return;
      }

      // 2. Check on-chain / backend ledger participants via deterministic wallet identity
      if (wallet?.address && draw.participants && draw.participants.length > 0) {
        try {
          const secret = await derivePlayerSecret(wallet.address);
          const pKey = await computeClientParticipantKey(draw.drawId ?? 0, secret);
          const cleanPKey = pKey.toLowerCase();
          const onChainDrawn = draw.participants.some(
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
  }, [draw?.id, draw?.drawId, draw?.participants, wallet?.address, currentNetwork]);

  // Compute live ZK commitment preview
  useEffect(() => {
    if (selectedNumber) {
      computeClientTicketCommitment(selectedNumber, previewSalt).then(setPreviewCommitment);
    }
  }, [selectedNumber, previewSalt]);

  // Check if connected wallet is creator of this specific draw
  const isCreatorOfThisDraw = useMemo(() => {
    if (!wallet?.address || !draw) return false;
    const userAddr = wallet.address.toLowerCase();
    const adminKey = draw.adminKey?.toLowerCase();
    const creatorAddr = draw.creatorAddress?.toLowerCase();
    return Boolean((adminKey && adminKey === userAddr) || (creatorAddr && creatorAddr === userAddr));
  }, [wallet?.address, draw]);

  // Check winning status from vault
  const userWinningTicket = useMemo(() => {
    if (!draw || draw.status !== 'DRAWN' || draw.winningNumber === undefined) return null;
    try {
      const tickets: UserTicket[] = JSON.parse(localStorage.getItem('zkdraw_user_tickets') ?? '[]');
      return tickets.find((t) => t.lotteryId === draw.id && t.ticketNumber === draw.winningNumber) || null;
    } catch {
      return null;
    }
  }, [draw]);

  if (loading) {
    return (
      <div className="myrad-card p-16 text-center text-[#8b98a5] max-w-xl mx-auto space-y-3">
        <div className="w-10 h-10 rounded-2xl bg-[#0f0f0f] border border-white/10 flex items-center justify-center mx-auto animate-spin text-[#00d4ff]">
          <Loader2 className="w-5 h-5" />
        </div>
        <div className="text-white font-bold">Loading Draw Details...</div>
      </div>
    );
  }

  if (!draw) {
    return (
      <div className="myrad-card p-16 text-center border border-white/10 space-y-4 max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-[#0f0f0f] border border-white/10 text-amber-400 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-white">Draw Not Found</h2>
        <p className="text-xs text-[#8b98a5] leading-relaxed">
          The requested draw ID could not be located on {netConfig.name}. It may belong to another testnet network or hasn't been created yet.
        </p>
        <div className="pt-2">
          <Link to="/draws" className="myrad-btn-primary px-6 py-2.5 text-xs font-bold inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Active Draws</span>
          </Link>
        </div>
      </div>
    );
  }

  const rangeMin = draw.rangeMin || 1;
  const rangeMax = draw.rangeMax || 50;
  const maxTickets = draw.maxTickets || 10;
  const ticketCount = draw.ticketCount || 0;
  const isSoldOut = ticketCount >= maxTickets;

  // Enforce automatic sellout closure condition in UI layer
  const effectiveStatus = (draw.status === 'OPEN' && isSoldOut) ? 'CLOSED' : draw.status;
  const isAutoClosed = isSoldOut && effectiveStatus === 'CLOSED';
  const percentFilled = Math.min(100, Math.round((ticketCount / maxTickets) * 100));

  const numberOptions = Array.from(
    { length: rangeMax - rangeMin + 1 },
    (_, i) => rangeMin + i,
  );

  const formattedPrize = (Number(draw.prizePool) / 1_000_000).toLocaleString();
  const formattedTicketPrice = (Number(draw.ticketPrice) / 1_000_000).toString();

  // Business Rule 3: creator cannot buy tickets in their own draw
  const isPurchaseDisabled =
    effectiveStatus !== 'OPEN' ||
    isCreatorOfThisDraw ||
    hasDrawnTicket ||
    isSoldOut;

  const getPurchaseDisabledReason = (): string => {
    if (isCreatorOfThisDraw) {
      return "You created this draw and can't purchase tickets in it";
    }
    if (hasDrawnTicket) {
      return 'Already drawn 1 ticket in this draw (Protocol limit)';
    }
    if (isSoldOut) {
      return 'All tickets sold out (Draw closed)';
    }
    if (effectiveStatus !== 'OPEN') {
      return `Draw is ${effectiveStatus}`;
    }
    return '';
  };

  // Quick preset helper
  const handlePresetSelect = (num: number) => {
    if (num >= rangeMin && num <= rangeMax && !isPurchaseDisabled) {
      setSelectedNumber(num);
    }
  };

  const handleRandomPick = () => {
    if (!isPurchaseDisabled) {
      const random = Math.floor(Math.random() * (rangeMax - rangeMin + 1)) + rangeMin;
      setSelectedNumber(random);
    }
  };

  // End Draw Early (Creator only)
  const handleConfirmClose = async () => {
    setShowCloseConfirmModal(false);
    if (!wallet?.connectedApi) {
      setActionError('Please connect a funded Midnight wallet (Lace/1AM) to broadcast on-chain.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setProvingStep('Proving creator authorization on-chain (closeLottery circuit)...');

    try {
      let adminSecretHex = draw.drawSecretHex;
      if (!adminSecretHex && wallet?.connectedApi) {
        try {
          const derived = await deriveAdminSecretFromWallet(wallet.connectedApi, currentNetwork, draw.id);
          adminSecretHex = derived.adminSecretHex;
        } catch { /* fallback */ }
      }
      if (!adminSecretHex) {
        adminSecretHex = netConfig.defaultLottery.drawSecretHex || '0dfcc49e9d7fe799d2c7b8266ab095efe0bf60226edafd4723324fc5a8e3ff99';
      }

      const res = await closeLotteryOnChain(
        wallet.connectedApi,
        draw.contractAddress,
        draw.drawId ?? 0,
        adminSecretHex,
        currentNetwork,
        (s: string) => setProvingStep(s),
      );

      const updated = await closeLottery(draw.id, currentNetwork);
      setDraw(updated.lottery);
      onLotteryUpdated(updated.lottery);

      if (onToast) {
        onToast(`On-chain transaction confirmed (${res.txHash.slice(0, 8)}...)! Ticket sales ended early.`);
      }
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
      setProvingStep('');
    }
  };

  // Execute Provable Winner Draw (Creator only)
  const handleDrawWinner = async () => {
    if (!wallet?.connectedApi) {
      setActionError('Please connect a funded Midnight wallet (Lace/1AM) to broadcast on-chain.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setProvingStep('Deriving winning entropy and Euclidean division quotient proof...');

    try {
      let adminSecretHex = draw.drawSecretHex;
      if (!adminSecretHex && wallet?.connectedApi) {
        try {
          const derived = await deriveAdminSecretFromWallet(wallet.connectedApi, currentNetwork, draw.id);
          adminSecretHex = derived.adminSecretHex;
        } catch { /* fallback */ }
      }
      if (!adminSecretHex) {
        adminSecretHex = netConfig.defaultLottery.drawSecretHex || '0dfcc49e9d7fe799d2c7b8266ab095efe0bf60226edafd4723324fc5a8e3ff99';
      }

      const secretHex = draw.drawSecretHex || netConfig.defaultLottery.drawSecretHex;
      const secretBytes = hexToBytes(secretHex);
      const drawIdBig = BigInt(draw.drawId ?? 0);

      const entropyBytes = pureCircuits.deriveWinningEntropy(
        drawIdBig,
        secretBytes,
        BigInt(draw.ticketCount),
      );

      const sliced = entropyBytes.slice(0, 31);
      let entropyField = 0n;
      for (let i = sliced.length - 1; i >= 0; i -= 1) {
        entropyField = entropyField * 256n + BigInt(sliced[i]);
      }

      const span = BigInt(draw.rangeMax - draw.rangeMin + 1);
      const quotient = entropyField / span;
      const offset = entropyField % span;
      const winningNumber = draw.rangeMin + Number(offset);

      setProvingStep('Submitting on-chain drawWinner circuit proof to Midnight...');
      const res = await drawWinnerOnChain(
        wallet.connectedApi,
        draw.contractAddress,
        draw.drawId ?? 0,
        adminSecretHex,
        secretHex,
        winningNumber,
        quotient,
        currentNetwork,
        (s: string) => setProvingStep(s),
      );

      const updated = await drawLottery(draw.id, currentNetwork);
      setDraw(updated.lottery);
      onLotteryUpdated(updated.lottery);

      if (onToast) {
        onToast(`🎉 Winning Number #${res.winningNumber} drawn and verified on-chain!`);
      }
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
      setProvingStep('');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.08]">
        <div className="flex items-center gap-2 text-xs font-bold text-[#8b98a5]">
          <Link to="/draws" className="hover:text-white flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Active Draws</span>
          </Link>
          <span>/</span>
          <span className="text-[#00d4ff] font-mono">#{draw.id.slice(-8)}</span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <a
            href={getExplorerContractUrl(draw.contractAddress, currentNetwork)}
            target="_blank"
            rel="noreferrer"
            className="myrad-btn-secondary px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"
          >
            <span>Contract on Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <Link
            to={`/verify?draw=${draw.id}`}
            className="myrad-btn-secondary px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 text-[#00ba7c]"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verify Math</span>
          </Link>
        </div>
      </div>

      {/* Draw Header Banner */}
      <div className="myrad-card p-6 sm:p-8 border border-white/10 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`myrad-badge text-xs ${
                  effectiveStatus === 'OPEN'
                    ? 'badge-open'
                    : effectiveStatus === 'CLOSED'
                    ? 'badge-closed'
                    : 'badge-drawn'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                {isAutoClosed ? 'AUTO CLOSED (SOLD OUT)' : effectiveStatus}
              </span>

              {isCreatorOfThisDraw && (
                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" />
                  Your Draw (Creator)
                </span>
              )}

              <span className="text-xs font-mono text-[#8b98a5] bg-[#0f0f0f] px-2 py-0.5 rounded-lg border border-white/[0.06]">
                Contract: {shortenContractAddress(draw.contractAddress)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white">
              {draw.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#8b98a5] leading-relaxed">
              {draw.description || 'Confidential provably fair lottery on Midnight testnet.'}
            </p>
          </div>

          {/* Quick Action Button for Creator to End Draw Early */}
          {isCreatorOfThisDraw && effectiveStatus === 'OPEN' && (
            <div className="shrink-0">
              <button
                onClick={() => setShowCloseConfirmModal(true)}
                disabled={actionLoading || ticketCount === 0}
                className={`myrad-btn-secondary px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 ${
                  ticketCount === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>End Draw Early</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/[0.08]">
          <div>
            <span className="text-[10px] font-extrabold text-[#8b98a5] uppercase tracking-wider block">
              Jackpot Pool
            </span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1 flex items-baseline gap-1">
              <span>{formattedPrize}</span>
              <span className="text-xs text-[#00d4ff]">tDUST</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-extrabold text-[#8b98a5] uppercase tracking-wider block">
              Ticket Price
            </span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1 flex items-baseline gap-1">
              <span>{formattedTicketPrice}</span>
              <span className="text-xs text-purple-400">tDUST</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-extrabold text-[#8b98a5] uppercase tracking-wider block">
              Tickets Sold
            </span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">
              {ticketCount} <span className="text-xs text-[#8b98a5]">/ {maxTickets}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-extrabold text-[#8b98a5] uppercase tracking-wider block">
              Number Range
            </span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">
              [{rangeMin} .. {rangeMax}]
            </div>
          </div>
        </div>

        {/* Capacity Progress Bar */}
        <div className="mt-4 pt-3 border-t border-white/[0.04]">
          <div className="w-full bg-[#141414] h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isSoldOut ? 'bg-amber-400' : 'bg-[#00ba7c]'
              }`}
              style={{ width: `${percentFilled}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#8b98a5] mt-1.5">
            <span>{percentFilled}% filled</span>
            <span>{isSoldOut ? 'Sellout reached — ticket sales closed' : `${maxTickets - ticketCount} tickets available`}</span>
          </div>
        </div>
      </div>

      {/* Proving Step Notification */}
      {provingStep && (
        <div className="p-4 rounded-2xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-white text-xs flex items-center gap-3 animate-pulse">
          <Loader2 className="w-5 h-5 text-[#00d4ff] animate-spin shrink-0" />
          <div>
            <div className="font-bold text-[#00d4ff]">On-Chain Transaction in Progress</div>
            <div className="text-[11px] text-[#8b98a5]">{provingStep}</div>
          </div>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Creator Restriction Warning Banner */}
      {isCreatorOfThisDraw && effectiveStatus === 'OPEN' && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-3 shadow-md">
          <Crown className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="font-bold text-amber-300 text-sm">
              👑 Creator Restriction Enforced
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              You created this draw and are barred from purchasing tickets in it. You can manage sales closure or execute the provable draw.
            </p>
          </div>
        </div>
      )}

      {/* 1 Ticket Limit Banner */}
      {hasDrawnTicket && !isCreatorOfThisDraw && (
        <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/40 text-purple-200 text-xs flex items-center gap-3">
          <Ticket className="w-5 h-5 text-purple-400 shrink-0" />
          <div>
            <div className="font-bold text-purple-300 text-sm">
              🎟️ 1 Ticket Limit Reached
            </div>
            <p className="text-xs text-purple-200/80 mt-0.5">
              You already hold a confidential ticket in this draw. View your ticket receipts in the Vault.
            </p>
          </div>
        </div>
      )}

      {/* Auto-Closed Sellout Banner */}
      {isAutoClosed && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div className="font-bold text-emerald-300 text-sm">
              🔒 Sellout Condition Reached (Auto-Closed)
            </div>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              All {maxTickets} available tickets have been purchased! Ticket sales have automatically locked. Ready to draw the winner.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ENTER FLOW: Lucky Number Selector (Active when OPEN)          */}
      {/* ------------------------------------------------------------- */}
      {effectiveStatus === 'OPEN' && (
        <div className="myrad-card p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <span>Select Your Lucky Number</span>
                <Sparkles className="w-4 h-4 text-[#00d4ff]" />
              </h2>
              <p className="text-xs text-[#8b98a5] mt-0.5">
                Pick a number from {rangeMin} to {rangeMax}. Synthesized into a zero-knowledge commitment in your browser.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handlePresetSelect(7)}
                disabled={isPurchaseDisabled}
                className="px-3 py-1 rounded-xl bg-[#0f0f0f] border border-white/10 text-xs font-bold text-white hover:bg-[#141414] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Lucky 7
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect(21)}
                disabled={isPurchaseDisabled}
                className="px-3 py-1 rounded-xl bg-[#0f0f0f] border border-white/10 text-xs font-bold text-white hover:bg-[#141414] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Blackjack 21
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect(42)}
                disabled={isPurchaseDisabled}
                className="px-3 py-1 rounded-xl bg-[#0f0f0f] border border-white/10 text-xs font-bold text-white hover:bg-[#141414] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cosmic 42
              </button>
              <button
                type="button"
                onClick={handleRandomPick}
                disabled={isPurchaseDisabled}
                className="myrad-btn-secondary px-3.5 py-1 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Shuffle className="w-3.5 h-3.5 text-[#00d4ff]" />
                Random
              </button>
            </div>
          </div>

          {/* Number Grid */}
          <div className="py-2">
            <div className="flex flex-wrap gap-2.5 justify-center sm:justify-start">
              {numberOptions.map((num) => {
                const isSelected = selectedNumber === num;
                return (
                  <button
                    key={num}
                    type="button"
                    disabled={isPurchaseDisabled}
                    onClick={() => setSelectedNumber(num)}
                    className={`number-grid-cell ${isSelected ? 'selected' : ''} ${
                      isPurchaseDisabled ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Real-time Commitment Preview */}
          <div className="p-4 rounded-2xl bg-[#070707] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-[#00d4ff] font-bold">
                <Cpu className="w-3.5 h-3.5" />
                ZK Circuit Synthesis Preview
              </span>
              <span className="text-[10px] text-[#00ba7c] font-semibold flex items-center gap-1">
                <EyeOff className="w-3 h-3" />
                Confidential in Browser
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-[#0f0f0f] p-2.5 rounded-xl border border-white/[0.04]">
                <span className="text-[#8b98a5] text-[10px] block font-sans">Circuit Input</span>
                <span className="text-white font-bold">Number #{selectedNumber}</span>
                <span className="text-[#8b98a5] text-[10px] block truncate">Salt: 0x{previewSalt.slice(0, 16)}...</span>
              </div>
              <div className="bg-[#0f0f0f] p-2.5 rounded-xl border border-white/[0.04]">
                <span className="text-[#8b98a5] text-[10px] block font-sans">Public On-Chain Commitment</span>
                <span className="text-[#00d4ff] font-semibold truncate block">
                  {previewCommitment ? `0x${previewCommitment.slice(0, 24)}...` : 'Computing...'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Bar with Creator Enforcement */}
          <div className="p-5 rounded-2xl bg-[#0f0f0f] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center font-black text-2xl text-[#00d4ff]">
                {selectedNumber}
              </div>
              <div>
                <div className="text-xs font-extrabold text-[#8b98a5] uppercase tracking-wider">
                  Your Selected Number
                </div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Number #{selectedNumber}</span>
                  <span className="text-xs text-[#00ba7c] font-normal flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Encapsulated
                  </span>
                </div>
              </div>
            </div>

            <div>
              {!wallet ? (
                <button
                  type="button"
                  onClick={onOpenWalletModal}
                  className="myrad-btn-white px-7 py-3 text-sm font-bold"
                >
                  Connect Wallet to Play
                </button>
              ) : isCreatorOfThisDraw ? (
                /* Creator disabled state per Section 3 */
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    disabled
                    title="You created this draw and can't purchase tickets in it"
                    className="px-6 py-3 rounded-2xl bg-[#1a1a1a] border border-white/10 text-xs font-bold text-[#8b98a5] cursor-not-allowed opacity-60 flex items-center gap-2"
                  >
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>Buy Ticket (Creator Restricted)</span>
                  </button>
                  <span className="text-[11px] text-amber-300/80 font-medium">
                    You created this draw and can't purchase tickets in it
                  </span>
                </div>
              ) : isPurchaseDisabled ? (
                <button
                  type="button"
                  disabled
                  className="px-6 py-3 rounded-2xl bg-[#1a1a1a] border border-white/10 text-xs font-bold text-[#8b98a5] cursor-not-allowed opacity-60"
                >
                  {getPurchaseDisabledReason()}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBuyModal(true)}
                  className="myrad-btn-primary px-8 py-3.5 text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#00d4ff]/15"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Buy Ticket #{selectedNumber} ({formattedTicketPrice} tDUST)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* RESOLVE FLOW: Closed State (Execute Draw)                     */}
      {/* ------------------------------------------------------------- */}
      {effectiveStatus === 'CLOSED' && (
        <div className="myrad-card p-6 sm:p-8 border border-amber-500/30 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Ticket Sales Closed</h3>
                <p className="text-xs text-[#8b98a5]">
                  {ticketCount} ticket{ticketCount > 1 ? 's' : ''} locked into the on-chain commitment set. Ready to execute provable winner draw.
                </p>
              </div>
            </div>

            <span className="myrad-badge badge-closed">Phase 2: Closed</span>
          </div>

          {isCreatorOfThisDraw ? (
            <div className="p-6 rounded-2xl bg-[#0f0f0f] border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-extrabold text-white text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#00d4ff]" />
                    <span>Execute Provable Draw as Operator</span>
                  </div>
                  <p className="text-xs text-[#8b98a5] mt-1 max-w-xl leading-relaxed">
                    Reveals the pre-committed operator draw seed and computes winning number W through Euclidean field modulus verified on Midnight.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDrawWinner}
                  disabled={actionLoading}
                  className="myrad-btn-primary px-7 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 self-start sm:self-center shrink-0"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Proving Draw...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Execute Draw on {netConfig.name}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] text-xs text-[#8b98a5] space-y-1">
              <div className="font-bold text-white">Waiting for Operator Draw Execution</div>
              <p>
                The draw creator ({shortenAddress(draw.creatorAddress || draw.adminKey || '')}) will reveal the seed and execute the Euclidean division circuit to determine the winner. Check back shortly!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* RESOLVE FLOW: Drawn State (Results & Winner Claim)            */}
      {/* ------------------------------------------------------------- */}
      {effectiveStatus === 'DRAWN' && (
        <div className="myrad-card p-6 sm:p-8 border border-purple-500/40 bg-gradient-to-b from-purple-950/20 via-[#0a0a0a] to-[#0a0a0a] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-950/70 border border-purple-500/40 text-purple-300 flex items-center justify-center font-black text-3xl shadow-lg">
                {draw.winningNumber}
              </div>
              <div>
                <div className="text-xs font-extrabold text-purple-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                  <Trophy className="w-4 h-4" />
                  Official Winning Number
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Lucky #{draw.winningNumber}
                </h3>
                <p className="text-xs text-[#8b98a5]">
                  Proved deterministically on {netConfig.name}
                </p>
              </div>
            </div>

            <Link
              to={`/verify?draw=${draw.id}`}
              className="myrad-btn-white px-5 py-2.5 text-xs font-bold self-start sm:self-center flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-black" />
              <span>Verify Circuit Proof</span>
            </Link>
          </div>

          {/* User Vault Winner Card */}
          {userWinningTicket ? (
            <div className="p-5 rounded-2xl bg-[#00ba7c]/15 border border-[#00ba7c]/40 text-white space-y-3">
              <div className="flex items-center gap-2 text-[#00ba7c] font-black text-base">
                <Trophy className="w-5 h-5" />
                <span>🎉 Congratulations! Your Ticket Won!</span>
              </div>
              <p className="text-xs text-white/80">
                You hold Ticket #{userWinningTicket.ticketNumber} with secret commitment in your Vault. Claim your prize using Midnight zero-knowledge nullifiers.
              </p>
              <div className="pt-1">
                <Link
                  to="/my-tickets"
                  className="myrad-btn-primary px-6 py-2.5 text-xs font-bold inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Go to Vault & Claim Prize</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#0f0f0f] border border-white/[0.04] text-xs text-[#8b98a5] flex items-center justify-between">
              <span>Looking for your tickets?</span>
              <Link to="/my-tickets" className="text-[#00d4ff] font-bold hover:underline">
                View My Vault
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal: End Draw Early (Creator only) */}
      {showCloseConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="myrad-card w-full max-w-md p-6 sm:p-7 border border-amber-500/40 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-300">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black text-white">End Ticket Sales Early?</h3>
            </div>
            <p className="text-xs text-[#8b98a5] leading-relaxed">
              Are you sure you want to end ticket sales for <strong>{draw.name}</strong> early?
              <br />
              Currently, <strong>{ticketCount} of {maxTickets}</strong> tickets have been sold.
              Ending sales is irreversible and allows you to execute the winner draw with the current tickets sold.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseConfirmModal(false)}
                className="myrad-btn-secondary flex-1 py-2.5 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className="myrad-btn-primary flex-1 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black"
              >
                Confirm & End Draw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Modal for Purchasing */}
      {showBuyModal && wallet && (
        <TicketModal
          lottery={draw}
          selectedNumber={selectedNumber}
          wallet={wallet}
          onClose={() => setShowBuyModal(false)}
          onSuccess={(ticket) => {
            setHasDrawnTicket(true);
            onTicketPurchased(ticket);
            loadDraw();
            if (onToast) {
              onToast(`Successfully purchased Ticket #${selectedNumber} in ${draw.name}!`);
            }
          }}
          currentNetwork={currentNetwork}
        />
      )}
    </div>
  );
};
