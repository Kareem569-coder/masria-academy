'use client';

import { useId } from 'react';

interface TechLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export default function TechLogo({ size = 64, showText = false, className = '' }: TechLogoProps) {
  const uid = useId().replace(/[:]/g, '');

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="MASRIA x Kareem Monogram"
        style={{ filter: 'drop-shadow(0 0 16px rgba(6,182,212,0.38))' }}
      >
        <defs>
          {/* M-Wing Gradient (Cyan -> Sky Blue) */}
          <linearGradient id={`${uid}-mGrad`} x1="15" y1="20" x2="55" y2="85" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* K-Bracket Gradient (Neon Indigo -> Violet) */}
          <linearGradient id={`${uid}-kGrad`} x1="45" y1="20" x2="85" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>

          {/* Glowing Filter */}
          <filter id={`${uid}-monogramGlow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient Dark Hexagon Shield Backing */}
        <path
          d="M50 8 L86 28 V72 L50 92 L14 72 V28 Z"
          fill="#090e1a"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.5"
        />

        {/* Integrated M + K Code Structure */}
        <g filter={`url(#${uid}-monogramGlow)`}>
          {/* Left Wing: Forms 'M' spine + Code Bracket < */}
          <path
            d="M26 72 V28 L48 50 L38 60"
            stroke={`url(#${uid}-mGrad)`}
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Central Stem: Shared Backbone */}
          <path
            d="M50 24 V76"
            stroke="url(#${uid}-mGrad)"
            strokeWidth="5.5"
            strokeLinecap="round"
          />

          {/* Right Wings: Forms 'K' geometry + Code Bracket > */}
          {/* Top K Branch / > */}
          <path
            d="M50 50 L74 28"
            stroke={`url(#${uid}-kGrad)`}
            strokeWidth="5.5"
            strokeLinecap="round"
          />

          {/* Bottom K Branch / > */}
          <path
            d="M50 50 L74 72"
            stroke={`url(#${uid}-kGrad)`}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
        </g>

        {/* Dynamic Binary / Core Code Points */}
        <circle cx="50" cy="50" r="3.5" fill="#38bdf8" />
        <circle cx="74" cy="28" r="2.5" fill="#c084fc" />
        <circle cx="74" cy="72" r="2.5" fill="#c084fc" />
        <circle cx="26" cy="28" r="2.5" fill="#22d3ee" />
      </svg>

      {showText && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1">
            <span className="text-lg font-black tracking-tight text-white">MASRIA</span>
            <span className="text-xs font-semibold text-cyan-400 font-mono">.kz</span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Eng. Kareem Ezzeldin</span>
        </div>
      )}
    </div>
  );
}