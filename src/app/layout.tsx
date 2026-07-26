import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Nucleus Platform | منصة الإدارة والتعليم الذكي",
  description: "منصة متكاملة لإدارة المنظومة التعليمية، تربط بين المعلم، الطالب، وولي الأمر في بيئة تفاعلية ذكية وسريعة.",
  keywords: ["Nucleus", "Nucleus Platform", "منصة تعليمية", "إدارة المدارس", "نظام تعليمي"],
  
  // الإعدادات دي مسؤولة عن شكل الرابط على فيسبوك وواتساب ولينكدإن
  openGraph: {
    title: "Nucleus Platform | منصة الإدارة والتعليم الذكي",
    description: "منصة متكاملة لإدارة المنظومة التعليمية، تربط بين المعلم، الطالب، وولي الأمر.",
    url: "https://nucleus-platform-delta.vercel.app",
    siteName: "Nucleus Platform",
    images: [
      {
        url: "/teacher-mobile.png", // ده مسار الصورة اللي حطيناها في فولدر public
        width: 1200,
        height: 630,
        alt: "Nucleus Platform Preview",
      },
    ],
    locale: "ar_EG",
    type: "website",
  },

  // الإعدادات دي مسؤولة عن شكل الرابط لو اتبعت على تويتر (X)
  twitter: {
    card: "summary_large_image",
    title: "Nucleus Platform | منصة الإدارة والتعليم الذكي",
    description: "منصة متكاملة لإدارة المنظومة التعليمية، تربط بين المعلم، الطالب، وولي الأمر.",
    images: ["/teacher-mobile.png"],
  },
};
export const viewport = {
  themeColor: '#000000', // تقدر تغير الكود الأسود ده للون الأساسي بتاع المنصة بتاعتك
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // بيمنع الزوم الغلط على الموبايل عشان يفضل شكل التطبيق مظبوط
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
