import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Loader2,
  Send,
} from 'lucide-react';
import { Link } from '../router/index.js';
import type { Lottery, UserTicket, MidnightNetwork } from '../types/index.js';
import { computeClientClaimNullifier } from '../midnight/crypto.js';
import { getNetworkConfig, getExplorerTxUrl, isCorruptedTxHash } from '../midnight/config.js';
import type { ConnectedWallet } from '../midnight/wallet.js';
import { claimPrizeOnChain } from '../midnight/contract.js';
import { requestEscrowPayout } from '../services/escrow.js';

interface MyVaultPageProps {
  tickets: UserTicket[];
  lotteries: Lottery[];
  currentNetwork: MidnightNetwork;
  wallet?: ConnectedWallet | null;
  onOpenWalletModal?: () => void;
  onToast?: (message: string) => void;
}

const formatTicketDate = (date: string) => new Date(date).toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export const MyVaultPage: React.FC<MyVaultPageProps> = ({
  tickets,
  lotteries,
  wallet,
  onOpenWalletModal,
  onToast,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [claimingTicketId, setClaimingTicketId] = useState<string | null>(null);
  const [provingStep, setProvingStep] = useState('');
  const [revealedReceiptId, setRevealedReceiptId] = useState<string | null>(null);
  const [networkFilter, setNetworkFilter] = useState<'ALL' | MidnightNetwork>('ALL');
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
  // Escrow payout status per ticket id: 'pending' | 'verifying' | 'paid' | 'simulated' | 'failed'
  const [payoutStatus, setPayoutStatus] = useState<Record<string, {
    status: 'pending' | 'verifying' | 'paid' | 'simulated' | 'failed';
    txHash?: string;
    amountAtomic?: string;
    message?: string;
  }>>({});

  const associatedDraws = new Map(lotteries.map((lottery) => [lottery.id, lottery]));
  const activeEntryCount = tickets.filter((ticket) => associatedDraws.get(ticket.lotteryId)?.status !== 'DRAWN').length;
  const claimReadyCount = tickets.filter((ticket) => {
    const draw = associatedDraws.get(ticket.lotteryId);
    return draw?.status === 'DRAWN' && draw.winningNumber === ticket.ticketNumber && !claimedNullifiers[ticket.id];
  }).length;
  const filteredTickets = tickets.filter((ticket) => networkFilter === 'ALL' || (ticket.network || 'preprod') === networkFilter);

  const handleCopy = (id: string, text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    onToast?.(`Copied ${label} to clipboard`);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClaimPrize = async (ticket: UserTicket) => {
    const ticketNet = (ticket.network || 'preprod') as MidnightNetwork;

    if (!wallet?.connectedApi && onOpenWalletModal) {
      onOpenWalletModal();
      return;
    }

    setClaimingTicketId(ticket.id);
    setProvingStep('Preparing your private claim witness…');

    try {
      if (wallet?.connectedApi) {
        // Step 1: Execute claimPrize ZK circuit — burns nullifier on-chain
        const result = await claimPrizeOnChain(
          wallet.connectedApi,
          ticket.contractAddress,
          ticket.drawId ?? 0,
          ticket.ticketNumber,
          ticket.saltHex,
          ticket.playerSecretHex,
          ticketNet,
          setProvingStep,
        );
        const realTxHash = `0x${result.txHash}`;

        setClaimedNullifiers((previous) => {
          const updated = { ...previous, [ticket.id]: result.nullifierHex };
          try { localStorage.setItem('zkdraw_claimed_nullifiers', JSON.stringify(updated)); } catch {}
          return updated;
        });
        setClaimTxHashes((previous) => {
          const updated = { ...previous, [ticket.id]: realTxHash };
          try { localStorage.setItem('zkdraw_claim_txs', JSON.stringify(updated)); } catch {}
          return updated;
        });
        onToast?.(`ZK claim confirmed on-chain! Tx: ${result.txHash.slice(0, 8)}… Requesting escrow payout…`);

        // Step 2: Request escrow payout — backend verifies nullifier and sends tNIGHT
        setPayoutStatus((prev) => ({
          ...prev,
          [ticket.id]: { status: 'verifying', message: 'Verifying nullifier on Midnight Indexer…' },
        }));
        setProvingStep('Requesting prize payout from escrow vault…');

        try {
          const winnerAddress = wallet.address ?? '';
          const associatedDraw = associatedDraws.get(ticket.lotteryId);
          const escrowResult = await requestEscrowPayout(
            ticket.contractAddress,
            ticket.drawId ?? 0,
            result.nullifierHex,
            winnerAddress,
            ticketNet,
            ticket.lotteryId,
            associatedDraw?.ticketPrice,
          );

          if (escrowResult.ok && escrowResult.verified) {
            const isSimulated = escrowResult.claim.isSimulated;
            const payoutTx = escrowResult.claim.payoutTxHash;
            const amountAtomic = escrowResult.claim.payoutAmountAtomic;
            const amountFormatted = amountAtomic
              ? `${(Number(amountAtomic) / 1_000_000).toLocaleString()} tNIGHT`
              : '';

            setPayoutStatus((prev) => ({
              ...prev,
              [ticket.id]: {
                status: isSimulated ? 'simulated' : 'paid',
                txHash: payoutTx,
                amountAtomic,
                message: escrowResult.message,
              },
            }));

            if (isSimulated) {
              onToast?.(`Prize payout recorded [SIMULATION — configure ESCROW_MNEMONIC for real transfers]. ${amountFormatted}`);
            } else {
              onToast?.(`🎉 ${amountFormatted} sent to your wallet! TxHash: ${payoutTx?.slice(0, 8)}…`);
            }
          } else {
            setPayoutStatus((prev) => ({
              ...prev,
              [ticket.id]: {
                status: 'failed',
                message: escrowResult.error || escrowResult.message || 'Payout request failed',
              },
            }));
            onToast?.(`Claim recorded on-chain but payout request failed: ${escrowResult.error || 'see escrow status'}`);
          }
        } catch (payoutErr) {
          const msg = (payoutErr as Error).message || 'Escrow payout error';
          setPayoutStatus((prev) => ({
            ...prev,
            [ticket.id]: { status: 'failed', message: msg },
          }));
          onToast?.(`ZK claim verified, but payout request failed: ${msg}`);
        }
      } else {
        const nullifier = await computeClientClaimNullifier(
          ticket.commitmentHex,
          ticket.playerSecretHex,
          ticket.drawId ?? 0,
        );
        setClaimedNullifiers((previous) => {
          const updated = { ...previous, [ticket.id]: nullifier };
          try { localStorage.setItem('zkdraw_claimed_nullifiers', JSON.stringify(updated)); } catch {}
          return updated;
        });
        onToast?.(`Generated the ZK claim nullifier for ticket #${ticket.ticketNumber}.`);
      }
    } catch (error) {
      alert(`Claim failed: ${(error as Error).message}`);
    } finally {
      setClaimingTicketId(null);
      setProvingStep('');
    }
  };

  return (
    <section className="vault-page">
      <div className="vault-hero">
        <Link to="/draws" className="vault-back"><ChevronLeft className="w-4 h-4" /> Active draws</Link>
        <div className="vault-hero-grid">
          <div>
            <p className="vault-eyebrow">Private ticket receipts</p>
            <h1>Keep your entries<br />close.</h1>
            <p>Your ticket details are held in this browser, ready when a draw closes and a prize needs claiming.</p>
          </div>
          <div className="vault-hero-ticket" aria-hidden="true">
            <span>private<br />vault</span>
            <strong>{String(tickets.length).padStart(2, '0')}</strong>
            <i />
          </div>
        </div>
      </div>

      <div className="vault-overview" aria-label="Vault overview">
        <div><Ticket className="w-4 h-4" /><span>Total entries</span><strong>{tickets.length}</strong></div>
        <div><ShieldCheck className="w-4 h-4" /><span>Live entries</span><strong>{activeEntryCount}</strong></div>
        <div className={claimReadyCount > 0 ? 'vault-overview-ready' : ''}><Trophy className="w-4 h-4" /><span>Ready to claim</span><strong>{claimReadyCount}</strong></div>
      </div>

      <div className="vault-content">
        {tickets.length === 0 ? (
          <div className="vault-empty-state">
            <div className="vault-empty-icon"><LockKeyhole className="w-7 h-7" /></div>
            <p className="vault-eyebrow">Nothing stored yet</p>
            <h2>Your vault is waiting.</h2>
            <p>When you enter a draw, its private receipt stays on this device. No account, email, or public profile required.</p>
            <div className="vault-empty-actions">
              <Link to="/draws" className="vault-primary-action">Explore live draws <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/create" className="vault-secondary-action"><Plus className="w-4 h-4" /> Launch a draw</Link>
            </div>
            <div className="vault-empty-notes">
              <span><ShieldCheck className="w-4 h-4" /> Browser-local receipts</span>
              <span><KeyRound className="w-4 h-4" /> Private witness data</span>
              <span><Sparkles className="w-4 h-4" /> ZK claims when you win</span>
            </div>
          </div>
        ) : (
          <>
            <div className="vault-toolbar">
              <div>
                <p className="vault-eyebrow">Your collection</p>
                <h2>Ticket receipts</h2>
              </div>
              <div className="vault-filter" role="group" aria-label="Filter tickets by network">
                <button type="button" onClick={() => setNetworkFilter('ALL')} className={networkFilter === 'ALL' ? 'is-active' : ''} aria-pressed={networkFilter === 'ALL'}>All <span>{tickets.length}</span></button>
                <button type="button" onClick={() => setNetworkFilter('preprod')} className={networkFilter === 'preprod' ? 'is-active' : ''} aria-pressed={networkFilter === 'preprod'}>Preprod</button>
                <button type="button" onClick={() => setNetworkFilter('preview')} className={networkFilter === 'preview' ? 'is-active' : ''} aria-pressed={networkFilter === 'preview'}>Preview</button>
              </div>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="vault-filter-empty">
                <p>No tickets on this network yet.</p>
                <button type="button" onClick={() => setNetworkFilter('ALL')}>Show all tickets</button>
              </div>
            ) : (
              <div className="vault-ticket-list">
                {filteredTickets.map((ticket) => {
                  const associatedDraw = associatedDraws.get(ticket.lotteryId);
                  const ticketNet = (ticket.network || 'preprod') as MidnightNetwork;
                  const ticketNetConfig = getNetworkConfig(ticketNet);
                  const isWinner = associatedDraw?.status === 'DRAWN' && associatedDraw.winningNumber === ticket.ticketNumber;
                  const claimedNullifier = claimedNullifiers[ticket.id];
                  const receiptIsVisible = revealedReceiptId === ticket.id;

                  return (
                    <article key={ticket.id} className={`vault-ticket-card ${isWinner ? 'is-winner' : ''}`}>
                      <header className="vault-ticket-head">
                        <div className="vault-ticket-id">
                          <div className="vault-ticket-number">{ticket.ticketNumber}</div>
                          <div>
                            <p>{isWinner ? 'Winning entry' : 'Private entry'}</p>
                            <h3>{associatedDraw?.name || 'Unlinked draw receipt'}</h3>
                            <span>Added {formatTicketDate(ticket.purchasedAt)} · {ticketNetConfig.name}</span>
                          </div>
                        </div>
                        <div className="vault-ticket-actions">
                          {isWinner ? (
                            <span className="vault-status is-winner"><Trophy className="w-3.5 h-3.5" /> Winner</span>
                          ) : associatedDraw?.status === 'DRAWN' ? (
                            <span className="vault-status is-complete">Result: #{associatedDraw.winningNumber}</span>
                          ) : (
                            <span className="vault-status is-live"><ShieldCheck className="w-3.5 h-3.5" /> Live entry</span>
                          )}
                          {associatedDraw && <Link to={`/draws/${associatedDraw.id}`} className="vault-draw-link">View draw <ArrowRight className="w-3.5 h-3.5" /></Link>}
                        </div>
                      </header>

                      <div className="vault-private-receipt">
                        <div>
                          <LockKeyhole className="w-4 h-4" />
                          <span><b>Private receipt</b> · Your salt and commitment stay hidden until you need them.</span>
                        </div>
                        <button type="button" onClick={() => setRevealedReceiptId(receiptIsVisible ? null : ticket.id)} aria-expanded={receiptIsVisible}>
                          {receiptIsVisible ? <><EyeOff className="w-3.5 h-3.5" /> Hide details</> : <><Eye className="w-3.5 h-3.5" /> Reveal details</>}
                        </button>
                      </div>

                      {receiptIsVisible && (
                        <div className="vault-receipt-details">
                          <div className="vault-receipt-value">
                            <div><span><KeyRound className="w-3.5 h-3.5" /> Private 256-bit salt</span><button type="button" onClick={() => handleCopy(`salt-${ticket.id}`, `0x${ticket.saltHex}`, 'salt')}>{copiedId === `salt-${ticket.id}` ? 'Copied' : 'Copy'}</button></div>
                            <code>0x{ticket.saltHex}</code>
                          </div>
                          <div className="vault-receipt-value">
                            <div><span><Hash className="w-3.5 h-3.5" /> On-chain commitment</span><button type="button" onClick={() => handleCopy(`comm-${ticket.id}`, `0x${ticket.commitmentHex}`, 'commitment')}>{copiedId === `comm-${ticket.id}` ? 'Copied' : 'Copy'}</button></div>
                            <code>0x{ticket.commitmentHex}</code>
                            {ticket.txHash && !isCorruptedTxHash(ticket.txHash) && <a href={getExplorerTxUrl(ticket.txHash, ticketNet)} target="_blank" rel="noreferrer">View on explorer <ExternalLink className="w-3 h-3" /></a>}
                          </div>
                        </div>
                      )}

                      {isWinner && (() => {
                        const ticketPayout = payoutStatus[ticket.id];
                        return (
                          <section className="vault-claim-panel">
                            <div>
                              <p><Sparkles className="w-4 h-4" /> Prize claim ready</p>
                              <span>Use this private receipt to create a one-way zero-knowledge claim and receive your tNIGHT payout.</span>
                            </div>
                            {!claimedNullifier ? (
                              <button type="button" onClick={() => handleClaimPrize(ticket)} disabled={claimingTicketId === ticket.id} className="vault-primary-action">
                                {claimingTicketId === ticket.id ? provingStep || 'Creating proof…' : <>Claim prize <ArrowRight className="w-4 h-4" /></>}
                              </button>
                            ) : (
                              <span className="vault-claimed"><CheckCircle2 className="w-4 h-4" /> ZK Claim Submitted</span>
                            )}
                            {claimingTicketId === ticket.id && provingStep && <div className="vault-claim-progress"><span />{provingStep}</div>}

                            {/* Escrow payout status */}
                            {claimedNullifier && ticketPayout && (
                              <div className={`vault-payout-status vault-payout-${ticketPayout.status}`}>
                                {ticketPayout.status === 'verifying' && (
                                  <><Loader2 className="w-4 h-4 animate-spin" /> <span>Verifying ZK nullifier on Midnight Indexer…</span></>
                                )}
                                {ticketPayout.status === 'paid' && (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>
                                      <strong>{ticketPayout.amountAtomic ? `${(Number(ticketPayout.amountAtomic) / 1_000_000).toLocaleString()} tNIGHT` : 'Prize'} paid to your wallet!</strong>
                                      {ticketPayout.txHash && !isCorruptedTxHash(ticketPayout.txHash) && (
                                        <> · <a href={getExplorerTxUrl(ticketPayout.txHash, ticketNet)} target="_blank" rel="noreferrer">Payout tx <ExternalLink className="w-3 h-3" /></a></>
                                      )}
                                    </span>
                                  </>
                                )}
                                {ticketPayout.status === 'simulated' && (
                                  <>
                                    <Send className="w-4 h-4" />
                                    <span><strong>[Simulation]</strong> Payout recorded. Configure <code>ESCROW_MNEMONIC</code> for real tNIGHT transfers.{ticketPayout.amountAtomic && ` (${(Number(ticketPayout.amountAtomic) / 1_000_000).toLocaleString()} tNIGHT)`}</span>
                                  </>
                                )}
                                {ticketPayout.status === 'failed' && (
                                  <>
                                    <span style={{ color: 'var(--color-error, #e53e3e)' }}>⚠ Payout request failed: {ticketPayout.message}</span>
                                  </>
                                )}
                              </div>
                            )}

                            {claimedNullifier && (
                              <div className="vault-nullifier">
                                <span>Zero-knowledge claim nullifier</span>
                                <code>0x{claimedNullifier}</code>
                                <button type="button" onClick={() => handleCopy(`null-${ticket.id}`, `0x${claimedNullifier}`, 'claim nullifier')}>{copiedId === `null-${ticket.id}` ? 'Copied' : 'Copy'}</button>
                                {claimTxHashes[ticket.id] && !isCorruptedTxHash(claimTxHashes[ticket.id]) && <a href={getExplorerTxUrl(claimTxHashes[ticket.id], ticketNet)} target="_blank" rel="noreferrer">Claim tx <ExternalLink className="w-3 h-3" /></a>}
                              </div>
                            )}
                          </section>
                        );
                      })()}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
