import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Code2,
  Copy,
  Cpu,
  ExternalLink,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Link, useLocation } from '../router/index.js';
import type { DrawVerificationResult, Lottery, MidnightNetwork } from '../types/index.js';
import { fetchDrawVerification } from '../services/api.js';
import { getNetworkConfig, getExplorerContractUrl, shortenContractAddress } from '../midnight/config.js';

interface VerifierPageProps {
  lotteries: Lottery[];
  currentNetwork: MidnightNetwork;
  onToast?: (message: string) => void;
}

const verificationChecks = [
  {
    key: 'commitmentMatch',
    index: '01',
    title: 'Commitment match',
    description: 'The revealed seed hashes to the commitment published before entries were sold.',
  },
  {
    key: 'entropyDerivationValid',
    index: '02',
    title: 'Bound entropy',
    description: 'The winner entropy is domain-separated and bound to this exact draw.',
  },
  {
    key: 'euclideanDivisionValid',
    index: '03',
    title: 'Fair modulus',
    description: 'The circuit’s Euclidean math maps the entropy to one valid result.',
  },
  {
    key: 'winningNumberInRange',
    index: '04',
    title: 'Range respected',
    description: 'The published winner remains inside the range set when the draw launched.',
  },
] as const;

export const VerifierPage: React.FC<VerifierPageProps> = ({ lotteries, currentNetwork, onToast }) => {
  const { searchParams } = useLocation();
  const queryDrawId = searchParams.get('draw');
  const netConfig = getNetworkConfig(currentNetwork);
  const completedDraws = useMemo(
    () => lotteries.filter((lottery) => lottery.status === 'DRAWN'),
    [lotteries],
  );
  const [selectedDrawId, setSelectedDrawId] = useState(() => {
    if (queryDrawId && lotteries.some((lottery) => lottery.id === queryDrawId && lottery.status === 'DRAWN')) return queryDrawId;
    return completedDraws[0]?.id || '';
  });
  const [verification, setVerification] = useState<DrawVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const activeLottery = useMemo(
    () => completedDraws.find((lottery) => lottery.id === selectedDrawId) || null,
    [completedDraws, selectedDrawId],
  );
  const activeLotteryId = activeLottery?.id;

  const loadVerification = useCallback(async () => {
    if (!activeLotteryId) return;

    setLoading(true);
    setErrorMessage('');
    try {
      const result = await fetchDrawVerification(activeLotteryId, currentNetwork);
      setVerification(result);
      if (result.valid) onToast?.(`Draw verified cryptographically on ${netConfig.name}.`);
    } catch (error) {
      console.warn('Verification fetch error:', error);
      setVerification(null);
      setErrorMessage((error as Error).message || 'We could not load a verifier response for this draw.');
    } finally {
      setLoading(false);
    }
  }, [activeLotteryId, currentNetwork, netConfig.name, onToast]);

  useEffect(() => {
    if (queryDrawId && completedDraws.some((lottery) => lottery.id === queryDrawId)) {
      setSelectedDrawId(queryDrawId);
    }
  }, [completedDraws, queryDrawId]);

  useEffect(() => {
    if (completedDraws.length > 0 && (!selectedDrawId || !completedDraws.some((lottery) => lottery.id === selectedDrawId))) {
      setSelectedDrawId(completedDraws[0]?.id || '');
    }
  }, [completedDraws, selectedDrawId]);

  useEffect(() => {
    setVerification(null);
    setErrorMessage('');
    setShowJson(false);
    if (activeLotteryId) void loadVerification();
  }, [activeLotteryId, currentNetwork, loadVerification]);

  const handleCopyProof = () => {
    if (!verification) return;
    void navigator.clipboard.writeText(JSON.stringify(verification, null, 2));
    setCopied(true);
    onToast?.('Verification receipt copied to clipboard');
    window.setTimeout(() => setCopied(false), 2000);
  };

  const isVerified = Boolean(verification?.valid);
  const passedCount = verification ? verificationChecks.filter(({ key }) => verification.checks[key]).length : 0;

  return (
    <section className="verify-page">
      <div className="verify-hero">
        <Link to="/draws" className="verify-back"><ChevronLeft className="w-4 h-4" /> Active draws</Link>
        <div className="verify-hero-grid">
          <div>
            <p className="verify-eyebrow">Independent verification</p>
            <h1>Check the draw.<br />Trust the math.</h1>
            <p>Anyone can replay zkDraw’s public commitments and confirm that a completed draw followed the rules it started with.</p>
          </div>
          <div className="verify-hero-seal" aria-hidden="true"><ShieldCheck className="w-14 h-14" /><span>public<br />proof</span><i /></div>
        </div>
      </div>

      <div className="verify-content">
        {completedDraws.length === 0 ? (
          <div className="verify-empty-state">
            <div className="verify-empty-icon"><LockKeyhole className="w-7 h-7" /></div>
            <p className="verify-eyebrow">No completed draw yet</p>
            <h2>The verifier is ready when the draw is.</h2>
            <p>A draw becomes independently verifiable after ticket sales close and the winning entropy has been published on Midnight.</p>
            <Link to="/draws" className="verify-primary-action">See active draws <ArrowRight className="w-4 h-4" /></Link>
            <div className="verify-how-it-works">
              <span><b>01</b> A commitment locks the randomness</span>
              <span><b>02</b> The secret is revealed after close</span>
              <span><b>03</b> Anyone validates the final number</span>
            </div>
          </div>
        ) : (
          <>
            <div className="verify-picker">
              <div>
                <p className="verify-eyebrow">Choose a completed draw</p>
                <h2>Verification workspace</h2>
              </div>
              <label>
                <span>Completed draw</span>
                <select value={selectedDrawId} onChange={(event) => setSelectedDrawId(event.target.value)}>
                  {completedDraws.map((lottery) => <option key={lottery.id} value={lottery.id}>{lottery.name} · winner #{lottery.winningNumber}</option>)}
                </select>
              </label>
            </div>

            {activeLottery && (
              <div className="verify-draw-summary">
                <div className="verify-summary-winning-number"><span>Winning number</span><strong>{activeLottery.winningNumber}</strong><p>Range {activeLottery.rangeMin}—{activeLottery.rangeMax}</p></div>
                <div className="verify-summary-copy"><p className="verify-eyebrow">Draw outcome</p><h2>{activeLottery.name}</h2><span>{activeLottery.ticketCount} entries committed to this outcome on {netConfig.name}.</span></div>
                <div className="verify-summary-actions">
                  <button type="button" onClick={() => void loadVerification()} disabled={loading} className="verify-secondary-action"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Checking…' : 'Verify again'}</button>
                  <Link to={`/draws/${activeLottery.id}`} className="verify-draw-link">View draw <ArrowRight className="w-3.5 h-3.5" /></Link>
                </div>
              </div>
            )}

            {loading && !verification ? (
              <div className="verify-loading-state"><span /><div><b>Replaying the public proof</b><p>Checking commitments, entropy, modulus math, and the winning range.</p></div></div>
            ) : errorMessage ? (
              <div className="verify-error-state"><XCircle className="w-5 h-5" /><div><b>Unable to verify this draw right now.</b><p>{errorMessage}</p></div><button type="button" onClick={() => void loadVerification()}>Try again</button></div>
            ) : verification && (
              <div className={`verify-result ${isVerified ? 'is-verified' : 'has-failed'}`}>
                <div className="verify-result-header">
                  <div className="verify-result-mark">{isVerified ? <CheckCircle2 className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}</div>
                  <div><p className="verify-eyebrow">Verifier result</p><h2>{isVerified ? 'The draw checks out.' : 'The draw did not pass verification.'}</h2><span>{passedCount} of {verificationChecks.length} independent circuit checks passed.</span></div>
                  <div className="verify-result-actions">
                    <button type="button" onClick={handleCopyProof} className="verify-secondary-action"><>{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied' : 'Copy receipt'}</></button>
                    <button type="button" onClick={() => setShowJson((visible) => !visible)} className="verify-code-action"><Code2 className="w-3.5 h-3.5" /> {showJson ? 'Hide JSON' : 'View JSON'}</button>
                  </div>
                </div>

                <div className="verify-check-grid">
                  {verificationChecks.map((check) => {
                    const passed = verification.checks[check.key];
                    return <div key={check.key} className={`verify-check ${passed ? 'has-passed' : 'has-failed'}`}>
                      <div><span>{check.index}</span>{passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}</div>
                      <h3>{check.title}</h3>
                      <p>{check.description}</p>
                      <b>{passed ? 'Passed' : 'Failed'}</b>
                    </div>;
                  })}
                </div>

                <div className="verify-formula">
                  <div><Cpu className="w-4 h-4" /><span>Winning-number calculation</span></div>
                  <code>W = rangeMin + (E_field % (rangeMax - rangeMin + 1))</code>
                  <p>{activeLottery?.winningNumber} = {activeLottery?.rangeMin} + (E_field % {(activeLottery?.rangeMax || 0) - (activeLottery?.rangeMin || 0) + 1})</p>
                  <a href={getExplorerContractUrl(activeLottery?.contractAddress || '', currentNetwork)} target="_blank" rel="noreferrer">Contract {shortenContractAddress(activeLottery?.contractAddress || '')} <ExternalLink className="w-3 h-3" /></a>
                </div>

                {showJson && <pre className="verify-json-view">{JSON.stringify(verification, null, 2)}</pre>}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
