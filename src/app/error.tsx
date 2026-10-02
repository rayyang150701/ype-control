'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('全站客戶端未捕獲異常:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900">系統發生非預期錯誤</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            系統已攔截此錯誤，未影響雲端資料庫。請點擊重新整理或返回主頁。
          </p>
        </div>

        {error?.message && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-[11px] font-mono text-slate-600 overflow-x-auto max-h-32">
            {error.message}
          </div>
        )}

        <div className="flex justify-center gap-2 pt-2">
          <Button
            onClick={() => reset()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重試</span>
          </Button>

          <Button variant="outline" asChild className="text-xs">
            <Link href="/dashboard" className="flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5" />
              <span>返回總表</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
