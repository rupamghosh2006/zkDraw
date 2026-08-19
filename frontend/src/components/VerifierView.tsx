import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Cpu,
  RefreshCw,
  Lock,
  Copy,
  Check,
  Code2,
} from 'lucide-react';
import type { Lottery, DrawVerificationResult } from '../types/index.js';
import { fetchDrawVerification } from '../services/api.js';

interface VerifierViewProps {
  lottery: Lottery | null;
}

export const VerifierView: React.FC<VerifierViewProps> = ({ lottery }) => {
  const [verification, setVerification] = useState<DrawVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);

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

  const handleCopyProof = () => {
    if (!verification) return;
    navigator.clipboard.writeText(JSON.stringify(verification, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!lottery) {
    return (
      <div className="myrad-card p-12 text-center text-[#8b98a5]">
        Loading verification engine...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="myrad-card p-6 sm:p-8 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0f0f0f] border border-white/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-[#00ba7c]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Provable Fairness & Cryptographic Verifier
              </h2>
              <p className="text-xs sm:text-sm text-[#8b98a5]">
                Independent client-side validation of Midnight commit-reveal and Euclidean modulus proofs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={loadVerification}
              disabled={loading || lottery.status !== 'DRAWN'}
              className="myrad-btn-secondary px-4 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Re-verify Draw
            </button>
          </div>
        </div>
      </div>

      {lottery.status !== 'DRAWN' ? (
        <div className="myrad-card p-16 text-center border border-white/10 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#0f0f0f] border border-white/10 text-amber-400 mx-auto flex items-center justify-center">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-white">
            Draw Not Yet Executed
          </h3>
          <p className="text-xs sm:text-sm text-[#8b98a5] max-w-md mx-auto leading-relaxed">
            This lottery is currently in the <strong>{lottery.status}</strong> state. Cryptographic verification data will become available once the operator reveals the pre-committed seed upon draw.
          </p>
        </div>
      ) : (
        <>
          {/* Main Verification Status Card */}
          {verification && (
            <div
              className={`myrad-card p-6 sm:p-8 border ${
                verification.valid
                  ? 'border-[#00ba7c]/40 bg-[#0a0a0a]'
                  : 'border-rose-500/40 bg-[#0a0a0a]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
                <div>
                  <div className="text-xs font-extrabold text-[#8b98a5] uppercase tracking-widest">
                    Verification Outcome
                  </div>
                  <div className="mt-1 flex items-center gap-2.5">
                    {verification.valid ? (
                      <>
                        <CheckCircle2 className="w-8 h-8 text-[#00ba7c]" />
                        <span className="text-2xl sm:text-3xl font-black text-white">
                          Cryptographic Draw Verified Valid
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-8 h-8 text-rose-400" />
                        <span className="text-2xl sm:text-3xl font-black text-rose-400">
                          Verification Failed / Discrepancy Detected
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={handleCopyProof}
                    className="myrad-btn-secondary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#00ba7c]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied Proof' : 'Copy Proof JSON'}
                  </button>
                  <button
                    onClick={() => setShowJson(!showJson)}
                    className="myrad-btn-secondary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Code2 className="w-3.5 h-3.5 text-[#00d4ff]" />
                    {showJson ? 'Hide JSON' : 'View JSON'}
                  </button>
                </div>
              </div>

              {/* 4 Cryptographic Rule Checks */}
              <div className="py-6 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#8b98a5]">
                  Mathematical Invariant Checks
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.06] flex items-start gap-3">
                    {verification.checks.commitmentMatch ? (
                      <CheckCircle2 className="w-5 h-5 text-[#00ba7c] shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        1. Pre-commitment Integrity
                      </div>
                      <p className="text-[11px] text-[#8b98a5] mt-0.5">
                        H(revealedSecret) strictly equals the on-chain drawCommitment.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.06] flex items-start gap-3">
                    {verification.checks.entropyDerivationValid ? (
                      <CheckCircle2 className="w-5 h-5 text-[#00ba7c] shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        2. Deterministic Derivation
                      </div>
                      <p className="text-[11px] text-[#8b98a5] mt-0.5">
                        Winning number {verification.winningNumber} matches Compact circuit calculation.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.06] flex items-start gap-3">
                    {verification.checks.winningNumberInRange ? (
                      <CheckCircle2 className="w-5 h-5 text-[#00ba7c] shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        3. Number Range Bounds
                      </div>
                      <p className="text-[11px] text-[#8b98a5] mt-0.5">
                        Winning number lies within bounds [{verification.rangeMin}..{verification.rangeMax}].
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.06] flex items-start gap-3">
                    {verification.checks.euclideanDivisionValid ? (
                      <CheckCircle2 className="w-5 h-5 text-[#00ba7c] shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        4. Euclidean Quotient Check
                      </div>
                      <p className="text-[11px] text-[#8b98a5] mt-0.5">
                        q * span + offset == entropyField (Remainder uniqueness).
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* JSON Proof Drawer */}
              {showJson && (
                <div className="my-4 p-4 rounded-2xl bg-black border border-white/10 text-xs font-mono text-[#00d4ff] overflow-x-auto">
                  <pre>{JSON.stringify(verification, null, 2)}</pre>
                </div>
              )}

              {/* Cryptographic Trace Breakdown */}
              <div className="pt-4 border-t border-white/[0.08] space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#8b98a5]">
                  Cryptographic Trace & Parameters
                </h4>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-white/[0.06]">
                    <span className="text-[#8b98a5] block mb-1 font-sans font-bold">
                      Contract Address:
                    </span>
                    <span className="text-[#00d4ff] break-all">{verification.contractAddress}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-white/[0.06]">
                    <span className="text-[#8b98a5] block mb-1 font-sans font-bold">
                      Draw Commitment (C):
                    </span>
                    <span className="text-[#00d4ff] break-all">{verification.drawCommitment}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-white/[0.06]">
                    <span className="text-[#8b98a5] block mb-1 font-sans font-bold">
                      Revealed Operator Seed (S):
                    </span>
                    <span className="text-purple-300 break-all">{verification.revealedEntropy}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-white/[0.06]">
                    <span className="text-[#8b98a5] block mb-1 font-sans font-bold">
                      Combined Derived Entropy Hash (H(S, {verification.ticketCount})):
                    </span>
                    <span className="text-[#00ba7c] break-all">
                      {verification.details.derivedEntropyHex}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Educational Explain Section */}
          <div className="myrad-card p-6 sm:p-8 border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#00d4ff]" />
              What is being verified?
            </h3>
            <p className="text-xs sm:text-sm text-[#8b98a5] leading-relaxed">
              The winning result was derived according to Midnight smart contract rules without requiring private participant ticket numbers to ever be revealed.
            </p>
            <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.06] space-y-2 text-xs text-[#8b98a5]">
              <p>
                • <strong className="text-white">Why the operator cannot cheat:</strong> The operator committed to hash <code className="text-[#00d4ff]">C = H(S)</code> before any participant bought tickets and before closure. They cannot reveal a different seed <code className="text-purple-300">S'</code> because the smart contract checks <code className="text-[#00ba7c]">H(S') == C</code>.
              </p>
              <p>
                • <strong className="text-white">Why participants cannot cheat:</strong> Participant ticket numbers are hidden behind cryptographic commitments. Users cannot pick numbers tailored to the operator seed because the seed was kept confidential until after ticket sales ended.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
