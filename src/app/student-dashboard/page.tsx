'use client';

import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getYouTubeEmbedUrl } from '@/lib/utils';

interface StudentData {
  name: string;
  email: string;
  linkCode: string;
  gradeLevel?: string;
}

type TabType = 'dashboard' | 'lessons' | 'quiz' | 'grades' | 'announcements';

interface QuizOption {
  en: string;
  ar: string;
}

interface QuizQuestion {
  en: string;
  ar: string;
  options: QuizOption[];
  correct: number;
}

interface LessonQuiz {
  quizTitle_en: string;
  quizTitle_ar: string;
  questions: QuizQuestion[];
}

interface Lesson {
  id: string;
  title_en: string;
  title_ar: string;
  type: 'video' | 'pdf' | 'quiz_only' | 'hybrid';
  duration: string;
  gradeLevel: string;
  order?: number;
  videoUrl?: string;
  pdfUrl?: string;
  quiz?: LessonQuiz;
}

interface GradeEntry {
  id: string;
  subject: string;
  quiz: string;
  score: number;
  date: string;
  source: 'legacy' | 'quiz';
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

const initialGrades: GradeEntry[] = [];

const PASSING_SCORE_PERCENT = 60;

function buildFallbackLessons(gradeLevel: string): Lesson[] {
  return [
    {
      id: 'fallback-1',
      title_en: 'Introduction to Physics',
      title_ar: 'مقدمة في الفيزياء',
      type: 'video',
      duration: '45 min',
      gradeLevel,
      order: 1,
      videoUrl: undefined,
      quiz: {
        quizTitle_en: 'Physics Check',
        quizTitle_ar: 'اختبار الفيزياء',
        questions: [
          {
            en: 'What force pulls objects toward Earth?',
            ar: 'ما هي القوة التي تجذب الأجسام نحو الأرض؟',
            options: [
              { en: 'Magnetism', ar: 'المغناطيسية' },
              { en: 'Gravity', ar: 'الجاذبية' },
              { en: 'Friction', ar: 'الاحتكاك' },
              { en: 'Tension', ar: 'الشد' },
            ],
            correct: 1,
          },
        ],
      },
    },
    {
      id: 'fallback-2',
      title_en: 'Chemistry Basics',
      title_ar: 'أساسيات الكيمياء',
      type: 'pdf',
      duration: '30 min',
      gradeLevel,
      order: 2,
      pdfUrl: '#',
      quiz: {
        quizTitle_en: 'Chemistry Check',
        quizTitle_ar: 'اختبار الكيمياء',
        questions: [
          {
            en: 'What is the chemical symbol for water?',
            ar: 'ما هو الرمز الكيميائي للماء؟',
            options: [
              { en: 'H2O', ar: 'H2O' },
              { en: 'CO2', ar: 'CO2' },
              { en: 'O2', ar: 'O2' },
              { en: 'NaCl', ar: 'NaCl' },
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      id: 'fallback-3',
      title_en: 'Quick Cell Review',
      title_ar: 'مراجعة سريعة للخلية',
      type: 'quiz_only',
      duration: '10 min',
      gradeLevel,
      order: 3,
      quiz: {
        quizTitle_en: 'Biology Check',
        quizTitle_ar: 'اختبار الأحياء',
        questions: [
          {
            en: 'What is the basic unit of life?',
            ar: 'ما هي الوحدة الأساسية للحياة؟',
            options: [
              { en: 'Atom', ar: 'الذرة' },
              { en: 'Molecule', ar: 'الجزيء' },
              { en: 'Cell', ar: 'الخلية' },
              { en: 'Tissue', ar: 'النسيج' },
            ],
            correct: 2,
          },
        ],
      },
    },
    {
      id: 'fallback-4',
      title_en: 'Earth Science',
      title_ar: 'علوم الأرض',
      type: 'pdf',
      duration: '25 min',
      gradeLevel,
      order: 4,
      pdfUrl: '#',
    },
    {
      id: 'fallback-5',
      title_en: 'Astronomy 101',
      title_ar: 'علم الفلك 101',
      type: 'video',
      duration: '50 min',
      gradeLevel,
      order: 5,
      videoUrl: undefined,
    },
    {
      id: 'fallback-6',
      title_en: 'Environmental Science',
      title_ar: 'العلوم البيئية',
      type: 'pdf',
      duration: '35 min',
      gradeLevel,
      order: 6,
      pdfUrl: '#',
    },
  ];
}

export default function StudentDashboard() {
  const { user, logout, loading } = useAuth();
  const { language, setLanguage, dir } = useLanguage();
  const router = useRouter();
  
  // 🌟 State الوضع الليلي والصباحي
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);

  const [activeQuizLessonId, setActiveQuizLessonId] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number; passed: boolean } | null>(null);
  const [savingResult, setSavingResult] = useState(false);

  const [gradesLog, setGradesLog] = useState<GradeEntry[]>(initialGrades);

  // ===== Exam Results (Offline Exams) =====
  const [examResults, setExamResults] = useState<any[]>([]);
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
            setStudentData(userDoc.data() as StudentData);
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
        const fetched = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
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
            author: data.author || 'Teacher Mariam 👑',
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
        const snapshot = await getDocs(collection(db, 'lessons'));
        const fetched: Lesson[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Lesson, 'id'>),
        }));
        const matching = gradeLevel
          ? fetched.filter((lesson) => lesson.gradeLevel === gradeLevel)
          : fetched;

