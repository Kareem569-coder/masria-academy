'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'en' | 'ar';

interface Translations {
  appName: string;
  tagline: string;
  login: string;
  signup: string;
  name: string;
  email: string;
  password: string;
  role: string;
  student: string;
  parent: string;
  gradeLevel: string;
  processing: string;
  welcomeStudent: string;
  welcomeParent: string;
  studentPortal: string;
  parentPortal: string;
  myDashboard: string;
  scienceLessons: string;
  myGrades: string;
  linkCode: string;
  copyCode: string;
  copied: string;
  logout: string;
  linkStudent: string;
  linkStudentDesc: string;
  enterLinkCode: string;
  linkStudentBtn: string;
  linking: string;
  linkedStudents: string;
  noStudentsLinked: string;
  noStudentsDesc: string;
  viewDetails: string;
  studentDetails: string;
  studentInfo: string;
  linkedSince: string;
  academicPerformance: string;
  currentGrade: string;
  attendanceRecord: string;
  overall: string;
  present: string;
  absent: string;
  recentAttendance: string;
  close: string;
  dashboardOverview: string;
  myCourses: string;
  activeCourses: string;
  progress: string;
  overallCompletion: string;
  assignments: string;
  pendingTasks: string;
  physics: string;
  chemistry: string;
  biology: string;
  earthScience: string;
  astronomy: string;
  environmentalScience: string;
  video: string;
  pdf: string;
  chapterQuiz: string;
  labReport: string;
  midtermExam: string;
  project: string;
  // Exam Grading System
  examsGrading: string;
  createExam: string;
  examTitle: string;
  examDate: string;
  totalMarks: string;
  createExamBtn: string;
  selectExam: string;
  gradeStudents: string;
  saveGrades: string;
  score: string;
  feedback: string;
  noExams: string;
  noExamsDesc: string;
  examResults: string;
  offlineExams: string;
  percentage: string;
  teacherFeedback: string;
  // Announcement Board
  announcements: string;
  classBoard: string;
  createAnnouncement: string;
  announcementTitle: string;
  announcementContent: string;
  targetGrade: string;
  allGrades: string;
  pinPost: string;
  postAnnouncement: string;
  deleteAnnouncement: string;
  noAnnouncements: string;
  noAnnouncementsDesc: string;
  author: string;
  pinned: string;
}

