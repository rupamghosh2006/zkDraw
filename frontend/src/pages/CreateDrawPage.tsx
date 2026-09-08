import React, { useState } from 'react';
import {
  Sparkles,
  Ticket,
  Coins,
  Hash,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Wallet,
  ArrowRight,
  Crown,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate, Link } from '../router/index.js';
import { initLottery } from '../services/api.js';
import type { Lottery, MidnightNetwork } from '../types/index.js';
import { getNetworkConfig } from '../midnight/config.js';
import { shortenAddress, type ConnectedWallet } from '../midnight/wallet.js';
import {
  deriveAdminSecretFromWallet,
  deployLotteryOnChain,
  fetchLiveContractState,
} from '../midnight/contract.js';
import { generateRandomHex, hexToBytes, bytesToHex } from '../midnight/crypto.js';
import { pureCircuits } from '../contract/index.js';

interface CreateDrawPageProps {
  currentNetwork: MidnightNetwork;
  wallet: ConnectedWallet | null;
  onLotteryCreated: (lottery: Lottery) => void;
  onOpenWalletModal: () => void;
  onToast?: (message: string) => void;
}

export const CreateDrawPage: React.FC<CreateDrawPageProps> = ({
  currentNetwork,
  wallet,
  onLotteryCreated,
  onOpenWalletModal,
  onToast,
}) => {
  const navigate = useNavigate();
  const netConfig = getNetworkConfig(currentNetwork);

  // Tabs: 'create' | 'register'
  const [activeTab, setActiveTab] = useState<'create' | 'register'>('create');
  const [contractAddressInput, setContractAddressInput] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerStep, setRegisterStep] = useState('');

  // Form states
  const [name, setName] = useState(`zkDraw ${netConfig.name} Pot`);
  const [description, setDescription] = useState('Provably fair confidential draw on Midnight');
  const [maxTickets, setMaxTickets] = useState<number>(10);
  const [ticketPriceDust, setTicketPriceDust] = useState<string>('1');
  const [rangeMin, setRangeMin] = useState<number>(1);
  const [rangeMax, setRangeMax] = useState<number>(50);

  // Status & Progress
  const [loading, setLoading] = useState(false);
  const [provingStep, setProvingStep] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const priceNum = parseFloat(ticketPriceDust);
    if (isNaN(priceNum) || priceNum <= 0) {
      newErrors.ticketPrice = 'Ticket price must be greater than 0 tDUST.';
    }

    if (rangeMin < 1) {
      newErrors.rangeMin = 'Minimum number must be at least 1.';
    }

    if (rangeMax > 50) {
      newErrors.rangeMax = 'Maximum number cannot exceed 50 (Euclidean field constraint).';
    }

    if (rangeMax <= rangeMin) {
      newErrors.rangeMax = 'Maximum number must be strictly greater than minimum number.';
    }

    if (maxTickets <= 0 || !Number.isInteger(maxTickets)) {
      newErrors.maxTickets = 'Total ticket supply must be at least 1.';
    }

    if (!name.trim()) {
      newErrors.name = 'Draw title is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wallet) {
      onOpenWalletModal();
      return;
    }

    if (!validateForm()) return;

    setLoading(true);
    setProvingStep('Deriving deterministic operator secret & public key from 1AM wallet...');
    setErrors({});

    try {
      const drawId = `lottery-${currentNetwork}-${Date.now()}`;
      let adminSecretHex: string | undefined;
      let adminKeyHex: string = wallet.address;

      if (wallet.connectedApi) {
        try {
          const derived = await deriveAdminSecretFromWallet(
            wallet.connectedApi,
            currentNetwork,
            drawId,
          );
          adminSecretHex = derived.adminSecretHex;
          adminKeyHex = derived.adminKeyHex;
        } catch (e) {
          console.warn('1AM wallet signData fallback:', e);
        }
      }

      setProvingStep('Generating cryptographic commit-reveal entropy & ZK draw commitment...');
      const drawSecretHex = adminSecretHex || generateRandomHex(32);
      const drawSecretBytes = hexToBytes(drawSecretHex);
      const drawCommitmentBytes = pureCircuits.deriveDrawCommitment(drawSecretBytes);
      const drawCommitmentHex = bytesToHex(drawCommitmentBytes);

      setProvingStep('Constructing on-chain contract deployment transaction...');
      const priceAtomic = Math.round(parseFloat(ticketPriceDust) * 1_000_000).toString();

      if (!wallet.connectedApi) {
        throw new Error('1AM wallet connected API is not available.');
      }

      const deployRes = await deployLotteryOnChain(
        wallet.connectedApi,
        {
          adminKeyHex,
          ticketPriceAtomic: priceAtomic,
          rangeMin,
          rangeMax,
          drawCommitmentHex,
          maxTickets,
        },
        currentNetwork,
        (step) => setProvingStep(step),
      );

      setProvingStep('Registering newly deployed contract on ' + netConfig.name + '...');
      const newLottery = await initLottery({
        name: name.trim(),
        description: description.trim(),
        network: currentNetwork,
        contractAddress: deployRes.contractAddress,
        ticketPrice: priceAtomic,
        rangeMin,
        rangeMax,
        maxTickets,
        adminKey: adminKeyHex,
        creatorAddress: wallet.address,
        drawCommitment: drawCommitmentHex,
        drawSecretHex,
      });

      onLotteryCreated(newLottery);

      if (onToast) {
        onToast(`🎉 Deployed contract ${deployRes.contractAddress.slice(0, 8)}... on-chain via 1AM wallet! Tx: ${deployRes.txHash.slice(0, 8)}...`);
      }

      navigate(`/draws?highlight=${newLottery.id}`);
    } catch (err) {
      console.error('1AM deploy error:', err);
      setErrors({ submit: (err as Error).message });
    } finally {
      setLoading(false);
      setProvingStep('');
    }
  };

  const handleRegisterContract = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAddr = contractAddressInput.trim().replace(/^0x/, '');
    if (cleanAddr.length !== 64) {
      setErrors({ register: 'Contract address must be a 32-byte hex string (64 hex characters).' });
      return;
    }

    setRegisterLoading(true);
    setRegisterStep('Querying Midnight Indexer v4 for on-chain contract state...');
    setErrors({});

    try {
      const liveState = await fetchLiveContractState(netConfig.indexerUrl, cleanAddr);
      if (!liveState) {
        throw new Error(
          `Contract not found at ${cleanAddr} on Midnight ${netConfig.name} indexer. Please verify the contract is deployed and network matches.`,
        );
      }

      setRegisterStep('Contract verified on-chain! Registering into active draws...');
      const newLottery = await initLottery({
        name: name.trim() || `Verified ${netConfig.name} Pot`,
        description: description.trim() || `Live verified on-chain Midnight contract instance`,
        network: currentNetwork,
        contractAddress: cleanAddr,
        ticketPrice: liveState.ticketPrice,
        rangeMin: liveState.rangeMin,
        rangeMax: liveState.rangeMax,
        maxTickets: liveState.maxTickets,
        adminKey: liveState.adminHex,
        creatorAddress: wallet?.address || liveState.adminHex,
        drawCommitment: liveState.drawCommitmentHex,
        drawSecretHex: liveState.status === 'DRAWN' ? liveState.entropyRevealedHex : undefined,
      });

      onLotteryCreated(newLottery);

      if (onToast) {
        onToast(`✅ Verified and registered on-chain contract ${cleanAddr.slice(0, 8)}...!`);
      }

      navigate(`/draws?highlight=${newLottery.id}`);
    } catch (err) {
      setErrors({ register: (err as Error).message });
    } finally {
      setRegisterLoading(false);
      setRegisterStep('');
    }
  };

  // Calculations for Preview Panel
  const parsedPrice = parseFloat(ticketPriceDust) || 0;
  const totalJackpotCapacity = (parsedPrice * maxTickets).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const span = Math.max(0, rangeMax - rangeMin + 1);

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#8b98a5] mb-1">
            <Link to="/draws" className="hover:text-white transition-colors">
              Active Draws
            </Link>
            <span>/</span>
            <span className="text-[#00d4ff]">Create Draw</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <span>Launch New Confidential Draw</span>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#00ba7c]/15 text-[#00ba7c] border border-[#00ba7c]/30">
              {netConfig.name}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#8b98a5] mt-1">
            Configure provable parameters, ticket capacity, and commit-reveal randomness on Midnight.
          </p>
        </div>

        <Link
          to="/draws"
          className="myrad-btn-secondary px-4 py-2 text-xs font-bold self-start sm:self-auto flex items-center gap-1.5"
        >
          View All Active Draws
        </Link>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#0f0f0f] border border-white/[0.08] max-w-md">
        <button
          type="button"
          onClick={() => { setActiveTab('create'); setErrors({}); }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'create'
              ? 'bg-white text-black shadow-md'
              : 'text-[#8b98a5] hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Launch New Draw (1AM Wallet)</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('register'); setErrors({}); }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'register'
              ? 'bg-[#00d4ff] text-black font-extrabold shadow-md'
              : 'text-[#8b98a5] hover:text-white'
          }`}
        >
          <Hash className="w-4 h-4" />
          <span>Register Deployed Contract</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {errors.submit && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errors.submit}</span>
        </div>
      )}

      {errors.register && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errors.register}</span>
        </div>
      )}

      {activeTab === 'register' ? (

        <div className="myrad-card p-6 sm:p-8 border border-white/10 max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
            <div className="w-9 h-9 rounded-xl bg-[#0f0f0f] border border-[#00d4ff]/30 text-[#00d4ff] flex items-center justify-center">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Register Deployed Midnight Contract</h2>
              <p className="text-xs text-[#8b98a5]">
                Deployed a new contract via Midnight CLI or SDK? Register the address to index and interact immediately.
              </p>
            </div>
          </div>

          <form onSubmit={handleRegisterContract} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#8b98a5] uppercase tracking-wider mb-2">
                Midnight {netConfig.name} Contract Address (64 hex characters) <span className="text-[#00d4ff]">*</span>
              </label>
              <input
                type="text"
                value={contractAddressInput}
                onChange={(e) => setContractAddressInput(e.target.value)}
                placeholder="246fee4d100b2e2b6f98587e8a573e54ffc3a9d87e775a65c958a302f138e267"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-[#00d4ff] transition-colors"
                required
              />
              <p className="text-[11px] text-[#8b98a5] mt-1.5">
                The address will be verified against the official Midnight GraphQL Indexer v4.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8b98a5] uppercase tracking-wider mb-2">
                Custom Title / Label <span className="text-[10px] text-[#8b98a5] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Midnight High Roller Pot"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00d4ff] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8b98a5] uppercase tracking-wider mb-2">
                Description <span className="text-[10px] text-[#8b98a5] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description for discovery"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00d4ff] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={registerLoading || !contractAddressInput.trim()}
              className="myrad-btn-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2"
            >
              {registerLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{registerStep || 'Verifying on Indexer...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify On-Chain & Register Contract</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Main Grid: Form (Left 60%) + Live Preview Panel (Right 40%) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form Fields */}
          <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleCreate} className="space-y-6">
            {/* Step 1: Draw Metadata Card */}
            <div className="myrad-card p-6 sm:p-7 border border-white/10 space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.08]">
                <div className="w-7 h-7 rounded-lg bg-[#0f0f0f] border border-white/10 flex items-center justify-center text-[#00d4ff]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-black text-white text-base">1. Draw Identity (Off-Chain Display)</h3>
              </div>

              {/* Title Field */}
              <div>
                <label className="block text-xs font-bold text-[#8b98a5] uppercase tracking-wider mb-2">
                  Draw Title / Label <span className="text-[#00d4ff]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  placeholder="e.g. Midnight High Roller Pot"
                  className={`w-full bg-[#0a0a0a] border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors ${
                    errors.name ? 'border-rose-500' : 'border-white/10 focus:border-[#00d4ff]'
                  }`}
                />
                {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name}</p>}
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-xs font-bold text-[#8b98a5] uppercase tracking-wider mb-2">
                  Description <span className="text-[10px] text-[#8b98a5] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description for player discovery"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00d4ff] transition-colors"
                />
              </div>
            </div>

            {/* Step 2: Total Supply & Pricing Card */}
            <div className="myrad-card p-6 sm:p-7 border border-white/10 space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.08]">
                <div className="w-7 h-7 rounded-lg bg-[#0f0f0f] border border-white/10 flex items-center justify-center text-[#00ba7c]">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">2. Ticket Capacity & Entry Price</h3>
                  <p className="text-[11px] text-[#8b98a5]">
                    The draw will automatically end when all tickets sell out.
                  </p>
                </div>
              </div>

              {/* Total Tickets (Supply) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    Total Ticket Supply <span className="text-[#00d4ff]">*</span>
                  </label>
                  <span className="text-xs font-mono font-bold text-[#00ba7c] bg-[#00ba7c]/10 px-2.5 py-0.5 rounded-lg border border-[#00ba7c]/20">
                    {maxTickets} tickets available
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {[5, 10, 20, 50, 100].map((count) => (
                    <button
                      type="button"
                      key={count}
                      onClick={() => {
                        setMaxTickets(count);
                        if (errors.maxTickets) setErrors((prev) => ({ ...prev, maxTickets: '' }));
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        maxTickets === count
                          ? 'bg-[#00d4ff] text-black border-[#00d4ff]'
                          : 'bg-[#0a0a0a] text-[#8b98a5] border-white/10 hover:border-white/30'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-[#8b98a5]">Custom count:</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={maxTickets}
                    onChange={(e) => {
                      setMaxTickets(parseInt(e.target.value) || 0);
                      if (errors.maxTickets) setErrors((prev) => ({ ...prev, maxTickets: '' }));
                    }}
                    className={`w-28 bg-[#0a0a0a] border rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none ${
                      errors.maxTickets ? 'border-rose-500' : 'border-white/10 focus:border-[#00d4ff]'
                    }`}
                  />
                  <span className="text-xs text-[#8b98a5]">tickets</span>
                </div>
                {errors.maxTickets && <p className="text-xs text-rose-400">{errors.maxTickets}</p>}
              </div>

              {/* Ticket Price in tDUST */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-[#8b98a5] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  Ticket Price (tDUST) <span className="text-[#00d4ff]">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={ticketPriceDust}
                    onChange={(e) => {
                      setTicketPriceDust(e.target.value);
                      if (errors.ticketPrice) setErrors((prev) => ({ ...prev, ticketPrice: '' }));
                    }}
                    placeholder="1.0"
                    className={`w-full bg-[#0a0a0a] border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors ${
                      errors.ticketPrice ? 'border-rose-500' : 'border-white/10 focus:border-[#00d4ff]'
                    }`}
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-[#8b98a5]">
                    tDUST
                  </span>
                </div>
                {errors.ticketPrice && <p className="text-xs text-rose-400 mt-1">{errors.ticketPrice}</p>}
                <p className="text-[11px] text-[#8b98a5] mt-1">
                  1 tDUST = 1,000,000 atomic units on Midnight.
                </p>
              </div>
            </div>

            {/* Step 3: Provable Range Bounds */}
            <div className="myrad-card p-6 sm:p-7 border border-white/10 space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.08]">
                <div className="w-7 h-7 rounded-lg bg-[#0f0f0f] border border-white/10 flex items-center justify-center text-purple-400">
                  <Hash className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">3. Provable Lucky Number Range</h3>
                  <p className="text-[11px] text-[#8b98a5]">
                    Euclidean division range bounds enforced in the Compact circuit.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#8b98a5] uppercase tracking-wider mb-2">
                    Min Value
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="49"
                    value={rangeMin}
                    onChange={(e) => {
                      setRangeMin(parseInt(e.target.value) || 1);
                      if (errors.rangeMin || errors.rangeMax) {
                        setErrors((prev) => ({ ...prev, rangeMin: '', rangeMax: '' }));
                      }
                    }}
                    className={`w-full bg-[#0a0a0a] border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none ${
                      errors.rangeMin ? 'border-rose-500' : 'border-white/10 focus:border-[#00d4ff]'
                    }`}
                  />
                  {errors.rangeMin && <p className="text-xs text-rose-400 mt-1">{errors.rangeMin}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8b98a5] uppercase tracking-wider mb-2">
                    Max Value (Max 50)
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="50"
                    value={rangeMax}
                    onChange={(e) => {
                      setRangeMax(parseInt(e.target.value) || 50);
                      if (errors.rangeMax) setErrors((prev) => ({ ...prev, rangeMax: '' }));
                    }}
                    className={`w-full bg-[#0a0a0a] border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none ${
                      errors.rangeMax ? 'border-rose-500' : 'border-white/10 focus:border-[#00d4ff]'
                    }`}
                  />
                  {errors.rangeMax && <p className="text-xs text-rose-400 mt-1">{errors.rangeMax}</p>}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-white/[0.06] text-xs text-[#8b98a5] flex items-center justify-between">
                <span>Number choices available to players:</span>
                <span className="font-mono font-bold text-white">
                  [{rangeMin} .. {rangeMax}] ({span} total numbers)
                </span>
              </div>
            </div>

            {/* Submission Button */}
            <div className="pt-2 space-y-2">
              {!wallet ? (
                <button
                  type="button"
                  onClick={onOpenWalletModal}
                  className="myrad-btn-white w-full py-4 text-sm font-bold flex items-center justify-center gap-2.5 shadow-lg"
                >
                  <Wallet className="w-5 h-5" />
                  Connect 1AM Wallet to Deploy Draw
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="myrad-btn-primary w-full py-4 text-sm sm:text-base font-bold flex items-center justify-center gap-2.5 shadow-xl shadow-[#00d4ff]/10"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-xs sm:text-sm">{provingStep || 'Deploying via 1AM Wallet...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Deploy New Draw on {netConfig.name} via 1AM Wallet</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
              <p className="text-[11px] text-[#8b98a5] text-center">
                Proving, fee balancing, and on-chain contract deployment are executed directly by your connected 1AM wallet on {netConfig.name}.
              </p>
            </div>

          </form>
        </div>

        {/* Right Column: Live Summary & Preview Panel */}
        <div className="lg:col-span-5 space-y-6 sticky top-28">
          <div className="myrad-card p-6 sm:p-7 border border-[#00d4ff]/30 shadow-2xl relative overflow-hidden">
            {/* Top Accent Gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00d4ff] via-[#00ba7c] to-purple-500" />

            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="text-xs font-black uppercase tracking-widest text-[#00d4ff] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                On-Chain Commitment Preview
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20">
                {netConfig.name}
              </span>
            </div>

            {/* Summary Highlights */}
            <div className="py-5 space-y-4">
              <div>
                <span className="text-[11px] text-[#8b98a5] uppercase tracking-wider block font-medium">
                  Draw Title
                </span>
                <div className="text-lg font-black text-white mt-0.5 truncate">
                  {name || 'Untitled Draw'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.06]">
                  <span className="text-[10px] text-[#8b98a5] uppercase block font-semibold">
                    Ticket Price
                  </span>
                  <div className="text-base font-black text-white mt-0.5 flex items-baseline gap-1">
                    <span>{ticketPriceDust || '0'}</span>
                    <span className="text-xs text-[#00d4ff]">tDUST</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.06]">
                  <span className="text-[10px] text-[#8b98a5] uppercase block font-semibold">
                    Total Capacity
                  </span>
                  <div className="text-base font-black text-white mt-0.5 flex items-baseline gap-1">
                    <span>{maxTickets}</span>
                    <span className="text-xs text-[#00ba7c]">tickets</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-[#8b98a5] font-semibold">Potential Jackpot:</span>
                <span className="text-sm font-mono font-black text-[#00ba7c]">
                  {totalJackpotCapacity} tDUST
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-[#8b98a5] font-semibold">Lucky Number Range:</span>
                <span className="text-sm font-mono font-bold text-white">
                  {rangeMin} to {rangeMax} ({span} options)
                </span>
              </div>

              {/* Creator Address Info */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                <div className="flex items-center gap-1.5 text-amber-300 font-extrabold mb-1">
                  <Crown className="w-3.5 h-3.5" />
                  <span>Creator / Operator Wallet</span>
                </div>
                {wallet ? (
                  <div className="font-mono text-[11px] text-white/90 truncate" title={wallet.address}>
                    {shortenAddress(wallet.address)}
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-200/70">
                    Not connected. Connect wallet before launching.
                  </div>
                )}
              </div>
            </div>

            {/* Protocol Guarantees */}
            <div className="pt-4 border-t border-white/[0.08] space-y-2 text-[11px] text-[#8b98a5]">
              <div className="font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00ba7c]" />
                Enforced Circuit Rules:
              </div>
              <ul className="space-y-1 pl-4 list-disc text-[11px] leading-relaxed">
                <li>You (the creator) are barred from purchasing tickets in this draw.</li>
                <li>Each player can purchase at most 1 ticket.</li>
                <li>Ends automatically once all {maxTickets} tickets are sold, or when ended early by you.</li>
                <li>Winning number derived via deterministic commit-reveal Euclidean math.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
