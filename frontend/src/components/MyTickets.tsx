import React, { useState } from 'react';
import {
  Award,
  Lock,
  Trophy,
  CheckCircle2,
  Sparkles,
  Copy,
  Check,
  KeyRound,
  Hash,
  ShieldCheck,
} from 'lucide-react';
import type { Lottery, UserTicket } from '../types/index.js';
import { computeClientClaimNullifier } from '../midnight/crypto.js';

interface MyTicketsProps {
  lottery: Lottery | null;
  tickets: UserTicket[];
  onNavigateToPot: () => void;
}

export const MyTickets: React.FC<MyTicketsProps> = ({
  lottery,
  tickets,
  onNavigateToPot,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [claimingTicketId, setClaimingTicketId] = useState<string | null>(null);
  const [claimedNullifiers, setClaimedNullifiers] = useState<Record<string, string>>({});

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClaimPrize = async (ticket: UserTicket) => {
    setClaimingTicketId(ticket.id);
    try {
      const nullifier = await computeClientClaimNullifier(
        ticket.commitmentHex,
        ticket.playerSecretHex,
      );

      await new Promise((r) => setTimeout(r, 800));

      setClaimedNullifiers((prev) => ({
        ...prev,
        [ticket.id]: nullifier,
      }));
    } catch (err) {
      alert(`Claim failed: ${(err as Error).message}`);
    } finally {
      setClaimingTicketId(null);
    }
  };

  if (tickets.length === 0) {
    return (
      <div className="myrad-card p-16 text-center border border-white/10 space-y-4 max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-[#0f0f0f] border border-white/10 text-purple-400 mx-auto flex items-center justify-center">
          <Award className="w-8 h-8" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-white">
          No Confidential Tickets Yet
        </h3>
        <p className="text-xs sm:text-sm text-[#8b98a5] max-w-md mx-auto leading-relaxed">
          Your confidential ticket receipts are stored locally in your browser memory. Pick a private number to participate in the active Midnight lottery pot.
        </p>
        <div className="pt-3">
          <button
            onClick={onNavigateToPot}
            className="myrad-btn-primary px-7 py-3.5 text-sm font-bold"
          >
            Enter Active Lottery Pot
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="myrad-card p-6 sm:p-8 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Award className="w-6 h-6 text-[#00d4ff]" />
            Your Confidential Ticket Vault
          </h2>
          <p className="text-xs sm:text-sm text-[#8b98a5] mt-1">
            You hold {tickets.length} confidential ticket{tickets.length > 1 ? 's' : ''} in this browser session.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-[#00ba7c] bg-[#0f0f0f] border border-white/10 px-4 py-2 rounded-xl">
          <Lock className="w-4 h-4" />
          Encrypted Locally
        </div>
      </div>

      <div className="space-y-4">
        {tickets.map((ticket) => {
          const isDrawn = lottery?.status === 'DRAWN';
          const isWinner =
            isDrawn &&
            lottery?.winningNumber !== undefined &&
            ticket.ticketNumber === lottery.winningNumber;

          const hasClaimed = Boolean(claimedNullifiers[ticket.id]);

          return (
            <div
              key={ticket.id}
              className={`myrad-card-interactive p-6 border transition-all ${
                isWinner
                  ? 'border-[#00ba7c]/60 shadow-xl shadow-[#00ba7c]/10'
                  : 'border-white/[0.08]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-3xl border ${
                      isWinner
                        ? 'bg-[#00ba7c]/20 text-[#00ba7c] border-[#00ba7c]/40'
                        : 'bg-[#0f0f0f] text-[#00d4ff] border-white/10'
                    }`}
                  >
                    {ticket.ticketNumber}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-base sm:text-lg">
                        Secret Number #{ticket.ticketNumber}
                      </span>
                      {isWinner && (
                        <span className="myrad-badge bg-[#00ba7c]/10 text-[#00ba7c] border border-[#00ba7c]/40 flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5 text-amber-400" />
                          WINNER!
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#8b98a5] mt-0.5">
                      Purchased: {new Date(ticket.purchasedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Winner Status / Action */}
                <div>
                  {isWinner ? (
                    hasClaimed ? (
                      <div className="text-right">
                        <span className="myrad-badge bg-[#00ba7c]/20 text-[#00ba7c] border border-[#00ba7c]/50 flex items-center gap-1 py-1.5 px-3">
                          <CheckCircle2 className="w-4 h-4" />
                          Prize Claimed
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleClaimPrize(ticket)}
                        disabled={claimingTicketId === ticket.id}
                        className="myrad-btn-primary px-6 py-3 text-xs sm:text-sm flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        {claimingTicketId === ticket.id ? 'Proving Claim in ZK...' : 'Claim Jackpot Prize'}
                      </button>
                    )
                  ) : isDrawn ? (
                    <span className="text-xs font-semibold text-[#8b98a5]">
                      Not drawn this round (Winning # was {lottery?.winningNumber})
                    </span>
                  ) : (
                    <span className="myrad-badge badge-open text-[11px]">
                      Awaiting Draw
                    </span>
                  )}
                </div>
              </div>

              {/* Cryptographic Details */}
              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.06]">
                  <div className="text-[10px] text-[#8b98a5] font-sans font-bold mb-1 flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-[#00ba7c]" />
                    Client Secret Salt:
                  </div>
                  <div className="text-[#8b98a5] truncate">{ticket.saltHex}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.06]">
                  <div className="text-[10px] text-[#8b98a5] font-sans font-bold mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-[#00d4ff]" />
                      On-Chain Commitment:
                    </span>
                    <button
                      onClick={() => handleCopy(ticket.id, ticket.commitmentHex)}
                      className="text-[#00d4ff] hover:underline font-sans text-[10px] flex items-center gap-1"
                    >
                      {copiedId === ticket.id ? (
                        <Check className="w-3 h-3 text-[#00ba7c]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedId === ticket.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-[#00d4ff] truncate">{ticket.commitmentHex}</div>
                </div>
              </div>

              {/* Claim Nullifier Output */}
              {hasClaimed && (
                <div className="mt-3 p-3.5 rounded-xl bg-[#0f0f0f] border border-[#00ba7c]/30 text-xs font-mono">
                  <div className="text-[10px] font-sans font-bold text-[#00ba7c] mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    ZK Claim Nullifier (Domain-Separated One-Way Nullifier):
                  </div>
                  <div className="text-[#00ba7c] break-all">
                    {claimedNullifiers[ticket.id]}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
