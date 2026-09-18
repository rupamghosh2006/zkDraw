import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  Coins,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { Link, useNavigate } from '../router/index.js';
import { initLottery } from '../services/api.js';
import type { Lottery, MidnightNetwork } from '../types/index.js';
import { getNetworkConfig } from '../midnight/config.js';
import { shortenAddress, type ConnectedWallet } from '../midnight/wallet.js';
import {
  createDrawOnChain,
  deriveAdminSecretFromWallet,
} from '../midnight/contract.js';
import { bytesToHex, hexToBytes, saveCreatorSecrets, sha256Hex } from '../midnight/crypto.js';
import { pureCircuits } from '../contract/index.js';

interface CreateDrawPageProps {
  currentNetwork: MidnightNetwork;
  wallet: ConnectedWallet | null;
  onLotteryCreated: (lottery: Lottery) => void;
  onOpenWalletModal: () => void;
  onToast?: (message: string) => void;
}

const ticketPresets = [10, 25, 50, 100];
const pricePresets = ['1', '2.5', '5'];
const rangePresets = [
  { label: 'Quick', min: 1, max: 10 },
  { label: 'Classic', min: 1, max: 25 },
  { label: 'Wide', min: 1, max: 50 },
];

export const CreateDrawPage: React.FC<CreateDrawPageProps> = ({
  currentNetwork,
  wallet,
  onLotteryCreated,
  onOpenWalletModal,
  onToast,
}) => {
  const navigate = useNavigate();
  const netConfig = getNetworkConfig(currentNetwork);

  const [name, setName] = useState(`zkDraw ${netConfig.name} Pot`);
  const [description, setDescription] = useState('Provably fair confidential draw on Midnight');
  const [maxTickets, setMaxTickets] = useState(10);
  const [ticketPriceNight, setTicketPriceNight] = useState('1');
  const [rangeMin, setRangeMin] = useState(1);
  const [rangeMax, setRangeMax] = useState(50);
  const [loading, setLoading] = useState(false);
  const [provingStep, setProvingStep] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => {
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const validateForm = (): boolean => {
    const nextErrors: Record<string, string> = {};
    const priceNum = parseFloat(ticketPriceNight);

    if (!name.trim()) nextErrors.name = 'Give your draw a name so players can find it.';
    if (isNaN(priceNum) || priceNum <= 0) nextErrors.ticketPrice = 'Enter a ticket price greater than 0 tNIGHT.';
    if (!Number.isInteger(maxTickets) || maxTickets < 1) nextErrors.maxTickets = 'Choose at least one available ticket.';
    if (rangeMin < 1) nextErrors.rangeMin = 'The range must begin at 1 or higher.';
    if (rangeMax > 50) nextErrors.rangeMax = 'The winning range can go up to 50.';
    if (rangeMax <= rangeMin) nextErrors.rangeMax = 'The upper number needs to be higher than the lower number.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!wallet) {
      onOpenWalletModal();
      return;
    }
    if (!validateForm()) return;

    setLoading(true);
    setProvingStep('Preparing your private operator key…');
    setErrors({});

    try {
      const drawId = `lottery-${currentNetwork}-${Date.now()}`;
      let adminSecretHex: string;
      let adminKeyHex: string;

      if (wallet.connectedApi) {
        try {
          const derived = await deriveAdminSecretFromWallet(wallet.connectedApi, currentNetwork, drawId);
          adminSecretHex = derived.adminSecretHex;
          adminKeyHex = derived.adminKeyHex;
        } catch (error) {
          console.warn('1AM wallet signData fallback — hashing wallet address:', error);
          adminSecretHex = await sha256Hex(new TextEncoder().encode(`zkDraw:admin:${wallet.address}`));
          adminKeyHex = bytesToHex(pureCircuits.deriveAdminKey(hexToBytes(adminSecretHex)));
        }
      } else {
        adminSecretHex = await sha256Hex(new TextEncoder().encode(`zkDraw:admin:${wallet.address}`));
        adminKeyHex = bytesToHex(pureCircuits.deriveAdminKey(hexToBytes(adminSecretHex)));
      }

      setProvingStep('Creating the private randomness commitment…');
      const drawSecretHex = adminSecretHex;
      const drawCommitmentHex = bytesToHex(
        pureCircuits.deriveDrawCommitment(hexToBytes(drawSecretHex)),
      );
      const priceAtomic = Math.round(parseFloat(ticketPriceNight) * 1_000_000).toString();

      if (!wallet.connectedApi) throw new Error('1AM wallet connected API is not available.');

      setProvingStep('Proving your draw settings on Midnight…');
      const createRes = await createDrawOnChain(
        wallet.connectedApi,
        netConfig.contractAddress,
        {
          adminKeyHex,
          ticketPriceAtomic: priceAtomic,
          rangeMin,
          rangeMax,
          drawCommitmentHex,
          maxTickets,
        },
        currentNetwork,
        setProvingStep,
      );

      setProvingStep(`Saving Draw #${createRes.drawId}…`);
      const newLottery = await initLottery({
        id: drawId,
        name: name.trim(),
        description: description.trim(),
        network: currentNetwork,
        contractAddress: netConfig.contractAddress,
        drawId: createRes.drawId,
        ticketPrice: priceAtomic,
        rangeMin,
        rangeMax,
        maxTickets,
        adminKey: adminKeyHex,
        creatorAddress: wallet.address,
        drawCommitment: drawCommitmentHex,
        drawSecretHex,
      });

      saveCreatorSecrets(newLottery.id, {
        adminSecretHex,
        drawSecretHex,
        adminKeyHex,
        contractAddress: netConfig.contractAddress,
        drawId: createRes.drawId,
        lotteryId: newLottery.id,
      });

      onLotteryCreated(newLottery);
      onToast?.(`Draw #${createRes.drawId} is live on ${netConfig.name}.`);
      navigate(`/draws?highlight=${newLottery.id}`);
    } catch (error) {
      console.error('1AM createDraw error:', error);
      setErrors({ submit: (error as Error).message });
    } finally {
      setLoading(false);
      setProvingStep('');
    }
  };

  const parsedPrice = parseFloat(ticketPriceNight) || 0;
  const totalJackpotCapacity = (parsedPrice * maxTickets).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const span = Math.max(0, rangeMax - rangeMin + 1);
  const selectedRange = rangePresets.find((preset) => preset.min === rangeMin && preset.max === rangeMax);

  return (
    <section className="launch-draw-page">
      <div className="launch-draw-hero">
        <Link to="/draws" className="launch-draw-back">
          <ChevronLeft className="w-4 h-4" /> All draws
        </Link>
        <div className="launch-draw-hero-grid">
          <div>
            <p className="launch-draw-eyebrow">Create on {netConfig.name}</p>
            <h1 className="launch-draw-title">Make every entry<br />count.</h1>
            <p className="launch-draw-intro">
              Set the rules once. Midnight proves every outcome is fair without exposing the numbers behind it.
            </p>
          </div>
          <div className="launch-draw-proof-mark" aria-hidden="true">
            <span>zk</span>
            <span>draw</span>
            <i />
          </div>
        </div>
      </div>

      <div className="launch-draw-steps" aria-label="Create draw steps">
        <div className="is-current"><span>01</span> Name your draw</div>
        <div><span>02</span> Set the prize pool</div>
        <div><span>03</span> Choose the range</div>
      </div>

      {errors.submit && (
        <div className="launch-draw-error" role="alert">
          <span>Something needs attention</span>
          <p>{errors.submit}</p>
        </div>
      )}

      <div className="launch-draw-layout">
        <form onSubmit={handleCreate} className="launch-draw-form">
          <section className="launch-draw-section">
            <div className="launch-draw-section-index">01</div>
            <div className="launch-draw-section-heading">
              <p>Identity</p>
              <h2>Give it a reason to exist.</h2>
              <span>This is how players will discover your draw.</span>
            </div>
            <div className="launch-draw-fields">
              <label className="launch-draw-field launch-draw-field-wide">
                <span>Draw name <b>Required</b></span>
                <input
                  type="text"
                  value={name}
                  maxLength={70}
                  onChange={(event) => { setName(event.target.value); clearError('name'); }}
                  placeholder="e.g. Friday Night Pool"
                  className={errors.name ? 'has-error' : ''}
                />
                {errors.name && <em>{errors.name}</em>}
              </label>
              <label className="launch-draw-field launch-draw-field-wide">
                <span>What is this draw for? <small>Optional</small></span>
                <textarea
                  value={description}
                  maxLength={150}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Tell players a little about the draw"
                  rows={2}
                />
              </label>
            </div>
          </section>

          <section className="launch-draw-section">
            <div className="launch-draw-section-index">02</div>
            <div className="launch-draw-section-heading">
              <p>Prize pool</p>
              <h2>Decide the stakes.</h2>
              <span>Every ticket contributes to the potential pool.</span>
            </div>
            <div className="launch-draw-fields">
              <fieldset className="launch-draw-field launch-draw-field-wide">
                <legend>Tickets available</legend>
                <div className="launch-draw-choice-row">
                  {ticketPresets.map((count) => (
                    <button
                      type="button"
                      key={count}
                      onClick={() => { setMaxTickets(count); clearError('maxTickets'); }}
                      className={maxTickets === count ? 'is-selected' : ''}
                    >
                      {count}
                    </button>
                  ))}
                  <label className="launch-draw-inline-input">
                    <span>Custom</span>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={maxTickets || ''}
                      onChange={(event) => { setMaxTickets(parseInt(event.target.value, 10) || 0); clearError('maxTickets'); }}
                    />
                  </label>
                </div>
                {errors.maxTickets && <em>{errors.maxTickets}</em>}
              </fieldset>

              <fieldset className="launch-draw-field launch-draw-field-wide">
                <legend>Price per ticket</legend>
                <div className="launch-draw-price-control">
                  <div className="launch-draw-price-input">
                    <Coins className="w-4 h-4" />
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={ticketPriceNight}
                      onChange={(event) => { setTicketPriceNight(event.target.value); clearError('ticketPrice'); }}
                      className={errors.ticketPrice ? 'has-error' : ''}
                    />
                    <span>tNIGHT</span>
                  </div>
                  <div className="launch-draw-price-presets" aria-label="Ticket price presets">
                    {pricePresets.map((price) => (
                      <button
                        type="button"
                        key={price}
                        onClick={() => { setTicketPriceNight(price); clearError('ticketPrice'); }}
                        className={ticketPriceNight === price ? 'is-selected' : ''}
                      >
                        {price}
                      </button>
                    ))}
                  </div>
                </div>
                {errors.ticketPrice && <em>{errors.ticketPrice}</em>}
              </fieldset>
            </div>
          </section>

          <section className="launch-draw-section">
            <div className="launch-draw-section-index">03</div>
            <div className="launch-draw-section-heading">
              <p>Winning number</p>
              <h2>Set a fair playing field.</h2>
              <span>The resulting number is generated and verified in the draw circuit.</span>
            </div>
            <div className="launch-draw-fields">
              <fieldset className="launch-draw-field launch-draw-field-wide">
                <legend>Choose a range</legend>
                <div className="launch-draw-range-presets">
                  {rangePresets.map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => { setRangeMin(preset.min); setRangeMax(preset.max); setErrors((previous) => ({ ...previous, rangeMin: '', rangeMax: '' })); }}
                      className={selectedRange?.label === preset.label ? 'is-selected' : ''}
                    >
                      <b>{preset.label}</b>
                      <span>{preset.min}–{preset.max}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="launch-draw-range-inputs">
                <label className="launch-draw-field">
                  <span>From</span>
                  <input
                    type="number"
                    min="1"
                    max="49"
                    value={rangeMin}
                    onChange={(event) => { setRangeMin(parseInt(event.target.value, 10) || 1); setErrors((previous) => ({ ...previous, rangeMin: '', rangeMax: '' })); }}
                    className={errors.rangeMin ? 'has-error' : ''}
                  />
                  {errors.rangeMin && <em>{errors.rangeMin}</em>}
                </label>
                <span className="launch-draw-range-divider">to</span>
                <label className="launch-draw-field">
                  <span>To <small>Maximum 50</small></span>
                  <input
                    type="number"
                    min="2"
                    max="50"
                    value={rangeMax}
                    onChange={(event) => { setRangeMax(parseInt(event.target.value, 10) || 50); clearError('rangeMax'); }}
                    className={errors.rangeMax ? 'has-error' : ''}
                  />
                  {errors.rangeMax && <em>{errors.rangeMax}</em>}
                </label>
              </div>
            </div>
          </section>

          <div className="launch-draw-submit-wrap">
            {!wallet ? (
              <button type="button" onClick={onOpenWalletModal} className="launch-draw-submit">
                <Wallet className="w-5 h-5" /> Connect 1AM wallet to launch <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={loading} className="launch-draw-submit">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {provingStep || 'Launching your draw…'}</> : <><Sparkles className="w-5 h-5" /> Launch draw <ArrowRight className="w-4 h-4" /></>}
              </button>
            )}
            <p>By launching, your rules are committed to the {netConfig.name} smart contract.</p>
          </div>
        </form>

        <aside className="launch-draw-preview">
          <div className="launch-draw-preview-topline">
            <span>Live preview</span>
            <span className="launch-draw-network-dot">{netConfig.name}</span>
          </div>
          <div className="launch-draw-ticket">
            <span className="launch-draw-ticket-label">Your draw</span>
            <h2>{name || 'Untitled draw'}</h2>
            <p>{description || 'A private, provably fair draw on Midnight.'}</p>
            <div className="launch-draw-ticket-orb"><Sparkles className="w-6 h-6" /></div>
            <div className="launch-draw-ticket-number">{String(maxTickets || 0).padStart(2, '0')}</div>
          </div>
          <div className="launch-draw-preview-pool">
            <span>Potential prize pool</span>
            <strong>{totalJackpotCapacity} <small>tNIGHT</small></strong>
            <p><CircleDollarSign className="w-3.5 h-3.5" /> {maxTickets || 0} tickets × {ticketPriceNight || '0'} tNIGHT</p>
          </div>
          <dl className="launch-draw-preview-stats">
            <div><dt>Winning range</dt><dd>{rangeMin}—{rangeMax}</dd></div>
            <div><dt>Possible picks</dt><dd>{span}</dd></div>
            <div><dt>Creator</dt><dd>{wallet ? shortenAddress(wallet.address) : 'Connect wallet'}</dd></div>
          </dl>
          <div className="launch-draw-guarantees">
            <div><ShieldCheck className="w-4 h-4" /><span>Built-in fairness</span></div>
            <p><Check className="w-3.5 h-3.5" /> One ticket per player</p>
            <p><Check className="w-3.5 h-3.5" /> Private commit–reveal draw</p>
            <p><CheckCircle2 className="w-3.5 h-3.5" /> Creator cannot enter</p>
          </div>
        </aside>
      </div>
    </section>
  );
};
