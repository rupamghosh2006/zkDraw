import React, { useState } from 'react';
import {
  Award,
  Trophy,
  CheckCircle2,
  Sparkles,
  KeyRound,
  Hash,
  ShieldCheck,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { Link } from '../router/index.js';
import type { Lottery, UserTicket, MidnightNetwork } from '../types/index.js';
import { computeClientClaimNullifier } from '../midnight/crypto.js';
import { getNetworkConfig, getExplorerTxUrl } from '../midnight/config.js';

import type { ConnectedWallet } from '../midnight/wallet.js';
import { claimPrizeOnChain } from '../midnight/contract.js';

interface MyVaultPageProps {
  tickets: UserTicket[];
  lotteries: Lottery[];
  currentNetwork: MidnightNetwork;
  wallet?: ConnectedWallet | null;
  onOpenWalletModal?: () => void;
  onToast?: (message: string) => void;
}

export const MyVaultPage: React.FC<MyVaultPageProps> = ({
  tickets,
  lotteries,
  currentNetwork,
  wallet,
  onOpenWalletModal,
  onToast,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [claimingTicketId, setClaimingTicketId] = useState<string | null>(null);
  const [provingStep, setProvingStep] = useState<string>('');
  const [claimedNullifiers, setClaimedNullifiers] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('zkdraw_claimed_nullifiers') ?? '{}');
    } catch {
      return {};
    }
  });
  const [claimTxHashes, setClaimTxHashes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('zkdraw_claim_txs') ?? '{}');
    } catch {
      return {};
    }
  });
  const [networkFilter, setNetworkFilter] = useState<'ALL' | MidnightNetwork>('ALL');

  const handleCopy = (id: string, text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (onToast) {
      onToast(label ? `Copied ${label} to clipboard` : 'Copied to clipboard');
    }
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClaimPrize = async (ticket: UserTicket) => {
    const ticketNet = (ticket.network || 'preprod') as MidnightNetwork;

    if (!wallet?.connectedApi) {
      if (onOpenWalletModal) {
        onOpenWalletModal();
        return;
      }
    }

    setClaimingTicketId(ticket.id);
    setProvingStep('Computing local ZK witness preimages...');

    try {
      if (wallet?.connectedApi) {
        const result = await claimPrizeOnChain(
          wallet.connectedApi,
          ticket.contractAddress,
          ticket.ticketNumber,
          ticket.saltHex,
          ticket.playerSecretHex,
          ticketNet,
          (msg) => setProvingStep(msg),
        );

        const realTxHash = `0x${result.txHash}`;
        setClaimedNullifiers((prev) => {
          const updated = { ...prev, [ticket.id]: result.nullifierHex };
          try {
            localStorage.setItem('zkdraw_claimed_nullifiers', JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setClaimTxHashes((prev) => {
          const updated = { ...prev, [ticket.id]: realTxHash };
          try {
            localStorage.setItem('zkdraw_claim_txs', JSON.stringify(updated));
          } catch {}
          return updated;
        });

        if (onToast) {
          onToast(`🎉 Claim transaction broadcast on-chain! Tx: ${result.txHash.slice(0, 8)}...`);
        }
      } else {
        const nullifier = await computeClientClaimNullifier(
          ticket.commitmentHex,
          ticket.playerSecretHex,
        );
        setClaimedNullifiers((prev) => {
          const updated = { ...prev, [ticket.id]: nullifier };
          try {
            localStorage.setItem('zkdraw_claimed_nullifiers', JSON.stringify(updated));
          } catch {}
          return updated;
        });

        if (onToast) {
          onToast(`🎉 Generated ZK Claim Nullifier for Ticket #${ticket.ticketNumber}!`);
        }
      }
    } catch (err) {
      alert(`Claim failed: ${(err as Error).message}`);
    } finally {
      setClaimingTicketId(null);
      setProvingStep('');
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (networkFilter === 'ALL') return true;
    return (t.network || 'preprod') === networkFilter;
  });

  if (tickets.length === 0) {
    return (
      <div className="myrad-card p-16 text-center border border-white/10 space-y-4 max-w-2xl mx-auto my-8">
        <div className="w-16 h-16 rounded-2xl bg-[#0f0f0f] border border-white/10 text-purple-400 mx-auto flex items-center justify-center">
          <Award className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white">
          No Confidential Tickets in Vault
        </h2>
        <p className="text-xs sm:text-sm text-[#8b98a5] max-w-md mx-auto leading-relaxed">
          Your confidential ticket receipts and private witness salts are stored exclusively in your browser memory. Browse active draws and pick a lucky number to enter.
        </p>
        <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/draws"
            className="myrad-btn-primary px-7 py-3.5 text-sm font-bold flex items-center gap-2"
          >
            <span>Explore Active Draws</span>
          </Link>
          <Link
            to="/create"
            className="myrad-btn-secondary px-6 py-3.5 text-sm font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create a Draw</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-2">
      {/* Header with Filter */}
      <div className="myrad-card p-6 sm:p-8 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Award className="w-6 h-6 text-[#00d4ff]" />
            <span>Your Confidential Ticket Vault</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#8b98a5] mt-1">
            You hold {tickets.length} confidential ticket{tickets.length > 1 ? 's' : ''} stored locally in this browser.
          </p>
        </div>

        {/* Network Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0f0f0f] border border-white/[0.08] self-start sm:self-auto">
          <button
            onClick={() => setNetworkFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              networkFilter === 'ALL'
                ? 'bg-white text-black'
                : 'text-[#8b98a5] hover:text-white'
            }`}
          >
            All ({tickets.length})
          </button>
          <button
            onClick={() => setNetworkFilter('preprod')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              networkFilter === 'preprod'
                ? 'bg-[#00ba7c] text-black font-extrabold'
                : 'text-[#8b98a5] hover:text-white'
            }`}
          >
            Preprod
          </button>
          <button
            onClick={() => setNetworkFilter('preview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              networkFilter === 'preview'
                ? 'bg-[#00d4ff] text-black font-extrabold'
                : 'text-[#8b98a5] hover:text-white'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Ticket List */}
      <div className="space-y-4">
        {filteredTickets.map((ticket) => {
          const associatedDraw = lotteries.find((l) => l.id === ticket.lotteryId);
          const isWinner =
            associatedDraw &&
            associatedDraw.status === 'DRAWN' &&
            associatedDraw.winningNumber === ticket.ticketNumber;
          const claimedNullifier = claimedNullifiers[ticket.id];
          const ticketNet = (ticket.network || 'preprod') as MidnightNetwork;
          const ticketNetConfig = getNetworkConfig(ticketNet);

          return (
            <div
              key={ticket.id}
              className={`myrad-card p-6 border transition-all ${
                isWinner
                  ? 'border-[#00ba7c]/60 bg-gradient-to-r from-[#00ba7c]/10 via-[#0a0a0a] to-[#0a0a0a] shadow-lg shadow-[#00ba7c]/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center font-black text-2xl text-[#00d4ff] shadow-inner">
                    {ticket.ticketNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-white text-base">
                        Private Ticket #{ticket.ticketNumber}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          ticketNet === 'preprod'
                            ? 'bg-[#00ba7c]/15 text-[#00ba7c] border-[#00ba7c]/30'
                            : 'bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/30'
                        }`}
                      >
                        {ticketNetConfig.name}
                      </span>
                    </div>

                    <div className="text-xs text-[#8b98a5] mt-0.5 flex items-center gap-2">
                      <span>Draw: {associatedDraw?.name || ticket.lotteryId}</span>
                      <span>•</span>
                      <span>{new Date(ticket.purchasedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {isWinner ? (
                    <span className="myrad-badge bg-[#00ba7c]/20 text-[#00ba7c] border border-[#00ba7c]/40 font-extrabold text-xs">
                      <Trophy className="w-3.5 h-3.5" />
                      Winning Ticket!
                    </span>
                  ) : associatedDraw?.status === 'DRAWN' ? (
                    <span className="myrad-badge bg-[#536471]/20 text-[#8b98a5] border border-white/10 text-xs">
                      Not Selected (#{associatedDraw.winningNumber})
                    </span>
                  ) : (
                    <span className="myrad-badge badge-open text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Active Entry
                    </span>
                  )}

                  {associatedDraw && (
                    <Link
                      to={`/draws/${associatedDraw.id}`}
                      className="text-xs text-[#00d4ff] hover:underline font-bold ml-1"
                    >
                      View Draw →
                    </Link>
                  )}
                </div>
              </div>

              {/* Cryptographic Preimages & Witness Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 text-xs font-mono">
                <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.04]">
                  <div className="flex items-center justify-between text-[#8b98a5] mb-1 font-sans">
                    <span className="flex items-center gap-1 font-semibold">
                      <KeyRound className="w-3.5 h-3.5 text-[#00ba7c]" />
                      Private 256-bit Salt:
                    </span>
                    <button
                      onClick={() => handleCopy(`salt-${ticket.id}`, `0x${ticket.saltHex}`, 'Salt')}
                      className="text-[#00d4ff] hover:underline text-[11px]"
                    >
                      {copiedId === `salt-${ticket.id}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-white/80 truncate">0x{ticket.saltHex}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.04]">
                  <div className="flex items-center justify-between text-[#8b98a5] mb-1 font-sans">
                    <span className="flex items-center gap-1 font-semibold">
                      <Hash className="w-3.5 h-3.5 text-[#00d4ff]" />
                      On-Chain Commitment Hash:
                    </span>
                    <button
                      onClick={() => handleCopy(`comm-${ticket.id}`, `0x${ticket.commitmentHex}`, 'Commitment')}
                      className="text-[#00d4ff] hover:underline text-[11px]"
                    >
                      {copiedId === `comm-${ticket.id}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-[#00d4ff] truncate">0x{ticket.commitmentHex}</div>
                  <div className="mt-2 pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-[#8b98a5] font-sans">
                    <span>ZK State Commitment</span>
                    {ticket.txHash && (
                      <a
                        href={getExplorerTxUrl(ticket.txHash, (ticket.network as MidnightNetwork) || currentNetwork)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#00ba7c] hover:underline flex items-center gap-1 font-semibold"
                      >
                        <span>View Tx on Explorer</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Claim Nullifier Section if Winner */}
              {isWinner && (
                <div className="mt-4 p-4 rounded-2xl bg-[#00ba7c]/10 border border-[#00ba7c]/30 space-y-3 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-[#00ba7c] text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        Prize Claim Ready
                      </div>
                      <p className="text-xs text-white/80">
                        Derive your unlinkable one-way claim nullifier in client ZK to unlock the jackpot pool.
                      </p>
                    </div>

                    {!claimedNullifier ? (
                      <button
                        onClick={() => handleClaimPrize(ticket)}
                        disabled={claimingTicketId === ticket.id}
                        className="myrad-btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 self-start sm:self-center"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {claimingTicketId === ticket.id ? (provingStep || 'Processing ZK Claim...') : 'Claim Prize in ZK'}
                      </button>
                    ) : (
                      <span className="myrad-badge bg-[#00ba7c] text-black font-extrabold text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Prize Claimed
                      </span>
                    )}
                  </div>

                  {claimingTicketId === ticket.id && provingStep && (
                    <div className="p-2.5 bg-black/60 rounded-xl border border-[#00d4ff]/30 text-xs text-[#00d4ff] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-ping" />
                      <span>{provingStep}</span>
                    </div>
                  )}

                  {claimedNullifier && (
                    <div className="p-2.5 bg-black rounded-xl border border-[#00ba7c]/20 text-xs font-mono space-y-1.5">
                      <div className="text-[#8b98a5] text-[10px] font-sans">
                        Zero-Knowledge Claim Nullifier:
                      </div>
                      <div className="text-[#00ba7c] truncate flex items-center justify-between gap-2">
                        <span>0x{claimedNullifier}</span>
                        <button
                          onClick={() => handleCopy(`null-${ticket.id}`, `0x${claimedNullifier}`, 'Nullifier')}
                          className="text-[#00d4ff] hover:underline text-[11px] font-sans"
                        >
                          {copiedId === `null-${ticket.id}` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      {claimTxHashes[ticket.id] && (
                        <div className="pt-1 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-sans">
                          <span className="text-[#8b98a5]">On-Chain Nullifier Transaction:</span>
                          <a
                            href={getExplorerTxUrl(claimTxHashes[ticket.id], ticketNet)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#00ba7c] hover:underline flex items-center gap-1 font-semibold"
                          >
                            <span>View on Explorer</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
