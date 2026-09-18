import React, { useState } from 'react';
import { EyeOff, Eye, Lock, ChevronDown, Sparkles, Shield, KeyRound, Database } from 'lucide-react';

export const PrivacyBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="privacy-hero">
      <div className="privacy-copy">
        <div className="privacy-kicker">zkDraw on Midnight</div>
        <h1 className="privacy-title celo-serif">
          Private picks.<br />
          <em>Publicly fair.</em>
        </h1>
        <p className="privacy-subtitle">
          Enter a draw with a number known only to you. Zero-knowledge proofs keep your choice private while every outcome remains independently verifiable.
        </p>
        <div className="privacy-actions">
          <a href="#live-draws" className="myrad-btn-primary inline-flex items-center gap-2 px-5 py-3 text-xs">
            Explore live draws
            <span aria-hidden="true">↗</span>
          </a>
          <button onClick={() => setIsExpanded(!isExpanded)} className="privacy-detail-trigger">
            <Lock className="w-3.5 h-3.5" />
            {isExpanded ? 'Hide privacy details' : 'How privacy works'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <div className="ticket-collage" aria-hidden="true">
        <div className="ticket-art ticket-one"><span>Witness</span><b>Private</b><strong className="ticket-number">01</strong></div>
        <div className="ticket-art ticket-two"><span>Proof</span><b>Verified</b><strong className="ticket-number">ZK</strong></div>
        <div className="ticket-art ticket-three"><span>Draw</span><b>Fairness</b><strong className="ticket-number">∞</strong></div>
        <div className="ticket-art ticket-four"><span>Results</span><b>Onchain</b><strong className="ticket-number">OK</strong></div>
      </div>

      {isExpanded && (
        <div className="privacy-details grid grid-cols-1 gap-4 md:grid-cols-2 animate-in fade-in duration-200">
          <div className="privacy-detail-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#f6ff2f] font-bold text-xs uppercase tracking-wider">
                <EyeOff className="w-4 h-4" /> Private to you
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-bold">Never broadcast</span>
            </div>
            <ul className="space-y-2 text-xs text-[#8b98a5]">
              <li className="flex items-start gap-2.5"><KeyRound className="w-4 h-4 text-[#f6ff2f] shrink-0 mt-0.5" /><span><strong className="text-white">Your ticket number:</strong> selected and proved inside your browser.</span></li>
              <li className="flex items-start gap-2.5"><Shield className="w-4 h-4 text-[#f6ff2f] shrink-0 mt-0.5" /><span><strong className="text-white">A random salt:</strong> protects the commitment from guesswork.</span></li>
              <li className="flex items-start gap-2.5"><Lock className="w-4 h-4 text-[#f6ff2f] shrink-0 mt-0.5" /><span><strong className="text-white">Your proof witness:</strong> enables a private prize claim.</span></li>
            </ul>
          </div>

          <div className="privacy-detail-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#79cf99] font-bold text-xs uppercase tracking-wider">
                <Eye className="w-4 h-4" /> Public to everyone
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-bold">Verifiable</span>
            </div>
            <ul className="space-y-2 text-xs text-[#8b98a5]">
              <li className="flex items-start gap-2.5"><Database className="w-4 h-4 text-[#79cf99] shrink-0 mt-0.5" /><span><strong className="text-white">Ticket commitments:</strong> opaque hashes recorded on Midnight.</span></li>
              <li className="flex items-start gap-2.5"><Lock className="w-4 h-4 text-[#79cf99] shrink-0 mt-0.5" /><span><strong className="text-white">The draw commitment:</strong> locked before tickets close.</span></li>
              <li className="flex items-start gap-2.5"><Sparkles className="w-4 h-4 text-[#79cf99] shrink-0 mt-0.5" /><span><strong className="text-white">Winner derivation:</strong> mathematical and auditable by anyone.</span></li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
