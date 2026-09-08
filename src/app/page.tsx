'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import SplashScreen from '@/components/SplashScreen';
import TechLogo from '@/components/TechLogo';
import { getErrorCode, getErrorMessage } from '@/types/models';
import { isTeacherEmail } from '@/lib/authorization';

const gradeLevels = [
  { en: 'Grade 4', ar: 'الرابع الابتدائي' },
  { en: 'Grade 5', ar: 'الخامس الابتدائي' },
  { en: 'Grade 6', ar: 'السادس الابتدائي' },
  { en: 'Prep 1', ar: 'الأول الإعدادي' },
  { en: 'Prep 2', ar: 'الثاني الإعدادي' },
  { en: 'Prep 3', ar: 'الثالث الإعدادي' },
  { en: 'Sec 1', ar: 'الأول الثانوي' },
  { en: 'Sec 2', ar: 'الثاني الثانوي' },
  { en: 'Sec 3', ar: 'الثالث الثانوي' },
];

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'parent'>('student');
  const [gradeLevel, setGradeLevel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, role: userRole, login, signup } = useAuth();
  const { language, setLanguage, t, dir } = useLanguage();
  const router = useRouter();
  const isAr = language === 'ar';

  useEffect(() => {
    if (user && userRole) {
      const isTeacher = isTeacherEmail(user.email);
      if (isTeacher) {
        router.push('/teacher-dashboard');
      } else if (userRole === 'student') {
        router.push('/student-dashboard');
      } else if (userRole === 'parent') {
        router.push('/parent-dashboard');
      }
    }
  }, [user, userRole, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const result = await login(email, password);
        const isTeacher = isTeacherEmail(email);

        if (isTeacher) {
          router.push('/teacher-dashboard');
        } else if (result.role === 'student') {
          router.push('/student-dashboard');
        } else if (result.role === 'parent') {
          router.push('/parent-dashboard');
        }
      } else {
        if (role === 'student' && !gradeLevel) {
          setError('الرجاء اختيار السنة الدراسية');
          setLoading(false);
          return;
        }

        await signup(name, email, password, role, gradeLevel);

        if (role === 'student') {
          alert('تم إنشاء الحساب بنجاح! حسابك الآن في انتظار مراجعة إدارة MASRIA قبل التمكن من تسجيل الدخول.');
          setIsLogin(true);
        } else {
          router.push('/parent-dashboard');
        }
      }
    } catch (error: unknown) {
      const errorCode = getErrorCode(error);
      if (errorCode === 'auth/email-already-in-use') {
        setError('هذا البريد الإلكتروني مستخدم بالفعل، جرب تسجيل الدخول أو استخدم بريدًا جديدًا.');
      } else if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else {
        setError(getErrorMessage(error, 'حدث خطأ ما، يرجى المحاولة مرة أخرى.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showSplash && (
        <SplashScreen
          teacherImageDesktop="/teacher-desktop.png"
          teacherImageMobile="/teacher-mobile.png"
          isAr={isAr}
          onComplete={() => setShowSplash(false)}
        />
      )}

      <div dir={dir} className="relative min-h-screen overflow-hidden bg-[#080c14] font-body text-slate-50">
        {/* Ambient background */}
        <div className="absolute inset-0 bg-grid opacity-[0.25]" />
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -right-16 top-1/3 h-[28rem] w-[28rem] rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#080c14] to-transparent" />

        {/* Minimal top bar */}
        <header className="relative z-10 mx-auto max-w-6xl px-6 pt-6 sm:px-10">
          <div className="flex items-center justify-between rounded-2xl border-b border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="flex items-center gap-3">
              <TechLogo size={40} />
              <div>
                <div className="text-lg font-bold tracking-tight text-white">MASRIA</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                  {isAr ? 'م. كريم عزالدين' : 'Eng. Kareem Ezzeldin'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="cyber-button rounded-full border border-cyan-400/35 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-300/60 hover:text-white"
            >
              {language === 'en' ? 'العربية' : 'English'}
            </button>
          </div>
        </header>

        {/* Centered auth container */}
        <main className="relative z-10 mx-auto flex min-h-[calc(100vh-96px)] max-w-6xl flex-col items-center justify-center px-6 py-10 sm:px-10">
          <div className="mb-6 flex flex-col items-center gap-3">
            <TechLogo size={64} />
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              {isAr ? 'أكاديمية هندسة البرمجيات' : 'Software Engineering Academy'}
            </p>
          </div>

          <section className="w-full max-w-md">
            <div className="glass-panel soft-ring relative overflow-hidden rounded-[2rem] border border-white/10 p-6 sm:p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-transparent to-indigo-500/10" />
              {/* signature: thin animated circuit trace along the top edge */}
              <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
                <div className="h-full w-1/3 animate-[trace_3.2s_linear_infinite] bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
              </div>

              <div className="relative z-10">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-cyan-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      {isAr ? 'بوابة المنصة' : 'Access Portal'}
                    </p>
                    <h1 className="mt-2 text-2xl font-bold text-white">
                      {isAr ? 'بوابة MASRIA' : 'MASRIA Portal'}
                    </h1>
                  </div>
                  <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    MASRIA
                  </div>
                </div>

                <div className="mb-6 flex rounded-full border border-white/10 bg-slate-900/60 p-1">
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                      isLogin
                        ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/15'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {t.login}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                      !isLogin
                        ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/15'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {t.signup}
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                        {t.name}
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-500/10"
                        placeholder={dir === 'rtl' ? 'أدخل اسمك' : 'Enter your name'}
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {t.email}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-500/10"
                      placeholder={dir === 'rtl' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {t.password}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-500/10"
                      placeholder={dir === 'rtl' ? 'أدخل كلمة المرور' : 'Enter your password'}
                    />
                  </div>

                  {!isLogin && (
                    <>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                          {t.role}
                        </label>
                        <div className="flex rounded-2xl border border-white/10 bg-slate-900/60 p-1">
                          <button
                            type="button"
                            onClick={() => {
                              setRole('student');
                              setGradeLevel('');
                            }}
                            className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                              role === 'student'
                                ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md shadow-cyan-500/15'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {t.student}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRole('parent');
                              setGradeLevel('');
                            }}
                            className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                              role === 'parent'
                                ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md shadow-cyan-500/15'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {t.parent}
                          </button>
                        </div>
                      </div>

                      {role === 'student' && (
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                            {t.gradeLevel}
                          </label>
                          <select
                            value={gradeLevel}
                            onChange={(e) => setGradeLevel(e.target.value)}
                            required
                            className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-500/10"
                          >
                            <option value="">{dir === 'rtl' ? 'اختر السنة الدراسية' : 'Select Grade Level'}</option>
                            {gradeLevels.map((level) => (
                              <option key={level.en} value={level.en} className="bg-slate-900">
                                {language === 'ar' ? level.ar : level.en}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {error && (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="cyber-button w-full rounded-2xl px-4 py-3.5 text-base font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? t.processing : isLogin ? t.login : t.signup}
                  </button>
                </form>
              </div>
            </div>

            <p className="mt-5 text-center text-xs text-slate-500">
              {isAr ? 'منصة MASRIA التعليمية © ' : '© MASRIA Learning Platform '}
              {new Date().getFullYear()}
            </p>
          </section>
        </main>
      </div>

      <style jsx global>{`
        @keyframes trace {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(320%);
          }
        }
      `}</style>
    </>
  );
}