'use client';

import { useEffect, useRef, useState } from 'react';

type Phase = 'logo' | 'logo-exit' | 'teacher' | 'teacher-exit' | 'hidden';

export interface SplashScreenProps {
  teacherImageDesktop?: string;
  teacherImageMobile?: string;
  isAr?: boolean;
  onComplete?: () => void;
  timings?: Partial<typeof DEFAULT_TIMINGS>;
}

const DEFAULT_TIMINGS = {
  logoExitStart: 1800,
  teacherStart: 2000,
  teacherExitStart: 5000,
  hideStart: 5800,
  unmountAfter: 6500,
};

export default function SplashScreen({
  teacherImageDesktop = '/teacher-desktop.png',
  teacherImageMobile = '/teacher-mobile.png',
  isAr = false,
  onComplete,
  timings,
}: SplashScreenProps) {
  const t = { ...DEFAULT_TIMINGS, ...timings };

  const [phase, setPhase] = useState<Phase>('logo');
  const [mounted, setMounted] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // تحديد نوع الشاشة بدقة وقت التحميل
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth <= 768);
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const schedule = (fn: () => void, delay: number) => {
      timeouts.current.push(setTimeout(fn, delay));
    };

    if (reducedMotion) {
      schedule(() => setPhase('hidden'), 250);
      schedule(() => {
        setMounted(false);
        onComplete?.();
      }, 700);
      return () => timeouts.current.forEach(clearTimeout);
    }

    schedule(() => setPhase('logo-exit'), t.logoExitStart);
    schedule(() => setPhase('teacher'), t.teacherStart);
    schedule(() => setPhase('teacher-exit'), t.teacherExitStart);
    schedule(() => setPhase('hidden'), t.hideStart);
    schedule(() => {
      setMounted(false);
      onComplete?.();
    }, t.unmountAfter);

    return () => timeouts.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  const isHidden = phase === 'hidden';
  const showLogoStage = phase === 'logo' || phase === 'logo-exit';
  const logoVisible = phase === 'logo';
  const showTeacherStage = phase === 'teacher' || phase === 'teacher-exit';
  const teacherVisible = phase === 'teacher';

  // اختيار الصورة بناءً على حالة الشاشة الحقيقية
  const currentImage = isMobile ? teacherImageMobile : teacherImageDesktop;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      aria-hidden={isHidden}
      className={`fixed inset-0 z-[999] flex items-center justify-center overflow-hidden bg-[#1A0609] transition-opacity duration-700 ease-out ${
        isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <SplashStyles />

      {/* ===== STAGE 1: Logo + wordmark ===== */}
      {showLogoStage && (
        <div
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 px-6 text-center bg-[#1A0609] transition-all duration-700 ease-out ${
            logoVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
          }`}
        >
          <div className="splash-logo-enter">
            <OrbitMark size={84} />
          </div>
          <div className="splash-text-enter">
            <h1
              dir="ltr"
              className="font-display text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-[#C9A876] via-[#E7C3B6] to-[#F3E4D6] bg-clip-text text-transparent"
            >
              Nucleus
            </h1>
            <p className="mt-2 text-xs sm:text-sm tracking-[0.2em] uppercase text-[#E7C3B6]/60 font-body">
              {isAr ? 'منصة مريم محمد لعلوم الحياة' : 'Maryam Mohamed Science School'}
            </p>
          </div>
        </div>
      )}

      {/* ===== STAGE 2: Fullscreen Dynamic Teacher Image ===== */}
      {showTeacherStage && (
        <div
          className={`absolute inset-0 z-10 w-full h-full transition-opacity duration-700 ease-out ${
            teacherVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={currentImage}
            alt="Teacher"
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

function OrbitMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className="splash-orbit-glow">
      <g className="splash-orbit-spin">
        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#C9A876" strokeWidth="1.6" transform="rotate(0 28 28)" fill="none" />
        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#8C3B3F" strokeWidth="1.6" transform="rotate(60 28 28)" fill="none" />
        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#5C1A24" strokeWidth="1.6" transform="rotate(120 28 28)" fill="none" />
      </g>
      <circle cx="28" cy="28" r="6.5" fill="url(#splashNucleusGlow)" />
      <defs>
        <radialGradient id="splashNucleusGlow" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#E7827E" />
          <stop offset="100%" stopColor="#5C1A24" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function SplashStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&display=swap');
      .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
      .font-body { font-family: 'Manrope', sans-serif; }

      @keyframes splash-orbit-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .splash-orbit-spin { animation: splash-orbit-spin 6s linear infinite; transform-origin: center; }

      @keyframes splash-orbit-glow {
        0%, 100% { filter: drop-shadow(0 0 6px rgba(201,168,118,0.35)); }
        50% { filter: drop-shadow(0 0 18px rgba(201,168,118,0.65)); }
      }
      .splash-orbit-glow { animation: splash-orbit-glow 2.4s ease-in-out infinite; }

      @keyframes splash-logo-enter {
        0% { opacity: 0; transform: scale(0.6) translateY(10px); }
        60% { opacity: 1; transform: scale(1.06) translateY(0); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      .splash-logo-enter { animation: splash-logo-enter 0.8s cubic-bezier(0.22, 1, 0.36, 1) both; }

      @keyframes splash-text-enter {
        0% { opacity: 0; transform: translateY(12px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      .splash-text-enter { animation: splash-text-enter 0.7s ease-out 0.25s both; }

      @media (prefers-reduced-motion: reduce) {
        .splash-orbit-spin,
        .splash-orbit-glow,
        .splash-logo-enter,
        .splash-text-enter {
          animation: none !important;
        }
      }
    `}</style>
  );
}