const translations: Record<Language, Translations> = {
  en: {
    appName: 'MASRIA',
    tagline: 'Software Engineering Academy',
    login: 'Login',
    signup: 'Sign Up',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    role: 'Role',
    student: 'Student',
    parent: 'Parent',
    gradeLevel: 'Grade Level',
    processing: 'Processing...',
    welcomeStudent: 'Welcome to Your Student Dashboard',
    welcomeParent: 'Welcome to Your Parent Dashboard',
    studentPortal: 'Student Portal',
    parentPortal: 'Parent Portal',
    myDashboard: 'My Dashboard',
    scienceLessons: 'Science Lessons',
    myGrades: 'My Grades',
    linkCode: 'Link Code',
    copyCode: 'Copy Code',
    copied: 'Copied!',
    logout: 'Logout',
    linkStudent: 'Link a Student Account',
    linkStudentDesc: 'Enter your child\'s unique link code to connect their account with yours.',
    enterLinkCode: 'Enter link code (e.g., NUC-8492)',
    linkStudentBtn: 'Link Student',
    linking: 'Linking...',
    linkedStudents: 'Linked Students',
    noStudentsLinked: 'No students linked yet',
    noStudentsDesc: 'Use the form above to link your child\'s account using their unique link code.',
    viewDetails: 'View Details →',
    studentDetails: 'Student Details',
    studentInfo: 'Student Information',
    linkedSince: 'Linked Since',
    academicPerformance: 'Academic Performance',
    currentGrade: 'Current Grade',
    attendanceRecord: 'Attendance Record',
    overall: 'Overall',
    present: 'Present',
    absent: 'Absent',
    recentAttendance: 'Recent Attendance',
    close: 'Close',
    dashboardOverview: 'Dashboard Overview',
    myCourses: 'My Courses',
    activeCourses: 'Active Courses',
    progress: 'Progress',
    overallCompletion: 'Overall Completion',
    assignments: 'Assignments',
    pendingTasks: 'Pending Tasks',
    physics: 'Physics',
    chemistry: 'Chemistry',
    biology: 'Biology',
    earthScience: 'Earth Science',
    astronomy: 'Astronomy',
    environmentalScience: 'Environmental Science',
    video: 'Video',
    pdf: 'PDF',
    chapterQuiz: 'Chapter 1 Quiz',
    labReport: 'Lab Report',
    midtermExam: 'Midterm Exam',
    project: 'Project',
    // Exam Grading System
    examsGrading: 'Exams & Grading',
    createExam: 'Create Exam',
    examTitle: 'Exam Title',
    examDate: 'Exam Date',
    totalMarks: 'Total Marks',
    createExamBtn: 'Create Exam',
    selectExam: 'Select Exam',
    gradeStudents: 'Grade Students',
    saveGrades: 'Save Grades',
    score: 'Score',
    feedback: 'Feedback',
    noExams: 'No exams created yet',
    noExamsDesc: 'Create an exam to start grading students',
    examResults: 'Exam Results',
    offlineExams: 'Offline Exams',
    percentage: 'Percentage',
    teacherFeedback: 'Teacher Feedback',
    // Announcement Board
    announcements: 'Announcements',
    classBoard: 'Class Board',
    createAnnouncement: 'Create Announcement',
    announcementTitle: 'Announcement Title',
    announcementContent: 'Announcement Content',
    targetGrade: 'Target Grade',
    allGrades: 'All Grades',
    pinPost: 'Pin Post',
    postAnnouncement: 'Post Announcement',
    deleteAnnouncement: 'Delete',
    noAnnouncements: 'No announcements posted yet',
    noAnnouncementsDesc: 'Stay tuned for updates from your teacher',
    author: 'Author',
    pinned: 'Pinned',
  },
  ar: {
    appName: 'MASRIA',
    tagline: 'أكاديمية هندسة البرمجيات',
    login: 'تسجيل الدخول',
    signup: 'إنشاء حساب',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    role: 'الدور',
    student: 'طالب',
    parent: 'ولي أمر',
    gradeLevel: 'السنة الدراسية',
    processing: 'جاري المعالجة...',
    welcomeStudent: 'مرحباً بك في لوحة تحكم الطالب',
    welcomeParent: 'مرحباً بك في لوحة تحكم ولي الأمر',
    studentPortal: 'بوابة الطالب',
    parentPortal: 'بوابة ولي الأمر',
    myDashboard: 'لوحة التحكم',
    scienceLessons: 'دروس العلوم',
    myGrades: 'درجاتي',
    linkCode: 'رمز الربط',
    copyCode: 'نسخ الرمز',
    copied: 'تم النسخ!',
    logout: 'تسجيل الخروج',
    linkStudent: 'ربط حساب طالب',
    linkStudentDesc: 'أدخل الرمز الفريد لطفلك لربط حسابه بحسابك.',
    enterLinkCode: 'أدخل رمز الربط (مثال: NUC-8492)',
    linkStudentBtn: 'ربط الطالب',
    linking: 'جاري الربط...',
    linkedStudents: 'الطلاب المرتبطون',
    noStudentsLinked: 'لا يوجد طلاب مرتبطين بعد',
    noStudentsDesc: 'استخدم النموذج أعلاه لربط حساب طفلك باستخدام رمز الربط الفريد الخاص به.',
    viewDetails: 'عرض التفاصيل ←',
    studentDetails: 'تفاصيل الطالب',
    studentInfo: 'معلومات الطالب',
    linkedSince: 'مرتبط منذ',
    academicPerformance: 'الأداء الأكاديمي',
    currentGrade: 'الدرجة الحالية',
    attendanceRecord: 'سجل الحضور',
    overall: 'الإجمالي',
    present: 'حاضر',
    absent: 'غائب',
    recentAttendance: 'الحضور الأخير',
    close: 'إغلاق',
    dashboardOverview: 'نظرة عامة على لوحة التحكم',
    myCourses: 'دوراتي',
    activeCourses: 'الدورات النشطة',
    progress: 'التقدم',
    overallCompletion: 'إكمال الإجمالي',
    assignments: 'المهام',
    pendingTasks: 'المهام المعلقة',
    physics: 'الفيزياء',
    chemistry: 'الكيمياء',
    biology: 'الأحياء',
    earthScience: 'علوم الأرض',
    astronomy: 'علم الفلك',
    environmentalScience: 'العلوم البيئية',
    video: 'فيديو',
    pdf: 'ملف PDF',
    chapterQuiz: 'اختبار الفصل الأول',
    labReport: 'تقرير المختبر',
    midtermExam: 'امتحان منتصف الفصل',
    project: 'مشروع',
    // Exam Grading System
    examsGrading: 'الاختبارات والتقييم',
    createExam: 'إنشاء اختبار',
    examTitle: 'عنوان الاختبار',
    examDate: 'تاريخ الاختبار',
    totalMarks: 'الدرجة الكلية',
    createExamBtn: 'إنشاء الاختبار',
    selectExam: 'اختر الاختبار',
    gradeStudents: 'تقييم الطلاب',
    saveGrades: 'حفظ الدرجات',
    score: 'الدرجة',
    feedback: 'ملاحظات',
    noExams: 'لا توجد اختبارات بعد',
    noExamsDesc: 'قم بإنشاء اختبار لبدء تقييم الطلاب',
    examResults: 'نتائج الاختبارات',
    offlineExams: 'الاختبارات الورقية',
    percentage: 'النسبة المئوية',
    teacherFeedback: 'ملاحظات المعلمة',
    // Announcement Board
    announcements: 'الإعلانات',
    classBoard: 'لوحة الفصل',
    createAnnouncement: 'إنشاء إعلان',
    announcementTitle: 'عنوان الإعلان',
    announcementContent: 'محتوى الإعلان',
    targetGrade: 'الصف المستهدف',
    allGrades: 'جميع الصفوف',
    pinPost: 'تثبيت الإعلان',
    postAnnouncement: 'نشر الإعلان',
    deleteAnnouncement: 'حذف',
    noAnnouncements: 'لا توجد إعلانات بعد',
    noAnnouncementsDesc: 'ابق على اطلاع بتحديثات من معلمتك',
    author: 'الكاتب',
    pinned: 'مثبت',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Keep the server render and first client render identical. The persisted
  // preference is restored after hydration.
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage === 'ar') setLanguage('ar');
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t: translations[language], dir }}>
      {children}
    </LanguageContext.Provider>
  );
};
