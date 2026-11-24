'use client';

import { useEffect, useState } from 'react';

const ROUTES = ['/dashboard', '/internal-tasks', '/ai-todo', '/schedules', '/project-variance', '/km', '/pm-learning', '/users', '/clients'];

/** 網址大小寫不同、夾空白或後面黏到標點文字時，找出原本要去的頁面 */
function guessRoute(pathname: string): string | undefined {
  let path = pathname;
  try { path = decodeURIComponent(pathname); } catch {}
  const normalized = path.replace(/\s+/g, '').toLowerCase().match(/^\/[a-z-]+/)?.[0];
  return ROUTES.find((r) => r === normalized && r !== pathname);
}

export default function NotFound() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const target = guessRoute(window.location.pathname);
    if (target) window.location.replace(target);
    else setChecked(true);
  }, []);

  if (!checked) return <div className="py-16 text-center text-muted-foreground">載入中...</div>;

  // 使用完整換頁的 <a>，離開 404 狀態後登入才能正常執行
  return (
    <div className="space-y-5 py-16 text-center">
      <p className="text-lg font-semibold">找不到這個網頁，網址可能打錯了</p>
      <div className="flex flex-col items-center gap-3">
        <a href="/ai-todo" className="text-blue-700 hover:underline">AI 快速輸入待辦</a>
        <a href="/internal-tasks" className="text-blue-700 hover:underline">專案待辦</a>
        <a href="/dashboard" className="text-blue-700 hover:underline">進度管制表</a>
      </div>
    </div>
  );
}
