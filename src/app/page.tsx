'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import SplashScreen from '@/components/SplashScreen';

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

const TEACHER_EMAIL = "mariam@nucleus.com";

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
      const isTeacher = user.email && user.email.trim().toLowerCase() === TEACHER_EMAIL;
      
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

    console.log("1. بدأت عملية الإرسال...");

    try {
      if (isLogin) {
        console.log("2. جاري تسجيل الدخول...");
        const result = await login(email, password);
        const isTeacher = email.trim().toLowerCase() === TEACHER_EMAIL;
        
        if (isTeacher) {
          router.push('/teacher-dashboard');
        } else if (result.role === 'student') {
          router.push('/student-dashboard');
        } else if (result.role === 'parent') {
          router.push('/parent-dashboard');
        }
      } else {
        console.log("2. جاري إنشاء حساب جديد...", { role, email });
        
        if (role === 'student' && !gradeLevel) {
          setError('الرجاء اختيار السنة الدراسية');
          setLoading(false);
          return;
        }
        
        console.log("3. إرسال البيانات للفايربيز (Auth + Firestore)...");
        // تنفيذ التسجيل
        await signup(name, email, password, role, gradeLevel);
        console.log("4. تم حفظ البيانات في الفايربيز بنجاح!");
        
        if (role === 'student') {
          alert('تم إنشاء الحساب بنجاح! حسابك الآن في انتظار موافقة المعلمة مريم قبل التمكن من تسجيل الدخول.');
          setIsLogin(true); // تحويل التبويب لتسجيل الدخول
        } else {
          router.push('/parent-dashboard');
        }
      }
    } catch (err: any) {
      console.error('❌ خطأ في العملية:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('هذا البريد الإلكتروني مستخدم بالفعل، جرب تسجل دخول أو استخدم إيميل جديد.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else {
        setError(err.message || 'حدث خطأ ما، يرجى المحاولة مرة أخرى.');
      }
    } finally {
      console.log("5. انتهاء العملية وإغلاق الـ Loading");
      setLoading(false);
    }
  };
  return (
    <>
      {/* 🌟 شاشة الترحيب السينمائية (تظهر أولاً ثم تختفي بسلاسة) */}
      {showSplash && (
        <SplashScreen
          teacherImageDesktop="/teacher-desktop.png"
          teacherImageMobile="/teacher-mobile.png"
          isAr={isAr}
          onComplete={() => setShowSplash(false)}
        />
      )}

      <div dir={dir} className="min-h-screen relative overflow-hidden font-body">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&display=swap');

          .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
          .font-body { font-family: 'Manrope', sans-serif; }

          @keyframes orbit-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes card-glow {
            0%, 100% { box-shadow: 0 8px 60px -12px rgba(92,26,36,0.45), 0 0 0 1px rgba(201,168,118,0.25); }
            50% { box-shadow: 0 8px 70px -8px rgba(92,26,36,0.55), 0 0 0 1px rgba(201,168,118,0.4); }
          }
          
          @keyframes form-appear {
            0% {
              opacity: 0;
              transform: translateY(35px) scale(0.98);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          .orbit-ring { animation: orbit-spin 7s linear infinite; transform-origin: center; }
          .card-glow { animation: card-glow 5s ease-in-out infinite; }
          
          .animate-form-appear {
            animation: form-appear 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
          }

          @media (prefers-reduced-motion: reduce) {
            .orbit-ring, .card-glow, .animate-form-appear { animation: none; opacity: 1; transform: none; }
          }
        `}</style>

        {/* ===== Full-screen cinematic background ===== */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat lg:hidden"
          style={{ backgroundImage: "url('/bg-mobile.jpeg')" }}
        />
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat hidden lg:block"
          style={{ backgroundImage: "url('/bg-desktop.jpeg')" }}
        />

        {/* Warm dark vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A0609]/55 via-[#1A0609]/25 to-[#1A0609]/65" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A0609]/70 via-transparent to-transparent" />
        <div className="hidden lg:block absolute inset-y-0 start-0 w-1/2 bg-gradient-to-r from-[#1A0609]/45 to-transparent" />

        {/* ===== Content layer ===== */}
        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Language toggle */}
          <div className="flex justify-end px-6 sm:px-10 pt-6">
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="px-4 py-2 bg-[#1A0609]/50 backdrop-blur-lg border border-[#C9A876]/35 rounded-full text-[#F3E4D6] text-sm font-medium hover:bg-[#1A0609]/70 hover:border-[#C9A876]/60 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-black/20"
            >
              {language === 'en' ? 'العربية' : 'English'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </button>
          </div>

          {/* Card zone */}
          <div className="flex-1 flex items-center justify-center lg:justify-end px-6 sm:px-10 py-8 lg:pe-16 xl:pe-24">
            
            <div className="card-glow animate-form-appear w-full max-w-md bg-[#1A0609]/45 backdrop-blur-2xl rounded-[2rem] border border-[#C9A876]/40 px-8 py-9 relative overflow-hidden">
              
              {/* Warm inner wash */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#8C3B3F]/15 via-transparent to-[#C9A876]/10 pointer-events-none" />

              <div className="relative z-10">
                {/* Teacher identity strip */}
                <div className="text-center mb-5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.18em] bg-[#1A0609]/50 border border-[#E7C3B6]/30 text-[#F3D9CE]">
                    👑 {isAr ? 'معلمة موثقة' : 'Verified Educator'}
                  </span>
                  <p className="mt-2.5 text-[#F3E4D6]/90 text-sm font-semibold tracking-wide">
                    {isAr ? 'مريم محمد · مدرسة العلوم' : 'Mariam Mohamed · Science School'}
                  </p>
                </div>

                {/* Logo */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 mb-2">
                    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                      <g className="orbit-ring">
                        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#C9A876" strokeWidth="1.6" transform="rotate(0 28 28)" fill="none" />
                        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#E7C3B6" strokeWidth="1.6" transform="rotate(60 28 28)" fill="none" />
                        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#F3E4D6" strokeWidth="1.4" transform="rotate(120 28 28)" fill="none" />
                      </g>
                      <circle cx="28" cy="28" r="6.5" fill="url(#nucleusGlow)" />
                      <defs>
                        <radialGradient id="nucleusGlow" cx="0.35" cy="0.3" r="0.9">
                          <stop offset="0%" stopColor="#E7827E" />
                          <stop offset="100%" stopColor="#5C1A24" />
                        </radialGradient>
                      </defs>
                    </svg>
                  </div>
                  <h1
                    className="font-display text-4xl font-bold mb-1.5 tracking-tight bg-gradient-to-r from-[#F3E4D6] via-[#E7C3B6] to-[#C9A876] bg-clip-text text-transparent"
                    dir="ltr"
                  >
                    Nucleus
                  </h1>
                  <p className="text-[#E7C3B6]/85 text-base font-medium tracking-wide">{t.tagline}</p>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-[#C9A876]/40 to-transparent mb-6" />

                {/* Login/Signup Toggle */}
                <div className="flex mb-6 bg-black/25 rounded-full p-1 border border-[#C9A876]/25">
                  <button
                    onClick={() => setIsLogin(true)}
                    className={`flex-1 py-2.5 px-4 rounded-full transition-all duration-300 font-semibold text-sm ${
                      isLogin
                        ? 'bg-gradient-to-r from-[#5C1A24] to-[#8C3B3F] text-white shadow-md shadow-black/30'
                        : 'text-[#F3E4D6]/60 hover:text-[#F3E4D6]'
                    }`}
                  >
                    {t.login}
                  </button>
                  <button
                    onClick={() => setIsLogin(false)}
                    className={`flex-1 py-2.5 px-4 rounded-full transition-all duration-300 font-semibold text-sm ${
                      !isLogin
                        ? 'bg-gradient-to-r from-[#5C1A24] to-[#8C3B3F] text-white shadow-md shadow-black/30'
                        : 'text-[#F3E4D6]/60 hover:text-[#F3E4D6]'
                    }`}
                  >
                    {t.signup}
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div>
                      <label className="block text-xs font-semibold tracking-wide text-[#E7C3B6]/80 mb-1.5">
                        {t.name}
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full px-4 py-3.5 bg-black/25 border border-[#C9A876]/25 rounded-2xl text-[#F8F1E7] placeholder-[#F3E4D6]/35 outline-none focus:border-[#C9A876]/70 focus:ring-4 focus:ring-[#C9A876]/15 transition-all duration-300"
                        placeholder={dir === 'rtl' ? 'أدخل اسمك' : 'Enter your name'}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold tracking-wide text-[#E7C3B6]/80 mb-1.5">
                      {t.email}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3.5 bg-black/25 border border-[#C9A876]/25 rounded-2xl text-[#F8F1E7] placeholder-[#F3E4D6]/35 outline-none focus:border-[#C9A876]/70 focus:ring-4 focus:ring-[#C9A876]/15 transition-all duration-300"
                      placeholder={dir === 'rtl' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold tracking-wide text-[#E7C3B6]/80 mb-1.5">
                      {t.password}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-4 py-3.5 bg-black/25 border border-[#C9A876]/25 rounded-2xl text-[#F8F1E7] placeholder-[#F3E4D6]/35 outline-none focus:border-[#C9A876]/70 focus:ring-4 focus:ring-[#C9A876]/15 transition-all duration-300"
                      placeholder={dir === 'rtl' ? 'أدخل كلمة المرور' : 'Enter your password'}
                    />
                  </div>

                  {!isLogin && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold tracking-wide text-[#E7C3B6]/80 mb-1.5">
                          {t.role}
                        </label>
                        <div className="relative">
                          <select
                            value={role}
                            onChange={(e) => {
                              setRole(e.target.value as 'student' | 'parent');
                              setGradeLevel('');
                            }}
                            className="w-full px-4 py-3.5 bg-black/25 border border-[#C9A876]/25 rounded-2xl text-[#F8F1E7] outline-none focus:border-[#C9A876]/70 focus:ring-4 focus:ring-[#C9A876]/15 transition-all duration-300 appearance-none cursor-pointer pe-10"
                          >
                            <option value="student" className="bg-[#2A0D12]">{t.student}</option>
                            <option value="parent" className="bg-[#2A0D12]">{t.parent}</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4 text-[#C9A876]/70">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {role === 'student' && (
                        <div>
                          <label className="block text-xs font-semibold tracking-wide text-[#E7C3B6]/80 mb-1.5">
                            {t.gradeLevel}
                          </label>
                          <div className="relative">
                            <select
                              value={gradeLevel}
                              onChange={(e) => setGradeLevel(e.target.value)}
                              required
                              className="w-full px-4 py-3.5 bg-black/25 border border-[#C9A876]/25 rounded-2xl text-[#F8F1E7] outline-none focus:border-[#C9A876]/70 focus:ring-4 focus:ring-[#C9A876]/15 transition-all duration-300 appearance-none cursor-pointer pe-10"
                            >
                              <option value="" className="bg-[#2A0D12]">{dir === 'rtl' ? 'اختر السنة الدراسية' : 'Select Grade Level'}</option>
                              {gradeLevels.map((level) => (
                                <option key={level.en} value={level.en} className="bg-[#2A0D12]">
                                  {language === 'ar' ? level.ar : level.en}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4 text-[#C9A876]/70">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {error && (
                    <div className="p-3 bg-rose-500/15 border border-rose-300/30 rounded-2xl text-rose-100 text-sm backdrop-blur-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 px-4 bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] text-white font-semibold rounded-2xl hover:shadow-[0_8px_32px_rgba(201,168,118,0.35)] hover:brightness-110 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-[#C9A876]/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none shadow-lg shadow-black/40"
                  >
                    {loading ? t.processing : isLogin ? t.login : t.signup}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}