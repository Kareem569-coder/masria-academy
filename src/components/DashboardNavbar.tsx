'use client';

import type { ReactNode } from 'react';
import TechLogo from '@/components/TechLogo';
import { useLanguage } from '@/context/LanguageContext';

type Theme = 'light' | 'dark';

type DashboardNavbarProps = {
  theme: Theme;
  onThemeToggle: () => void;
  onLogout: () => void | Promise<void>;
  portalLabel?: string;
  portalSubLabel?: string;
  adminBadge?: string;
  greeting?: ReactNode;
  showThemeLabel?: boolean;
  navClassName?: string;
  themeButtonClassName?: string;
};

export default function DashboardNavbar({
  theme,
  onThemeToggle,
  onLogout,
  portalLabel,
  portalSubLabel,
  adminBadge,
  greeting,
  showThemeLabel = false,
  navClassName = 'border-white/10 bg-slate-950/70',
  themeButtonClassName = 'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900/60 text-slate-100 transition hover:border-cyan-400/40 hover:text-white',
}: DashboardNavbarProps) {
  const { language, setLanguage, dir } = useLanguage();
  const isAr = language === 'ar';
  const isDark = theme === 'dark';

  return (
    <nav dir={dir} className={`relative z-10 border-b backdrop-blur-xl ${navClassName}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <TechLogo size={42} showText={true} className="drop-shadow-[0_0_24px_rgba(6,182,212,0.35)]" />
            {adminBadge && (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-200">
                  {adminBadge}
                </span>
              </div>
            )}
            {portalLabel && (
              <div className="hidden flex-col leading-tight sm:flex">
                <span className="text-sm font-semibold tracking-[0.18em] text-cyan-300 uppercase">{portalLabel}</span>
                {portalSubLabel && <span className="text-[10px] tracking-[0.2em] text-slate-400">{portalSubLabel}</span>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {greeting && <div className="hidden text-sm text-slate-300 md:inline">{greeting}</div>}
            <button
              type="button"
              onClick={onThemeToggle}
              className={themeButtonClassName}
              aria-label={isAr ? 'تبديل المظهر' : 'Toggle theme'}
              title={isAr ? 'تبديل المظهر' : 'Toggle theme'}
            >
              {isDark ? '☀️' : '🌙'}
              {showThemeLabel && (
                <span className="hidden sm:inline">{isDark ? (isAr ? 'صباحي' : 'Light') : (isAr ? 'ليلي' : 'Dark')}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-cyan-400/40 hover:text-white sm:text-sm"
            >
              {language === 'en' ? 'العربية' : 'English'}
            </button>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15"
            >
              {isAr ? 'تسجيل الخروج' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
