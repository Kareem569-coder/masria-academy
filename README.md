# MASRIA Academy

MASRIA is an education platform for practical software engineering and programming learning. The name represents **Motivation Assisting solution resources integration Abilities**: a role-based learning environment that connects instructional content, assessment, progress, and family visibility.

The platform currently targets:

- **Students**, who follow ordered learning modules, watch or open lesson content, complete quizzes, and review grades.
- **Parents**, who link student accounts and monitor quiz results, teacher-graded exams, and announcements.
- **Teachers and administrators**, who approve accounts, manage lessons and quizzes, create exams, grade students, and publish announcements.

The interface supports English and Arabic, including right-to-left layout, and is designed for responsive desktop and mobile use.

## Architecture and Tech Stack

- **Next.js 16.2.10** using the App Router
- **React 19.2.4** with client components and React hooks
- **TypeScript 5** with strict compiler settings
- **Tailwind CSS 4** through `@tailwindcss/postcss`
- **Firebase Authentication** for email/password accounts
- **Cloud Firestore** for profiles, lessons, assessments, results, and announcements
- **Next Image** for optimized splash-screen imagery

### Directory Structure

```text
src/
	app/
		page.tsx                    Authentication portal and role redirects
		layout.tsx                  Root metadata, fonts, and context providers
		globals.css                 Theme variables and shared visual utilities
		student-dashboard/page.tsx  Student learning and assessment workspace
		parent-dashboard/page.tsx   Parent linking and student monitoring workspace
		teacher-dashboard/page.tsx  Teacher administration and content workspace
		manifest.ts                 PWA manifest
		robots.ts                   Crawler rules
		sitemap.ts                  Sitemap generation
	components/
		SplashScreen.tsx            Branded animated startup screen
		TechLogo.tsx                Reusable MASRIA monogram/logo
	context/
		AuthContext.tsx             Firebase auth, roles, signup, and linking
		LanguageContext.tsx         English/Arabic translations and direction
	types/
		models.ts                   Shared domain models and error helpers
	lib/
		firebase.ts                 Validated Firebase initialization
		utils.ts                    YouTube URL normalization
```

The application is currently client-driven. Dashboard pages fetch and mutate Firestore directly through the Firebase Web SDK; there are no custom API routes or server actions.

## Routes and Portals

| Route | Purpose |
| --- | --- |
| `/` | Splash screen, login, signup, role selection, grade selection, and role-based redirect |
| `/student-dashboard` | Lessons, ordered progress, quizzes, quiz history, exam results, and announcements |
| `/parent-dashboard` | Student-code linking, linked-student cards, and student detail modal |
| `/teacher-dashboard` | Analytics, student approval, lesson CMS, quiz builder, exam grading, and announcements |
| `/manifest.webmanifest` | PWA metadata |
| `/robots.txt` | Crawler policy; dashboard routes are disallowed from indexing |
| `/sitemap.xml` | Public sitemap containing the main platform URL |

There are no separate course-detail, profile, assignment, code-runner, or API routes. Dashboard subviews are local tabs or sections managed with React state.

## Role and Authorization Matrix

| Capability | Student | Parent | Teacher/admin |
| --- | --- | --- | --- |
| Read own profile | Yes | Yes | Yes |
| Read all student profiles | No | No | Yes |
| Read published lessons | Yes, matching grade | Yes, if permitted by rules | Yes, including drafts |
| Complete lessons and submit quizzes | Yes | No | No |
| Read own results | Yes | No | Yes |
| Read linked-student results | No | Yes | Yes |
| Create or grade exams | No | No | Yes |
| Create or manage lessons | No | No | Yes |
| Create or manage announcements | No | No | Yes |
| Approve, suspend, or delete students | No | No | Yes |

The client checks teacher access with the email allowlist in [src/context/AuthContext.tsx](src/context/AuthContext.tsx) and the dashboard pages. The same allowlist is enforced server-side in [firestore.rules](firestore.rules), which is the actual database security boundary. Client-side redirects alone must not be treated as authorization.

Current teacher emails:

- `aymankareem548@gmail.com`
- `mariam@masria.academy`

## Firestore Collections and Schema

The shared TypeScript contracts live in [src/types/models.ts](src/types/models.ts). Firestore documents include an implicit document ID represented as `id` when loaded by the client.

### `users`

```text
name: string
email: string
role: 'student' | 'parent'
status: 'pending' | 'active' | 'suspended'
gradeLevel?: string
linkCode?: string                 // Student-to-parent code, e.g. NUC-AB12
completedLessons?: string[]       // Completed lesson document IDs
linkedStudents?: LinkedStudent[]  // Parent display records
linkedStudentIds?: string[]       // Parent authorization IDs used by rules
createdAt?: string
```

`linkedStudents` contains objects with `uid`, `name`, `email`, `linkedAt`, and optional `gradeLevel`. New parent links should maintain both `linkedStudents` and `linkedStudentIds`.

### `lessons`

