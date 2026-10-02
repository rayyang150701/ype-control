'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function PMLearningError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('PM Learning Hub 運行時攔截到客戶端例外:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900">
            專案-Map 畫面載入發生暫時性異常
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            系統已成功攔截此異常，您的課程進度與文章資料皆已妥善保存於資料庫中，請點擊下方按鈕重新載入。
          </p>
        </div>

        {/* 錯誤詳情折疊 (方便排查) */}
        {error?.message && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-[11px] font-mono text-slate-600 overflow-x-auto max-h-32">
            <span className="font-bold text-rose-600">Error: </span>
            {error.message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Button
            onClick={() => reset()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重新載入頁面</span>
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