        if (matching.length > 0) {
          setLessons(matching);
        } else {
          setLessons(buildFallbackLessons(gradeLevel || 'Grade 4'));
        }
      } catch (error) {
        console.error('Error fetching lessons:', error);
        setLessons(buildFallbackLessons(gradeLevel || 'Grade 4'));
      } finally {
        setLoadingLessons(false);
      }
    };

    if (!loadingData) {
      fetchLessons();
    }
  }, [loadingData, studentData?.gradeLevel]);

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
            const data = d.data() as any;
            return {
              id: d.id,
              subject: data.subject || (isAr ? 'اختبار مادة علمية' : 'Science Quiz'),
              quiz: data.quizTitle || (isAr ? 'اختبار الدرس' : 'Lesson Quiz'),
              score: Math.round((data.score / (data.total || 1)) * 100),
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

  const isLessonLockedAt = (index: number) => {
    if (index <= 0) return false;
    const prevLesson = sortedLessons[index - 1];
    return !completedLessons.has(prevLesson.id);
  };

  const toggleLessonCompletion = (lesson: Lesson) => {
    if (lesson.quiz) return;
    setCompletedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lesson.id)) {
        next.delete(lesson.id);
      } else {
        next.add(lesson.id);
      }
      return next;
    });
  };

  const progress = lessons.length > 0 ? Math.round((completedLessons.size / lessons.length) * 100) : 0;

  const quizzableLessons = useMemo(() => {
    return sortedLessons
      .map((lesson, idx) => ({ lesson, locked: isLessonLockedAt(idx) }))
      .filter(({ lesson, locked }) => !!lesson.quiz && !locked)
      .map(({ lesson }) => lesson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedLessons, completedLessons]);

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

  const OrbitMark = ({ size = 40 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <g className="orbit-ring">
        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#C9A876" strokeWidth="1.6" transform="rotate(0 28 28)" fill="none" />
        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#8C3B3F" strokeWidth="1.6" transform="rotate(60 28 28)" fill="none" />
        <ellipse cx="28" cy="28" rx="24" ry="9" stroke="#5C1A24" strokeWidth="1.6" transform="rotate(120 28 28)" fill="none" />
      </g>
      <circle cx="28" cy="28" r="6.5" fill="url(#navNucleusGlow)" />
      <defs>
        <radialGradient id="navNucleusGlow" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#E7827E" />
          <stop offset="100%" stopColor="#5C1A24" />
        </radialGradient>
      </defs>
    </svg>
  );

  if (loading || loadingData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#1A0609]' : 'bg-[#F8F1E7]'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-[#C9A876]/25 border-t-[#8C3B3F] animate-spin" />
          <div className={`${isDark ? 'text-[#F3E4D6]' : 'text-[#5C1A24]'} text-lg font-medium font-body`}>
            {isAr ? 'جاري التحميل...' : 'Loading...'}
          </div>
        </div>
        <FontStyles />
      </div>
    );
  }

  // 🌟 شاشة "حسابك قيد المراجعة" للطالب فقط
  if (status === 'pending') {
    return (
      <div dir={dir} className={`min-h-screen flex items-center justify-center p-6 ${isDark ? 'bg-[#1A0609]' : 'bg-[#F8F1E7]'} font-body transition-colors duration-500`}>
        <FontStyles />
        <div className={`max-w-md w-full ${isDark ? 'bg-[#2A0D12]/80 border-[#C9A876]/30 text-[#F3E4D6]' : 'bg-white/80 border-[#C9A876]/30 text-[#2E1013]'} backdrop-blur-xl border rounded-3xl p-8 text-center shadow-xl shadow-[#5C1A24]/5 relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#E7C3B6]/10 via-transparent to-[#C9A876]/10 pointer-events-none" />
          <div className="w-20 h-20 mx-auto mb-5 bg-[#5C1A24]/10 border border-[#C9A876]/40 rounded-full flex items-center justify-center text-4xl shadow-inner">
            🔒
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] bg-clip-text text-transparent mb-2 font-display">
            {isAr ? 'الحساب قيد المراجعة' : 'Account Under Review'}
          </h2>
          <p className="text-sm font-semibold text-[#8C3B3F] mb-4">
            {isAr ? 'تم إنشاء حسابك بنجاح وهو بانتظار التفعيل' : 'Your account is currently awaiting activation'}
          </p>
          <p className={`text-sm ${isDark ? 'text-[#F3E4D6]/70' : 'text-gray-600'} mb-6 leading-relaxed`}>
            {isAr
              ? 'أهلاً بك في Nucleus! يرجى الانتظار حتى تقوم إدارة مدرسة مريم محمد بمراجعة حسابك وتفعيله لتتمكن من الوصول للدروس والاختبارات.'
              : 'Welcome to Nucleus! Please wait until Mariam Mohamed Science School administration reviews and activates your account to access lessons and quizzes.'}
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-3.5 bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] text-white rounded-2xl font-semibold shadow-md hover:brightness-110 transition-all"
          >
            {isAr ? 'تسجيل الخروج' : 'Log Out'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} className={`min-h-screen relative overflow-x-hidden font-body transition-colors duration-500 ${isDark ? 'bg-[#1A0609] text-[#F3E4D6]' : 'bg-[#F8F1E7] text-[#2E1013]'}`}>
      <FontStyles />

      {/* Ambient warm field */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-12%] start-[-8%] w-[28rem] h-[28rem] rounded-full blur-[120px] ${isDark ? 'bg-[#C9A876]/10' : 'bg-[#C9A876]/15'}`} />
        <div className={`absolute bottom-[-12%] end-[5%] w-[26rem] h-[26rem] rounded-full blur-[120px] ${isDark ? 'bg-[#8C3B3F]/15' : 'bg-[#8C3B3F]/10'}`} />
        <div className={`absolute top-[30%] end-[20%] w-[20rem] h-[20rem] rounded-full blur-[120px] ${isDark ? 'bg-[#5C1A24]/20' : 'bg-[#E7C3B6]/25'}`} />
      </div>

      {/* Nav */}
      <nav className={`relative z-10 backdrop-blur-xl border-b transition-colors duration-500 ${isDark ? 'bg-[#1A0609]/70 border-[#C9A876]/20' : 'bg-white/70 border-[#C9A876]/25'}`}>
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
                <span className="text-[11px] text-[#8C3B3F]/70 tracking-wide block leading-tight">
                  {isAr ? 'منصة مريم محمد لعلوم الحياة' : 'Maryam Mohamed Science School'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className={`hidden md:inline text-sm ${isDark ? 'text-[#F3E4D6]/70' : 'text-[#5C1A24]/70'}`}>
                {isAr ? 'أهلاً،' : 'Welcome,'} <span className={`${isDark ? 'text-[#C9A876]' : 'text-[#5C1A24]'} font-semibold`}>{studentData?.name || (isAr ? 'الطالب' : 'Student')}</span>
              </span>

              {/* 🌟 زرار التبديل صباحي ومسائي */}
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className={`p-2 sm:px-3 sm:py-2 rounded-full border text-xs sm:text-sm font-medium transition-all duration-300 flex items-center gap-1.5 ${isDark ? 'bg-[#2A0D12] border-[#C9A876]/30 text-[#C9A876] hover:bg-[#C9A876]/20' : 'bg-[#5C1A24]/5 border-[#C9A876]/30 text-[#5C1A24] hover:bg-[#C9A876]/15'}`}
                title="Toggle Theme"
              >
                {isDark ? '☀️' : '🌙'}
                <span className="hidden sm:inline">{isDark ? (isAr ? 'صباحي' : 'Light') : (isAr ? 'ليلي' : 'Dark')}</span>
              </button>

              <button
                onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                className={`px-3 py-2 border rounded-full text-xs sm:text-sm font-medium transition-all duration-300 ${isDark ? 'bg-[#2A0D12] border-[#C9A876]/30 text-[#F3E4D6] hover:bg-[#C9A876]/20' : 'bg-[#5C1A24]/5 border-[#C9A876]/30 text-[#5C1A24] hover:bg-[#C9A876]/15'}`}
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

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero / Profile Card */}
        <div className={`backdrop-blur-xl rounded-[2rem] p-8 border shadow-xl transition-colors duration-500 mb-8 relative overflow-hidden ${isDark ? 'bg-[#2A0D12]/60 border-[#C9A876]/30 shadow-black/20' : 'bg-white/80 border-[#C9A876]/25 shadow-[#5C1A24]/5'}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#E7C3B6]/15 via-transparent to-[#C9A876]/10 pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h2 className={`font-display text-3xl font-bold ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                  {studentData?.name || (isAr ? 'الطالب' : 'Student')}
                </h2>
                {studentData?.gradeLevel && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-[#5C1A24]/10 to-[#C9A876]/20 border border-[#C9A876]/40 ${isDark ? 'text-[#C9A876]' : 'text-[#5C1A24]'} shadow-[0_0_16px_rgba(201,168,118,0.15)]`}>
                    {studentData.gradeLevel}
                  </span>
                )}
              </div>
              <p className={`${isDark ? 'text-[#F3E4D6]/60' : 'text-[#5C1A24]/60'} text-base mb-5`}>{studentData?.email || 'student@example.com'}</p>

              {/* Access Key widget */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest text-[#8C3B3F]/80 mb-1 font-semibold">
                    {isAr ? 'مفتاح الدخول' : 'Student Access Key'}
                  </span>
                  <div className={`px-4 py-2.5 rounded-xl border border-[#C9A876]/40 shadow-[0_0_20px_rgba(201,168,118,0.1)] ${isDark ? 'bg-black/40' : 'bg-[#5C1A24]/5'}`}>
                    <span className="text-lg font-mono font-bold text-[#8C3B3F] tracking-[0.2em]">
                      {studentData?.linkCode || '········'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleCopyCode}
                  className={`px-4 py-2.5 border border-[#C9A876]/40 rounded-xl transition-all duration-300 flex items-center gap-2 mt-5 ${isDark ? 'bg-[#C9A876]/15 text-[#C9A876] hover:bg-[#C9A876]/25' : 'bg-gradient-to-r from-[#5C1A24]/10 to-[#C9A876]/20 text-[#5C1A24] hover:from-[#5C1A24]/15 hover:to-[#C9A876]/30'}`}
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
        </div>

        {/* Tabs */}
        <div className={`backdrop-blur-xl rounded-[2rem] border transition-colors duration-500 mb-8 overflow-hidden shadow-xl ${isDark ? 'bg-[#2A0D12]/60 border-[#C9A876]/30 shadow-black/20' : 'bg-white/80 border-[#C9A876]/25 shadow-[#5C1A24]/5'}`}>
          <div className="flex flex-col sm:flex-row gap-2 p-2">
            {([
              { key: 'dashboard', en: 'Dashboard Overview', ar: 'نظرة عامة' },
              { key: 'lessons', en: 'Science Lessons & Videos', ar: 'الدروس والفيديوهات' },
              { key: 'quiz', en: 'Interactive Quizzes', ar: 'الاختبارات التفاعلية' },
              { key: 'grades', en: 'My Grades', ar: 'درجاتي' },
              { key: 'announcements', en: 'Announcements', ar: 'الإعلانات' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`flex-1 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] text-white shadow-lg shadow-[#5C1A24]/25'
                    : `${isDark ? 'text-[#F3E4D6]/60 hover:text-[#F3E4D6] hover:bg-white/5' : 'text-[#5C1A24]/60 hover:text-[#5C1A24] hover:bg-[#C9A876]/[0.08]'}`
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
                <h3 className={`font-display text-2xl font-bold mb-6 ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                  {isAr ? 'نظرة عامة على لوحة التحكم' : 'Dashboard Overview'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                  <div className={`bg-gradient-to-br from-[#5C1A24]/[0.1] to-transparent border rounded-2xl p-6 ${isDark ? 'border-[#C9A876]/20' : 'border-[#5C1A24]/15'}`}>
                    <h4 className={`text-lg font-semibold mb-1 ${isDark ? 'text-[#C9A876]' : 'text-[#5C1A24]'}`}>
                      {isAr ? 'دوراتي' : 'My Courses'}
                    </h4>
                    <p className={`text-sm mb-4 ${isDark ? 'text-[#F3E4D6]/60' : 'text-[#5C1A24]/50'}`}>
                      {isAr ? 'الوصول لدوراتك العلمية' : 'Access your enrolled science courses'}
                    </p>
                    <div className={`text-3xl font-bold ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>{loadingLessons ? '···' : lessons.length}</div>
                    <div className={`text-xs mt-1 ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>{isAr ? 'دروس متاحة' : 'Available Lessons'}</div>
                  </div>

                  <div className={`bg-gradient-to-br from-[#C9A876]/15 to-transparent border rounded-2xl p-6 ${isDark ? 'border-[#C9A876]/30' : 'border-[#C9A876]/30'}`}>
                    <h4 className="text-lg font-semibold text-[#8C3B3F] mb-1">
                      {isAr ? 'التقدم' : 'Progress'}
                    </h4>
                    <p className={`text-sm mb-4 ${isDark ? 'text-[#F3E4D6]/60' : 'text-[#5C1A24]/50'}`}>
                      {isAr ? 'تتبع تقدمك في التعلم' : 'Track your learning progress'}
                    </p>
                    <div className={`text-3xl font-bold ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>{progress}%</div>
                    <div className={`text-xs mt-1 ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>
                      {isAr ? 'الإنجاز الكلي' : 'Overall Completion'}
                    </div>
                  </div>

                  <div className={`bg-gradient-to-br from-[#E7C3B6]/20 to-transparent border rounded-2xl p-6 ${isDark ? 'border-[#C9A876]/30' : 'border-[#E7C3B6]/50'}`}>
                    <h4 className="text-lg font-semibold text-[#8C3B3F] mb-1">
                      {isAr ? 'الاختبارات' : 'Quizzes Taken'}
                    </h4>
                    <p className={`text-sm mb-4 ${isDark ? 'text-[#F3E4D6]/60' : 'text-[#5C1A24]/50'}`}>
                      {isAr ? 'شارك في اختبار علمي' : 'Play the live science quiz'}
                    </p>
                    <div className={`text-3xl font-bold ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                      {gradesLog.filter((g) => g.source === 'quiz').length}
                    </div>
                    <div className={`text-xs mt-1 ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>{isAr ? 'مرات لعبت' : 'Attempts'}</div>
                  </div>
                </div>

                {/* Animated progress bar */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-semibold ${isDark ? 'text-[#F3E4D6]/80' : 'text-[#5C1A24]/70'}`}>
                      {isAr ? 'تقدم الدروس' : 'Lessons Progress'}
                    </span>
                    <span className="text-sm font-bold text-[#8C3B3F]">{progress}%</span>
                  </div>
                  <div className={`w-full h-3 rounded-full border overflow-hidden ${isDark ? 'bg-black/40 border-[#C9A876]/30' : 'bg-[#5C1A24]/[0.06] border-[#C9A876]/25'}`}>
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] transition-all duration-700 ease-out shadow-[0_0_16px_rgba(201,168,118,0.5)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-2 ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/40'}`}>
                    {completedLessons.size} / {lessons.length} {isAr ? 'دروس مكتملة' : 'lessons completed'}
                  </p>
                </div>
              </div>
            )}

            {/* LESSONS TAB */}
            {activeTab === 'lessons' && (
              <div>
                <h3 className={`font-display text-2xl font-bold mb-1 ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                  {isAr ? 'الدروس العلمية' : 'Science Lessons'}
                </h3>
                <p className={`text-xs mb-6 ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/40'}`}>
                  {isAr ? 'أكمل الدروس بالترتيب لفتح ما يليها' : 'Complete lessons in order to unlock the next one'}
                </p>
                {loadingLessons ? (
                  <div className={`text-sm ${isDark ? 'text-[#F3E4D6]/60' : 'text-[#5C1A24]/50'}`}>{isAr ? 'جاري تحميل الدروس...' : 'Loading lessons...'}</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {sortedLessons.map((lesson, index) => {
                      const isDone = completedLessons.has(lesson.id);
                      const isOpen = openLessonId === lesson.id;
                      const locked = isLessonLockedAt(index);

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
                          className={`border rounded-2xl p-5 transition-all duration-300 ${
                            locked
                              ? `${isDark ? 'bg-black/30 border-[#C9A876]/10 opacity-50' : 'bg-[#EFE4D6]/60 border-[#C9A876]/20 opacity-70'}`
                              : isOpen
                              ? `${isDark ? 'bg-[#2A0D12] border-[#8C3B3F]/60' : 'bg-white/70 border-[#8C3B3F]/50 shadow-[0_0_24px_rgba(140,59,63,0.12)]'}`
                              : `${isDark ? 'bg-black/20 border-[#C9A876]/20 hover:border-[#C9A876]/50' : 'bg-white/60 border-[#C9A876]/25 hover:border-[#C9A876]/60'}`
                          }`}
                        >
                          <button
                            onClick={() => !locked && setOpenLessonId(isOpen ? null : lesson.id)}
                            disabled={locked}
                            className={`w-full flex items-center gap-3 text-start ${
                              locked ? 'cursor-not-allowed' : ''
                            }`}
                          >
                            <div
                              className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-lg ${
                                locked
                                  ? 'bg-[#C9A876]/15 text-[#8C3B3F]/40'
                                  : contentKind === 'video'
                                  ? `${isDark ? 'bg-[#5C1A24]/30 text-[#C9A876]' : 'bg-[#5C1A24]/10 text-[#5C1A24]'}`
                                  : contentKind === 'pdf'
                                  ? 'bg-[#C9A876]/20 text-[#8C3B3F]'
                                  : 'bg-[#E7C3B6]/30 text-[#8C3B3F]'
                              }`}
                            >
                              {locked ? (
                                '🔒'
                              ) : contentKind === 'video' ? (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                </svg>
                              ) : contentKind === 'pdf' ? (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M11.983 1.907a.75.75 0 00-1.292-.657L4.204 9.507a.75.75 0 00.543 1.243h4.222l-1.688 6.943a.75.75 0 001.292.657l6.487-8.257a.75.75 0 00-.543-1.243h-4.222l1.688-6.943z" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className={`text-xs uppercase tracking-wide ${locked ? 'text-[#8C3B3F]/40' : `${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}`}>
                                {locked ? (isAr ? 'مقفل' : 'Locked') : `${contentLabel} · ${lesson.duration}`}
                              </span>
                              <div className={`font-semibold truncate ${locked ? 'text-[#8C3B3F]/50' : `${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}`}>
                                {isAr ? lesson.title_ar : lesson.title_en}
                              </div>
                            </div>
                            {isDone && !locked && (
                              <svg className="w-5 h-5 text-[#8C3B3F] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          {isOpen && !locked && (
                            <div className="mt-4 pt-4 border-t border-[#C9A876]/25 space-y-3">
                              {lesson.videoUrl && (
                                <div className="aspect-video rounded-xl overflow-hidden border border-[#C9A876]/25">
                                  {(() => {
                                    const embedUrl = getYouTubeEmbedUrl(lesson.videoUrl);
                                    if (!embedUrl) {
                                      return (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#5C1A24]/10 to-[#C9A876]/10">
                                          <p className={`text-sm ${isDark ? 'text-[#F3E4D6]/60' : 'text-[#5C1A24]/60'}`}>
                                            {isAr ? 'رابط الفيديو غير صالح' : 'Invalid video URL'}
                                          </p>
                                        </div>
                                      );
                                    }
                                    return (
                                      <iframe
                                        src={embedUrl}
                                        title={isAr ? lesson.title_ar : lesson.title_en}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                        referrerPolicy="strict-origin-when-cross-origin"
                                      />
                                    );
                                  })()}
                                </div>
                              )}

                              {!lesson.videoUrl && contentKind === 'video' && (
                                <div className="aspect-video rounded-xl bg-gradient-to-br from-[#5C1A24]/10 to-[#C9A876]/10 border border-[#C9A876]/25 flex items-center justify-center">
                                  <div className="w-14 h-14 rounded-full bg-[#5C1A24]/10 border border-[#C9A876]/40 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-[#5C1A24] ms-0.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M6 4l12 6-12 6V4z" />
                                    </svg>
                                  </div>
                                </div>
                              )}

                              {lesson.pdfUrl && (
                                <button
                                  onClick={() => handleDownloadPdf(lesson)}
                                  className="w-full py-2.5 rounded-xl bg-[#C9A876]/15 border border-[#C9A876]/40 text-[#8C3B3F] text-sm font-medium hover:bg-[#C9A876]/25 transition-all duration-300 flex items-center justify-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m-8 8h10a2 2 0 002-2V8a2 2 0 00-2-2h-3.586a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 0011.586 4H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  {isAr ? 'تحميل ملخص PDF' : 'Download PDF Summary'}
                                </button>
                              )}

                              {!lesson.videoUrl && !lesson.pdfUrl && (
                                <div className={`rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap ${isDark ? 'border-[#C9A876]/30 bg-black/30' : 'border-[#E7C3B6]/50 bg-gradient-to-br from-[#5C1A24]/[0.05] to-[#E7C3B6]/20'}`}>
                                  <span className={`text-sm font-medium ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                                    ⚡ {isAr ? 'جلسة مراجعة سريعة واختبار' : 'Quick Review & Quiz Session'}
                                  </span>
                                  {lesson.quiz && (
                                    <button
                                      onClick={() => startQuiz(lesson.id)}
                                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#5C1A24] to-[#C9A876] text-white text-xs font-semibold hover:brightness-110 transition-all duration-300"
                                    >
                                      {isAr ? 'ابدأ الاختبار' : 'Start Quiz'}
                                    </button>
                                  )}
                                </div>
                              )}

                              {lesson.quiz ? (
                                <div className="flex items-center justify-between px-1 py-1 gap-2">
                                  <span className="text-xs font-medium text-[#8C3B3F]">
                                    ⚠️ {isAr ? 'يجب اجتياز الاختبار لإتمام الدرس' : 'Must pass quiz to complete'}
                                  </span>
                                  {isDone && (
                                    <span className={`text-xs shrink-0 ${isDark ? 'text-[#C9A876]' : 'text-[#5C1A24]'}`}>
                                      {isAr ? 'مكتمل ✓' : 'Passed ✓'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <label className="flex items-center justify-between px-1 py-1 cursor-pointer select-none">
                                  <span className={`text-sm ${isDark ? 'text-[#F3E4D6]/70' : 'text-[#5C1A24]/70'}`}>
                                    {isAr ? 'وضع علامة كمكتمل' : 'Mark as Completed'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleLessonCompletion(lesson)}
                                    className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
                                      isDone ? 'bg-gradient-to-r from-[#5C1A24] to-[#C9A876]' : `${isDark ? 'bg-black/40 border-[#C9A876]/30' : 'bg-[#5C1A24]/[0.06] border-[#C9A876]/30'}`
                                    }`}
                                  >
                                    <span
                                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
                                        isDone ? 'start-[calc(100%-1.375rem)]' : 'start-0.5'
                                      }`}
                                    />
                                  </button>
                                </label>
                              )}

                              {lesson.quiz && (lesson.videoUrl || lesson.pdfUrl) && (
                                <button
                                  onClick={() => startQuiz(lesson.id)}
                                  className={`w-full py-2.5 rounded-xl border text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(201,168,118,0.12)] ${isDark ? 'bg-[#C9A876]/15 border-[#C9A876]/40 text-[#C9A876] hover:bg-[#C9A876]/25' : 'bg-gradient-to-r from-[#5C1A24]/10 to-[#C9A876]/20 border-[#C9A876]/40 text-[#5C1A24] hover:from-[#5C1A24]/15 hover:to-[#C9A876]/30'}`}
                                >
                                  ✨ {isAr ? 'اختبر نفسك في هذا الدرس' : 'Take Lesson Quiz'}
                                </button>
                              )}
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
                <h3 className={`font-display text-2xl font-bold mb-6 ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                  {isAr ? 'درجاتي' : 'My Grades'}
                </h3>

                {/* Offline Exam Results */}
                <div className={`backdrop-blur-xl rounded-[2rem] border transition-colors duration-500 mb-8 overflow-hidden shadow-xl ${isDark ? 'bg-[#2A0D12]/60 border-[#C9A876]/30 shadow-black/20' : 'bg-white/80 border-[#C9A876]/25 shadow-[#5C1A24]/5'}`}>
                  <div className="p-6 sm:p-8 pb-4">
                    <h4 className={`font-display text-lg font-bold mb-1 ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                      {isAr ? 'الاختبارات الورقية' : 'Offline Exams'}
                    </h4>
                    <p className={`text-xs ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>
                      {isAr ? 'نتائج الاختبارات التي تم تقييمها من قبل المعلمة' : 'Exam results graded by your teacher'}
                    </p>
                  </div>

                  {loadingExamResults ? (
                    <div className="px-6 sm:px-8 pb-8 space-y-2">{[0, 1].map((i) => (<div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/5'}`} />))}</div>
                  ) : examResults.length === 0 ? (
                    <div className={`px-6 sm:px-8 pb-8 text-sm ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>
                      {isAr ? 'لا توجد نتائج اختبارات بعد' : 'No exam results yet'}
                    </div>
                  ) : (
                    <div className="px-6 sm:px-8 pb-8 space-y-4">
                      {examResults.map((result) => {
                        const percentage = Math.round((result.score / result.totalMarks) * 100);
                        return (
                          <div key={result.id} className={`rounded-xl p-4 border ${isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/20'}`}>
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <h5 className={`font-semibold ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>{result.examTitle}</h5>
                                <p className={`text-xs ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>
                                  {new Date(result.updatedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className={`px-4 py-2 rounded-xl font-bold ${
                                percentage >= 70 ? 'bg-emerald-500/10 text-emerald-600' :
                                percentage >= 50 ? 'bg-amber-400/10 text-amber-600' :
                                'bg-rose-500/10 text-rose-600'
                              }`}>
                                {percentage}%
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className={isDark ? 'text-[#F3E4D6]/70' : 'text-[#5C1A24]/70'}>
                                {result.score} / {result.totalMarks} {isAr ? 'درجة' : 'marks'}
                              </span>
                              {result.feedback && (
                                <span className={`text-xs ${isDark ? 'text-[#C9A876]' : 'text-[#5C1A24]'}`}>
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
                <div className={`backdrop-blur-xl rounded-[2rem] border transition-colors duration-500 overflow-hidden shadow-xl ${isDark ? 'bg-[#2A0D12]/60 border-[#C9A876]/30 shadow-black/20' : 'bg-white/80 border-[#C9A876]/25 shadow-[#5C1A24]/5'}`}>
                  <div className="p-6 sm:p-8 pb-4">
                    <h4 className={`font-display text-lg font-bold mb-1 ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                      {isAr ? 'سجل اختبارات الدروس' : 'Quiz History'}
                    </h4>
                    <p className={`text-xs ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>
                      {isAr ? 'نتائج الاختبارات التفاعلية للدروس' : 'Interactive lesson quiz results'}
                    </p>
                  </div>

                  {gradesLog.length === 0 ? (
                    <div className={`px-6 sm:px-8 pb-8 text-sm ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>
                      {isAr ? 'لا توجد نتائج اختبارات دروس بعد' : 'No quiz results yet'}
                    </div>
                  ) : (
                    <div className="px-6 sm:px-8 pb-8 space-y-3">
                      {gradesLog.map((grade) => {
                        const pct = Math.round((grade.score / (grade.source === 'quiz' ? 10 : 100)) * 100);
                        return (
                          <div key={grade.id} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/15'}`}>
                            <div>
                              <p className={`text-xs sm:text-sm font-semibold ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>{grade.quiz}</p>
                              <p className={`text-[11px] ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>{grade.date}</p>
                            </div>
                            <span className={`text-sm font-bold ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-rose-500'}`}>{pct}%</span>
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
                <h3 className={`font-display text-2xl font-bold mb-6 ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                  {isAr ? 'الإعلانات' : 'Announcements'}
                </h3>

                {loadingAnnouncements ? (
                  <div className="space-y-4">{[0, 1].map((i) => (<div key={i} className={`h-24 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/5'}`} />))}</div>
                ) : announcements.length === 0 ? (
                  <div className={`text-sm ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>
                    {isAr ? 'لا توجد إعلانات بعد' : 'No announcements yet'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {announcements.map((announcement) => (
                      <div key={announcement.id} className={`rounded-xl p-5 border ${isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/20'}`}>
                        <div className="flex items-start gap-3 mb-3">
                          {announcement.pinned && (
                            <span className="text-lg">📌</span>
                          )}
                          <div className="flex-1">
                            <h4 className={`font-semibold ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>{announcement.title}</h4>
                            <p className={`text-xs ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>
                              {announcement.author} · {new Date(announcement.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-[#F3E4D6]/80' : 'text-[#5C1A24]/80'}`}>
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
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <h3 className={`font-display text-2xl font-bold ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                        {isAr ? activeQuiz.quizTitle_ar : activeQuiz.quizTitle_en}
                      </h3>
                      <button
                        onClick={() => setActiveQuizLessonId(null)}
                        className={`text-xs transition-colors ${isDark ? 'text-[#F3E4D6]/60 hover:text-[#F3E4D6]' : 'text-[#5C1A24]/60 hover:text-[#5C1A24]'}`}
                      >
                        {isAr ? 'كل الاختبارات' : 'All quizzes'}
                      </button>
                    </div>
                    <p className={`text-sm mb-6 ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>
                      {isAr
                        ? `أجب عن الأسئلة ثم أرسل إجاباتك — تحتاج ${PASSING_SCORE_PERCENT}% لإتمام الدرس`
                        : `Answer the questions, then submit — you need ${PASSING_SCORE_PERCENT}% to complete this lesson`}
                    </p>

                    <div className="space-y-6 mb-8">
                      {activeQuiz.questions.map((q, qIdx) => (
                        <div key={qIdx} className={`border rounded-2xl p-5 ${isDark ? 'bg-black/20 border-[#C9A876]/25' : 'bg-white/60 border-[#C9A876]/25'}`}>
                          <div className={`font-semibold mb-4 ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                            {qIdx + 1}. {isAr ? q.ar : q.en}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {q.options.map((opt, optIdx) => {
                              const selected = quizAnswers[qIdx] === optIdx;
                              const isCorrectOpt = optIdx === q.correct;
                            let stateClasses = isDark ? 'border-[#C9A876]/30 text-[#F3E4D6]/70 hover:border-[#C9A876]/60 hover:bg-white/5' : 'border-[#C9A876]/30 text-[#5C1A24]/70 hover:border-[#C9A876]/60 hover:bg-[#C9A876]/[0.06]';

if (quizSubmitted) {
  // 🌟 لو الطالب جاب أكتر من 60% (نجح)، أظهر له الإجابات الصح والخطأ عادي
  if (quizResult?.passed) {
    if (isCorrectOpt) {
      stateClasses = 'border-[#8C3B3F]/60 bg-[#8C3B3F]/20 text-[#C9A876] font-bold';
    } else if (selected && !isCorrectOpt) {
      stateClasses = 'border-rose-400/60 bg-rose-400/10 text-rose-500';
    } else {
      stateClasses = isDark ? 'border-[#C9A876]/10 text-[#F3E4D6]/20' : 'border-[#C9A876]/15 text-[#5C1A24]/30';
    }
  } 
  // 🌟 لو جاب أقل من 60% (سقط)، ويه بس إيه إجابته الغلط من غير ما تفضح له الإجابة الصح عشان يفكر تاني!
  else {
    if (selected && !isCorrectOpt) {
      stateClasses = 'border-rose-400/60 bg-rose-400/10 text-rose-500 font-semibold'; // نبين إجابته إنه غلط بس
    } else {
      stateClasses = isDark ? 'border-[#C9A876]/20 text-[#F3E4D6]/50' : 'border-[#C9A876]/30 text-[#5C1A24]/50'; // نخفي الإجابة الصح ونتركها عادية
    }
  }
} else if (selected) {
  stateClasses = isDark ? 'border-[#C9A876] bg-[#5C1A24]/40 text-white' : 'border-[#5C1A24]/60 bg-[#5C1A24]/10 text-[#2E1013]';
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
                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] text-white font-semibold hover:shadow-[0_8px_28px_rgba(92,26,36,0.35)] hover:brightness-110 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isAr ? 'إرسال الاختبار' : 'Submit Quiz'}
                      </button>
                    ) : (
                      quizResult && (
                        <div className="space-y-3 mb-2">
                          <div className="flex flex-col sm:flex-row items-center gap-5">
                            <div
                              className={`flex items-center gap-3 px-6 py-4 rounded-2xl border ${
                                quizResult.passed
                                  ? 'bg-[#C9A876]/15 border-[#C9A876]/50'
                                  : 'bg-rose-400/10 border-rose-400/40'
                              } ${quizResult.passed ? 'animate-pulse' : ''}`}
                            >
                              <span className="text-3xl">
                                {quizResult.passed ? '🏆' : '🔬'}
                              </span>
                              <div>
                                <div className={`text-xl font-bold ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                                  {quizResult.score} / {quizResult.total}
                                </div>
                                <div className={`text-xs ${isDark ? 'text-[#F3E4D6]/60' : 'text-[#5C1A24]/60'}`}>
                                  {savingResult
                                    ? isAr ? 'جارٍ حفظ النتيجة...' : 'Saving your result...'
                                    : isAr ? 'نتيجتك في الاختبار' : 'Your quiz score'}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={retakeQuiz}
                              className={`px-6 py-3 rounded-2xl border font-medium transition-all duration-300 ${isDark ? 'bg-white/5 border-[#C9A876]/30 text-[#C9A876] hover:bg-white/10' : 'bg-[#5C1A24]/[0.06] border-[#C9A876]/30 text-[#5C1A24] hover:bg-[#C9A876]/[0.1]'}`}
                            >
                              {isAr ? 'إعادة المحاولة' : 'Retake Quiz'}
                            </button>
                          </div>
                        <p className={`text-sm font-medium ${quizResult.passed ? 'text-[#8C3B3F]' : 'text-rose-500'}`}>
  {quizResult.passed
    ? '🎉 ' + (isAr ? 'ممتاز! تم فتح الدرس التالي وعرض الإجابات الصحيحة.' : 'Awesome! Lesson complete — next lesson unlocked!')
    : isAr
    ? `⚠️ لم تجتز الاختبار (${quizResult.score}/${quizResult.total}). راجع الأسئلة المحددة باللون الأحمر وفكر فيها مجددًا ثم اضغط إعادة المحاولة.`
    : `⚠️ You didn't pass yet. Review your incorrect answers highlighted in red, think about them, and retry.`}
</p>
                        </div>
                      )
                    )}
                  </>
                ) : (
                  <>
                    <h3 className={`font-display text-2xl font-bold mb-2 ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                      {isAr ? 'الاختبارات التفاعلية' : 'Interactive Quizzes'}
                    </h3>
                    <p className={`text-sm mb-6 ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>
                      {isAr ? 'اختر درسًا لبدء اختباره' : 'Pick a lesson quiz to get started'}
                    </p>

                    {quizzableLessons.length === 0 ? (
                      <p className={`text-sm mb-8 ${isDark ? 'text-[#F3E4D6]/40' : 'text-[#5C1A24]/40'}`}>
                        {isAr
                          ? 'لا توجد اختبارات متاحة الآن — أكمل الدرس الحالي لفتح المزيد.'
                          : 'No quizzes available right now — finish your current lesson to unlock more.'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                        {quizzableLessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className={`border rounded-2xl p-5 transition-all duration-300 ${isDark ? 'bg-black/20 border-[#C9A876]/25 hover:border-[#C9A876]/60' : 'bg-white/60 border-[#C9A876]/25 hover:border-[#C9A876]/60'}`}
                          >
                            <div className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-[#F3E4D6]/50' : 'text-[#5C1A24]/50'}`}>
                              {isAr ? lesson.title_ar : lesson.title_en}
                            </div>
                            <div className={`font-semibold mb-4 ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                              {isAr ? lesson.quiz?.quizTitle_ar : lesson.quiz?.quizTitle_en}
                            </div>
                            <button
                              onClick={() => startQuiz(lesson.id)}
                              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#5C1A24] to-[#C9A876] text-white text-sm font-semibold hover:brightness-110 transition-all duration-300"
                            >
                              {isAr ? 'ابدأ الاختبار' : 'Start Quiz'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Grades history */}
                <div className="mt-10">
                  <h4 className={`font-display text-xl font-bold mb-4 ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>
                    {isAr ? 'سجل الدرجات' : 'Grades History'}
                  </h4>
                  <div className="space-y-3">
                    {gradesLog.map((grade) => (
                      <div
                        key={grade.id}
                        className={`border rounded-2xl p-5 flex items-center justify-between gap-4 ${isDark ? 'bg-black/20 border-[#C9A876]/25' : 'bg-white/60 border-[#C9A876]/25'}`}
                      >
                        <div className="min-w-0">
                          <div className={`font-semibold ${isDark ? 'text-[#F3E4D6]' : 'text-[#2E1013]'}`}>{grade.subject}</div>
                          <div className={`text-sm truncate ${isDark ? 'text-[#F3E4D6]/60' : 'text-[#5C1A24]/50'}`}>{grade.quiz}</div>
                          <div className={`text-xs ${isDark ? 'text-[#F3E4D6]/30' : 'text-[#5C1A24]/30'}`}>{grade.date}</div>
                        </div>
                        <div
                          className={`text-2xl sm:text-3xl font-bold shrink-0 ${
                            grade.score >= 90 ? 'text-[#8C3B3F]' : grade.score >= 80 ? 'text-[#C9A876]' : 'text-rose-500'
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
      @media (prefers-reduced-motion: reduce) {
        .orbit-ring { animation: none; }
      }
    `}</style>
  );
}