```text
title_en: string
title_ar: string
duration: string
type: 'video' | 'pdf' | 'quiz_only' | 'hybrid'
gradeLevel: string
order?: number | null
videoUrl?: string | null
pdfUrl?: string | null
isPublished?: boolean
quiz?: LessonQuiz | null
createdAt?: string
```

`quiz` contains optional bilingual titles and a `questions` array. Each question has bilingual text, four bilingual options, and a zero-based `correct` option index. Students query only lessons where `isPublished == true` and the grade matches.

### `exams`

```text
title: string
gradeLevel: string
totalMarks: number
date: string
createdAt?: string
```

Teachers create exams for a grade level. Students or other authenticated users may read exams permitted for their grade by the rules.

### `exam_results`

```text
examId?: string
examTitle: string
studentId: string
studentName?: string
gradeLevel?: string
score: number
totalMarks: number
feedback?: string
updatedAt: string
```

Teacher grade saves use deterministic IDs in the form `${examId}_${studentId}` and `setDoc(..., { merge: true })`, so later saves update the existing result.

### `performance`

```text
studentId?: string
studentName?: string
gradeLevel?: string | null
lessonId?: string
subject?: string
quizTitle?: string
score: number
total: number
passed?: boolean
date?: string
```

Students create their own online quiz attempts. Students can read their own attempts, parents can read attempts for normalized linked student IDs, and teachers can read the collection for analytics.

### `announcements`

```text
title: string
content: string
gradeLevel: string              // A grade value or 'All'
author: string
pinned: boolean
createdAt: string
```

Announcements are filtered by grade in student and parent views and sorted with pinned items first.

## Local Setup

### Prerequisites

- Node.js compatible with the installed Next.js version
- npm
- A Firebase project with Email/Password Authentication and Cloud Firestore enabled
- Firebase CLI for deploying rules

### Install

```bash
npm install
```

### Environment Variables

Create `.env.local` in the project root. The current configuration targets the `masria-16b8f` Firebase project:

```env
NEXT_PUBLIC_FIREBASE_API_KEY="your-masria-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="masria-16b8f.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="masria-16b8f"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="masria-16b8f.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="808390544358"
NEXT_PUBLIC_FIREBASE_APP_ID="1:808390544358:web:e12bc18d55eb12983fe427"
```

All six values are required by [src/lib/firebase.ts](src/lib/firebase.ts). `NEXT_PUBLIC_` is expected for browser-side Firebase configuration; Firebase API keys are not treated as secrets. Never commit private service-account credentials.

### Development and Validation Commands

```bash
npm run dev       # Start the local development server at http://localhost:3000
npm run lint      # Run ESLint
npm run build     # Create and type-check the production build
npm run start     # Serve the production build locally
npm run test:rules # Run Firestore Rules tests with the local emulator
```

## Security and Deployment

### Firestore Rules

[firestore.rules](firestore.rules) denies all unspecified reads and writes. It enforces authentication, ownership, the teacher email allowlist, published lesson access, grade-based exam reads, student/parent result visibility, and teacher-only administrative writes.

Deploy from the project root after authenticating with the Firebase CLI and selecting the MASRIA project:

```bash
firebase login
firebase use masria-16b8f
firebase deploy --only firestore:rules
```

Before deployment, verify that existing parent profiles have `linkedStudentIds` populated. The app maintains this field for new parent accounts and new links; older records may require a one-time migration.

Student signup also creates a minimal `linkCodes/{code}` document containing only the student ID, active state, and timestamps. Existing students who were created before this collection was introduced need a one-time, trusted migration that creates one active `linkCodes` document for each valid existing `users/{uid}.linkCode`. Do not run this migration from an untrusted browser client, and do not delete existing `linkedStudents` or `linkCode` fields.

### Vercel Checklist

1. Import the repository into Vercel and use the default Next.js build settings.
2. Add all six `NEXT_PUBLIC_FIREBASE_*` variables to the required Vercel environments: Preview and Production at minimum.
3. Confirm the values reference `masria-16b8f`, not a legacy Firebase project.
4. Add the Vercel deployment domain to Firebase Authentication authorized domains.
5. Deploy `firestore.rules` separately with the Firebase CLI; Vercel does not deploy Firestore rules automatically.
6. Confirm Firestore indexes and security rules in the Firebase console if a compound query requests one.
7. Run `npm run lint` and `npm run build` before promoting a deployment.
8. Verify teacher email access, pending student approval, parent linking, lesson publication, quiz submission, and exam grading in a non-production test account.

## Operational Notes

- Authentication and Firestore are initialized once through `getApps().length ? getApp() : initializeApp(...)`.
- Lesson completion is persisted in the student profile through `completedLessons`.
- The UI is bilingual through `LanguageProvider`; Arabic switches the root direction to RTL.
- Teacher, student, and parent dashboards intentionally share the visual language but currently keep most dashboard markup local to each page.
- `firebase.json` points Firebase CLI deployments to `firestore.rules` and `firestore.indexes.json`; project selection should be confirmed before deployment because no project alias is committed.
