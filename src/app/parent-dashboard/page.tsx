'use client';

import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Theme = 'light' | 'dark';

interface LinkedStudent {
  uid: string;
  name: string;
  email: string;
  linkedAt: string | Date;
  gradeLevel?: string;
}

interface PerformanceRow {
  id: string;
  quizTitle?: string;
  score: number;
  total: number;
  date?: string;
}

interface ExamResult {
  id: string;
  examTitle: string;
  score: number;
  totalMarks: number;
  feedback?: string;
  updatedAt: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  gradeLevel: string;
  author: string;
  pinned: boolean;
  createdAt: string;
}

interface ToastItem {
  id: string;
  type: 'success' | 'error';
  message: string;
}

export default function ParentDashboard() {
  const { user, logout, loading, linkStudent } = useAuth();
  const { language, setLanguage, dir } = useLanguage();
  const router = useRouter();
  const isAr = language === 'ar';

  const [theme, setTheme] = useState<Theme>('light');
  const isDark = theme === 'dark';

  const [parentData, setParentData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [linkCode, setLinkCode] = useState('');
  const [linking, setLinking] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<LinkedStudent | null>(null);
  const [studentScores, setStudentScores] = useState<PerformanceRow[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);

  // ===== Exam Results & Announcements for selected student =====
  const [studentExamResults, setStudentExamResults] = useState<ExamResult[]>([]);
  const [loadingExamResults, setLoadingExamResults] = useState(false);
  const [studentAnnouncements, setStudentAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  // ===== Toasts =====
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pushToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);
  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // ===== Access gate =====
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/');
    }
  }, [loading, user, router]);

  // ===== Fetch parent data + realtime listener =====
  useEffect(() => {
    if (!user) return;

    const fetchParentData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setParentData(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching parent data:', error);
        pushToast('error', isAr ? 'تعذر تحميل بيانات الحساب' : 'Could not load account data');
      } finally {
        setLoadingData(false);
      }
    };

    fetchParentData();

    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setParentData(snap.data());
        }
      },
      (error) => {
        console.error('Realtime listener error:', error);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !linkCode.trim()) return;

    setLinking(true);
    try {
      await linkStudent(user.uid, linkCode.trim().toUpperCase());
      pushToast('success', isAr ? 'تم ربط الطالب بنجاح بحسابك!' : 'Student successfully linked to your account!');
      setLinkCode('');
    } catch (error: any) {
      pushToast(
        'error',
        error?.message || (isAr ? 'فشل ربط الطالب. تحقق من الكود وحاول مرة أخرى.' : 'Failed to link student. Check the code and try again.')
      );
    } finally {
      setLinking(false);
    }
  };

  const openStudentModal = async (student: LinkedStudent) => {
    setSelectedStudent(student);
    setLoadingScores(true);
    setLoadingExamResults(true);
    setLoadingAnnouncements(true);
    setStudentScores([]);
    setStudentExamResults([]);
    setStudentAnnouncements([]);
    try {
      // Fetch quiz performance
      const q = query(collection(db, 'performance'), where('studentId', '==', student.uid));
      const snapshot = await getDocs(q);
      const fetched: PerformanceRow[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          quizTitle: data.quizTitle || (isAr ? 'اختبار' : 'Quiz'),
          score: Number(data.score) || 0,
          total: Number(data.total) || 1,
          date: data.date || '',
        };
      });
      setStudentScores(fetched);

      // Fetch exam results
      const examQ = query(collection(db, 'exam_results'), where('studentId', '==', student.uid));
      const examSnapshot = await getDocs(examQ);
      const examFetched: ExamResult[] = examSnapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          examTitle: data.examTitle || '',
          score: Number(data.score) || 0,
          totalMarks: Number(data.totalMarks) || 1,
          feedback: data.feedback || '',
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
      });
      setStudentExamResults(examFetched);

      // Fetch announcements
      const announcementSnapshot = await getDocs(collection(db, 'announcements'));
      const announcementFetched: Announcement[] = announcementSnapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || '',
          content: data.content || '',
          gradeLevel: data.gradeLevel || '',
          author: data.author || 'Teacher Mariam 👑',
          pinned: data.pinned || false,
          createdAt: data.createdAt || new Date().toISOString(),
        };
      });
      // Filter by student's grade level or "All"
      const filteredAnnouncements = announcementFetched.filter((a) => 
        a.gradeLevel === 'All' || a.gradeLevel === student.gradeLevel
      );
      // Sort by pinned first, then by date
      filteredAnnouncements.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setStudentAnnouncements(filteredAnnouncements);
    } catch (error) {
      console.error('Error fetching student data:', error);
      pushToast('error', isAr ? 'تعذر تحميل بيانات الطالب' : 'Could not load student data');
    } finally {
      setLoadingScores(false);
      setLoadingExamResults(false);
      setLoadingAnnouncements(false);
    }
  };

  const closeStudentModal = () => {
    setSelectedStudent(null);
    setStudentScores([]);
  };

  const linkedStudents: LinkedStudent[] = parentData?.linkedStudents || [];

  // ===== Inline "Orbit Ring" brand mark — gold / burgundy / maroon ellipses =====
  const OrbitMark = ({ size = 40 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <g className="orbit-ring">
        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#C9A876" strokeWidth="1.6" transform="rotate(0 28 28)" fill="none" />
        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#8C3B3F" strokeWidth="1.6" transform="rotate(60 28 28)" fill="none" />
        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#5C1A24" strokeWidth="1.6" transform="rotate(120 28 28)" fill="none" />
      </g>
      <circle cx="28" cy="28" r="6.5" fill="url(#parentNucleusGlow)" />
      <defs>
        <radialGradient id="parentNucleusGlow" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#E7827E" />
          <stop offset="100%" stopColor="#5C1A24" />
        </radialGradient>
      </defs>
    </svg>
  );

  // ===== Theme-derived class helpers =====
  const pageBg = isDark ? 'bg-[#1A0609]' : 'bg-[#F8F1E7]';
  const navBg = isDark ? 'bg-black/40 border-[#C9A876]/15' : 'bg-white/70 border-[#C9A876]/25';
  const cardBg = isDark ? 'bg-[#2A0D12]/60 border-[#C9A876]/15' : 'bg-white/75 border-[#C9A876]/25';
  const cardShadow = isDark ? 'shadow-xl shadow-black/40' : 'shadow-xl shadow-[#5C1A24]/5';
  const headingText = isDark ? 'text-[#F8F1E7]' : 'text-[#2E1013]';
  const bodyText = isDark ? 'text-[#E7C3B6]/80' : 'text-[#5C1A24]/70';
  const mutedText = isDark ? 'text-[#E7C3B6]/50' : 'text-[#5C1A24]/50';
  const inputBg = isDark
    ? 'bg-black/30 border-[#C9A876]/20 text-[#F8F1E7] placeholder-[#E7C3B6]/30'
    : 'bg-white/70 border-[#C9A876]/30 text-[#2E1013] placeholder-[#5C1A24]/30';
  const ambientA = isDark ? 'bg-[#8C3B3F]/15' : 'bg-[#C9A876]/15';
  const ambientB = isDark ? 'bg-[#C9A876]/10' : 'bg-[#8C3B3F]/10';

  if (loading || !user || loadingData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${pageBg}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-[#C9A876]/25 border-t-[#8C3B3F] animate-spin" />
          <div className={`text-lg font-medium font-body ${isDark ? 'text-[#F8F1E7]' : 'text-[#5C1A24]'}`}>
            {isAr ? 'جاري التحميل...' : 'Loading...'}
          </div>
        </div>
        <FontStyles />
      </div>
    );
  }

  return (
    <div dir={dir} className={`min-h-screen relative overflow-x-hidden font-body transition-colors duration-300 ${pageBg}`}>
      <FontStyles />

      {/* Ambient warm field */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-12%] start-[-8%] w-[28rem] h-[28rem] rounded-full blur-[120px] ${ambientA}`} />
        <div className={`absolute bottom-[-12%] end-[5%] w-[26rem] h-[26rem] rounded-full blur-[120px] ${ambientB}`} />
      </div>

      {/* Toasts */}
      <div className="fixed top-5 inset-x-0 sm:inset-x-auto sm:end-5 z-[100] flex flex-col items-center sm:items-end gap-2 px-4 sm:px-0 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto w-full sm:w-auto sm:min-w-[280px] max-w-sm flex items-start gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-xl shadow-xl animate-toast-in ${
              t.type === 'success'
                ? isDark
                  ? 'bg-[#1A0609]/90 border-[#C9A876]/40 text-[#F8F1E7]'
                  : 'bg-white/95 border-[#C9A876]/40 text-[#2E1013]'
                : isDark
                ? 'bg-[#1A0609]/90 border-rose-400/40 text-[#F8F1E7]'
                : 'bg-white/95 border-rose-400/40 text-[#2E1013]'
            }`}
          >
            <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${t.type === 'success' ? 'bg-[#8C3B3F]' : 'bg-rose-500'}`} />
            <p className="text-sm font-medium leading-snug flex-1">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className={`shrink-0 text-xs ${mutedText} hover:opacity-80`}
              aria-label={isAr ? 'إغلاق' : 'Dismiss'}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Nav */}
      <nav className={`relative z-10 backdrop-blur-xl border-b ${navBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20 gap-4">
            <div className="flex items-center gap-3">
              <OrbitMark />
              <div>
                <h1
                  className="font-display text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] bg-clip-text text-transparent leading-tight"
                  dir="ltr"
                >
                  Nucleus
                </h1>
                <span className={`text-[11px] tracking-wide block leading-tight ${mutedText}`}>
                  {isAr ? 'بوابة أولياء الأمور' : 'Parent Portal'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-300 ${
                  isDark
                    ? 'bg-[#C9A876]/10 border-[#C9A876]/30 text-[#C9A876] hover:bg-[#C9A876]/20'
                    : 'bg-[#5C1A24]/5 border-[#C9A876]/30 text-[#5C1A24] hover:bg-[#C9A876]/15'
                }`}
                aria-label={isAr ? 'تبديل المظهر' : 'Toggle theme'}
              >
                {isDark ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                className={`px-3 py-2 rounded-full text-xs sm:text-sm font-medium border transition-all duration-300 ${
                  isDark
                    ? 'bg-[#C9A876]/10 border-[#C9A876]/25 text-[#F8F1E7] hover:bg-[#C9A876]/20'
                    : 'bg-[#5C1A24]/5 border-[#C9A876]/30 text-[#5C1A24] hover:bg-[#C9A876]/15'
                }`}
              >
                {language === 'en' ? 'العربية' : 'English'}
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-[#8C3B3F]/10 text-[#8C3B3F] border border-[#8C3B3F]/30 rounded-full font-medium hover:bg-[#8C3B3F]/20 hover:border-[#8C3B3F]/50 transition-all duration-300 text-sm"
              >
                {isAr ? 'تسجيل الخروج' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ===== Greeting / School Branding ===== */}
        <div className={`backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border ${cardBg} ${cardShadow}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className={`text-xs font-semibold tracking-wide uppercase mb-1.5 ${mutedText}`}>
                {isAr ? 'منصة مريم محمد لعلوم الحياة' : 'Maryam Mohamed Science School'}
              </p>
              <h2 className={`font-display text-2xl sm:text-3xl font-bold mb-2 ${headingText}`}>
                {isAr
                  ? `مرحبًا، ${user?.displayName || parentData?.name || 'ولي الأمر'}`
                  : `Welcome, ${user?.displayName || parentData?.name || 'Parent'}`}
              </h2>
              <p className={`text-sm ${bodyText}`}>{user?.email}</p>
            </div>
            <div className={`shrink-0 rounded-2xl border px-5 py-4 text-center ${isDark ? 'bg-black/20 border-[#C9A876]/15' : 'bg-white/60 border-[#C9A876]/20'}`}>
              <p className={`text-2xl font-bold ${headingText}`}>{linkedStudents.length}</p>
              <p className={`text-[11px] uppercase tracking-wide ${mutedText}`}>
                {isAr ? 'طلاب مرتبطون' : 'Linked Students'}
              </p>
            </div>
          </div>
        </div>

        {/* ===== Link Student Form ===== */}
        <div className={`backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border ${cardBg} ${cardShadow}`}>
          <h3 className={`font-display text-xl sm:text-2xl font-bold mb-1.5 ${headingText}`}>
            {isAr ? 'ربط حساب طالب' : 'Link a Student Account'}
          </h3>
          <p className={`text-sm mb-6 ${bodyText}`}>
            {isAr
              ? 'أدخل رمز الربط الخاص بابنك لربط حسابه بحسابك.'
              : "Enter your child's unique link code to connect their account with yours."}
          </p>

          <form onSubmit={handleLinkStudent} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
              placeholder={isAr ? 'أدخل رمز الربط (مثال: NUC-8492)' : 'Enter link code (e.g., NUC-8492)'}
              maxLength={8}
              dir="ltr"
              className={`flex-1 px-4 py-3 rounded-2xl border outline-none focus:border-[#8C3B3F]/60 focus:ring-4 focus:ring-[#8C3B3F]/10 transition-all duration-300 font-mono tracking-wider ${inputBg}`}
            />
            <button
              type="submit"
              disabled={linking || !linkCode.trim()}
              className="px-8 py-3 rounded-2xl bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] text-white font-semibold hover:shadow-[0_8px_28px_rgba(92,26,36,0.35)] hover:brightness-110 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {linking ? (isAr ? 'جارٍ الربط...' : 'Linking...') : (isAr ? 'ربط الطالب' : 'Link Student')}
            </button>
          </form>
        </div>

        {/* ===== Linked Students Grid ===== */}
        <div className={`backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border ${cardBg} ${cardShadow}`}>
          <h3 className={`font-display text-xl sm:text-2xl font-bold mb-6 ${headingText}`}>
            {isAr ? 'الطلاب المرتبطون' : 'Linked Students'}
          </h3>

          {linkedStudents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {linkedStudents.map((student) => (
                <button
                  key={student.uid}
                  onClick={() => openStudentModal(student)}
                  className={`text-start rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-0.5 ${
                    isDark
                      ? 'bg-black/20 border-[#C9A876]/15 hover:border-[#C9A876]/35'
                      : 'bg-white/60 border-[#C9A876]/20 hover:border-[#8C3B3F]/40'
                  } ${cardShadow}`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center bg-gradient-to-br from-[#5C1A24] via-[#8C3B3F] to-[#C9A876]">
                      <span className="text-white font-bold text-lg">{student.name?.charAt(0)?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className={`font-semibold truncate ${headingText}`}>{student.name}</h4>
                      <p className={`text-xs truncate ${mutedText}`}>{student.email}</p>
                    </div>
                  </div>
                  <p className={`text-xs ${bodyText}`}>
                    {isAr ? 'تاريخ الربط: ' : 'Linked on: '}
                    {student.linkedAt ? new Date(student.linkedAt).toLocaleDateString() : '—'}
                  </p>
                  <span className={`inline-block mt-3 text-xs font-semibold ${isDark ? 'text-[#C9A876]' : 'text-[#8C3B3F]'}`}>
                    {isAr ? 'عرض التفاصيل ←' : 'View details →'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-14">
              <div className={`text-lg font-semibold mb-2 ${headingText}`}>
                {isAr ? 'لا يوجد طلاب مرتبطون بعد' : 'No students linked yet'}
              </div>
              <p className={`text-sm ${mutedText}`}>
                {isAr
                  ? 'استخدم النموذج أعلاه لربط حساب ابنك باستخدام رمز الربط الخاص به.'
                  : "Use the form above to link your child's account using their unique link code."}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ===== Student Detail Modal ===== */}
      {selectedStudent && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeStudentModal} />
          <div
            className={`relative w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] border p-6 sm:p-8 ${
              isDark ? 'bg-[#1A0609] border-[#C9A876]/20' : 'bg-[#F8F1E7] border-[#C9A876]/25'
            } ${cardShadow}`}
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center bg-gradient-to-br from-[#5C1A24] via-[#8C3B3F] to-[#C9A876]">
                  <span className="text-white font-bold text-lg">
                    {selectedStudent.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <h3 className={`font-display text-xl font-bold ${headingText}`}>{selectedStudent.name}</h3>
                  <p className={`text-sm ${bodyText}`}>{selectedStudent.email}</p>
                </div>
              </div>
              <button
                onClick={closeStudentModal}
                className={`w-9 h-9 flex items-center justify-center rounded-full border shrink-0 ${
                  isDark ? 'border-[#C9A876]/25 text-[#E7C3B6]' : 'border-[#5C1A24]/20 text-[#5C1A24]'
                }`}
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className={`rounded-xl p-3.5 border ${isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/15'}`}>
                <p className={`text-[11px] uppercase tracking-wide mb-1 ${mutedText}`}>{isAr ? 'الصف' : 'Grade'}</p>
                <p className={`text-sm font-semibold ${headingText}`}>{selectedStudent.gradeLevel || '—'}</p>
              </div>
              <div className={`rounded-xl p-3.5 border ${isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/15'}`}>
                <p className={`text-[11px] uppercase tracking-wide mb-1 ${mutedText}`}>{isAr ? 'تاريخ الربط' : 'Linked'}</p>
                <p className={`text-sm font-semibold ${headingText}`}>
                  {selectedStudent.linkedAt ? new Date(selectedStudent.linkedAt).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>

            <h4 className={`text-sm font-bold mb-3 ${headingText}`}>
              {isAr ? 'الأداء الأخير' : 'Recent Performance'}
            </h4>
            {loadingScores ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className={`h-11 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/5'}`} />
                ))}
              </div>
            ) : studentScores.length === 0 ? (
              <p className={`text-sm ${mutedText}`}>
                {isAr ? 'لا توجد نتائج اختبارات مسجلة بعد.' : 'No recorded quiz results yet.'}
              </p>
            ) : (
              <div className="space-y-2">
                {studentScores.map((p) => {
                  const pct = Math.round((p.score / (p.total || 1)) * 100);
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                        isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/15'
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-semibold ${headingText}`}>{p.quizTitle}</p>
                        <p className={`text-[11px] ${mutedText}`}>{p.score}/{p.total}</p>
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-rose-500'
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Offline Exam Results */}
            <h4 className={`text-sm font-bold mb-3 mt-6 ${headingText}`}>
              {isAr ? 'الاختبارات الورقية' : 'Offline Exams'}
            </h4>
            {loadingExamResults ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className={`h-11 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/5'}`} />
                ))}
              </div>
            ) : studentExamResults.length === 0 ? (
              <p className={`text-sm ${mutedText}`}>
                {isAr ? 'لا توجد نتائج اختبارات ورقية بعد.' : 'No offline exam results yet.'}
              </p>
            ) : (
              <div className="space-y-2">
                {studentExamResults.map((result) => {
                  const percentage = Math.round((result.score / result.totalMarks) * 100);
                  return (
                    <div
                      key={result.id}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                        isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/15'
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-semibold ${headingText}`}>{result.examTitle}</p>
                        <p className={`text-[11px] ${mutedText}`}>
                          {new Date(result.updatedAt).toLocaleDateString()} · {result.score}/{result.totalMarks}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          percentage >= 70 ? 'text-emerald-600' : percentage >= 50 ? 'text-amber-600' : 'text-rose-500'
                        }`}
                      >
                        {percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Announcements */}
            <h4 className={`text-sm font-bold mb-3 mt-6 ${headingText}`}>
              {isAr ? 'الإعلانات' : 'Announcements'}
            </h4>
            {loadingAnnouncements ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/5'}`} />
                ))}
              </div>
            ) : studentAnnouncements.length === 0 ? (
              <p className={`text-sm ${mutedText}`}>
                {isAr ? 'لا توجد إعلانات بعد.' : 'No announcements yet.'}
              </p>
            ) : (
              <div className="space-y-3">
                {studentAnnouncements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className={`rounded-xl p-4 border ${
                      isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/15'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {announcement.pinned && <span className="text-sm">📌</span>}
                      <h5 className={`text-sm font-semibold ${headingText}`}>{announcement.title}</h5>
                    </div>
                    <p className={`text-xs ${mutedText} mb-2`}>
                      {announcement.author} · {new Date(announcement.createdAt).toLocaleDateString()}
                    </p>
                    <p className={`text-sm whitespace-pre-wrap ${bodyText}`}>{announcement.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FontStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&display=swap');
      .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
      .font-body { font-family: 'Manrope', sans-serif; }

      @keyframes orbit-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .orbit-ring { animation: orbit-spin 7s linear infinite; transform-origin: center; }

      @keyframes toast-in {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-toast-in { animation: toast-in 0.25s ease-out; }

      @media (prefers-reduced-motion: reduce) {
        .orbit-ring { animation: none; }
        .animate-toast-in { animation: none; }
      }
    `}</style>
  );
}