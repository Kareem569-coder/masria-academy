'use client';

import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardNavbar from '@/components/DashboardNavbar';
import ConfirmModal from '@/components/ConfirmModal';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getErrorMessage } from '@/types/models';
import { isTeacherEmail } from '@/lib/authorization';
import PackageManager from '@/components/teacher/PackageManager';
import { getActivePackagesByGradeLevel } from '@/lib/firestore/packageService';
import { createLesson, deleteLesson } from '@/lib/firestore/lessonService';
import ActivityBuilder, { validateActivityList } from '@/components/teacher/ActivityBuilder';
import type { Activity, Announcement as AnnouncementModel, CoursePackage, Exam as ExamModel, PerformanceRecord, StudentStatus as StudentStatusModel, LessonCategory } from '@/types/models';

const isAdminEmail = (email?: string | null) => {
  return isTeacherEmail(email);
};

type Theme = 'light' | 'dark';
type StudentStatus = StudentStatusModel;
type LessonType = 'video' | 'pdf' | 'quiz_only' | 'hybrid';
type ActiveSection = 'analytics' | 'students' | 'repository' | 'addLesson' | 'exams' | 'announcements';

type Announcement = AnnouncementModel;



interface StudentRow {
  id: string;
  name: string;
  email: string;
  status: StudentStatus;
  gradeLevel?: string;
  createdAt?: string;
}

type PerformanceRow = PerformanceRecord;

interface QuizOption {
  en: string;
  ar: string;
}

interface QuizQuestion {
  uid: string;
  en: string;
  ar: string;
  options: QuizOption[];
  correct: number;
}

interface LessonRow {
  id: string;
  title_en: string;
  title_ar: string;
  duration: string;
  type: LessonType;
  gradeLevel: string;
  order?: number | null;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  isPublished: boolean;
  quiz?: { questions: QuizQuestion[] } | null;
  createdAt?: string;
  category?: LessonCategory;
}

type ExamRow = ExamModel;

interface ExamResultRow {
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  gradeLevel: string;
  score: number;
  totalMarks: number;
  feedback: string;
  updatedAt: string;
}

interface ToastItem {
  id: string;
  type: 'success' | 'error';
  message: string;
}

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

const lessonTypes: { value: LessonType; en: string; ar: string }[] = [
  { value: 'video', en: 'Video', ar: 'فيديو' },
  { value: 'pdf', en: 'PDF', ar: 'ملف PDF' },
  { value: 'quiz_only', en: 'Quiz Only', ar: 'اختبار فقط' },
  { value: 'hybrid', en: 'Hybrid', ar: 'هجين' },
];

const lessonCategories: { value: LessonCategory; en: string; ar: string }[] = [
  { value: 'THEORY', en: 'Theory', ar: 'نظري' },
  { value: 'PRACTICAL', en: 'Practical', ar: 'عملي' },
  { value: 'HYBRID', en: 'Hybrid', ar: 'هجين' },
  { value: 'ASSESSMENT', en: 'Assessment', ar: 'تقييم' },
];

const emptyOption = (): QuizOption => ({ en: '', ar: '' });
const makeQuestion = (): QuizQuestion => ({
  uid: Math.random().toString(36).slice(2),
  en: '',
  ar: '',
  options: [emptyOption(), emptyOption(), emptyOption(), emptyOption()],
  correct: 0,
});

