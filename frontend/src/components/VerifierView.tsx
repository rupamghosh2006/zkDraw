import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Cpu,
  RefreshCw,
  Lock,
} from 'lucide-react';
import type { Lottery, DrawVerificationResult } from '../types/index.js';
import { fetchDrawVerification } from '../services/api.js';

interface VerifierViewProps {
  lottery: Lottery | null;
}

export const VerifierView: React.FC<VerifierViewProps> = ({ lottery }) => {
  const [verification, setVerification] = useState<DrawVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const loadVerification = async () => {
    if (!lottery) return;
    setLoading(true);
    try {
      const data = await fetchDrawVerification(lottery.id);
      setVerification(data);
    } catch (err) {
      console.warn('Verification fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lottery?.status === 'DRAWN') {
      loadVerification();
    }
  }, [lottery?.id, lottery?.status]);

  if (!lottery) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center text-slate-400">
        Loading verification engine...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Provable Fairness & Cryptographic Verifier
              </h2>
            </div>
            <p className="text-sm text-slate-400">
              Independently verify that the winning number was derived strictly from predefined commit-reveal rules on Midnight.
            </p>
          </div>

          <button
            onClick={loadVerification}
            disabled={loading || lottery.status !== 'DRAWN'}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 self-start sm:self-auto transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Re-verify Draw
          </button>
        </div>
      </div>

      {lottery.status !== 'DRAWN' ? (
        <div className="glass-panel rounded-3xl p-12 text-center border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">
            Draw Not Yet Executed
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            This lottery is currently in the <strong>{lottery.status}</strong> state. Cryptographic verification data will become available once the operator reveals the pre-committed seed upon draw.
          </p>
        </div>
      ) : (
        <>
          {/* Main Verification Status Card */}
          {verification && (
            <div
              className={`glass-panel rounded-3xl p-6 sm:p-8 border ${
                verification.valid
                  ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-slate-900/50 to-slate-950/80'
                  : 'border-rose-500/40 bg-gradient-to-br from-rose-950/20 via-slate-900/50 to-slate-950/80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Verification Outcome
                  </div>
                  <div className="mt-1 flex items-center gap-2.5">
                    {verification.valid ? (
                      <>
                        <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                        <span className="text-2xl font-black text-white">
                          Cryptographic Draw Verified Valid
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-7 h-7 text-rose-400" />
                        <span className="text-2xl font-black text-rose-400">
                          Verification Failed / Discrepancy Detected
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="cyber-badge bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                    {verification.method}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Verified: {new Date(verification.verifiedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* 4 Cryptographic Rule Checks */}
              <div className="py-6 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Mathematical Invariant Checks
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3">
                    {verification.checks.commitmentMatch ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        1. Pre-commitment Integrity
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        H(revealedSecret) strictly matches on-chain drawCommitment.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3">
                    {verification.checks.entropyDerivationValid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        2. Deterministic Derivation
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Winning number {verification.winningNumber} matches Compact circuit calculation.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3">
                    {verification.checks.winningNumberInRange ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        3. Number Range Bounds
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Winning number lies within valid bounds [{verification.rangeMin}..{verification.rangeMax}].
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3">
                    {verification.checks.euclideanDivisionValid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        4. Euclidean Quotient Check
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        q * span + offset == entropyField (Remainder uniqueness).
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cryptographic Trace Breakdown */}
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Cryptographic Trace & Parameters
                </h4>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                    <span className="text-slate-500 block mb-0.5 font-sans font-semibold">
                      Contract Address:
                    </span>
                    <span className="text-cyan-300 break-all">{verification.contractAddress}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                    <span className="text-slate-500 block mb-0.5 font-sans font-semibold">
                      Draw Commitment (C):
                    </span>
                    <span className="text-cyan-300 break-all">{verification.drawCommitment}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                    <span className="text-slate-500 block mb-0.5 font-sans font-semibold">
                      Revealed Operator Seed (S):
                    </span>
                    <span className="text-purple-300 break-all">{verification.revealedEntropy}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                    <span className="text-slate-500 block mb-0.5 font-sans font-semibold">
                      Combined Derived Entropy Hash (H(S, {verification.ticketCount})):
                    </span>
                    <span className="text-emerald-300 break-all">
                      {verification.details.derivedEntropyHex}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Educational Explain Section */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              What is being verified?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              The winning result was derived according to Midnight smart contract rules without requiring private participant ticket numbers to ever be revealed.
            </p>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs text-slate-300">
              <p>
                • <strong>Why the operator cannot cheat:</strong> The operator committed to hash <code className="text-cyan-300">C = H(S)</code> before any participant bought tickets and before closure. They cannot reveal a different seed <code className="text-purple-300">S'</code> because the smart contract checks <code className="text-emerald-300">H(S') == C</code>.
              </p>
              <p>
                • <strong>Why participants cannot cheat:</strong> Participant ticket numbers are hidden behind cryptographic commitments. Users cannot pick numbers tailored to the operator seed because the seed was kept confidential until after ticket sales ended.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
