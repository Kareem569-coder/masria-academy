'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import TechLogo from './TechLogo';

interface SplashScreenProps {
  teacherImageDesktop: string;
  teacherImageMobile: string;
  isAr: boolean;
  onComplete: () => void;
  /** How long the splash stays on screen before fading out, in ms. Default 2200. */
  durationMs?: number;
}

export default function SplashScreen({
  teacherImageDesktop,
  teacherImageMobile,
  isAr,
  onComplete,
  durationMs = 2200,
}: SplashScreenProps) {
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const enter = requestAnimationFrame(() => setMounted(true));

    const exitTimer = setTimeout(() => setExiting(true), durationMs);
    const completeTimer = setTimeout(() => onComplete(), durationMs + 450);

    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [durationMs, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#080c14] transition-opacity duration-500 ${
        exiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* ambient background, consistent with the auth portal */}
      <div className="absolute inset-0 bg-grid opacity-[0.25]" />
      <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute -right-16 bottom-0 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />

      {/* optional teacher portrait, kept subtle behind the mark */}
      <Image
        src={teacherImageDesktop}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 hidden h-full w-full object-cover opacity-[0.06] md:block"
      />
      <Image
        src={teacherImageMobile}
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        className="absolute inset-0 h-full w-full object-cover opacity-[0.06] md:hidden"
      />

      <div
        className={`relative z-10 flex flex-col items-center gap-6 transition-all duration-700 ease-out ${
          mounted ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'
        }`}
      >
        <div
          className={`transition-all duration-1000 ease-out ${
            mounted ? 'rotate-0 opacity-100' : 'rotate-[-8deg] opacity-0'
          }`}
        >
          <TechLogo size={112} />
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
              MASRIA
            </span>
          </h1>
          <p className="text-sm font-medium tracking-wide text-slate-300 sm:text-base">
            {isAr ? 'أكاديمية هندسة البرمجيات - م. كريم عزالدين' : 'Software Engineering Academy — Eng. Kareem Ezzeldin'}
          </p>
        </div>

        {/* loading indicator, echoing the logo's node colors */}
        <div className="mt-2 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />
        </div>
      </div>
    </div>
  );
}