export default function TeacherDashboard() {
  const { user, logout, loading } = useAuth();
  const { language, dir } = useLanguage();
  const router = useRouter();
  const isAr = language === 'ar';

  const [theme, setTheme] = useState<Theme>('light');
  const isDark = theme === 'dark';

  const checkingAccess = loading || !user || !isAdminEmail(user.email);

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

  // ===== Students =====
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentGradeFilter, setStudentGradeFilter] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('');

  // ===== Performance (global, for analytics) =====
  const [performance, setPerformance] = useState<PerformanceRow[]>([]);
  const [loadingPerformance, setLoadingPerformance] = useState(true);

  // ===== Lessons =====
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [togglingLessonId, setTogglingLessonId] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<ActiveSection>('analytics');

  // ===== Profile modal =====
  const [profileStudent, setProfileStudent] = useState<StudentRow | null>(null);
  const [profileScores, setProfileScores] = useState<PerformanceRow[]>([]);
  const [loadingProfileScores, setLoadingProfileScores] = useState(false);

  // ===== Confirm modal (delete actions) =====
  const [confirmState, setConfirmState] = useState<{
    title: string;
    body: string;
    onConfirm: () => void;
  } | null>(null);

  // CMS form state
  const [titleEn, setTitleEn] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [duration, setDuration] = useState('');
  const [lessonOrder, setLessonOrder] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('video');
  const [lessonCategory, setLessonCategory] = useState<LessonCategory>('THEORY');
  const [videoUrl, setVideoUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [lessonGrade, setLessonGrade] = useState('');

  const [selectedPackageId, setSelectedPackageId] = useState('');

  const [availablePackages, setAvailablePackages] = useState<CoursePackage[]>([]);

  const [isPublished, setIsPublished] = useState(false);
  const [lessonActivities, setLessonActivities] = useState<Activity[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [submittingLesson, setSubmittingLesson] = useState(false);
  const [lessonFormError, setLessonFormError] = useState('');

  // Load packages when grade level changes
  useEffect(() => {
    const loadPackages = async () => {
      if (lessonGrade) {
        try {
          const packages = await getActivePackagesByGradeLevel(lessonGrade);
          setAvailablePackages(packages);
        } catch (error) {
          console.error('Error loading packages:', error);
        }
      } else {
        setAvailablePackages([]);
        setSelectedPackageId('');
      }
    };
    loadPackages();
  }, [lessonGrade]);



  // ===== Exams & Grading =====
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [selectedExam, setSelectedExam] = useState<ExamRow | null>(null);
  const [examStudents, setExamStudents] = useState<StudentRow[]>([]);
  const [loadingExamStudents, setLoadingExamStudents] = useState(false);
  const [examGrades, setExamGrades] = useState<Record<string, { score: string; feedback: string }>>({});
  const [savingGrades, setSavingGrades] = useState(false);
  
  // Exam creation form
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examTotalMarks, setExamTotalMarks] = useState('');
  const [examGradeLevel, setExamGradeLevel] = useState('');
  const [creatingExam, setCreatingExam] = useState(false);

  // ===== Announcements =====
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  
  // Announcement creation form
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementGrade, setAnnouncementGrade] = useState('');
  const [announcementPinned, setAnnouncementPinned] = useState(false);
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);

  // ===== Admin gate =====
  useEffect(() => {
    if (loading) return;
    if (!user || !isAdminEmail(user.email)) {
      router.push('/');
    }
  }, [loading, user, router]);

  // ===== Fetch students =====
  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snapshot = await getDocs(q);
      const fetched: StudentRow[] = snapshot.docs.map((d) => {
        const data = d.data() as Partial<StudentRow>;
        return {
          id: d.id,
          name: data.name || '—',
          email: data.email || '—',
          status: data.status || 'active',
          gradeLevel: data.gradeLevel || '',
          createdAt: data.createdAt || '',
        };
      });
      setStudents(fetched);
    } catch (error) {
      console.error('Error fetching students:', error);
      pushToast('error', isAr ? 'تعذر تحميل بيانات الطلاب' : 'Could not load student data');
    } finally {
      setLoadingStudents(false);
    }
  }, [isAr, pushToast]);

  useEffect(() => {
    if (checkingAccess) return;
    queueMicrotask(() => { void fetchStudents(); });
  }, [checkingAccess, fetchStudents]);

  // ===== Fetch performance for analytics =====
  useEffect(() => {
    const fetchPerformance = async () => {
      setLoadingPerformance(true);
      try {
        const snapshot = await getDocs(collection(db, 'performance'));
        const fetched: PerformanceRow[] = snapshot.docs.map((d) => {
          const data = d.data() as Partial<PerformanceRow>;
          return {
            id: d.id,
            studentId: data.studentId || '',
            quizTitle: data.quizTitle || '',
            score: Number(data.score) || 0,
            total: Number(data.total) || 1,
            date: data.date || '',
          };
        });
        setPerformance(fetched);
      } catch (error) {
        console.error('Error fetching performance:', error);
      } finally {
        setLoadingPerformance(false);
      }
    };

    if (!checkingAccess) fetchPerformance();
  }, [checkingAccess]);

  // ===== Fetch lessons =====
  const fetchLessons = useCallback(async () => {
    setLoadingLessons(true);
    try {
      const snapshot = await getDocs(collection(db, 'lessons'));
      const fetched: LessonRow[] = snapshot.docs.map((d) => {
        const data = d.data() as Partial<LessonRow>;
        return {
          id: d.id,
          title_en: data.title_en || '',
          title_ar: data.title_ar || '',
          duration: data.duration || '',
          type: (data.type || 'video') as LessonType,
          gradeLevel: data.gradeLevel || '',
          order: typeof data.order === 'number' ? data.order : null,
          videoUrl: data.videoUrl || null,
          pdfUrl: data.pdfUrl || null,
          isPublished: Boolean(data.isPublished),
          quiz: data.quiz || null,
          createdAt: data.createdAt || '',
          category: data.category,
        };
      });
      fetched.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      setLessons(fetched);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      pushToast('error', isAr ? 'تعذر تحميل الدروس' : 'Could not load lessons');
    } finally {
      setLoadingLessons(false);
    }
  }, [isAr, pushToast]);

  useEffect(() => {
    if (checkingAccess) return;
    queueMicrotask(() => { void fetchLessons(); });
  }, [checkingAccess, fetchLessons]);

  // ===== Fetch Exams =====
  const fetchExams = useCallback(async () => {
    setLoadingExams(true);
    try {
      const snapshot = await getDocs(collection(db, 'exams'));
      const fetched: ExamRow[] = snapshot.docs.map((d) => {
        const data = d.data() as Partial<ExamRow>;
        return {
          id: d.id,
          title: data.title || '',
          gradeLevel: data.gradeLevel || '',
          totalMarks: Number(data.totalMarks) || 0,
          date: data.date || '',
          createdAt: data.createdAt,
        };
      });
      setExams(fetched);
    } catch (error) {
      console.error('Error fetching exams:', error);
      pushToast('error', isAr ? 'تعذر تحميل الاختبارات' : 'Could not load exams');
    } finally {
      setLoadingExams(false);
    }
  }, [isAr, pushToast]);

  useEffect(() => {
    if (checkingAccess) return;
    queueMicrotask(() => { void fetchExams(); });
  }, [checkingAccess, fetchExams]);

  // ===== Fetch Announcements =====
  const fetchAnnouncements = useCallback(async () => {
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
          author: data.author || 'Teacher MASRIA',
          pinned: data.pinned || false,
          createdAt: data.createdAt || new Date().toISOString(),
        };
      });
      fetched.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setAnnouncements(fetched);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      pushToast('error', isAr ? 'تعذر تحميل الإعلانات' : 'Could not load announcements');
    } finally {
      setLoadingAnnouncements(false);
    }
  }, [isAr, pushToast]);

  useEffect(() => {
    if (checkingAccess) return;
    queueMicrotask(() => { void fetchAnnouncements(); });
  }, [checkingAccess, fetchAnnouncements]);

  // ===== Exam & Grading Handlers =====
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle || !examDate || !examTotalMarks || !examGradeLevel) {
      pushToast('error', isAr ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }

    setCreatingExam(true);
    try {
      await addDoc(collection(db, 'exams'), {
        title: examTitle.trim(),
        gradeLevel: examGradeLevel,
        totalMarks: Number(examTotalMarks),
        date: examDate,
        createdAt: new Date().toISOString(),
      });
      pushToast('success', isAr ? 'تم إنشاء الاختبار بنجاح' : 'Exam created successfully');
      setExamTitle('');
      setExamDate('');
      setExamTotalMarks('');
      setExamGradeLevel('');
      fetchExams();
    } catch (error) {
      console.error('Error creating exam:', error);
      pushToast('error', isAr ? 'فشل إنشاء الاختبار' : 'Failed to create exam');
    } finally {
      setCreatingExam(false);
    }
  };

  const handleSelectExam = async (exam: ExamRow) => {
    setSelectedExam(exam);
    setLoadingExamStudents(true);
    setExamGrades({});
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('gradeLevel', '==', exam.gradeLevel),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      const fetched: StudentRow[] = snapshot.docs.map((d) => ({
        id: d.id,
        name: d.data().name || '—',
        email: d.data().email || '—',
        status: d.data().status || 'active',
        gradeLevel: d.data().gradeLevel || '',
        createdAt: d.data().createdAt || '',
      }));
      setExamStudents(fetched);

      // Load existing grades
      const gradesQ = query(collection(db, 'exam_results'), where('examId', '==', exam.id));
      const gradesSnapshot = await getDocs(gradesQ);
      const grades: Record<string, { score: string; feedback: string }> = {};
      gradesSnapshot.docs.forEach((resultDoc) => {
        const data = resultDoc.data() as Partial<ExamResultRow>;
        if (!data.studentId) return;
        grades[data.studentId] = {
          score: data.score?.toString() || '',
          feedback: data.feedback || '',
        };
      });
      setExamGrades(grades);
    } catch (error) {
      console.error('Error loading exam students:', error);
      pushToast('error', isAr ? 'تعذر تحميل الطلاب' : 'Could not load students');
    } finally {
      setLoadingExamStudents(false);
    }
  };

  const handleSaveGrades = async () => {
    if (!selectedExam) return;
    setSavingGrades(true);
    try {
      const updatedAt = new Date().toISOString();
      await Promise.all(
        examStudents.map(async (student) => {
          const grade = examGrades[student.id];
          if (!grade || grade.score === '') return;

          const result: ExamResultRow = {
            examId: selectedExam.id,
            examTitle: selectedExam.title,
            studentId: student.id,
            studentName: student.name,
            gradeLevel: selectedExam.gradeLevel,
            score: Number(grade.score),
            totalMarks: selectedExam.totalMarks,
            feedback: grade.feedback || '',
            updatedAt,
          };
          const resultId = `${selectedExam.id}_${student.id}`;
          await setDoc(doc(db, 'exam_results', resultId), result, { merge: true });
        })
      );
      pushToast('success', isAr ? 'تم حفظ الدرجات بنجاح' : 'Grades saved successfully');
    } catch (error) {
      console.error('Error saving grades:', error);
      pushToast('error', isAr ? 'فشل حفظ الدرجات' : 'Failed to save grades');
    } finally {
      setSavingGrades(false);
    }
  };

  const handleDeleteExam = (exam: ExamRow) => {
    setConfirmState({
      title: isAr ? 'حذف الاختبار' : 'Delete Exam',
      body: isAr
        ? `سيتم حذف "${exam.title}" وجميع الدرجات المرتبطة به.`
        : `This will delete "${exam.title}" and all associated grades.`,
      onConfirm: async () => {
        try {
          const q = query(collection(db, 'exam_results'), where('examId', '==', exam.id));
          const snapshot = await getDocs(q);
          await Promise.all([
            deleteDoc(doc(db, 'exams', exam.id)),
            ...snapshot.docs.map((resultDoc) => deleteDoc(resultDoc.ref)),
          ]);
          setExams((prev) => prev.filter((e) => e.id !== exam.id));
          if (selectedExam?.id === exam.id) {
            setSelectedExam(null);
            setExamStudents([]);
            setExamGrades({});
          }
          pushToast('success', isAr ? 'تم حذف الاختبار' : 'Exam deleted');
        } catch (error) {
          console.error('Error deleting exam:', error);
          pushToast('error', isAr ? 'فشل حذف الاختبار' : 'Failed to delete exam');
        } finally {
          setConfirmState(null);
        }
      },
    });
  };

  // ===== Announcement Handlers =====
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle || !announcementContent || !announcementGrade) {
      pushToast('error', isAr ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }

    setCreatingAnnouncement(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: announcementTitle.trim(),
        content: announcementContent.trim(),
        gradeLevel: announcementGrade,
        author: 'Teacher MASRIA',
        pinned: announcementPinned,
        createdAt: new Date().toISOString(),
      });
      pushToast('success', isAr ? 'تم نشر الإعلان بنجاح' : 'Announcement posted successfully');
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementGrade('');
      setAnnouncementPinned(false);
      fetchAnnouncements();
    } catch (error) {
      console.error('Error creating announcement:', error);
      pushToast('error', isAr ? 'فشل نشر الإعلان' : 'Failed to post announcement');
    } finally {
      setCreatingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = (announcement: Announcement) => {
    setConfirmState({
      title: isAr ? 'حذف الإعلان' : 'Delete Announcement',
      body: isAr
        ? `سيتم حذف "${announcement.title}" نهائيًا.`
        : `This will permanently delete "${announcement.title}".`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'announcements', announcement.id));
          setAnnouncements((prev) => prev.filter((a) => a.id !== announcement.id));
          pushToast('success', isAr ? 'تم حذف الإعلان' : 'Announcement deleted');
        } catch (error) {
          console.error('Error deleting announcement:', error);
          pushToast('error', isAr ? 'فشل حذف الإعلان' : 'Failed to delete announcement');
        } finally {
          setConfirmState(null);
        }
      },
    });
  };

  const pendingStudents = useMemo(() => students.filter((s) => s.status === 'pending'), [students]);

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    return students.filter((s) => {
      const matchesTerm =
        !term || s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term);
      const matchesGrade = !studentGradeFilter || s.gradeLevel === studentGradeFilter;
      const matchesStatus = !studentStatusFilter || s.status === studentStatusFilter;
      return matchesTerm && matchesGrade && matchesStatus;
    });
  }, [students, studentSearch, studentGradeFilter, studentStatusFilter]);

  const averageScore = useMemo(() => {
    if (performance.length === 0) return 0;
    const totalPercent = performance.reduce((acc, p) => acc + (p.score / (p.total || 1)) * 100, 0);
    return Math.round(totalPercent / performance.length);
  }, [performance]);

  const publishedLessonsCount = useMemo(() => lessons.filter((l) => l.isPublished).length, [lessons]);

 // 🌟 تعديل يضيف عمود "غير محدد" للطلاب اللي معندهمش صف متسجل في الفايربيز
  const gradeDistribution = useMemo(() => {
    const distribution = gradeLevels.map((g) => ({
      ...g,
      count: students.filter((s) => {
        if (!s.gradeLevel || s.gradeLevel === '—') return false;
        const val = s.gradeLevel.toString().trim().toLowerCase();
        
        if (val === g.en.toLowerCase() || val === g.ar.toLowerCase()) return true;

        if (g.en === 'Grade 4' && (val.includes('4') || val.includes('رابع') || val.includes('fourth'))) return true;
        if (g.en === 'Grade 5' && (val.includes('5') || val.includes('خامس') || val.includes('fifth'))) return true;
        if (g.en === 'Grade 6' && (val.includes('6') || val.includes('سادس') || val.includes('sixth'))) return true;
        
        if (g.en === 'Prep 1' && (val.includes('prep 1') || val.includes('prep1') || val.includes('اول اعدادي') || val.includes('أول الإعدادي') || val.includes('7'))) return true;
        if (g.en === 'Prep 2' && (val.includes('prep 2') || val.includes('prep2') || val.includes('ثاني اعدادي') || val.includes('ثاني الإعدادي') || val.includes('8'))) return true;
        if (g.en === 'Prep 3' && (val.includes('prep 3') || val.includes('prep3') || val.includes('ثالث اعدادي') || val.includes('ثالث الإعدادي') || val.includes('9'))) return true;
        
        if (g.en === 'Sec 1' && (val.includes('sec 1') || val.includes('sec1') || val.includes('اول ثانوي') || val.includes('أول الثانوي') || val.includes('10'))) return true;
        if (g.en === 'Sec 2' && (val.includes('sec 2') || val.includes('sec2') || val.includes('ثاني ثانوي') || val.includes('ثاني الثانوي') || val.includes('11'))) return true;
        if (g.en === 'Sec 3' && (val.includes('sec 3') || val.includes('sec3') || val.includes('ثالث ثانوي') || val.includes('ثالث الثانوي') || val.includes('12'))) return true;

        return false;
      }).length,
    }));

    // 🛠️ تجميع الطلاب اللي بدون صف دراسي عشان يظهروا في الداشبورد
    const unassignedCount = students.filter(
      (s) => !s.gradeLevel || s.gradeLevel.trim() === '' || s.gradeLevel === '—'
    ).length;

    if (unassignedCount > 0) {
      distribution.push({
        en: 'Unassigned',
        ar: 'غير محدد (بدون صف)',
        count: unassignedCount,
      });
    }

    return distribution;
  }, [students]);

  const maxGradeCount = useMemo(
    () => Math.max(1, ...gradeDistribution.map((g) => g.count)),
    [gradeDistribution]
  );
  // ===== Student actions =====
  const handleApprove = async (studentId: string) => {
    setApprovingId(studentId);
    try {
      await updateDoc(doc(db, 'users', studentId), { status: 'active' });
      setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, status: 'active' } : s)));
      pushToast('success', isAr ? 'تم تفعيل حساب الطالب' : 'Student account activated');
    } catch (error) {
      console.error('Error approving student:', error);
      pushToast('error', isAr ? 'فشلت عملية الموافقة' : 'Approval failed');
    } finally {
      setApprovingId(null);
    }
  };

  const handleToggleSuspend = async (student: StudentRow) => {
    const nextStatus = student.status === 'suspended' ? 'active' : 'suspended';
    setSuspendingId(student.id);
    try {
      await updateDoc(doc(db, 'users', student.id), { status: nextStatus });
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, status: nextStatus } : s)));
      pushToast(
        'success',
        nextStatus === 'suspended'
          ? isAr ? 'تم إيقاف الحساب' : 'Account suspended'
          : isAr ? 'تم إعادة تفعيل الحساب' : 'Account reactivated'
      );
    } catch (error) {
      console.error('Error updating student status:', error);
      pushToast('error', isAr ? 'فشل تحديث الحالة' : 'Status update failed');
    } finally {
      setSuspendingId(null);
    }
  };

  const handleDeleteStudent = (student: StudentRow) => {
    setConfirmState({
      title: isAr ? 'حذف الطالب' : 'Delete student',
      body: isAr
        ? `سيتم حذف سجل "${student.name}" نهائيًا. هذا الإجراء لا يمكن التراجع عنه.`
        : `This will permanently delete the record for "${student.name}". This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', student.id));
          setStudents((prev) => prev.filter((s) => s.id !== student.id));
          pushToast('success', isAr ? 'تم حذف الطالب' : 'Student deleted');
        } catch (error) {
          console.error('Error deleting student:', error);
          pushToast('error', isAr ? 'فشل حذف الطالب' : 'Delete failed');
        } finally {
          setConfirmState(null);
        }
      },
    });
  };

  const openProfile = async (student: StudentRow) => {
    setProfileStudent(student);
    setLoadingProfileScores(true);
    setProfileScores([]);
    try {
      const q = query(collection(db, 'performance'), where('studentId', '==', student.id));
      const snapshot = await getDocs(q);
      const fetched: PerformanceRow[] = snapshot.docs.map((d) => {
        const data = d.data() as Partial<PerformanceRow>;
        return {
          id: d.id,
          studentId: data.studentId || '',
          quizTitle: data.quizTitle || (isAr ? 'اختبار' : 'Quiz'),
          score: Number(data.score) || 0,
          total: Number(data.total) || 1,
          date: data.date || '',
        };
      });
      setProfileScores(fetched);
    } catch (error) {
      console.error('Error fetching student scores:', error);
      pushToast('error', isAr ? 'تعذر تحميل نتائج الطالب' : 'Could not load student scores');
    } finally {
      setLoadingProfileScores(false);
    }
  };

  // ===== Lesson actions =====
  const handleDeleteLesson = (lesson: LessonRow) => {
    setConfirmState({
      title: isAr ? 'حذف الدرس' : 'Delete lesson',
      body: isAr
        ? `سيتم حذف "${lesson.title_en || lesson.title_ar}" نهائيًا من المستودع.`
        : `This will permanently remove "${lesson.title_en || lesson.title_ar}" from the repository.`,
      onConfirm: async () => {
        try {

          await deleteLesson(lesson.id);

          setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
          pushToast('success', isAr ? 'تم حذف الدرس' : 'Lesson deleted');
        } catch (error) {
          console.error('Error deleting lesson:', error);
          pushToast('error', isAr ? 'فشل حذف الدرس' : 'Delete failed');
        } finally {
          setConfirmState(null);
        }
      },
    });
  };

  const handleTogglePublish = async (lesson: LessonRow) => {
    setTogglingLessonId(lesson.id);
    try {
      await updateDoc(doc(db, 'lessons', lesson.id), { isPublished: !lesson.isPublished });
      setLessons((prev) =>
        prev.map((l) => (l.id === lesson.id ? { ...l, isPublished: !l.isPublished } : l))
      );
      pushToast(
        'success',
        !lesson.isPublished
          ? isAr ? 'تم نشر الدرس' : 'Lesson published'
          : isAr ? 'تم إخفاء الدرس (مسودة)' : 'Lesson moved to draft'
      );
    } catch (error) {
      console.error('Error toggling publish state:', error);
      pushToast('error', isAr ? 'فشل تحديث حالة النشر' : 'Publish toggle failed');
    } finally {
      setTogglingLessonId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const resetLessonForm = () => {
    setTitleEn('');
    setTitleAr('');
    setDuration('');
    setLessonOrder('');
    setLessonType('video');
    setVideoUrl('');
    setPdfUrl('');
    setLessonGrade('');

    setSelectedPackageId('');

    setAvailablePackages([]);

    setIsPublished(false);
    setLessonActivities([]);
    setQuizQuestions([]);
  };

  // ===== Quiz builder helpers =====
  const addQuizQuestion = () => setQuizQuestions((prev) => [...prev, makeQuestion()]);
  const removeQuizQuestion = (uid: string) =>
    setQuizQuestions((prev) => prev.filter((q) => q.uid !== uid));
  const updateQuizQuestion = (uid: string, field: 'en' | 'ar', value: string) =>
    setQuizQuestions((prev) => prev.map((q) => (q.uid === uid ? { ...q, [field]: value } : q)));
  const updateQuizOption = (uid: string, optIndex: number, field: 'en' | 'ar', value: string) =>
    setQuizQuestions((prev) =>
      prev.map((q) =>
        q.uid === uid
          ? {
              ...q,
              options: q.options.map((o, i) => (i === optIndex ? { ...o, [field]: value } : o)),
            }
          : q
      )
    );
  const setQuizCorrect = (uid: string, optIndex: number) =>
    setQuizQuestions((prev) => prev.map((q) => (q.uid === uid ? { ...q, correct: optIndex } : q)));

  // ===== ADD LESSON SUBMIT (FIREBASE UNDEFINED FIX INCLUDED) =====
  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setLessonFormError('');

    if (!titleEn || !titleAr || !duration || !lessonGrade) {
      setLessonFormError(isAr ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields');
      return;
    }

    const incompleteQuestion = quizQuestions.find(
      (q) => !q.en || !q.ar || q.options.some((o) => !o.en || !o.ar)
    );
    if (incompleteQuestion) {
      setLessonFormError(
        isAr
          ? 'يوجد سؤال اختبار غير مكتمل. أكمل جميع الحقول أو احذف السؤال.'
          : 'One quiz question is incomplete. Fill in every field or remove it.'
      );
      return;
    }

    const activityErrors = validateActivityList(lessonActivities);
    if (activityErrors.length > 0) {
      setLessonFormError(activityErrors.join('\n'));
      return;
    }

    setSubmittingLesson(true);
    try {
      await createLesson({
        title_en: titleEn.trim(),
        title_ar: titleAr.trim(),
        duration: duration.trim(),
        type: lessonType,
        category: lessonCategory,
        gradeLevel: lessonGrade,
        order: lessonOrder ? Number(lessonOrder) : null,
        videoUrl: videoUrl.trim() || null,
        pdfUrl: pdfUrl.trim() || null,

        packageId: selectedPackageId || null,

        isPublished,
        quiz: quizQuestions.length
          ? { questions: quizQuestions.map((question) => ({
              en: question.en,
              ar: question.ar,
              options: question.options,
              correct: question.correct,
            })) }
          : null,
        activities: lessonActivities.length ? lessonActivities : [],
        createdAt: new Date().toISOString(),
      });
      pushToast('success', isAr ? 'تمت إضافة الدرس بنجاح!' : 'Lesson added successfully!');
      resetLessonForm();
      fetchLessons();
    } catch (error: unknown) {
      console.error('Error adding lesson:', error);
      setLessonFormError(
        isAr
          ? `حدث خطأ أثناء إضافة الدرس: ${getErrorMessage(error, 'حاول مرة أخرى.')}`
          : `Something went wrong adding the lesson: ${getErrorMessage(error, 'Please try again.')}`
      );
    } finally {
      setSubmittingLesson(false);
    }
  };

  const pageBg = 'bg-[#080c14]';
  const navBg = 'bg-slate-950/70 border-white/10';
  const cardBg = 'bg-slate-900/60 border-white/10';
  const cardShadow = 'shadow-[0_24px_80px_rgba(2,6,23,0.5)]';
  const headingText = 'text-white';
  const bodyText = 'text-slate-300';
  const mutedText = 'text-slate-400';
  const inputBg = 'bg-slate-950/80 border-white/10 text-slate-100 placeholder:text-slate-500';
  const ambientA = 'bg-cyan-500/10';
  const ambientB = 'bg-indigo-500/10';

  if (loading || checkingAccess) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${pageBg}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-[#C9A876]/25 border-t-[#8C3B3F] animate-spin" />
          <div className={`text-lg font-medium font-body ${isDark ? 'text-[#F8F1E7]' : 'text-[#5C1A24]'}`}>
            {isAr ? 'جاري التحقق من الصلاحيات...' : 'Verifying access...'}
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
            <button onClick={() => dismissToast(t.id)} className={`shrink-0 text-xs ${mutedText} hover:opacity-80`}>✕</button>
          </div>
        ))}
      </div>

      <DashboardNavbar
        theme={theme}
        onThemeToggle={() => setTheme(isDark ? 'light' : 'dark')}
        onLogout={handleLogout}
        adminBadge="Admin Portal"
        navClassName={navBg}
        themeButtonClassName="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900/60 text-slate-200 transition hover:border-cyan-400/40 hover:text-white"
      />

      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Section switcher (Responsive Grid on Mobile) */}
        <div className={`mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 backdrop-blur-xl ${cardShadow}`}>
          <div className="grid grid-cols-2 gap-2 p-2 sm:flex sm:flex-row">
            {([
              { key: 'analytics', en: 'System Metrics', ar: 'مقاييس النظام' },
              { key: 'students', en: 'Student Review', ar: 'مراجعة الطلاب' },
              { key: 'repository', en: 'Module Library', ar: 'مكتبة الوحدات' },
              { key: 'addLesson', en: 'Create Module', ar: 'إنشاء وحدة' },
              { key: 'exams', en: 'Assessment Pipeline', ar: 'مسار التقييم' },
              { key: 'announcements', en: 'Release Notes', ar: 'ملاحظات الإصدار' },

              { key: 'packages', en: 'Packages', ar: 'الباقات' },

            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                className={`flex-1 rounded-2xl px-3 py-3 text-xs font-semibold transition-all duration-300 sm:px-5 sm:text-sm ${
                  activeSection === tab.key
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/15'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {isAr ? tab.ar : tab.en}
                {tab.key === 'students' && pendingStudents.length > 0 && (
                  <span className="ms-1 sm:ms-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] sm:text-[11px] font-bold">
                    {pendingStudents.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ===== ANALYTICS SECTION ===== */}
        {activeSection === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              <StatCard cardBg={cardBg} cardShadow={cardShadow} headingText={headingText} mutedText={mutedText} accent={isDark ? 'text-[#C9A876]' : 'text-[#5C1A24]'} title={isAr ? 'إجمالي الطلاب' : 'Total Students'} subtitle={isAr ? 'جميع الطلاب المسجلين' : 'All registered students'} value={loadingStudents ? '···' : String(students.length)} />
              <StatCard cardBg={cardBg} cardShadow={cardShadow} headingText={headingText} mutedText={mutedText} accent={isDark ? 'text-[#C9A876]' : 'text-[#8C3B3F]'} title={isAr ? 'بانتظار الموافقة' : 'Pending Approvals'} subtitle={isAr ? 'يحتاجون تفعيل الحساب' : 'Awaiting account activation'} value={loadingStudents ? '···' : String(pendingStudents.length)} />
              <StatCard cardBg={cardBg} cardShadow={cardShadow} headingText={headingText} mutedText={mutedText} accent={isDark ? 'text-[#C9A876]' : 'text-[#8C3B3F]'} title={isAr ? 'الدروس المنشورة' : 'Published Lessons'} subtitle={isAr ? `من إجمالي ${lessons.length} درس` : `Out of ${lessons.length} total lessons`} value={loadingLessons ? '···' : String(publishedLessonsCount)} />
              <StatCard cardBg={cardBg} cardShadow={cardShadow} headingText={headingText} mutedText={mutedText} accent={isDark ? 'text-[#C9A876]' : 'text-[#8C3B3F]'} title={isAr ? 'متوسط الدرجات' : 'Average Score'} subtitle={isAr ? 'عبر جميع الاختبارات' : 'Across all quiz attempts'} value={loadingPerformance ? '···' : `${averageScore}%`} />
            </div>

            <div className={`backdrop-blur-xl rounded-[2rem] p-5 sm:p-8 border ${cardBg} ${cardShadow}`}>
              <h3 className={`font-display text-lg sm:text-xl font-bold mb-1 ${headingText}`}>{isAr ? 'توزيع الطلاب حسب الصف' : 'Grade Level Distribution'}</h3>
              <p className={`text-xs sm:text-sm mb-6 ${mutedText}`}>{isAr ? 'عدد الطلاب المسجلين في كل صف دراسي' : 'How many students are enrolled at each grade level'}</p>
              <div className="space-y-4">
                {gradeDistribution.map((g) => (
                  <div key={g.en}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className={`text-xs sm:text-sm font-semibold ${headingText}`}>{isAr ? g.ar : g.en}</span>
                      <span className={`text-xs ${mutedText}`}>{g.count}</span>
                    </div>
                    <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/8'}`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] transition-all duration-500" style={{ width: `${(g.count / maxGradeCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== STUDENT MANAGEMENT SECTION ===== */}
        {activeSection === 'students' && (
          <div className={`backdrop-blur-xl rounded-[2rem] border overflow-hidden ${cardBg} ${cardShadow}`}>
            <div className="p-5 sm:p-8 pb-4">
              <h3 className={`font-display text-xl sm:text-2xl font-bold mb-1 ${headingText}`}>{isAr ? 'مراجعة الطلاب' : 'Student Review Pipeline'}</h3>
              <p className={`text-xs mb-5 ${mutedText}`}>{isAr ? 'مراجعة الحسابات، الموافقة، والإيقاف المؤقت للطلاب' : 'Review accounts, approve access, and manage student status'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder={isAr ? 'ابحث بالاسم أو البريد الإلكتروني' : 'Search name or email'} className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:border-[#8C3B3F]/60 text-sm ${inputBg}`} />
                <select value={studentGradeFilter} onChange={(e) => setStudentGradeFilter(e.target.value)} className={`w-full px-4 py-2.5 rounded-xl border outline-none text-sm appearance-none cursor-pointer ${inputBg}`}>
                  <option value="" className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>{isAr ? 'كل الصفوف' : 'All grades'}</option>
                  {gradeLevels.map((g) => (<option key={g.en} value={g.en} className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>{isAr ? g.ar : g.en}</option>))}
                </select>
                <select value={studentStatusFilter} onChange={(e) => setStudentStatusFilter(e.target.value)} className={`w-full px-4 py-2.5 rounded-xl border outline-none text-sm appearance-none cursor-pointer ${inputBg}`}>
                  <option value="" className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>{isAr ? 'كل الحالات' : 'All statuses'}</option>
                  <option value="pending" className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>{isAr ? 'بانتظار الموافقة' : 'Pending'}</option>
                  <option value="active" className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>{isAr ? 'مفعل' : 'Active'}</option>
                  <option value="suspended" className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>{isAr ? 'موقوف' : 'Suspended'}</option>
                </select>
              </div>
            </div>

            {loadingStudents ? (
              <div className="px-5 sm:px-8 pb-8 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className={`h-12 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/5'}`} />))}</div>
            ) : filteredStudents.length === 0 ? (
              <div className={`px-5 sm:px-8 pb-8 text-sm ${mutedText}`}>{isAr ? 'لا يوجد طلاب مطابقون لهذا البحث.' : 'No students match this search.'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start">
                  <thead>
                    <tr className={`border-t ${isDark ? 'border-[#C9A876]/15' : 'border-[#C9A876]/20'}`}>
                      <th className={`text-start px-5 sm:px-8 py-3 text-xs uppercase font-semibold ${mutedText}`}>{isAr ? 'الاسم' : 'Name'}</th>
                      <th className={`text-start px-4 py-3 text-xs uppercase font-semibold ${mutedText}`}>{isAr ? 'البريد' : 'Email'}</th>
                      <th className={`text-start px-4 py-3 text-xs uppercase font-semibold ${mutedText}`}>{isAr ? 'الصف' : 'Grade'}</th>
                      <th className={`text-start px-4 py-3 text-xs uppercase font-semibold ${mutedText}`}>{isAr ? 'الحالة' : 'Status'}</th>
                      <th className={`text-start px-5 sm:px-8 py-3 text-xs uppercase font-semibold ${mutedText}`}>{isAr ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className={`border-t ${isDark ? 'border-[#C9A876]/10' : 'border-[#C9A876]/15'}`}>
                        <td className={`px-5 sm:px-8 py-4 font-semibold ${headingText}`}><button onClick={() => openProfile(student)} className="hover:underline text-start">{student.name}</button></td>
                        <td className={`px-4 py-4 text-xs sm:text-sm ${bodyText}`}>{student.email}</td>
                        <td className={`px-4 py-4 text-xs sm:text-sm ${bodyText}`}>{student.gradeLevel || '—'}</td>
                        <td className="px-4 py-4"><StatusBadge status={student.status} isAr={isAr} /></td>
                        <td className="px-5 sm:px-8 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {student.status === 'pending' ? (
                              <button onClick={() => handleApprove(student.id)} disabled={approvingId === student.id} className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] text-white text-xs font-semibold">{approvingId === student.id ? '···' : isAr ? 'موافقة' : 'Approve'}</button>
                            ) : (
                              <button onClick={() => handleToggleSuspend(student)} disabled={suspendingId === student.id} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${student.status === 'suspended' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-amber-400/10 border-amber-400/30 text-amber-600'}`}>{suspendingId === student.id ? '···' : student.status === 'suspended' ? (isAr ? 'تفعيل' : 'Reactivate') : (isAr ? 'إيقاف' : 'Suspend')}</button>
                            )}
                            <button onClick={() => openProfile(student)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${isDark ? 'border-[#C9A876]/25 text-[#E7C3B6]' : 'border-[#5C1A24]/20 text-[#5C1A24]'}`}>{isAr ? 'الملف' : 'Profile'}</button>
                            <button onClick={() => handleDeleteStudent(student)} className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-400/30 text-rose-600 text-xs font-semibold">{isAr ? 'حذف' : 'Delete'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===== LESSON REPOSITORY SECTION ===== */}
        {activeSection === 'repository' && (
          <div className={`backdrop-blur-xl rounded-[2rem] border overflow-hidden ${cardBg} ${cardShadow}`}>
            <div className="p-5 sm:p-8 pb-4">
              <h3 className={`font-display text-xl sm:text-2xl font-bold mb-1 ${headingText}`}>{isAr ? 'مكتبة الوحدات التعليمية' : 'Course Module Library'}</h3>
              <p className={`text-xs ${mutedText}`}>{isAr ? 'جميع الوحدات الدراسية، مع التحكم في النشر والإدارة' : 'All course modules with publishing and maintenance controls'}</p>
            </div>
            {loadingLessons ? (
              <div className="px-5 sm:px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => (<div key={i} className={`h-32 rounded-2xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/5'}`} />))}</div>
            ) : lessons.length === 0 ? (
              <div className={`px-5 sm:px-8 pb-8 text-sm ${mutedText}`}>{isAr ? 'لا توجد دروس بعد.' : 'No lessons yet.'}</div>
            ) : (
              <div className="px-5 sm:px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {lessons.map((lesson) => (
                  <div key={lesson.id} className={`rounded-2xl p-4 sm:p-5 border flex flex-col gap-3 ${isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/20'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className={`font-semibold leading-snug text-sm sm:text-base ${headingText}`}>{isAr ? lesson.title_ar || lesson.title_en : lesson.title_en || lesson.title_ar}</h4>
                        <p className={`text-xs mt-0.5 ${mutedText}`}>{lesson.gradeLevel || '—'} · {lesson.duration || '—'}</p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${lesson.isPublished ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-amber-400/10 border-amber-400/30 text-amber-600'}`}>{lesson.isPublished ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-auto pt-1">
                      <button onClick={() => handleTogglePublish(lesson)} disabled={togglingLessonId === lesson.id} className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border ${lesson.isPublished ? 'bg-amber-400/10 border-amber-400/30 text-amber-600' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'}`}>{togglingLessonId === lesson.id ? '···' : lesson.isPublished ? (isAr ? 'مسودة' : 'To Draft') : (isAr ? 'نشر' : 'Publish')}</button>
                      <button onClick={() => handleDeleteLesson(lesson)} className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-400/30 text-rose-600 text-xs font-semibold">{isAr ? 'حذف' : 'Delete'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== ADD LESSON SECTION (RESPONSIVE FIX) ===== */}
        {activeSection === 'addLesson' && (
          <div className={`backdrop-blur-xl rounded-[2rem] p-5 sm:p-8 border ${cardBg} ${cardShadow}`}>
            <h3 className={`font-display text-xl sm:text-2xl font-bold mb-1 ${headingText}`}>{isAr ? 'إنشاء وحدة تعليمية جديدة' : 'Create a New Learning Module'}</h3>
            <p className={`text-xs mb-6 ${mutedText}`}>{isAr ? 'يتم حفظ الوحدة مباشرة في مستودع المحتوى التعليمي' : 'This saves directly into the learning content repository'}</p>

            <form onSubmit={handleAddLesson} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'عنوان الدرس (إنجليزي)' : 'Title (English)'}</label>
                  <input type="text" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Introduction to Physics" className={`w-full px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-sm ${inputBg}`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'عنوان الدرس (عربي)' : 'Title (Arabic)'}</label>
                  <input type="text" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder="مقدمة في الفيزياء" className={`w-full px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-sm ${inputBg}`} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'المدة' : 'Duration'}</label>
                  <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={isAr ? '45 دقيقة' : '45 min'} className={`w-full px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-sm ${inputBg}`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'الترتيب' : 'Order'}</label>
                  <input type="number" value={lessonOrder} onChange={(e) => setLessonOrder(e.target.value)} placeholder="1" className={`w-full px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-sm ${inputBg}`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'نوع الدرس' : 'Lesson Type'}</label>
                  <select value={lessonType} onChange={(e) => setLessonType(e.target.value as LessonType)} className={`w-full px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-sm appearance-none cursor-pointer ${inputBg}`}>
                    {lessonTypes.map((lt) => (<option key={lt.value} value={lt.value} className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>{isAr ? lt.ar : lt.en}</option>))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'فئة الدرس' : 'Lesson Category'}</label>
                  <select value={lessonCategory} onChange={(e) => setLessonCategory(e.target.value as LessonCategory)} className={`w-full px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-sm appearance-none cursor-pointer ${inputBg}`}>
                    {lessonCategories.map((lc) => (<option key={lc.value} value={lc.value} className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>{isAr ? lc.ar : lc.en}</option>))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'الصف الدراسي' : 'Grade Level'}</label>
                  <select value={lessonGrade} onChange={(e) => setLessonGrade(e.target.value)} className={`w-full px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-sm appearance-none cursor-pointer ${inputBg}`}>
                    <option value="" className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>{isAr ? 'اختر الصف' : 'Select grade'}</option>
                    {gradeLevels.map((g) => (<option key={g.en} value={g.en} className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>{isAr ? g.ar : g.en}</option>))}
                  </select>
                </div>
              </div>

              {/* Package Selection */}
              {lessonGrade !== '' && (
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'الباقة (اختياري)' : 'Package (Optional)'}</label>
                  <select
                    value={selectedPackageId}
                    onChange={(e) => setSelectedPackageId(e.target.value)}
                    className={`w-full px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-sm appearance-none cursor-pointer ${inputBg}`}
                  >
                    <option value="" className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>{isAr ? 'بدون باقة' : 'No Package'}</option>
                    {availablePackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id} className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>
                        {pkg.name}
                      </option>
                    ))}
                  </select>
                  {availablePackages.length === 0 && (
                    <p className={`mt-2 text-xs ${mutedText}`}>
                      {isAr ? 'أنشئ شهرًا لهذا الصف من قسم الباقات قبل إضافة الدرس.' : 'Create a month for this grade from Packages before adding the lesson.'}
                    </p>
                  )}
                </div>
              )}



              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'رابط الفيديو (اختياري)' : 'Video URL (optional)'}</label>
                  <input type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." className={`w-full px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-sm ${inputBg}`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'رابط PDF (اختياري)' : 'PDF URL (optional)'}</label>
                  <input type="text" value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder="https://..." className={`w-full px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-sm ${inputBg}`} />
                </div>
              </div>

              {/* Publish toggle */}
              <div className={`flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl border ${isDark ? 'bg-black/20 border-[#C9A876]/15' : 'bg-white/50 border-[#C9A876]/20'}`}>
                <div>
                  <p className={`text-xs sm:text-sm font-semibold ${headingText}`}>{isAr ? 'نشر الدرس فورًا' : 'Publish immediately'}</p>
                  <p className={`text-[11px] sm:text-xs ${mutedText}`}>{isAr ? 'إذا كان مغلقًا، سيُحفظ كمسودة غير ظاهرة للطلاب' : 'If off, saves as draft hidden from students'}</p>
                </div>
                <button type="button" onClick={() => setIsPublished((v) => !v)} className={`relative w-12 h-7 rounded-full transition-colors ${isPublished ? 'bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876]' : isDark ? 'bg-white/10' : 'bg-[#5C1A24]/15'}`}>
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${isPublished ? 'start-6' : 'start-1'}`} />
                </button>
              </div>

              <ActivityBuilder
                activities={lessonActivities}
                onChange={setLessonActivities}
                isDark={isDark}
                isAr={isAr}
              />

              <div className={`rounded-xl sm:rounded-2xl border p-4 sm:p-6 ${isDark ? 'bg-black/20 border-[#C9A876]/15' : 'bg-white/50 border-[#C9A876]/20'}`}>
                <div className="flex items-center justify-between mb-1">
                  <h4 className={`font-display text-base sm:text-lg font-bold ${headingText}`}>{isAr ? 'باني الاختبار التفاعلي' : 'Interactive Quiz Builder'}</h4>
                  <button type="button" onClick={addQuizQuestion} className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] text-white text-xs font-semibold">+ {isAr ? 'إضافة سؤال' : 'Add Question'}</button>
                </div>
                <p className={`text-xs mb-5 ${mutedText}`}>{isAr ? 'اترك القائمة فارغة لدرس بدون اختبار.' : 'Leave empty for a lesson with no quiz.'}</p>

                {quizQuestions.length === 0 ? (
                  <div className={`text-xs sm:text-sm text-center py-8 rounded-xl border border-dashed ${isDark ? 'border-[#C9A876]/20 text-[#E7C3B6]/50' : 'border-[#5C1A24]/15 text-[#5C1A24]/40'}`}>{isAr ? 'لا توجد أسئلة بعد' : 'No questions yet'}</div>
                ) : (
                  <div className="space-y-5">
                    {quizQuestions.map((q, qIndex) => (
                      <div key={q.uid} className={`rounded-xl sm:rounded-2xl border p-3.5 sm:p-5 ${isDark ? 'bg-black/25 border-[#C9A876]/10' : 'bg-white/70 border-[#C9A876]/20'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-xs font-bold uppercase ${mutedText}`}>{isAr ? `سؤال ${qIndex + 1}` : `Question ${qIndex + 1}`}</span>
                          <button type="button" onClick={() => removeQuizQuestion(q.uid)} className="text-xs font-semibold text-rose-500 hover:text-rose-600">{isAr ? 'إزالة' : 'Remove'}</button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-4">
                          <input type="text" value={q.en} onChange={(e) => updateQuizQuestion(q.uid, 'en', e.target.value)} placeholder={isAr ? 'نص السؤال (إنجليزي)' : 'Question text (EN)'} className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm ${inputBg}`} />
                          <input type="text" value={q.ar} onChange={(e) => updateQuizQuestion(q.uid, 'ar', e.target.value)} placeholder={isAr ? 'نص السؤال (عربي)' : 'Question text (AR)'} dir="rtl" className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm ${inputBg}`} />
                        </div>

                        <div className="space-y-2.5">
                          {q.options.map((opt, optIndex) => (
                            <div key={optIndex} className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-2 rounded-xl border ${isDark ? 'bg-black/30 border-[#C9A876]/10' : 'bg-white/80 border-[#C9A876]/15'}`}>
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#8C3B3F] shrink-0">
                                <input type="radio" name={`correct-${q.uid}`} checked={q.correct === optIndex} onChange={() => setQuizCorrect(q.uid, optIndex)} className="w-4 h-4 accent-[#8C3B3F] cursor-pointer" />
                                <span className="sm:hidden">{isAr ? `صحيح؟ (خيار ${optIndex + 1})` : `Correct? (Opt ${optIndex + 1})`}</span>
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full flex-1">
                                <input type="text" value={opt.en} onChange={(e) => updateQuizOption(q.uid, optIndex, 'en', e.target.value)} placeholder={isAr ? `خيار ${optIndex + 1} (إنجليزي)` : `Option ${optIndex + 1} (EN)`} className={`w-full px-3.5 py-2 rounded-xl border text-xs sm:text-sm ${inputBg}`} />
                                <input type="text" value={opt.ar} onChange={(e) => updateQuizOption(q.uid, optIndex, 'ar', e.target.value)} placeholder={isAr ? `خيار ${optIndex + 1} (عربي)` : `Option ${optIndex + 1} (AR)`} dir="rtl" className={`w-full px-3.5 py-2 rounded-xl border text-xs sm:text-sm ${inputBg}`} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className={`text-[10px] sm:text-[11px] mt-2.5 ${mutedText}`}>{isAr ? 'حدد الدائرة بجانب الإجابة الصحيحة.' : 'Select the radio circle next to the correct answer.'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {lessonFormError && <div className="p-3 bg-rose-500/10 border border-rose-400/30 rounded-xl text-rose-600 text-xs sm:text-sm whitespace-pre-line">{lessonFormError}</div>}

              <button type="submit" disabled={submittingLesson} className="w-full sm:w-auto px-8 py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] text-white font-semibold text-sm sm:text-base hover:brightness-110 disabled:opacity-50">
                {submittingLesson ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ الدرس' : 'Save Lesson')}
              </button>
            </form>
          </div>
        )}

        {/* ===== EXAMS & GRADING SECTION ===== */}
        {activeSection === 'exams' && (
          <div className="space-y-6">
            {/* Create Exam Form */}
            <div className={`backdrop-blur-xl rounded-[2rem] p-5 sm:p-8 border ${cardBg} ${cardShadow}`}>
              <h3 className={`font-display text-xl sm:text-2xl font-bold mb-1 ${headingText}`}>{isAr ? 'إنشاء تقييم جديد' : 'Create New Assessment'}</h3>
              <p className={`text-xs mb-6 ${mutedText}`}>{isAr ? 'إنشاء اختبار منظم لتقييم أداء الطلاب' : 'Create a structured assessment for student evaluation'}</p>

              <form onSubmit={handleCreateExam} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'عنوان الاختبار' : 'Exam Title'}</label>
                    <input
                      type="text"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:border-[#8C3B3F]/60 text-sm ${inputBg}`}
                      placeholder={isAr ? 'مثال: اختبار الشهر الأول' : 'e.g., October Monthly Exam'}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'تاريخ الاختبار' : 'Exam Date'}</label>
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:border-[#8C3B3F]/60 text-sm ${inputBg}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'الدرجة الكلية' : 'Total Marks'}</label>
                    <input
                      type="number"
                      value={examTotalMarks}
                      onChange={(e) => setExamTotalMarks(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:border-[#8C3B3F]/60 text-sm ${inputBg}`}
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'الصف الدراسي' : 'Grade Level'}</label>
                    <select
                      value={examGradeLevel}
                      onChange={(e) => setExamGradeLevel(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none text-sm appearance-none cursor-pointer ${inputBg}`}
                    >
                      <option value="">{isAr ? 'اختر الصف' : 'Select Grade'}</option>
                      {gradeLevels.map((g) => (
                        <option key={g.en} value={g.en} className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>
                          {isAr ? g.ar : g.en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={creatingExam}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] text-white font-semibold text-sm sm:text-base hover:brightness-110 disabled:opacity-50"
                >
                  {creatingExam ? (isAr ? 'جارٍ الإنشاء...' : 'Creating...') : (isAr ? 'إنشاء الاختبار' : 'Create Exam')}
                </button>
              </form>
            </div>

            {/* Exam List & Grading */}
            <div className={`backdrop-blur-xl rounded-[2rem] border overflow-hidden ${cardBg} ${cardShadow}`}>
              <div className="p-5 sm:p-8 pb-4">
                <h3 className={`font-display text-xl sm:text-2xl font-bold mb-1 ${headingText}`}>{isAr ? 'مسار التقييم والدرجات' : 'Assessment & Grade Tracking'}</h3>
                <p className={`text-xs ${mutedText}`}>{isAr ? 'اختر تقييمًا لمراجعة أداء الطلاب' : 'Select a test to review student performance'}</p>
              </div>

              {loadingExams ? (
                <div className="px-5 sm:px-8 pb-8 space-y-2">{[0, 1].map((i) => (<div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/5'}`} />))}</div>
              ) : exams.length === 0 ? (
                <div className={`px-5 sm:px-8 pb-8 text-sm ${mutedText}`}>{isAr ? 'لا توجد اختبارات بعد' : 'No exams created yet'}</div>
              ) : (
                <div className="px-5 sm:px-8 pb-8 space-y-4">
                  {exams.map((exam) => (
                    <div key={exam.id} className={`rounded-xl p-4 border flex items-center justify-between ${isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/20'}`}>
                      <div>
                        <h4 className={`font-semibold ${headingText}`}>{exam.title}</h4>
                        <p className={`text-xs ${mutedText}`}>{exam.gradeLevel} · {exam.date} · {exam.totalMarks} {isAr ? 'درجة' : 'marks'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSelectExam(exam)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold border ${isDark ? 'border-[#C9A876]/25 text-[#E7C3B6] hover:bg-[#C9A876]/10' : 'border-[#5C1A24]/20 text-[#5C1A24] hover:bg-[#5C1A24]/5'}`}
                        >
                          {isAr ? 'تقييم الطلاب' : 'Grade Students'}
                        </button>
                        <button
                          onClick={() => handleDeleteExam(exam)}
                          className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-400/30 text-rose-600 text-xs font-semibold"
                        >
                          {isAr ? 'حذف' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grading Table */}
            {selectedExam && (
              <div className={`backdrop-blur-xl rounded-[2rem] border overflow-hidden ${cardBg} ${cardShadow}`}>
                <div className="p-5 sm:p-8 pb-4 flex items-center justify-between">
                  <div>
                    <h3 className={`font-display text-lg sm:text-xl font-bold mb-1 ${headingText}`}>{selectedExam.title}</h3>
                    <p className={`text-xs ${mutedText}`}>{selectedExam.gradeLevel} · {selectedExam.totalMarks} {isAr ? 'درجة' : 'marks'}</p>
                  </div>
                  <button
                    onClick={() => setSelectedExam(null)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border ${isDark ? 'border-[#C9A876]/25 text-[#E7C3B6]' : 'border-[#5C1A24]/20 text-[#5C1A24]'}`}
                  >
                    {isAr ? 'إغلاق' : 'Close'}
                  </button>
                </div>

                {loadingExamStudents ? (
                  <div className="px-5 sm:px-8 pb-8 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className={`h-12 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/5'}`} />))}</div>
                ) : examStudents.length === 0 ? (
                  <div className={`px-5 sm:px-8 pb-8 text-sm ${mutedText}`}>{isAr ? 'لا يوجد طلاب نشطين في هذا الصف' : 'No active students in this grade'}</div>
                ) : (
                  <div className="px-5 sm:px-8 pb-8">
                    <div className="overflow-x-auto">
                      <table className="w-full text-start">
                        <thead>
                          <tr className={`border-t ${isDark ? 'border-[#C9A876]/15' : 'border-[#C9A876]/20'}`}>
                            <th className={`text-start px-4 py-3 text-xs uppercase font-semibold ${mutedText}`}>{isAr ? 'الاسم' : 'Name'}</th>
                            <th className={`text-start px-4 py-3 text-xs uppercase font-semibold ${mutedText}`}>{isAr ? 'الدرجة' : 'Score'}</th>
                            <th className={`text-start px-4 py-3 text-xs uppercase font-semibold ${mutedText}`}>{isAr ? 'ملاحظات' : 'Feedback'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {examStudents.map((student) => (
                            <tr key={student.id} className={`border-t ${isDark ? 'border-[#C9A876]/10' : 'border-[#C9A876]/15'}`}>
                              <td className={`px-4 py-3 font-semibold ${headingText}`}>{student.name}</td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  value={examGrades[student.id]?.score || ''}
                                  onChange={(e) => setExamGrades((prev) => ({
                                    ...prev,
                                    [student.id]: { ...prev[student.id], score: e.target.value }
                                  }))}
                                  max={selectedExam.totalMarks}
                                  className={`w-20 px-3 py-2 rounded-lg border outline-none focus:border-[#8C3B3F]/60 text-sm ${inputBg}`}
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={examGrades[student.id]?.feedback || ''}
                                  onChange={(e) => setExamGrades((prev) => ({
                                    ...prev,
                                    [student.id]: { ...prev[student.id], feedback: e.target.value }
                                  }))}
                                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:border-[#8C3B3F]/60 text-sm ${inputBg}`}
                                  placeholder={isAr ? 'ملاحظات اختيارية' : 'Optional feedback'}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={handleSaveGrades}
                      disabled={savingGrades}
                      className="mt-4 w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] text-white font-semibold text-sm hover:brightness-110 disabled:opacity-50"
                    >
                      {savingGrades ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ الدرجات' : 'Save Grades')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== ANNOUNCEMENTS SECTION ===== */}
        {activeSection === 'announcements' && (
          <div className="space-y-6">
            {/* Create Announcement Form */}
            <div className={`backdrop-blur-xl rounded-[2rem] p-5 sm:p-8 border ${cardBg} ${cardShadow}`}>
              <h3 className={`font-display text-xl sm:text-2xl font-bold mb-1 ${headingText}`}>{isAr ? 'إنشاء ملاحظة جديدة' : 'Create New Release Note'}</h3>
              <p className={`text-xs mb-6 ${mutedText}`}>{isAr ? 'نشر تحديثات وإعلانات للطلاب وأولياء الأمور' : 'Share updates and announcements for students and families'}</p>

              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'عنوان الإعلان' : 'Announcement Title'}</label>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:border-[#8C3B3F]/60 text-sm ${inputBg}`}
                    placeholder={isAr ? 'مثال: موعد الامتحان النهائي' : 'e.g., Final Exam Schedule'}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'محتوى الإعلان' : 'Announcement Content'}</label>
                  <textarea
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    rows={4}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:border-[#8C3B3F]/60 text-sm ${inputBg}`}
                    placeholder={isAr ? 'اكتب تفاصيل الإعلان هنا...' : 'Write announcement details here...'}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${bodyText}`}>{isAr ? 'الصف المستهدف' : 'Target Grade'}</label>
                    <select
                      value={announcementGrade}
                      onChange={(e) => setAnnouncementGrade(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none text-sm appearance-none cursor-pointer ${inputBg}`}
                    >
                      <option value="">{isAr ? 'اختر الصف' : 'Select Grade'}</option>
                      <option value="All">{isAr ? 'جميع الصفوف' : 'All Grades'}</option>
                      {gradeLevels.map((g) => (
                        <option key={g.en} value={g.en} className={isDark ? 'bg-[#2A0D12]' : 'bg-white'}>
                          {isAr ? g.ar : g.en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={announcementPinned}
                        onChange={(e) => setAnnouncementPinned(e.target.checked)}
                        className="w-4 h-4 rounded border-[#C9A876]/30 accent-[#8C3B3F]"
                      />
                      <span className={`text-sm ${bodyText}`}>{isAr ? 'تثبيت الإعلان' : 'Pin Announcement'}</span>
                    </label>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={creatingAnnouncement}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] text-white font-semibold text-sm sm:text-base hover:brightness-110 disabled:opacity-50"
                >
                  {creatingAnnouncement ? (isAr ? 'جارٍ النشر...' : 'Posting...') : (isAr ? 'نشر الإعلان' : 'Post Announcement')}
                </button>
              </form>
            </div>

            {/* Announcements List */}
            <div className={`backdrop-blur-xl rounded-[2rem] border overflow-hidden ${cardBg} ${cardShadow}`}>
              <div className="p-5 sm:p-8 pb-4">
                <h3 className={`font-display text-xl sm:text-2xl font-bold mb-1 ${headingText}`}>{isAr ? 'الإعلانات النشطة' : 'Published Release Notes'}</h3>
                <p className={`text-xs ${mutedText}`}>{isAr ? 'جميع التحديثات والإعلانات النشطة' : 'All active updates and announcements'}</p>
              </div>

              {loadingAnnouncements ? (
                <div className="px-5 sm:px-8 pb-8 space-y-2">{[0, 1].map((i) => (<div key={i} className={`h-20 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/5'}`} />))}</div>
              ) : announcements.length === 0 ? (
                <div className={`px-5 sm:px-8 pb-8 text-sm ${mutedText}`}>{isAr ? 'لا توجد إعلانات منشورة' : 'No announcements posted yet'}</div>
              ) : (
                <div className="px-5 sm:px-8 pb-8 space-y-4">
                  {announcements.map((announcement) => (
                    <div key={announcement.id} className={`rounded-xl p-4 border ${isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/20'}`}>
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {announcement.pinned && (
                              <span className="text-xs">📌</span>
                            )}
                            <h4 className={`font-semibold ${headingText}`}>{announcement.title}</h4>
                          </div>
                          <p className={`text-xs ${mutedText}`}>{announcement.author} · {new Date(announcement.createdAt).toLocaleDateString()} · {announcement.gradeLevel === 'All' ? (isAr ? 'جميع الصفوف' : 'All Grades') : announcement.gradeLevel}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteAnnouncement(announcement)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-600 text-xs font-semibold shrink-0"
                        >
                          {isAr ? 'حذف' : 'Delete'}
                        </button>
                      </div>
                      <p className={`text-sm ${bodyText} whitespace-pre-wrap`}>{announcement.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}



        {/* ===== PACKAGES SECTION ===== */}

        {activeSection === 'packages' && <PackageManager />}



      </main>

      {/* ===== Student Profile Modal ===== */}
      {profileStudent && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setProfileStudent(null)} />
          <div className={`relative w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] border p-5 sm:p-8 ${isDark ? 'bg-[#1A0609] border-[#C9A876]/20' : 'bg-[#F8F1E7] border-[#C9A876]/25'} ${cardShadow}`}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className={`font-display text-lg sm:text-xl font-bold ${headingText}`}>{profileStudent.name}</h3>
                <p className={`text-xs sm:text-sm ${bodyText}`}>{profileStudent.email}</p>
              </div>
              <button onClick={() => setProfileStudent(null)} className={`w-9 h-9 flex items-center justify-center rounded-full border ${isDark ? 'border-[#C9A876]/25 text-[#E7C3B6]' : 'border-[#5C1A24]/20 text-[#5C1A24]'}`}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className={`rounded-xl p-3 border ${isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/15'}`}>
                <p className={`text-[11px] uppercase mb-1 ${mutedText}`}>{isAr ? 'الصف' : 'Grade'}</p>
                <p className={`text-sm font-semibold ${headingText}`}>{profileStudent.gradeLevel || '—'}</p>
              </div>
              <div className={`rounded-xl p-3 border ${isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/15'}`}>
                <p className={`text-[11px] uppercase mb-1 ${mutedText}`}>{isAr ? 'الحالة' : 'Status'}</p>
                <StatusBadge status={profileStudent.status} isAr={isAr} />
              </div>
            </div>
            <h4 className={`text-sm font-bold mb-3 ${headingText}`}>{isAr ? 'نتائج الاختبارات' : 'Quiz Scores'}</h4>
            {loadingProfileScores ? (
              <div className="space-y-2">{[0, 1].map((i) => (<div key={i} className={`h-11 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-[#5C1A24]/5'}`} />))}</div>
            ) : profileScores.length === 0 ? (
              <p className={`text-xs sm:text-sm ${mutedText}`}>{isAr ? 'لا توجد محاولات اختبار مسجلة.' : 'No recorded quiz attempts.'}</p>
            ) : (
              <div className="space-y-2">
                {profileScores.map((p) => {
                  const pct = Math.round((p.score / (p.total || 1)) * 100);
                  return (
                    <div key={p.id} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${isDark ? 'bg-black/20 border-[#C9A876]/10' : 'bg-white/60 border-[#C9A876]/15'}`}>
                      <div>
                        <p className={`text-xs sm:text-sm font-semibold ${headingText}`}>{p.quizTitle || (isAr ? 'اختبار' : 'Quiz')}</p>
                        <p className={`text-[11px] ${mutedText}`}>{p.score}/{p.total}</p>
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

      {/* ===== Confirm Modal ===== */}
      <ConfirmModal
        open={confirmState !== null}
        title={confirmState?.title || ''}
        body={confirmState?.body || ''}
        confirmLabel={isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
        cancelLabel={isAr ? 'إلغاء' : 'Cancel'}
        onConfirm={confirmState?.onConfirm || (() => undefined)}
        onCancel={() => setConfirmState(null)}
        isDark={isDark}
      />
    </div>
  );
}

interface StatCardProps {
  cardBg: string;
  cardShadow: string;
  headingText: string;
  mutedText: string;
  accent: string;
  title: string;
  subtitle: string;
  value: string;
}

function StatCard({ cardBg, cardShadow, headingText, mutedText, accent, title, subtitle, value }: StatCardProps) {
  return (
    <div className={`backdrop-blur-xl rounded-2xl p-5 sm:p-6 border ${cardBg} ${cardShadow}`}>
      <h4 className={`text-sm sm:text-base font-semibold mb-1 ${accent}`}>{title}</h4>
      <p className={`text-[11px] sm:text-xs mb-3 sm:mb-4 ${mutedText}`}>{subtitle}</p>
      <div className={`text-2xl sm:text-3xl font-bold ${headingText}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status, isAr }: { status: StudentStatus; isAr: boolean }) {
  const map: Record<string, { en: string; ar: string; cls: string }> = {
    pending: { en: 'Pending', ar: 'بانتظار الموافقة', cls: 'bg-amber-400/10 border-amber-400/30 text-amber-600' },
    active: { en: 'Active', ar: 'مفعل', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' },
    suspended: { en: 'Suspended', ar: 'موقوف', cls: 'bg-rose-500/10 border-rose-400/30 text-rose-600' },
  };
  const info = map[status] || map.active;
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold border ${info.cls}`}>{isAr ? info.ar : info.en}</span>;
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