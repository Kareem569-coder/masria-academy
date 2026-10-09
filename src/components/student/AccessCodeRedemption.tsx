'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { redeemPackageAccessCode } from '@/lib/firestore/packageService';

interface AccessCodeRedemptionProps {
  studentId: string;
  studentGradeLevel: string;
  onRedeemSuccess?: () => void;
}

export default function AccessCodeRedemption({
  studentId,
  studentGradeLevel,
  onRedeemSuccess,
}: AccessCodeRedemptionProps) {
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const result = await redeemPackageAccessCode(code.trim(), studentId, studentGradeLevel);

      if (result.success) {
        setSuccess(true);
        setCode('');
        if (onRedeemSuccess) {
          onRedeemSuccess();
        }
      } else {
        setError(isAr ? 'فشل استبدال الكود' : 'Failed to redeem code');
      }
    } catch {
      setError(isAr ? 'حدث خطأ ما' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-6" dir={dir}>
      <h3 className="text-lg font-semibold text-white mb-4">
        {isAr ? 'استبدال كود الوصول' : 'Redeem Access Code'}
      </h3>

      {success ? (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-4">
          <p className="text-sm font-medium text-emerald-200">
            {isAr ? 'تم استبدال الكود بنجاح! تمت إضافة الباقة إلى حسابك.' : 'Code redeemed successfully! Package added to your account.'}
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-3 text-sm text-emerald-300 hover:text-emerald-200"
          >
            {isAr ? 'استبدال كود آخر' : 'Redeem another code'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              {isAr ? 'أدخل كود الوصول' : 'Enter Access Code'}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MASRIA-XXXX-XXXX"
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm font-mono text-slate-200 placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="whitespace-pre-wrap text-sm text-rose-300">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="cyber-button w-full rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? (isAr ? 'جارٍ الاستبدال...' : 'Redeeming...')
              : (isAr ? 'استبدال الكود' : 'Redeem Code')
            }
          </button>
        </form>
      )}
    </div>
  );
}
