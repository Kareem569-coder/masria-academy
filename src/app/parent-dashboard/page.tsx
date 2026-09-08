'use client';

import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DashboardNavbar from '@/components/DashboardNavbar';
import GlassCard from '@/components/GlassCard';
import { getErrorMessage } from '@/types/models';
import type { Announcement, ExamResult, LinkedStudent, PerformanceRecord, UserProfile } from '@/types/models';

type Theme = 'light' | 'dark';

interface ToastItem {
  id: string;
  type: 'success' | 'error';
  message: string;
}

export default function ParentDashboard() {
  const { user, logout, loading, linkStudent } = useAuth();
  const { language, dir } = useLanguage();
  const router = useRouter();
  const isAr = language === 'ar';

  const [theme, setTheme] = useState<Theme>('light');
  const isDark = theme === 'dark';

  const [parentData, setParentData] = useState<UserProfile | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [linkCode, setLinkCode] = useState('');
  const [linking, setLinking] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<LinkedStudent | null>(null);
  const [studentScores, setStudentScores] = useState<PerformanceRecord[]>([]);
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
          setParentData(userDoc.data() as UserProfile);
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
          setParentData(snap.data() as UserProfile);
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
    } catch (error: unknown) {
      pushToast(
        'error',
        getErrorMessage(error, isAr ? 'فشل ربط الطالب. تحقق من الكود وحاول مرة أخرى.' : 'Failed to link student. Check the code and try again.')
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
      const fetched: PerformanceRecord[] = snapshot.docs.map((d) => {
        const data = d.data() as Partial<PerformanceRecord>;
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
        const data = d.data() as Partial<ExamResult>;
        return {
          id: d.id,
          examId: data.examId,
          examTitle: data.examTitle || '',
          studentId: data.studentId || student.uid,
          studentName: data.studentName,
          gradeLevel: data.gradeLevel,
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
          author: data.author || 'Teacher MASRIA',
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

  // ===== Theme-derived class helpers =====
  const pageBg = 'bg-[#080c14]';
  const cardBg = 'border-white/10 bg-slate-900/60';
  const cardShadow = 'shadow-[0_24px_80px_rgba(2,6,23,0.5)]';
  const mutedText = 'text-slate-400';
  const inputBg = 'border-white/10 bg-slate-950/70 text-slate-100 placeholder:text-slate-500';

  if (loading || !user || loadingData) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${pageBg}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
          <div className="text-lg font-medium text-slate-100">
            {isAr ? 'جاري التحميل...' : 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} className={`relative min-h-screen overflow-x-hidden bg-[#080c14] text-slate-100`}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -right-16 top-1/3 h-[28rem] w-[28rem] rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
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

      <DashboardNavbar
        theme={theme}
        onThemeToggle={() => setTheme(isDark ? 'light' : 'dark')}
        onLogout={handleLogout}
        portalLabel="MASRIA Parent Portal"
        portalSubLabel="بوابة المتابعة الأكاديمية (م. كريم عزالدين)"
      />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ===== Greeting / School Branding ===== */}
        <GlassCard className={`rounded-[2rem] border p-6 backdrop-blur-xl sm:p-8 ${cardBg} ${cardShadow}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                MASRIA Parent Portal | بوابة المتابعة الأكاديمية (م. كريم عزالدين)
              </p>
              <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">
                {isAr
                  ? `مرحبًا، ${user?.displayName || parentData?.name || 'ولي الأمر'}`
                  : `Welcome, ${user?.displayName || parentData?.name || 'Parent'}`}
              </h2>
              <p className="text-sm text-slate-300">{user?.email}</p>
            </div>
            <div className="shrink-0 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-5 py-4 text-center shadow-[0_0_22px_rgba(6,182,212,0.08)]">
              <p className="text-2xl font-bold text-white">{linkedStudents.length}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                {isAr ? 'طلاب مرتبطون' : 'Linked Students'}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* ===== Link Student Form ===== */}
        <GlassCard className={`rounded-[2rem] border p-6 backdrop-blur-xl sm:p-8 ${cardBg} ${cardShadow}`}>
          <h3 className="mb-1.5 text-xl font-bold text-white sm:text-2xl">
            {isAr ? 'ربط حساب طالب' : 'Link a Student Account'}
          </h3>
          <p className="mb-6 text-sm text-slate-300">
            {isAr
              ? 'أدخل رمز الربط الخاص بابنك لربط حسابه بحسابك.'
              : "Enter your child's unique link code to connect their account with yours."}
          </p>

          <form onSubmit={handleLinkStudent} className="flex flex-col gap-4 sm:flex-row">
            <input
              type="text"
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
              placeholder={isAr ? 'أدخل رمز الربط (مثال: MAS-8492)' : 'Enter link code (e.g., MAS-8492)'}
              maxLength={8}
              dir="ltr"
              className={`flex-1 rounded-2xl border px-4 py-3 font-mono tracking-wider outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-500/10 ${inputBg}`}
            />
            <button
              type="submit"
              disabled={linking || !linkCode.trim()}
              className="rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-8 py-3 font-semibold text-white shadow-lg shadow-cyan-500/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {linking ? (isAr ? 'جارٍ الربط...' : 'Linking...') : (isAr ? 'ربط الطالب' : 'Link Student')}
            </button>
          </form>
        </GlassCard>

        {/* ===== Linked Students Grid ===== */}
        <GlassCard className={`rounded-[2rem] border p-6 backdrop-blur-xl sm:p-8 ${cardBg} ${cardShadow}`}>
          <h3 className="mb-6 text-xl font-bold text-white sm:text-2xl">
            {isAr ? 'الطلاب المرتبطون' : 'Linked Students'}
          </h3>

          {linkedStudents.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {linkedStudents.map((student) => (
                <button
                  key={student.uid}
                  onClick={() => openStudentModal(student)}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/25"
                >
                  <div className="mb-4 flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 via-indigo-500 to-violet-500 text-lg font-bold text-white">
                      {student.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate font-semibold text-white">{student.name}</h4>
                      <p className="truncate text-xs text-slate-400">{student.email}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300">
                    {isAr ? 'تاريخ الربط: ' : 'Linked on: '}
                    {student.linkedAt ? new Date(student.linkedAt).toLocaleDateString() : '—'}
                  </p>
                  <span className="mt-3 inline-block text-xs font-semibold text-cyan-300">
                    {isAr ? 'عرض التفاصيل ←' : 'View details →'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center">
              <div className="mb-2 text-lg font-semibold text-white">
                {isAr ? 'لا يوجد طلاب مرتبطون بعد' : 'No students linked yet'}
              </div>
              <p className="text-sm text-slate-400">
                {isAr
                  ? 'استخدم النموذج أعلاه لربط حساب ابنك باستخدام رمز الربط الخاص به.'
                  : "Use the form above to link your child's account using their unique link code."}
              </p>
            </div>
          )}
        </GlassCard>
      </main>

      {/* ===== Student Detail Modal ===== */}
      {selectedStudent && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeStudentModal} />
          <div
            className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl sm:max-w-lg sm:rounded-[2rem] sm:p-8"
          >
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 via-indigo-500 to-violet-500 text-lg font-bold text-white">
                  {selectedStudent.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedStudent.name}</h3>
                  <p className="text-sm text-slate-300">{selectedStudent.email}</p>
                </div>
              </div>
              <button
                onClick={closeStudentModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 text-slate-200"
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                ✕
              </button>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3.5">
                <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">{isAr ? 'الصف' : 'Grade'}</p>
                <p className="text-sm font-semibold text-white">{selectedStudent.gradeLevel || '—'}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3.5">
                <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">{isAr ? 'تاريخ الربط' : 'Linked'}</p>
                <p className="text-sm font-semibold text-white">
                  {selectedStudent.linkedAt ? new Date(selectedStudent.linkedAt).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>

            <h4 className="mb-3 text-sm font-bold text-white">
              {isAr ? 'الأداء الأخير' : 'Recent Performance'}
            </h4>
            {loadingScores ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-11 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            ) : studentScores.length === 0 ? (
              <p className="text-sm text-slate-400">
                {isAr ? 'لا توجد نتائج اختبارات مسجلة بعد.' : 'No recorded quiz results yet.'}
              </p>
            ) : (
              <div className="space-y-2">
                {studentScores.map((p) => {
                  const pct = Math.round((p.score / (p.total || 1)) * 100);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{p.quizTitle}</p>
                        <p className="text-[11px] text-slate-400">{p.score}/{p.total}</p>
                      </div>
                      <span
                        className={`text-sm font-bold ${pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-300' : 'text-rose-400'}`}
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <h4 className="mb-3 mt-6 text-sm font-bold text-white">
              {isAr ? 'الاختبارات الورقية' : 'Offline Exams'}
            </h4>
            {loadingExamResults ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-11 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            ) : studentExamResults.length === 0 ? (
              <p className="text-sm text-slate-400">
                {isAr ? 'لا توجد نتائج اختبارات ورقية بعد.' : 'No offline exam results yet.'}
              </p>
            ) : (
              <div className="space-y-2">
                {studentExamResults.map((result) => {
                  const percentage = Math.round((result.score / result.totalMarks) * 100);
                  return (
                    <div
                      key={result.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{result.examTitle}</p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(result.updatedAt).toLocaleDateString()} · {result.score}/{result.totalMarks}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-bold ${percentage >= 70 ? 'text-emerald-400' : percentage >= 50 ? 'text-amber-300' : 'text-rose-400'}`}
                      >
                        {percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <h4 className="mb-3 mt-6 text-sm font-bold text-white">
              {isAr ? 'الإعلانات' : 'Announcements'}
            </h4>
            {loadingAnnouncements ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            ) : studentAnnouncements.length === 0 ? (
              <p className="text-sm text-slate-400">
                {isAr ? 'لا توجد إعلانات بعد.' : 'No announcements yet.'}
              </p>
            ) : (
              <div className="space-y-3">
                {studentAnnouncements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="rounded-xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="mb-2 flex items-start gap-2">
                      {announcement.pinned && <span className="text-sm">📌</span>}
                      <h5 className="text-sm font-semibold text-white">{announcement.title}</h5>
                    </div>
                    <p className="mb-2 text-xs text-slate-400">
                      {announcement.author} · {new Date(announcement.createdAt).toLocaleDateString()}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-slate-300">{announcement.content}</p>
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
