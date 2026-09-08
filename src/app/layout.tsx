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

export const metadata: Metadata = {
  metadataBase: new URL('https://masria-academy.vercel.app'),
  title: 'MASRIA Academy | Eng. Kareem Ezzeldin',
  description: 'MASRIA Academy for software engineering, programming, algorithms, systems, and practical product development by Eng. Kareem Ezzeldin.',
  keywords: ['MASRIA', 'Software Academy', 'Kareem Ezzeldin', 'Programming', 'Algorithms', 'System Design', 'Full Stack'],
  icons: {
    icon: '/icon-192x192.png',
    shortcut: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
  openGraph: {
    title: 'MASRIA Academy | Eng. Kareem Ezzeldin',
    description: 'Software engineering academy for practical learning in programming, systems, and modern development.',
    url: 'https://masria-academy.vercel.app',
    siteName: 'MASRIA Academy',
    images: [
      {
        url: '/teacher-mobile.png',
        width: 1200,
        height: 630,
        alt: 'MASRIA Academy Preview',
      },
    ],
    locale: 'ar_EG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MASRIA Academy | Eng. Kareem Ezzeldin',
    description: 'Software engineering academy for practical learning in programming, systems, and modern development.',
    images: ['/teacher-mobile.png'],
  },
};

export const viewport = {
  themeColor: '#06b6d4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
