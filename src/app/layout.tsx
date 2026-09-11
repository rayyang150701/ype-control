import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import './globals.css';
import { Header } from '@/components/header';
import { AdminProvider } from '@/components/admin-context';

export const metadata: Metadata = {
  title: 'Project Zenith - 智慧製造執行方案進度管制表',
  description: 'Project Progress Tracking System for YC-ICT',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400..900;1,400..900&family=Belleza&family=Source+Code+Pro:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet" />
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-body antialiased overflow-x-hidden'
        )}
      >
        <AdminProvider>
          <Header />
          <main className="w-full px-4 py-4 sm:py-6 lg:py-8">
              {children}
          </main>
          <Toaster />
        </AdminProvider>
      </body>
    </html>
  );
}
