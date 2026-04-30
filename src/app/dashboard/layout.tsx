'use client';

import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, isDemo } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">載入中...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo & Title */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold text-sm">
                  燁
                </div>
                <span className="text-sm text-muted-foreground hidden sm:inline">燁輝企業股份有限公司</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-primary">
                燁輝智慧製造執行方案進度管制表
              </h1>
            </div>

            {/* Right: User info & actions */}
            <div className="flex items-center gap-3">
              {isDemo && (
                <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  Demo 模式
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {user.displayName || user.email}
              </span>
              {user.role === 'admin' && (
                <button
                  onClick={() => router.push('/users')}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  👥 成員管理
                </button>
              )}
              <button
                onClick={signOut}
                className="text-sm text-muted-foreground hover:text-destructive transition-colors"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
