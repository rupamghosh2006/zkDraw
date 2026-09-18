import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Hash,
  KeyRound,
  Shield,
  ExternalLink,
  Coins,
  Zap,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  generateRandomHex,
  computeClientTicketCommitment,
  derivePlayerSecret,
  computeClientParticipantKey,
} from '../midnight/crypto.js';
import { submitTicketCommitment } from '../services/api.js';
import { buyTicketOnChain, fetchLiveContractState } from '../midnight/contract.js';
import type { Lottery, UserTicket, MidnightNetwork } from '../types/index.js';
import type { ConnectedWallet } from '../midnight/wallet.js';
import { shortenAddress } from '../midnight/wallet.js';
import { getNetworkConfig, getExplorerTxUrl, isCorruptedTxHash } from '../midnight/config.js';
import { getEscrowAddress } from '../services/escrow.js';

interface TicketModalProps {
  lottery: Lottery;
  selectedNumber: number;
  wallet: ConnectedWallet;
  onClose: () => void;
  onSuccess: (ticket: UserTicket) => void;
  currentNetwork: MidnightNetwork;
}

type StageStatus = 'pending' | 'active' | 'completed' | 'failed';

export const TicketModal: React.FC<TicketModalProps> = ({
  lottery,
  selectedNumber,
  wallet,
  onClose,
  onSuccess,
  currentNetwork,
}) => {
  const [step, setStep] = useState<'review' | 'proving' | 'confirmed'>('review');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStage, setActiveStage] = useState<1 | 2 | 3>(1);
  const [stage1Status, setStage1Status] = useState<StageStatus>('pending');
  const [stage2Status, setStage2Status] = useState<StageStatus>('pending');
  const [stage3Status, setStage3Status] = useState<StageStatus>('pending');
  const [stageStatusMessage, setStageStatusMessage] = useState<string>('Preparing ticket purchase...');
  const [saltHex, setSaltHex] = useState<string>(() => generateRandomHex(32));
  const [playerSecretHex, setPlayerSecretHex] = useState<string>('');
  const [commitmentHex, setCommitmentHex] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [paymentTxHash, setPaymentTxHash] = useState<string>('');
  const paymentTxHashRef = React.useRef<string>('');
  const [showManualAttach, setShowManualAttach] = useState<boolean>(false);
  const [manualTxInput, setManualTxInput] = useState<string>('');
  const [manualAttachError, setManualAttachError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Escrow vault address — fetched from backend at mount; ticket fees are sent here
  const [escrowVaultAddress, setEscrowVaultAddress] = useState<string>(
    getNetworkConfig(currentNetwork).escrowAddress,
  );

  // Fetch the current escrow vault address from the backend API on mount
  useEffect(() => {
    const netConfig = getNetworkConfig(currentNetwork);
    getEscrowAddress(currentNetwork, netConfig.escrowAddress).then((addr) => {
      if (addr) setEscrowVaultAddress(addr);
    }).catch(() => {});
  }, [currentNetwork]);

  const activePaymentTxHash = paymentTxHash || paymentTxHashRef.current;

  const netConfig = getNetworkConfig(currentNetwork);
  const formattedTicketPrice = (Number(lottery.ticketPrice || '1000000') / 1_000_000).toLocaleString();

  // Pending payment storage keys for this draw & wallet (handles different lottery id formats)
  const storageKeys = React.useMemo(() => {
    const drawId = lottery?.drawId ?? 0;
    const addr = wallet?.address?.toLowerCase() || '';
    const keys = [
      `zkdraw_pending_pot_payment_${currentNetwork}_${drawId}_${addr}`,
      lottery?.id ? `zkdraw_pending_pot_payment_${lottery.id}_${addr}` : '',
      lottery?.contractAddress ? `zkdraw_pending_pot_payment_${lottery.contractAddress}_${drawId}_${addr}` : '',
      `zkdraw_pending_pot_payment_${currentNetwork}_${addr}`,
    ].filter(Boolean);
    return keys;
  }, [currentNetwork, lottery?.drawId, lottery?.id, lottery?.contractAddress, wallet?.address]);

  // Restore any confirmed pot payment from localStorage on mount
  React.useEffect(() => {
    for (const key of storageKeys) {
      const saved = localStorage.getItem(key);
      if (saved && /^[0-9a-fA-F]{64}$/.test(saved.replace(/^0x/, ''))) {
        const clean = saved.replace(/^0x/, '').toLowerCase();
        setPaymentTxHash(clean);
        paymentTxHashRef.current = clean;
        return;
      }
    }
  }, [storageKeys]);

  // Derive player secret deterministically from wallet address
  React.useEffect(() => {
    if (wallet?.address) {
      derivePlayerSecret(wallet.address).then(setPlayerSecretHex);
    }
  }, [wallet?.address]);

  // Compute commitment on mount
  React.useEffect(() => {
    computeClientTicketCommitment(selectedNumber, saltHex).then(setCommitmentHex);
  }, [selectedNumber, saltHex]);

  const handleRegenerateSalt = () => {
    const newSalt = generateRandomHex(32);
    setSaltHex(newSalt);
  };

  const handleConfirmPurchase = async () => {
    if (isSubmitting) return;

    // -----------------------------------------------------------------------
    // Guard: demo wallet cannot submit real on-chain transactions
    // -----------------------------------------------------------------------
    if (wallet.isDemo || !wallet.connectedApi) {
      setError(
        'A real Midnight Lace / 1AM wallet is required to submit on-chain transactions. ' +
        'The simulator cannot broadcast to the network. ' +
        'Please install 1AM Wallet and connect a funded testnet wallet.',
      );
      setStep('review');
      return;
    }

    if (!wallet.address) {
      setError('A connected wallet address is required to derive your private participant key.');
      setStep('review');
      return;
    }

    const targetDrawId = lottery.drawId ?? 0;
    const secretHex = playerSecretHex || (await derivePlayerSecret(wallet.address));

    if (!secretHex) {
      setError('Could not derive player identity secret from connected wallet.');
      setStep('review');
      return;
    }

    // Guard: creator cannot buy tickets
    if (lottery.adminKey && wallet.address.toLowerCase() === lottery.adminKey.toLowerCase()) {
      setError('The lottery creator cannot draw tickets from this lottery.');
      setStep('review');
      return;
    }

    // Guard: 1 ticket per participant (check local storage)
    const existingTickets = JSON.parse(localStorage.getItem('zkdraw_user_tickets') ?? '[]');
    const alreadyDrawnLocal = existingTickets.some((t: any) => t.lotteryId === lottery.id && t.network === currentNetwork);

    // Guard: 1 ticket per participant (check on-chain ledger participants)
    const pKey = await computeClientParticipantKey(targetDrawId, secretHex);
    const cleanPKey = pKey.toLowerCase();

    // Query live on-chain participants from indexer if local cache is empty
    let liveParticipants = lottery.participants || [];
    if (liveParticipants.length === 0 && lottery.contractAddress) {
      try {
        const live = await fetchLiveContractState(netConfig.indexerUrl, lottery.contractAddress);
        if (live?.participants && live.participants.length > 0) {
          liveParticipants = live.participants;
        }
      } catch (err) {
        console.warn('Could not query live participants before proving:', err);
      }
    }

    const alreadyDrawnOnChain = liveParticipants.some(
      (p) => p.replace(/^0x/, '').toLowerCase() === cleanPKey,
    );

    if (alreadyDrawnLocal || alreadyDrawnOnChain) {
      setError('You have already drawn 1 ticket from this lottery (enforced on Midnight ledger). Protocol rule: exactly 1 ticket per participant.');
      setStep('review');
      return;
    }

    // Guard: maxTickets sold
    if (lottery.ticketCount >= (lottery.maxTickets || 10)) {
      setError('All tickets have already been sold. The draw has ended automatically.');
      setStep('review');
      return;
    }

    // Enter Loading / Proving View
    setIsSubmitting(true);
    setError(null);
    setStep('proving');

    const currentPaidHash = paymentTxHashRef.current || paymentTxHash;
    if (currentPaidHash) {
      setActiveStage(2);
      setStage1Status('completed');
      setStage2Status('active');
      setStage3Status('pending');
      setStageStatusMessage('Pot entry already confirmed on Midnight. Synthesizing ZK proof...');
    } else {
      setActiveStage(1);
      setStage1Status('active');
      setStage2Status('pending');
      setStage3Status('pending');
      setStageStatusMessage(`Please approve the ${formattedTicketPrice} tNIGHT ticket payment in your wallet window...`);
    }

    try {
      // Step 1: Compute the local ZK commitment (browser crypto, no network)
      setStageStatusMessage('Computing 256-bit CSPRNG Salt & ticket commitment...');
      const commitment = await computeClientTicketCommitment(selectedNumber, saltHex);
      setCommitmentHex(commitment);
      await new Promise((r) => setTimeout(r, 200));

      // Step 2–8: Real on-chain transaction via dapp-connector-api
      const activePaymentHash = paymentTxHashRef.current || paymentTxHash || undefined;
      const result = await buyTicketOnChain(
        wallet.connectedApi,
        lottery.contractAddress,
        targetDrawId,
        selectedNumber,
        saltHex,
        secretHex,
        currentNetwork,
        (stepMsg: string) => {
          const cleanMsg = stepMsg.replace(/^\[[123]\/3\]\s*/, '');
          setStageStatusMessage(cleanMsg);

          if (stepMsg.includes('[1/3]')) {
            setActiveStage(1);
            if (stepMsg.includes('confirmed') || stepMsg.includes('already registered')) {
              setStage1Status('completed');
              setStage2Status('active');
              setActiveStage(2);
            } else {
              setStage1Status('active');
            }
          } else if (stepMsg.includes('[2/3]')) {
            setStage1Status('completed');
            setStage2Status('active');
            setActiveStage(2);
          } else if (stepMsg.includes('[3/3]')) {
            setStage1Status('completed');
            setStage2Status('completed');
            setStage3Status('active');
            setActiveStage(3);
          }
        },
        {
          ticketPriceAtomic: lottery.ticketPrice || '1000000',
          creatorAddress: lottery.creatorAddress,
          escrowAddress: escrowVaultAddress || undefined,
          existingPaymentTxHash: activePaymentHash,
          onPaymentConfirmed: (hash: string) => {
            paymentTxHashRef.current = hash;
            setPaymentTxHash(hash);
            storageKeys.forEach((k) => localStorage.setItem(k, hash));
            setStage1Status('completed');
            setStage2Status('active');
            setActiveStage(2);
          },
        },
      );

      setTxHash(result.txHash);
      const finalPaymentHash = result.paymentTxHash || paymentTxHashRef.current || paymentTxHash;
      if (finalPaymentHash) {
        paymentTxHashRef.current = finalPaymentHash;
        setPaymentTxHash(finalPaymentHash);
      }
      if (result.commitmentHex) setCommitmentHex(result.commitmentHex);

      setStage1Status('completed');
      setStage2Status('completed');
      setStage3Status('completed');

      // Record the ticket locally and sync the backend/localStorage state
      const realTxHash = `0x${result.txHash}`;
      const newTicket: UserTicket = {
        id: `ticket-${currentNetwork}-${Date.now()}`,
        lotteryId: lottery.id,
        drawId: targetDrawId,
        network: currentNetwork,
        contractAddress: lottery.contractAddress,
        ticketNumber: selectedNumber,
        saltHex,
        playerSecretHex: secretHex,
        commitmentHex: result.commitmentHex || commitment,
        purchasedAt: new Date().toISOString(),
        txHash: realTxHash,
        paymentTxHash: finalPaymentHash ? `0x${finalPaymentHash.replace(/^0x/, '')}` : undefined,
      };

      // Persist to localStorage
      const existing = JSON.parse(localStorage.getItem('zkdraw_user_tickets') ?? '[]');
      existing.unshift(newTicket);
      localStorage.setItem('zkdraw_user_tickets', JSON.stringify(existing));

      // Clear pending payment from localStorage since ticket was successfully registered
      storageKeys.forEach((k) => localStorage.removeItem(k));

      // Sync commitment and participant key to backend (resilient to backend downtime)
      try {
        setStageStatusMessage('Syncing on-chain state to app store...');
        await submitTicketCommitment(
          lottery.id,
          result.commitmentHex || commitment,
          result.participantKeyHex || pKey,
          currentNetwork,
        );
      } catch (syncErr) {
        console.warn('Backend state sync deferred:', syncErr);
      }

      setIsSubmitting(false);
      setStep('confirmed');
      onSuccess(newTicket);
    } catch (err) {
      setIsSubmitting(false);
      const msg = (err as Error).message ?? 'Unknown error';
      let formatted = msg;
      if (
        msg.includes('Participant has already drawn a ticket') ||
        msg.includes('already drawn a ticket') ||
        msg.includes('participants.member')
      ) {
        formatted = 'Protocol Rule Enforced: You have already drawn 1 ticket from this lottery with this wallet. Midnight smart contracts strictly enforce exactly 1 ticket per participant per draw.';
      } else if (msg.includes('A transaction is already pending') || msg.includes('transaction is already pending')) {
        formatted = 'Midnight Preprod: The previous transaction from your wallet is currently confirming on-chain. Please wait ~10 seconds and click "Retry ZK Submission" (your pot payment is already confirmed).';
      } else if (msg.length > 300) {
        formatted = msg.slice(0, 300) + '...';
      }
      setError(formatted);

      // Check ref directly to avoid React stale closure bug!
      const effectivePaidHash = paymentTxHashRef.current || paymentTxHash;
      if (effectivePaidHash || activeStage >= 2) {
        setStage1Status('completed');
        if (effectivePaidHash) {
          setPaymentTxHash(effectivePaidHash);
          paymentTxHashRef.current = effectivePaidHash;
          storageKeys.forEach((k) => localStorage.setItem(k, effectivePaidHash));
        }
        if (activeStage === 3) {
          setStage3Status('failed');
        } else {
          setStage2Status('failed');
        }
      } else {
        setStage1Status('failed');
      }
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="myrad-card w-full max-w-lg p-6 sm:p-8 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f0f0f] border border-white/10 p-1 flex items-center justify-center">
              <img src="/logo.png" alt="zkDraw" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">
                  Confidential Ticket Purchase
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00ba7c]/15 text-[#00ba7c] border border-[#00ba7c]/30">
                  {netConfig.name}
                </span>
              </div>
              <p className="text-xs text-[#8b98a5]">
                Midnight Zero-Knowledge Arithmetic Circuit Execution
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (isSubmitting) return;
              onClose();
            }}
            disabled={isSubmitting}
            className="text-[#8b98a5] hover:text-white p-1 text-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ✕
          </button>
        </div>

        {/* Body based on Step */}
        {step === 'review' && (
          <div className="space-y-6 pt-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs font-semibold">
                {error}
              </div>
            )}

            {activePaymentTxHash ? (
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs space-y-1.5 shadow-sm shadow-emerald-500/10">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-bold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pot Entry of {formattedTicketPrice} tNIGHT Confirmed!</span>
                  </span>
                  <a
                    href={getExplorerTxUrl(activePaymentTxHash, currentNetwork)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#00d4ff] hover:underline flex items-center gap-1 font-mono shrink-0 ml-2 font-bold"
                  >
                    <span>0x{activePaymentTxHash.slice(0, 8)}...</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="text-[11px] text-emerald-300/80 flex items-center justify-between">
                  <span>Entry fee confirmed on Midnight ledger. You will NOT be charged {formattedTicketPrice} tNIGHT again.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentTxHash('');
                      paymentTxHashRef.current = '';
                      storageKeys.forEach((k) => localStorage.removeItem(k));
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 underline shrink-0 ml-2"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-right">
                {!showManualAttach ? (
                  <button
                    type="button"
                    onClick={() => setShowManualAttach(true)}
                    className="text-[11px] text-[#8b98a5] hover:text-[#00d4ff] transition-colors underline"
                  >
                    Already paid {formattedTicketPrice} tNIGHT for this draw? Attach TX Hash
                  </button>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-[#0f0f0f] border border-white/10 text-left space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Attach Existing Payment Hash</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowManualAttach(false);
                          setManualAttachError(null);
                        }}
                        className="text-[#8b98a5] hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-[11px] text-[#8b98a5]">
                      If your wallet already submitted {formattedTicketPrice} tNIGHT to the pot, paste your transaction hash below so you are not charged again:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="0906c0b47df61a614258471a8b1ff4429dae4595..."
                        value={manualTxInput}
                        onChange={(e) => {
                          setManualTxInput(e.target.value);
                          setManualAttachError(null);
                        }}
                        className="flex-1 bg-black border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#00d4ff]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const clean = manualTxInput.replace(/^0x/, '').trim().toLowerCase();
                          if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
                            setManualAttachError('Must be a valid 64-character hex transaction hash.');
                            return;
                          }
                          setPaymentTxHash(clean);
                          paymentTxHashRef.current = clean;
                          storageKeys.forEach((k) => localStorage.setItem(k, clean));
                          setShowManualAttach(false);
                          setManualAttachError(null);
                        }}
                        className="myrad-btn-primary px-3 py-2 text-xs font-bold shrink-0"
                      >
                        Attach
                      </button>
                    </div>
                    {manualAttachError && (
                      <p className="text-[11px] text-rose-400">{manualAttachError}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selected Number Pill */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-black border border-white/10 flex items-center justify-center font-black text-2xl text-[#00d4ff]">
                  {selectedNumber}
                </div>
                <div>
                  <div className="text-xs font-extrabold text-white">
                    Private Number #{selectedNumber}
                  </div>
                  <div className="text-[11px] text-[#8b98a5]">
                    Valid Range: [{lottery.rangeMin} .. {lottery.rangeMax}] • {shortenAddress(wallet.address)}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-black text-[#00d4ff]">{formattedTicketPrice} tNIGHT</div>
                <div className="text-[10px] text-[#8b98a5] font-mono">+ gas in tDUST</div>
              </div>
            </div>

            {/* Dual-Token Fee Breakdown */}
            <div className="p-3.5 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] space-y-2 text-xs">
              <div className="flex justify-between items-center text-[#8b98a5]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Coins className="w-3.5 h-3.5 text-[#00d4ff]" />
                  Ticket Entry (Transferred to Pot):
                </span>
                <span className="font-bold text-white font-mono">{formattedTicketPrice} tNIGHT</span>
              </div>
              <div className="flex justify-between items-center text-[#8b98a5]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  Network Gas (Paid to Miners):
                </span>
                <span className="font-bold text-emerald-400 font-mono">~0.01 - 0.05 tDUST</span>
              </div>
              {lottery.creatorAddress && (
                <div className="text-[11px] text-[#8b98a5] pt-1.5 border-t border-white/[0.04] flex items-center justify-between">
                  <span>Recipient Pot Address:</span>
                  <span className="font-mono text-white/70">{shortenAddress(lottery.creatorAddress)}</span>
                </div>
              )}
            </div>

            {/* Privacy Breakdown */}
            <div className="space-y-3 p-4 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] text-xs">
              <div className="flex items-center justify-between text-[#8b98a5]">
                <span className="flex items-center gap-1.5 font-medium">
                  <KeyRound className="w-3.5 h-3.5 text-[#00ba7c]" />
                  256-bit CSPRNG Salt:
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateSalt}
                  className="text-[11px] text-[#00d4ff] hover:underline font-bold"
                >
                  Regenerate Salt
                </button>
              </div>
              <div className="font-mono text-[11px] text-white/80 bg-[#0f0f0f] p-2.5 rounded-xl border border-white/[0.04] truncate">
                0x{saltHex}
              </div>

              <div className="flex items-center justify-between text-[#8b98a5] pt-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Hash className="w-3.5 h-3.5 text-[#00d4ff]" />
                  Public Ticket Commitment (Circuit Output):
                </span>
              </div>
              <div className="font-mono text-[11px] text-[#00d4ff] bg-[#0f0f0f] p-2.5 rounded-xl border border-white/[0.04] truncate">
                {commitmentHex ? `0x${commitmentHex}` : 'Computing...'}
              </div>
            </div>

            {/* Notice */}
            <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-white/[0.06] flex items-start gap-2.5 text-xs text-[#8b98a5]">
              <Shield className="w-4 h-4 text-[#00ba7c] shrink-0 mt-0.5" />
              <p>
                This ticket receipt is saved in your browser local storage. Only the 32-byte commitment hash goes on-chain on <strong>{netConfig.name}</strong>.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="myrad-btn-secondary flex-1 py-3 text-xs font-bold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurchase}
                disabled={isSubmitting}
                className="myrad-btn-primary flex-1 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : activePaymentTxHash ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Continue to ZK Proof (Pot Entry Paid)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Prove & Purchase in ZK</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Multi-Stage Loading Stepper */}
        {step === 'proving' && (
          <div className="space-y-6 pt-5">
            {/* Headline */}
            <div className="text-center space-y-1">
              <h4 className="text-lg font-extrabold text-white">
                Confidential Ticket Purchase
              </h4>
              <p className="text-xs text-[#8b98a5]">
                Private Number #{selectedNumber} • Draw #{lottery.drawId ?? 0} on {netConfig.name}
              </p>
            </div>

            {/* Multi-Stage Stepper Container */}
            <div className="space-y-3 bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-4">
              {/* Stage 1: Pot Entry Transfer */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  stage1Status === 'active'
                    ? 'bg-[#00d4ff]/5 border-[#00d4ff]/40 shadow-sm shadow-[#00d4ff]/10'
                    : stage1Status === 'completed'
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : stage1Status === 'failed'
                    ? 'bg-rose-950/30 border-rose-600/40'
                    : 'bg-[#0f0f0f] border-white/[0.04] opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {stage1Status === 'completed' ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : stage1Status === 'active' ? (
                      <div className="w-7 h-7 rounded-full bg-[#00d4ff]/20 border border-[#00d4ff]/50 flex items-center justify-center text-[#00d4ff]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      </div>
                    ) : stage1Status === 'failed' ? (
                      <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#8b98a5] text-xs font-bold">
                        1
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-[#00d4ff]" />
                        1. Pot Entry Payment
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20 font-bold">
                        {formattedTicketPrice} tNIGHT
                      </span>
                    </div>

                    <div className="mt-1 text-xs">
                      {stage1Status === 'completed' ? (
                        <div className="text-emerald-400 flex items-center justify-between flex-wrap gap-1">
                          <span>✓ {formattedTicketPrice} tNIGHT transferred to draw pot</span>
                          {activePaymentTxHash && (
                            <a
                              href={getExplorerTxUrl(activePaymentTxHash, currentNetwork)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-[#00d4ff] hover:underline flex items-center gap-1 font-mono"
                            >
                              <span>tx: 0x{activePaymentTxHash.slice(0, 8)}...</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      ) : stage1Status === 'active' ? (
                        <div className="text-[#00d4ff] flex items-center gap-2">
                          <span className="animate-pulse">●</span>
                          <span>Please approve the {formattedTicketPrice} tNIGHT transfer in your 1AM / Lace wallet window...</span>
                        </div>
                      ) : stage1Status === 'failed' ? (
                        <span className="text-rose-400">Payment failed or was declined in wallet.</span>
                      ) : (
                        <span className="text-[#8b98a5]">Transfers entry fee into the draw prize pool.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage 2: ZK Proof Synthesis */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  stage2Status === 'active'
                    ? 'bg-[#00d4ff]/5 border-[#00d4ff]/40 shadow-sm shadow-[#00d4ff]/10'
                    : stage2Status === 'completed'
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : stage2Status === 'failed'
                    ? 'bg-rose-950/30 border-rose-600/40'
                    : 'bg-[#0f0f0f] border-white/[0.04] opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {stage2Status === 'completed' ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : stage2Status === 'active' ? (
                      <div className="w-7 h-7 rounded-full bg-[#00d4ff]/20 border border-[#00d4ff]/50 flex items-center justify-center text-[#00d4ff]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      </div>
                    ) : stage2Status === 'failed' ? (
                      <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#8b98a5] text-xs font-bold">
                        2
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#00ba7c]" />
                        2. Zero-Knowledge Circuit Proving
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00ba7c]/10 text-[#00ba7c] border border-[#00ba7c]/20 font-bold">
                        Client WASM
                      </span>
                    </div>

                    <div className="mt-1 text-xs">
                      {stage2Status === 'completed' ? (
                        <span className="text-emerald-400">
                          ✓ ZK proof synthesized locally. Secret number #{selectedNumber} kept private.
                        </span>
                      ) : stage2Status === 'active' ? (
                        <div className="text-[#00d4ff] flex items-center gap-2">
                          <span className="animate-pulse">●</span>
                          <span>Synthesizing zero-knowledge arithmetic constraints locally in browser...</span>
                        </div>
                      ) : stage2Status === 'failed' ? (
                        <span className="text-rose-400">Zero-knowledge proof synthesis failed.</span>
                      ) : (
                        <span className="text-[#8b98a5]">Proves valid ticket range without revealing secret number.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage 3: On-Chain Gas Balancing & Registration */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  stage3Status === 'active'
                    ? 'bg-[#00d4ff]/5 border-[#00d4ff]/40 shadow-sm shadow-[#00d4ff]/10'
                    : stage3Status === 'completed'
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : stage3Status === 'failed'
                    ? 'bg-rose-950/30 border-rose-600/40'
                    : 'bg-[#0f0f0f] border-white/[0.04] opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {stage3Status === 'completed' ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : stage3Status === 'active' ? (
                      <div className="w-7 h-7 rounded-full bg-[#00d4ff]/20 border border-[#00d4ff]/50 flex items-center justify-center text-[#00d4ff]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      </div>
                    ) : stage3Status === 'failed' ? (
                      <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#8b98a5] text-xs font-bold">
                        3
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        3. Ledger Shielding &amp; Gas Balancing
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 font-bold">
                        ~0.02 tDUST
                      </span>
                    </div>

                    <div className="mt-1 text-xs">
                      {stage3Status === 'completed' ? (
                        <span className="text-emerald-400">
                          ✓ Ticket commitment permanently registered on Midnight ledger.
                        </span>
                      ) : stage3Status === 'active' ? (
                        <div className="text-[#00d4ff] flex items-center gap-2">
                          <span className="animate-pulse">●</span>
                          <span>Please approve transaction balancing in your wallet (~0.02 tDUST gas)...</span>
                        </div>
                      ) : stage3Status === 'failed' ? (
                        <span className="text-rose-400">Transaction balancing or broadcast failed.</span>
                      ) : (
                        <span className="text-[#8b98a5]">Balances unsealed transaction with network gas and broadcasts.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Status Message Card */}
            <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.08] flex items-center gap-2.5 text-xs text-[#8b98a5]">
              <Loader2 className="w-4 h-4 text-[#00d4ff] animate-spin shrink-0" />
              <span className="font-mono text-white/90 truncate">{stageStatusMessage}</span>
            </div>

            {/* Dual-approval helper */}
            <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.06] flex items-start gap-2.5 text-[11px] text-[#8b98a5] leading-relaxed">
              <Shield className="w-4 h-4 text-[#00ba7c] shrink-0 mt-0.5" />
              <p>
                <strong>Why two wallet approvals?</strong> Midnight separates asset transfers from zero-knowledge contract calls. First, your wallet transfers <strong>{formattedTicketPrice} tNIGHT</strong> to the draw pot; second, it balances <strong>~0.02 tDUST</strong> gas to submit your zero-knowledge commitment anonymously.
              </p>
            </div>

            {/* Error Handling & Recovery Actions */}
            {error && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs font-semibold">
                  {error}
                </div>

                {activePaymentTxHash || stage1Status === 'completed' ? (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-600/40 text-emerald-200 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Your <strong>{formattedTicketPrice} tNIGHT</strong> pot payment is already confirmed on Midnight! Retrying will only submit the ZK proof with gas fee — you will not be charged tNIGHT again.
                    </span>
                  </div>
                ) : null}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep('review');
                    }}
                    className="myrad-btn-secondary flex-1 py-3 text-xs font-bold"
                  >
                    Back to Review
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPurchase}
                    disabled={isSubmitting}
                    className="myrad-btn-primary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {activePaymentTxHash || stage1Status === 'completed' ? 'Retry ZK Submission' : 'Try Again'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confirmed Step */}
        {step === 'confirmed' && (
          <div className="space-y-6 pt-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#00ba7c]/10 border border-[#00ba7c]/30 text-[#00ba7c] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-black text-white">
                Ticket Commitment Shielded!
              </h4>
              <p className="text-xs text-[#8b98a5]">
                Your confidential entry has been proved and confirmed on {netConfig.name}.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.08] space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-[#8b98a5]">Private Number:</span>
                <span className="font-extrabold text-[#00d4ff] text-sm">#{selectedNumber}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-[#8b98a5]">Target Network:</span>
                <span className="font-bold text-white">{netConfig.name}</span>
              </div>
              {/* Real on-chain tNIGHT payment transaction hash */}
              {paymentTxHash && !isCorruptedTxHash(paymentTxHash) && (
                <div className="space-y-1 pb-2 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8b98a5] block">tNIGHT Pot Payment TX:</span>
                    <a
                      href={getExplorerTxUrl(paymentTxHash, currentNetwork)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-[#00d4ff] font-semibold flex items-center gap-0.5 hover:underline"
                    >
                      View Payment <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#00d4ff] bg-black p-2 rounded-xl border border-[#00d4ff]/20">
                    <span className="truncate">0x{paymentTxHash}</span>
                    <button
                      onClick={() => handleCopy(`0x${paymentTxHash}`)}
                      className="p-1 hover:text-white"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#00ba7c]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
              {/* Real on-chain ZK circuit transaction hash */}
              {txHash && !isCorruptedTxHash(txHash) && (
                <div className="space-y-1 pb-2 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8b98a5] block">ZK Circuit TX (Gas Paid in tDUST):</span>
                    <a
                      href={getExplorerTxUrl(txHash, currentNetwork)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-[#00ba7c] font-semibold flex items-center gap-0.5 hover:underline"
                    >
                      View on Explorer <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#00ba7c] bg-black p-2 rounded-xl border border-[#00ba7c]/20">
                    <span className="truncate">0x{txHash}</span>
                    <button
                      onClick={() => handleCopy(`0x${txHash}`)}
                      className="p-1 hover:text-white"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#00ba7c]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#8b98a5] block">On-Chain Commitment Hash:</span>
                  <span className="text-[10px] text-[#8b98a5] font-sans">ZK State Commitment</span>
                </div>
                <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#00d4ff] bg-black p-2 rounded-xl border border-white/[0.06]">
                  <span className="truncate">0x{commitmentHex}</span>
                  <button
                    onClick={() => handleCopy(`0x${commitmentHex}`)}
                    className="p-1 hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#00ba7c]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-[#8b98a5] pt-0.5 font-sans">
                  The commitment is now in the on-chain <code>ticketCommitments</code> set. Your private number is never revealed.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              {txHash && !isCorruptedTxHash(txHash) ? (
                <a
                  href={getExplorerTxUrl(txHash, currentNetwork)}
                  target="_blank"
                  rel="noreferrer"
                  className="myrad-btn-secondary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 text-center"
                >
                  <span>View Transaction on 1AM</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <a
                  href={netConfig.explorerContractUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="myrad-btn-secondary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 text-center"
                >
                  <span>View Contract on 1AM</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button
                onClick={onClose}
                className="myrad-btn-primary flex-1 py-3 text-xs font-bold"
              >
                Close &amp; View Vault
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
