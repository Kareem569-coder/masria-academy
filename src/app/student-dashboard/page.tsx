'use client';

import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { arrayRemove, arrayUnion, doc, getDoc, collection, getDocs, addDoc, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getYouTubeEmbedUrl } from '@/lib/utils';
import { getAccessibleLessonsForStudent } from '@/lib/firestore/packageService';
import DashboardNavbar from '@/components/DashboardNavbar';
import GlassCard from '@/components/GlassCard';
import ActivityRenderer from '@/components/lesson/ActivityRenderer';
import { getLessonsForPackage, getOrderedActivities, isActivityCompletionRequired, isLessonCompleteForActivities } from '@/lib/lessonHelpers';
import type { Activity, Announcement, ExamResult, GradeEntry, Lesson, PerformanceRecord, UserProfile } from '@/types/models';
import PackageAccessCard from '@/components/student/PackageAccessCard';
import AccessCodeRedemption from '@/components/student/AccessCodeRedemption';

type TabType = 'dashboard' | 'lessons' | 'quiz' | 'grades' | 'announcements';

type StudentData = UserProfile;

const initialGrades: GradeEntry[] = [];

const PASSING_SCORE_PERCENT = 60;

export default function StudentDashboard() {
  const { user, logout, loading } = useAuth();
  const { language, dir } = useLanguage();
  const router = useRouter();
  
  // 🌟 State الوضع الليلي والصباحي
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [packageRefreshToken, setPackageRefreshToken] = useState(0);
  const [lessonRefreshToken, setLessonRefreshToken] = useState(0);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<{ id: string; name: string } | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);

  const [activeQuizLessonId, setActiveQuizLessonId] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number; passed: boolean } | null>(null);
  const [savingResult, setSavingResult] = useState(false);
  const [lessonActivityCompletion, setLessonActivityCompletion] = useState<Record<string, Set<string>>>({});
  const [activeActivityByLesson, setActiveActivityByLesson] = useState<Record<string, string | null>>({});

  const [gradesLog, setGradesLog] = useState<GradeEntry[]>(initialGrades);

  // ===== Exam Results (Offline Exams) =====
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [loadingExamResults, setLoadingExamResults] = useState(true);

  // ===== Announcements =====
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as StudentData;
            setStudentData(data);
            setCompletedLessons(new Set(data.completedLessons || []));
          }
        } catch (error) {
          console.error('Error fetching student data:', error);
        } finally {
          setLoadingData(false);
        }
      }
    };

    fetchStudentData();
  }, [user]);

  // ===== Fetch Exam Results =====
  useEffect(() => {
    const fetchExamResults = async () => {
      if (!user) return;
      setLoadingExamResults(true);
      try {
        const q = query(collection(db, 'exam_results'), where('studentId', '==', user.uid));
        const snapshot = await getDocs(q);
        const fetched: ExamResult[] = snapshot.docs.map((d) => {
          const data = d.data() as Partial<ExamResult>;
          return {
            id: d.id,
            examId: data.examId,
            examTitle: data.examTitle || '',
            studentId: data.studentId || user.uid,
            studentName: data.studentName,
            gradeLevel: data.gradeLevel,
            score: Number(data.score) || 0,
            totalMarks: Number(data.totalMarks) || 1,
            feedback: data.feedback || '',
            updatedAt: data.updatedAt || new Date().toISOString(),
          };
        });
        setExamResults(fetched);
      } catch (error) {
        console.error('Error fetching exam results:', error);
      } finally {
        setLoadingExamResults(false);
      }
    };

    fetchExamResults();
  }, [user]);

  // ===== Fetch Announcements =====
  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!studentData?.gradeLevel) return;
      setLoadingAnnouncements(true);
      try {
        const snapshot = await getDocs(collection(db, 'announcements'));
        const fetched: Announcement[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || '',
            content: data.content || '',
            gradeLevel: data.gradeLevel || '',
            author: data.author || 'MASRIA Instructor',
            pinned: data.pinned || false,
            createdAt: data.createdAt || new Date().toISOString(),
          };
        });
        // Filter by grade level or "All"
        const filtered = fetched.filter((a) => 
          a.gradeLevel === 'All' || a.gradeLevel === studentData.gradeLevel
        );
        // Sort by pinned first, then by date
        filtered.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setAnnouncements(filtered);
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setLoadingAnnouncements(false);
      }
    };

    fetchAnnouncements();
  }, [studentData?.gradeLevel]);

  useEffect(() => {
    const fetchLessons = async () => {
      setLoadingLessons(true);
      const gradeLevel = studentData?.gradeLevel || '';
      try {
        // Use package-aware lesson fetching
        const fetched = user ? await getAccessibleLessonsForStudent(user.uid, gradeLevel) : [];

        setLessons(fetched);
      } catch (error) {
        console.error('Error fetching lessons:', error);
        setLessons([]);
      } finally {
        setLoadingLessons(false);
      }
    };

    if (!loadingData) {
      fetchLessons();
    }
  }, [loadingData, studentData?.gradeLevel, packageRefreshToken, lessonRefreshToken, user]);

  // 🌟 1. تحسين جلب سجل الدرجات (تم تعريف isAr بالداخل لتجنب خطأ الترتيب)
  useEffect(() => {
    const fetchPerformance = async () => {
      if (!user) return;
      const isAr = language === 'ar'; // عرفناه هنا عشان يشتغل بدون أي إيرور
      try {
        const q = query(collection(db, 'performance'), where('studentId', '==', user.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const entries: GradeEntry[] = snapshot.docs.map((d) => {
            const data = d.data() as Partial<PerformanceRecord>;
            return {
              id: d.id,
              subject: data.subject || (isAr ? 'اختبار مادة علمية' : 'Science Quiz'),
              quiz: data.quizTitle || (isAr ? 'اختبار الدرس' : 'Lesson Quiz'),
              score: Math.round((Number(data.score) || 0) / (Number(data.total) || 1) * 100),
              date: (data.date || new Date().toISOString()).slice(0, 10),
              source: 'quiz',
            };
          });
          entries.sort((a, b) => (a.date < b.date ? 1 : -1));
          setGradesLog(entries);
        }
      } catch (error) {
        console.error('Error fetching performance history:', error);
      }
    };

    fetchPerformance();
  }, [user, language]); // استخدمنا language بدل isAr

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleCopyCode = () => {
    if (studentData?.linkCode) {
      navigator.clipboard.writeText(studentData.linkCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sortedLessons = useMemo(
    () => [...lessons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [lessons]
  );
  const displayedLessons = useMemo(
    () => selectedPackage ? getLessonsForPackage(sortedLessons, selectedPackage.id) : sortedLessons,
    [selectedPackage, sortedLessons]
  );

  const isLessonLockedAt = (index: number) => {
    if (index <= 0) return false;
    const prevLesson = sortedLessons[index - 1];
    return !completedLessons.has(prevLesson.id);
  };

  const syncLessonCompletion = async (lessonId: string, completed: boolean) => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        completedLessons: completed ? arrayUnion(lessonId) : arrayRemove(lessonId),
      });
    } catch (error) {
      console.error('Error saving lesson progress:', error);
    }
  };

  const toggleLessonCompletion = (lesson: Lesson) => {
    if (lesson.quiz) return;
    const completed = !completedLessons.has(lesson.id);

    setCompletedLessons((prev) => {
      const next = new Set(prev);
      if (!completed) {
        next.delete(lesson.id);
      } else {
        next.add(lesson.id);
      }
      return next;
    });
    void syncLessonCompletion(lesson.id, completed);
  };

  const progress = lessons.length > 0 ? Math.round((completedLessons.size / lessons.length) * 100) : 0;

  const quizzableLessons = useMemo(() => {
    return sortedLessons
      .map((lesson, idx) => ({ lesson, locked: isLessonLockedAt(idx) }))
      .filter(({ lesson, locked }) => !!lesson.quiz && !locked)
      .map(({ lesson }) => lesson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedLessons, completedLessons]);

  const markActivityCompleted = (lesson: Lesson, activityId: string) => {
    setLessonActivityCompletion((prev) => {
      const nextSet = new Set(prev[lesson.id] ?? []);
      nextSet.add(activityId);
      return {
        ...prev,
        [lesson.id]: nextSet,
      };
    });

    const nextCompletionSet = new Set(lessonActivityCompletion[lesson.id] ?? []);
    nextCompletionSet.add(activityId);

    if (isLessonCompleteForActivities(lesson.activities ?? [], nextCompletionSet)) {
      setCompletedLessons((prev) => {
        const next = new Set(prev);
        next.add(lesson.id);
        return next;
      });
      void syncLessonCompletion(lesson.id, true);
    }
  };

  const moveToActivity = (lesson: Lesson, activityId: string) => {
    setActiveActivityByLesson((prev) => ({
      ...prev,
      [lesson.id]: activityId,
    }));
  };

  const handleActivityContinue = (lesson: Lesson, activity: Activity) => {
    const ordered = getOrderedActivities(lesson.activities ?? []);
    const currentIndex = ordered.findIndex((item) => item.id === activity.id);

    if (isActivityCompletionRequired(activity)) {
      markActivityCompleted(lesson, activity.id);
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < ordered.length) {
      moveToActivity(lesson, ordered[nextIndex].id);
      return;
    }

    if (lesson.activities && lesson.activities.length > 0) {
      setCompletedLessons((prev) => {
        const next = new Set(prev);
        next.add(lesson.id);
        return next;
      });
      void syncLessonCompletion(lesson.id, true);
    }
  };

  const activeLesson = useMemo(
    () => lessons.find((l) => l.id === activeQuizLessonId) || null,
    [lessons, activeQuizLessonId]
  );
  const activeQuiz = activeLesson?.quiz || null;

  const startQuiz = (lessonId: string) => {
    const index = sortedLessons.findIndex((l) => l.id === lessonId);
    const lesson = sortedLessons[index];
    if (!lesson?.quiz || isLessonLockedAt(index)) return;
    setActiveQuizLessonId(lessonId);
    setQuizAnswers(lesson.quiz.questions.map(() => null));
    setQuizSubmitted(false);
    setQuizResult(null);
    setActiveTab('quiz');
  };

  const selectAnswer = (questionIndex: number, optionIndex: number) => {
    if (quizSubmitted) return;
    setQuizAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  };

  const allAnswered = quizAnswers.length > 0 && quizAnswers.every((a) => a !== null);

  // 🌟 2. دالة إرسال التقييم المحدثة لحل خطأ الـ undefined وربطها بالمعلم
  const submitQuiz = async () => {
    if (!allAnswered || !activeQuiz || !activeLesson) return;
    const isAr = language === 'ar'; // عرفناه هنا برضه ضماناً لعدم حدوث أي إيرور
    const score = quizAnswers.reduce<number>((acc, answer, idx) => {
      return answer === activeQuiz.questions[idx].correct ? acc + 1 : acc;
    }, 0);
    const total = activeQuiz.questions.length;
    const percent = Math.round((score / total) * 100);
    const passed = percent >= PASSING_SCORE_PERCENT;

    setQuizResult({ score, total, passed });
    setQuizSubmitted(true);

    if (passed) {
      setCompletedLessons((prev) => new Set(prev).add(activeLesson.id));
      void syncLessonCompletion(activeLesson.id, true);
    }

    const nowIso = new Date().toISOString();
    
    // 🛠️ حل المشكلة الأساسي: استخدام اسم الدرس كبديل في حال عدم وجود عنوان للاختبار
    const fallbackTitle = isAr ? activeLesson.title_ar : activeLesson.title_en;
    const quizTitle = (isAr ? activeQuiz.quizTitle_ar : activeQuiz.quizTitle_en) || fallbackTitle || (isAr ? 'اختبار قصير' : 'Quiz');
    const subjectName = (isAr ? activeLesson.title_ar : activeLesson.title_en) || fallbackTitle || 'Science';

    setGradesLog((prev) => [
      {
        id: `local-${Date.now()}`,
        subject: subjectName,
        quiz: quizTitle,
        score: percent,
        date: nowIso.slice(0, 10),
        source: 'quiz',
      },
      ...prev,
    ]);

    if (user) {
      setSavingResult(true);
      try {
        await addDoc(collection(db, 'performance'), {
          studentId: user.uid,
          studentName: studentData?.name || (isAr ? 'طالب غير مسمى' : 'Anonymous Student'),
          gradeLevel: studentData?.gradeLevel || null,
          lessonId: activeLesson.id,
          subject: subjectName,
          quizTitle: quizTitle,
          score: Number(score) || 0,
          total: Number(total) || 1,
          passed: Boolean(passed),
          date: nowIso,
        });
      } catch (error) {
        console.error('Error saving quiz result:', error);
      } finally {
        setSavingResult(false);
      }
    }
  };

  const retakeQuiz = () => {
    if (!activeQuiz) return;
    setQuizAnswers(activeQuiz.questions.map(() => null));
    setQuizSubmitted(false);
    setQuizResult(null);
  };

  const handleDownloadPdf = (lesson: Lesson) => {
    if (lesson.pdfUrl) {
      window.open(lesson.pdfUrl, '_blank');
    }
  };

  const isAr = language === 'ar';
  const isDark = theme === 'dark';

  if (loading || loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080c14] text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
          <div className="text-lg font-medium text-slate-100">
            {isAr ? 'جاري التحميل...' : 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  // 🌟 شاشة "حسابك قيد المراجعة" للطالب فقط
  if (studentData?.status === 'pending') {
    return (
      <div dir={dir} className="flex min-h-screen items-center justify-center bg-[#080c14] p-6 text-slate-100">
        <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 p-8 text-center shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.15),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_35%)]" />
          <div className="relative z-10">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10 text-4xl shadow-[0_0_24px_rgba(6,182,212,0.35)]">
              🔒
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">
              {isAr ? 'الحساب قيد المراجعة' : 'Account Under Review'}
            </h2>
            <p className="mb-4 text-sm font-semibold text-cyan-200">
              {isAr ? 'تم إنشاء حسابك بنجاح وهو بانتظار التفعيل' : 'Your account is currently awaiting activation'}
            </p>
            <p className="mb-6 text-sm leading-relaxed text-slate-300">
              {isAr
                ? 'أهلاً بك في MASRIA! يرجى الانتظار حتى تتم مراجعة حسابك وتفعيله لتتمكن من الوصول إلى المسارات والمحاضرات البرمجية.'
                : 'Welcome to MASRIA! Please wait while your account is reviewed and activated so you can access the coding tracks and learning modules.'}
            </p>
            <button
              onClick={handleLogout}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-3.5 font-semibold text-white shadow-lg shadow-cyan-500/15 transition hover:brightness-110"
            >
              {isAr ? 'تسجيل الخروج' : 'Log Out'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} className="relative min-h-screen overflow-x-hidden bg-[#080c14] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -right-16 top-1/3 h-[28rem] w-[28rem] rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <DashboardNavbar
        theme={theme}
        onThemeToggle={() => setTheme(isDark ? 'light' : 'dark')}
        onLogout={handleLogout}
        greeting={<><span>{isAr ? 'أهلاً،' : 'Welcome,'} </span><span className="font-semibold text-cyan-300">{studentData?.name || (isAr ? 'المتدرب' : 'Student')}</span></>}
        showThemeLabel
      />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero / Profile Card */}
        <GlassCard className="relative mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.15),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_35%)]" />
          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-bold text-white">
                  {studentData?.name || (isAr ? 'المتدرب' : 'Student')}
                </h2>
                {studentData?.gradeLevel && (
                  <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    {studentData.gradeLevel}
                  </span>
                )}
              </div>
              <p className="mb-5 text-base text-slate-300">{studentData?.email || 'student@example.com'}</p>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col">
                  <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {isAr ? 'مفتاح الدخول' : 'Access Key'}
                  </span>
                  <div className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2.5 shadow-[0_0_20px_rgba(6,182,212,0.12)]">
                    <span className="text-lg font-mono font-bold tracking-[0.2em] text-cyan-300">
                      {studentData?.linkCode || '········'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="mt-5 flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {isAr ? 'تم النسخ!' : 'Copied!'}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {isAr ? 'نسخ الكود' : 'Copy Code'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Tabs */}
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl">
          <div className="flex flex-col gap-2 p-2 sm:flex-row">
            {([
              { key: 'dashboard', en: 'Overview', ar: 'نظرة عامة' },
              { key: 'lessons', en: 'Learning Paths', ar: 'المسارات التعليمية' },
              { key: 'quiz', en: 'Coding Assessments', ar: 'تقييمات البرمجة' },
              { key: 'grades', en: 'Scoreboard', ar: 'لوحة الدرجات' },
              { key: 'announcements', en: 'Release Notes', ar: 'ملاحظات الإصدار' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`flex-1 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all duration-300 ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/15'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {isAr ? tab.ar : tab.en}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
              <div>
                <h3 className="mb-6 text-2xl font-bold text-white">
                  {isAr ? 'نظرة عامة على لوحة التحكم' : 'Dashboard Overview'}
                </h3>

                <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-[0_0_22px_rgba(6,182,212,0.08)]">
                    <h4 className="mb-1 text-lg font-semibold text-cyan-300">
                      {isAr ? 'مساري' : 'My Tracks'}
                    </h4>
                    <p className="mb-4 text-sm text-slate-300">
                      {isAr ? 'الوصول إلى محتواك التعليمي' : 'Access your learning modules'}
                    </p>
                    <div className="text-3xl font-bold text-white">{loadingLessons ? '···' : lessons.length}</div>
                    <div className="mt-1 text-xs text-slate-400">{isAr ? 'وحدات متاحة' : 'Available modules'}</div>
                  </div>

                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-6 shadow-[0_0_22px_rgba(34,211,238,0.08)]">
                    <h4 className="mb-1 text-lg font-semibold text-cyan-300">
                      {isAr ? 'التقدم' : 'Progress'}
                    </h4>
                    <p className="mb-4 text-sm text-slate-300">
                      {isAr ? 'تتبع تقدمك في التعلم' : 'Track your learning progress'}
                    </p>
                    <div className="text-3xl font-bold text-white">{progress}%</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {isAr ? 'الإكمال الكلي' : 'Overall completion'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-6 shadow-[0_0_22px_rgba(139,92,246,0.08)]">
                    <h4 className="mb-1 text-lg font-semibold text-violet-300">
                      {isAr ? 'التقييمات' : 'Assessments'}
                    </h4>
                    <p className="mb-4 text-sm text-slate-300">
                      {isAr ? 'شارك في تقييمات البرمجة' : 'Practice coding assessment challenges'}
                    </p>
                    <div className="text-3xl font-bold text-white">
                      {gradesLog.filter((g) => g.source === 'quiz').length}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{isAr ? 'محاولات' : 'Attempts'}</div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-200">
                      {isAr ? 'تقدم الدروس' : 'Lessons Progress'}
                    </span>
                    <span className="text-sm font-bold text-cyan-300">{progress}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full border border-white/10 bg-slate-950/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-500 shadow-[0_0_18px_rgba(6,182,212,0.45)] transition-all duration-700 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {completedLessons.size} / {lessons.length} {isAr ? 'دروس مكتملة' : 'lessons completed'}
                  </p>
                </div>

                {/* Package Access Section */}
                {user && studentData && (
                  <div className="mt-8 space-y-4">
                    <PackageAccessCard
                      studentId={user.uid}
                      gradeLevel={studentData.gradeLevel || ''}
                      refreshToken={packageRefreshToken}
                      onOpenPackageLessons={(packageId, packageName) => {
                        setSelectedPackage({ id: packageId, name: packageName });
                        setOpenLessonId(null);
                        setActiveTab('lessons');
                        setLessonRefreshToken((value) => value + 1);
                      }}
                    />
                    <AccessCodeRedemption
                      studentId={user.uid}
                      studentGradeLevel={studentData.gradeLevel || ''}
                      onRedeemSuccess={() => {
                        setPackageRefreshToken((value) => value + 1);
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* LESSONS TAB */}
            {activeTab === 'lessons' && (
              <div>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-2xl font-bold text-white">
                  {selectedPackage ? selectedPackage.name : isAr ? 'المسارات التعليمية' : 'Learning Paths'}
                </h3>
                {selectedPackage && <button type="button" onClick={() => { setSelectedPackage(null); setOpenLessonId(null); }} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:text-white">{isAr ? 'كل الدروس' : 'All lessons'}</button>}
                </div>
                <p className="mb-6 text-xs text-slate-400">
                  {selectedPackage ? (isAr ? 'دروس هذه الباقة مرتبة حسب تسلسلها التعليمي' : 'Lessons in this package, in learning order') : isAr ? 'أكمل الوحدات بالترتيب لفتح ما يليها' : 'Complete modules in order to unlock the next one'}
                </p>
                {loadingLessons ? (
                  <div className="text-sm text-slate-400">{isAr ? 'جاري تحميل الدروس...' : 'Loading lessons...'}</div>
                ) : displayedLessons.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-6 text-sm text-slate-400">
                    {selectedPackage ? (isAr ? 'لا توجد دروس متاحة في هذه الباقة حاليًا' : 'No accessible lessons are available in this package right now') : isAr ? 'لا توجد دروس متاحة حاليًا' : 'No lessons are available right now'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {displayedLessons.map((lesson, index) => {
                      const isDone = completedLessons.has(lesson.id);
                      const isOpen = openLessonId === lesson.id;
                      const locked = selectedPackage
                        ? index > 0 && !completedLessons.has(displayedLessons[index - 1].id)
                        : isLessonLockedAt(index);

                      const contentKind: 'video' | 'pdf' | 'quick' = lesson.videoUrl
                        ? 'video'
                        : lesson.pdfUrl
                        ? 'pdf'
                        : 'quick';
                      const contentLabel =
                        contentKind === 'video'
                          ? isAr ? 'فيديو' : 'Video'
                          : contentKind === 'pdf'
                          ? 'PDF'
                          : isAr ? 'مراجعة سريعة' : 'Quick Review';

                      return (
                        <div
                          key={lesson.id}
                          className={`rounded-2xl border p-5 transition-all duration-300 ${
                            locked
                              ? 'border-white/10 bg-slate-950/50 opacity-60'
                              : isOpen
                              ? 'border-cyan-400/35 bg-slate-900/80 shadow-[0_0_24px_rgba(6,182,212,0.12)]'
                              : 'border-white/10 bg-slate-900/60 hover:border-cyan-400/25'
                          }`}
                        >
                          <button
                            onClick={() => !locked && setOpenLessonId(isOpen ? null : lesson.id)}
                            disabled={locked}
                            className={`flex w-full items-center gap-3 text-start ${locked ? 'cursor-not-allowed' : ''}`}
                          >
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg ${
                                locked
                                  ? 'bg-slate-800 text-slate-500'
                                  : contentKind === 'video'
                                  ? 'bg-cyan-500/10 text-cyan-300'
                                  : contentKind === 'pdf'
                                  ? 'bg-violet-500/10 text-violet-300'
                                  : 'bg-indigo-500/10 text-indigo-300'
                              }`}
                            >
                              {locked ? (
                                '🔒'
                              ) : contentKind === 'video' ? (
                                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                </svg>
                              ) : contentKind === 'pdf' ? (
                                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M11.983 1.907a.75.75 0 00-1.292-.657L4.204 9.507a.75.75 0 00.543 1.243h4.222l-1.688 6.943a.75.75 0 001.292.657l6.487-8.257a.75.75 0 00-.543-1.243h-4.222l1.688-6.943z" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className={`text-xs uppercase tracking-[0.16em] ${locked ? 'text-slate-500' : 'text-slate-400'}`}>
                                {locked ? (isAr ? 'مقفل' : 'Locked') : `${contentLabel} · ${lesson.duration}`}
                              </span>
                              <div className={`truncate font-semibold ${locked ? 'text-slate-500' : 'text-white'}`}>
                                {isAr ? lesson.title_ar : lesson.title_en}
                              </div>
                            </div>
                            {isDone && !locked && (
                              <svg className="h-5 w-5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          {isOpen && !locked && (
                            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                              {lesson.videoUrl && (
                                <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-slate-950/80">
                                  {(() => {
                                    const embedUrl = getYouTubeEmbedUrl(lesson.videoUrl);
                                    if (!embedUrl) {
                                      return (
                                        <div className="flex h-full w-full items-center justify-center bg-slate-950/80">
                                          <p className="text-sm text-slate-400">
                                            {isAr ? 'رابط الفيديو غير صالح' : 'Invalid video URL'}
                                          </p>
                                        </div>
                                      );
                                    }
                                    return (
                                      <iframe
                                        src={embedUrl}
                                        title={isAr ? lesson.title_ar : lesson.title_en}
                                        className="h-full w-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                        referrerPolicy="strict-origin-when-cross-origin"
                                      />
                                    );
                                  })()}
                                </div>
                              )}

                              {!lesson.videoUrl && contentKind === 'video' && (
                                <div className="flex aspect-video items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/5 to-indigo-500/10">
                                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10">
                                    <svg className="ms-0.5 h-6 w-6 text-cyan-300" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M6 4l12 6-12 6V4z" />
                                    </svg>
                                  </div>
                                </div>
                              )}

                              {lesson.pdfUrl && (
                                <button
                                  onClick={() => handleDownloadPdf(lesson)}
                                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m-8 8h10a2 2 0 002-2V8a2 2 0 00-2-2h-3.586a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 0011.586 4H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  {isAr ? 'تحميل ملخص PDF' : 'Download PDF Summary'}
                                </button>
                              )}

                              {!lesson.videoUrl && !lesson.pdfUrl && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                                  <span className="text-sm font-medium text-slate-200">
                                    ⚡ {isAr ? 'جلسة مراجعة سريعة واختبار' : 'Quick Review & Quiz Session'}
                                  </span>
                                  {lesson.quiz && (
                                    <button
                                      onClick={() => startQuiz(lesson.id)}
                                      className="rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
                                    >
                                      {isAr ? 'ابدأ الاختبار' : 'Start Quiz'}
                                    </button>
                                  )}
                                </div>
                              )}

                              {lesson.quiz ? (
                                <div className="flex items-center justify-between gap-2 px-1 py-1">
                                  <span className="text-xs font-medium text-cyan-200">
                                    ⚠️ {isAr ? 'يجب اجتياز الاختبار لإتمام الدرس' : 'Must pass quiz to complete'}
                                  </span>
                                  {isDone && (
                                    <span className="shrink-0 text-xs text-emerald-300">
                                      {isAr ? 'مكتمل ✓' : 'Passed ✓'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <label className="flex cursor-pointer select-none items-center justify-between px-1 py-1">
                                  <span className="text-sm text-slate-300">
                                    {isAr ? 'وضع علامة كمكتمل' : 'Mark as Completed'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleLessonCompletion(lesson)}
                                    className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${
                                      isDone ? 'bg-gradient-to-r from-cyan-500 to-indigo-500' : 'border border-white/10 bg-slate-900/80'
                                    }`}
                                  >
                                    <span
                                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${
                                        isDone ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
                                      }`}
                                    />
                                  </button>
                                </label>
                              )}

                              {lesson.quiz && (lesson.videoUrl || lesson.pdfUrl) && (
                                <button
                                  onClick={() => startQuiz(lesson.id)}
                                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15"
                                >
                                  ✨ {isAr ? 'اختبر نفسك في هذا الدرس' : 'Take Lesson Quiz'}
                                </button>
                              )}

                              {lesson.activities && lesson.activities.length > 0 && (() => {
                                const orderedActivities = getOrderedActivities(lesson.activities);
                                const currentActivityId = activeActivityByLesson[lesson.id] ?? orderedActivities[0]?.id ?? null;
                                const currentIndex = currentActivityId
                                  ? orderedActivities.findIndex((activity) => activity.id === currentActivityId)
                                  : -1;
                                const currentActivity = currentIndex >= 0 ? orderedActivities[currentIndex] : null;
                                const completedIds = lessonActivityCompletion[lesson.id] ?? new Set<string>();
                                const lessonComplete = isLessonCompleteForActivities(orderedActivities, completedIds);

                                return (
                                  <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        {isAr ? 'المتصفح' : 'Lesson Player'}
                                      </div>
                                      {currentActivity && (
                                        <div className="text-xs text-cyan-300">
                                          {currentIndex + 1} / {orderedActivities.length}
                                        </div>
                                      )}
                                    </div>

                                    {currentActivity && (
                                      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                            {isAr ? 'نشاط' : 'Activity'}
                                          </div>
                                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                            {orderedActivities.map((activity, idx) => (
                                              <span
                                                key={activity.id}
                                                className={`inline-flex h-2.5 w-2.5 rounded-full ${
                                                  idx < currentIndex
                                                    ? 'bg-emerald-400'
                                                    : idx === currentIndex
                                                    ? 'bg-cyan-400'
                                                    : 'bg-slate-700'
                                                }`}
                                              />
                                            ))}
                                          </div>
                                        </div>

                                        <ActivityRenderer
                                          activity={currentActivity}
                                          language={language}
                                          isCompleted={completedIds.has(currentActivity.id)}
                                          onComplete={(activityId, passed, score, total) => {
                                            if (passed) {
                                              markActivityCompleted(lesson, activityId);
                                            }
                                            if (lessonComplete) {
                                              setCompletedLessons((prev) => new Set(prev).add(lesson.id));
                                              void syncLessonCompletion(lesson.id, true);
                                            }
                                            if (score === total && passed && currentIndex < orderedActivities.length - 1) {
                                              moveToActivity(lesson, orderedActivities[currentIndex + 1].id);
                                            }
                                          }}
                                          onContinue={(activityId) => {
                                            const activity = orderedActivities.find((item) => item.id === activityId);
                                            if (activity) {
                                              handleActivityContinue(lesson, activity);
                                            }
                                          }}
                                          onSkip={(activityId) => {
                                            const current = orderedActivities.find((item) => item.id === activityId);
                                            if (!current) return;
                                            const nextIndex = orderedActivities.findIndex((item) => item.id === current.id) + 1;
                                            if (nextIndex < orderedActivities.length) {
                                              moveToActivity(lesson, orderedActivities[nextIndex].id);
                                              return;
                                            }
                                            setCompletedLessons((prev) => new Set(prev).add(lesson.id));
                                            void syncLessonCompletion(lesson.id, true);
                                          }}
                                          initialQuizAnswers={quizAnswers}
                                        />

                                        <div className="mt-5 flex items-center justify-between gap-3">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const prevIndex = currentIndex - 1;
                                              if (prevIndex >= 0) {
                                                moveToActivity(lesson, orderedActivities[prevIndex].id);
                                              }
                                            }}
                                            disabled={currentIndex <= 0}
                                            className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                                          >
                                            {isAr ? 'السابق' : 'Previous'}
                                          </button>
                                          <div className="text-xs text-slate-400">
                                            {isAr ? 'إكمال النشاط' : 'Activity progress'}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (currentIndex < orderedActivities.length - 1) {
                                                moveToActivity(lesson, orderedActivities[currentIndex + 1].id);
                                              } else {
                                                setCompletedLessons((prev) => new Set(prev).add(lesson.id));
                                                void syncLessonCompletion(lesson.id, true);
                                              }
                                            }}
                                            className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white"
                                          >
                                            {currentIndex < orderedActivities.length - 1
                                              ? (isAr ? 'التالي' : 'Next')
                                              : (isAr ? 'إنهاء الدرس' : 'Finish lesson')}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* GRADES TAB */}
            {activeTab === 'grades' && (
              <div>
                <h3 className="mb-6 text-2xl font-bold text-white">
                  {isAr ? 'درجاتي' : 'My Grades'}
                </h3>

                {/* Offline Exam Results */}
                <div className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl">
                  <div className="p-6 pb-4 sm:p-8">
                    <h4 className="mb-1 text-lg font-bold text-white">
                      {isAr ? 'التقييمات الورقية' : 'Offline Assessments'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {isAr ? 'نتائج الاختبارات التي تم تقييمها من قبل المعلم' : 'Exam results graded by your instructor'}
                    </p>
                  </div>

                  {loadingExamResults ? (
                    <div className="space-y-2 px-6 pb-8 sm:px-8">{[0, 1].map((i) => (<div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />))}</div>
                  ) : examResults.length === 0 ? (
                    <div className="px-6 pb-8 text-sm text-slate-400 sm:px-8">
                      {isAr ? 'لا توجد نتائج اختبارات بعد' : 'No exam results yet'}
                    </div>
                  ) : (
                    <div className="px-6 sm:px-8 pb-8 space-y-4">
                      {examResults.map((result) => {
                        const percentage = Math.round((result.score / result.totalMarks) * 100);
                        return (
                          <div key={result.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                            <div className="mb-3 flex items-start justify-between gap-4">
                              <div>
                                <h5 className="font-semibold text-white">{result.examTitle}</h5>
                                <p className="text-xs text-slate-400">
                                  {new Date(result.updatedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className={`rounded-xl px-4 py-2 text-sm font-bold ${
                                percentage >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
                                percentage >= 50 ? 'bg-amber-500/10 text-amber-300' :
                                'bg-rose-500/10 text-rose-400'
                              }`}>
                                {percentage}%
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-300">
                                {result.score} / {result.totalMarks} {isAr ? 'درجة' : 'marks'}
                              </span>
                              {result.feedback && (
                                <span className="text-xs text-cyan-300">
                                  💬 {result.feedback}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quiz Grades History */}
                <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl">
                  <div className="p-6 pb-4 sm:p-8">
                    <h4 className="mb-1 text-lg font-bold text-white">
                      {isAr ? 'سجل التقييمات البرمجية' : 'Coding Quiz History'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {isAr ? 'نتائج اختبارات الدروس التفاعلية' : 'Interactive lesson quiz results'}
                    </p>
                  </div>

                  {gradesLog.length === 0 ? (
                    <div className="px-6 pb-8 text-sm text-slate-400 sm:px-8">
                      {isAr ? 'لا توجد نتائج اختبارات دروس بعد' : 'No quiz results yet'}
                    </div>
                  ) : (
                    <div className="px-6 sm:px-8 pb-8 space-y-3">
                      {gradesLog.map((grade) => {
                        const pct = Math.round((grade.score / (grade.source === 'quiz' ? 10 : 100)) * 100);
                        return (
                          <div key={grade.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5">
                            <div>
                              <p className="text-xs font-semibold text-white sm:text-sm">{grade.quiz}</p>
                              <p className="text-[11px] text-slate-400">{grade.date}</p>
                            </div>
                            <span className={`text-sm font-bold ${pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-300' : 'text-rose-400'}`}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ANNOUNCEMENTS TAB */}
            {activeTab === 'announcements' && (
              <div>
                <h3 className="mb-6 text-2xl font-bold text-white">
                  {isAr ? 'ملاحظات الإصدار' : 'Release Notes'}
                </h3>

                {loadingAnnouncements ? (
                  <div className="space-y-4">{[0, 1].map((i) => (<div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />))}</div>
                ) : announcements.length === 0 ? (
                  <div className="text-sm text-slate-400">
                    {isAr ? 'لا توجد إعلانات بعد' : 'No announcements yet'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {announcements.map((announcement) => (
                      <div key={announcement.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-5">
                        <div className="mb-3 flex items-start gap-3">
                          {announcement.pinned && (
                            <span className="text-lg text-cyan-300">📌</span>
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-white">{announcement.title}</h4>
                            <p className="text-xs text-slate-400">
                              {announcement.author} · {new Date(announcement.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-300">
                          {announcement.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* QUIZ TAB */}
            {activeTab === 'quiz' && (
              <div>
                {activeQuiz && activeLesson ? (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-2xl font-bold text-white">
                        {isAr ? activeQuiz.quizTitle_ar : activeQuiz.quizTitle_en}
                      </h3>
                      <button
                        onClick={() => setActiveQuizLessonId(null)}
                        className="text-xs text-slate-400 transition hover:text-white"
                      >
                        {isAr ? 'كل التقييمات' : 'All assessments'}
                      </button>
                    </div>
                    <p className="mb-6 text-sm text-slate-400">
                      {isAr
                        ? `أجب عن الأسئلة ثم أرسل إجاباتك — تحتاج ${PASSING_SCORE_PERCENT}% لإتمام الدرس`
                        : `Answer the questions, then submit — you need ${PASSING_SCORE_PERCENT}% to complete this lesson`}
                    </p>

                    <div className="space-y-6 mb-8">
                      {activeQuiz.questions.map((q, qIdx) => (
                        <div key={qIdx} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                          <div className="mb-4 font-semibold text-white">
                            {qIdx + 1}. {isAr ? q.ar : q.en}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {q.options.map((opt, optIdx) => {
                              const selected = quizAnswers[qIdx] === optIdx;
                              const isCorrectOpt = optIdx === q.correct;
                            let stateClasses = 'border-white/10 bg-slate-900/80 text-slate-200 hover:border-cyan-400/35 hover:bg-slate-800';

                            if (quizSubmitted) {
                              if (quizResult?.passed) {
                                if (isCorrectOpt) {
                                  stateClasses = 'border-emerald-400/60 bg-emerald-500/10 text-emerald-300 font-bold';
                                } else if (selected && !isCorrectOpt) {
                                  stateClasses = 'border-rose-400/60 bg-rose-500/10 text-rose-300';
                                } else {
                                  stateClasses = 'border-white/10 bg-slate-950/60 text-slate-500';
                                }
                              } else {
                                if (selected && !isCorrectOpt) {
                                  stateClasses = 'border-rose-400/60 bg-rose-500/10 text-rose-300 font-semibold';
                                } else {
                                  stateClasses = 'border-white/10 bg-slate-950/60 text-slate-500';
                                }
                              }
                            } else if (selected) {
                              stateClasses = 'border-cyan-400/60 bg-cyan-500/10 text-white';
                            }
                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => selectAnswer(qIdx, optIdx)}
                                  disabled={quizSubmitted}
                                  className={`px-4 py-3 rounded-xl border text-start text-sm font-medium transition-all duration-300 ${stateClasses}`}
                                >
                                  {isAr ? opt.ar : opt.en}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {!quizSubmitted ? (
                      <button
                        onClick={submitQuiz}
                        disabled={!allAnswered}
                        className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-8 py-3.5 font-semibold text-white shadow-lg shadow-cyan-500/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                      >
                        {isAr ? 'إرسال الاختبار' : 'Submit Quiz'}
                      </button>
                    ) : (
                      quizResult && (
                        <div className="space-y-3 mb-2">
                          <div className="flex flex-col sm:flex-row items-center gap-5">
                            <div
                              className={`flex items-center gap-3 rounded-2xl border px-6 py-4 ${
                                quizResult.passed
                                  ? 'border-emerald-400/40 bg-emerald-500/10'
                                  : 'border-rose-400/40 bg-rose-500/10'
                              } ${quizResult.passed ? 'animate-pulse' : ''}`}
                            >
                              <span className="text-3xl">
                                {quizResult.passed ? '🏆' : '🔬'}
                              </span>
                              <div>
                                <div className="text-xl font-bold text-white">
                                  {quizResult.score} / {quizResult.total}
                                </div>
                                <div className="text-xs text-slate-300">
                                  {savingResult
                                    ? isAr ? 'جارٍ حفظ النتيجة...' : 'Saving your result...'
                                    : isAr ? 'نتيجتك في الاختبار' : 'Your quiz score'}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={retakeQuiz}
                              className="rounded-2xl border border-white/10 bg-slate-950/80 px-6 py-3 font-medium text-slate-100 transition hover:border-cyan-400/35 hover:text-white"
                            >
                              {isAr ? 'إعادة المحاولة' : 'Retake Quiz'}
                            </button>
                          </div>
                        <p className={`text-sm font-medium ${quizResult.passed ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {quizResult.passed
                            ? '🎉 ' + (isAr ? 'ممتاز! تم فتح الدرس التالي وظهرت الإجابات الصحيحة.' : 'Awesome! Lesson complete — next lesson unlocked!')
                            : isAr
                              ? `⚠️ لم تجتز الاختبار (${quizResult.score}/${quizResult.total}). راجع الأسئلة المحددة باللون الأحمر ثم حاول مرة أخرى.`
                              : `⚠️ You didn't pass yet. Review the highlighted answers in red, then retry.`}
                        </p>
                        </div>
                      )
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="mb-2 text-2xl font-bold text-white">
                      {isAr ? 'التقييمات البرمجية' : 'Coding Assessments'}
                    </h3>
                    <p className="mb-6 text-sm text-slate-400">
                      {isAr ? 'اختر وحدة لبدء تقييمها' : 'Pick a module to start the assessment'}
                    </p>

                    {quizzableLessons.length === 0 ? (
                      <p className="mb-8 text-sm text-slate-400">
                        {isAr
                          ? 'لا توجد اختبارات متاحة الآن — أكمل الدرس الحالي لفتح المزيد.'
                          : 'No quizzes available right now — finish your current lesson to unlock more.'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                        {quizzableLessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 transition-all duration-300 hover:border-cyan-400/25"
                          >
                            <div className="mb-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                              {isAr ? lesson.title_ar : lesson.title_en}
                            </div>
                            <div className="mb-4 font-semibold text-white">
                              {isAr ? lesson.quiz?.quizTitle_ar : lesson.quiz?.quizTitle_en}
                            </div>
                            <button
                              onClick={() => startQuiz(lesson.id)}
                              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                            >
                              {isAr ? 'ابدأ التقييم' : 'Start Assessment'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Grades history */}
                <div className="mt-10">
                  <h4 className="mb-4 text-xl font-bold text-white">
                    {isAr ? 'سجل الدرجات' : 'Grade History'}
                  </h4>
                  <div className="space-y-3">
                    {gradesLog.map((grade) => (
                      <div
                        key={grade.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white">{grade.subject}</div>
                          <div className="truncate text-sm text-slate-400">{grade.quiz}</div>
                          <div className="text-xs text-slate-500">{grade.date}</div>
                        </div>
                        <div
                          className={`shrink-0 text-2xl font-bold sm:text-3xl ${
                            grade.score >= 90 ? 'text-emerald-400' : grade.score >= 80 ? 'text-cyan-300' : 'text-rose-400'
                          }`}
                        >
                          {grade.score}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

