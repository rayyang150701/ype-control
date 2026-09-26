
'use client';
import { useState } from 'react';
import { LogOut, User, Users, HelpCircle, Book, Route, Lock, Unlock, Building2, Bot, KeyRound, Calendar } from 'lucide-react';
import { useAdmin } from '@/components/admin-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';


import { LoginDialog } from '@/components/dashboard/login-dialog';
import { ResetPasswordDialog } from '@/components/users/reset-password-dialog';

export function Header() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { toast } = useToast();
  const { currentUser, role, isSuperAdmin, isAdmin, isEditor, isGuest, isLoginDialogOpen, setIsLoginDialogOpen, logout } = useAdmin();
  const [isChangeMyPasswordOpen, setIsChangeMyPasswordOpen] = useState(false);
  
  const startTour = async () => {
    const { driver } = await import("driver.js");

    const driverObj = driver({
      showProgress: true,
      steps: [
        { 
          element: '[data-tour="search"]', 
          popover: { 
            title: '全域搜尋', 
            description: '在這裡輸入案號、專案名稱或TPM窗口等關鍵字，可以快速找到您想查詢的任何專案。',
            side: "bottom", 
            align: 'start' 
          }
        },
        { 
          element: '[data-tour="filter-status"]', 
          popover: { 
            title: '篩選專案狀態', 
            description: '使用此選單可以快速篩選出不同狀態的專案，例如「進行中」、「已完成」或「逾期未報」。',
            side: "bottom", 
            align: 'start' 
          }
        },
        { 
          element: '[data-tour="add-new-project"]', 
          popover: { 
            title: '新增專案', 
            description: '點擊這裡可以一次性建立一個主專案及其下的多個子專案。',
            side: "bottom", 
            align: 'start' 
          }
        },
        {
          element: '[data-tour="on-hold-project"]',
          popover: {
            title: '專案暫緩',
            description: '若有專案或子專案需要暫停，可使用此功能進行標記。',
            side: "bottom",
            align: 'center'
          }
        },
        {
          element: '[data-tour="resume-project"]',
          popover: {
            title: '恢復專案',
            description: '從這裡可以將先前被暫緩的專案或子專案恢復成「進行中」狀態。',
            side: "bottom",
            align: 'center'
          }
        },
        {
          element: '[data-tour="export-all"]',
          popover: {
            title: '匯出總表',
            description: '一鍵將所有專案的最新進度匯出成 Excel 總表，方便線下報告與存檔。',
            side: "bottom",
            align: 'end'
          }
        },
        {
          element: '[data-tour="add-new-log"]',
          popover: {
            title: '新增週報',
            description: '點擊任一專案卡片上的這個按鈕，即可為該子專案快速新增一筆本週進度回報。',
            side: "top",
            align: 'center'
          }
        },
        {
          element: '[data-tour="help-menu"]',
          popover: {
            title: '需要協助嗎？',
            description: '您可以隨時從這裡重新啟動功能導覽，或下載完整的操作手冊。',
            side: "bottom",
            align: 'end'
          }
        }
      ]
    });
    
    driverObj.drive();
  }

  const handleDownload = async () => {
    try {
      const response = await fetch('/manual.pdf');
      if (!response.ok) {
        throw new Error('找不到檔案或網路錯誤');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = '操作手冊.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('下載失敗:', error);
      toast({
        title: "下載失敗",
        description: "無法取得操作手冊，請稍後再試或聯繫管理員。",
        variant: "destructive",
      });
    }
  };


  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
      <div className="w-full px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-4" />

        <div className="flex-1 flex justify-center px-4">
            <Link href="/dashboard" className="font-headline text-2xl md:text-3xl lg:text-4xl font-bold text-primary whitespace-nowrap overflow-hidden text-ellipsis">
                智慧製造執行方案進度管制表
            </Link>
        </div>

        <div className="flex items-center justify-end space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1" data-tour="help-menu">
                  <HelpCircle className="h-4 w-4" />
                  幫助
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={startTour}>
                  <Route className="mr-2 h-4 w-4" />
                  <span>功能導覽</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload}>
                  <Book className="mr-2 h-4 w-4" />
                  <span>下載操作手冊</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {currentUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={`gap-1.5 border text-xs font-semibold shadow-xs ${
                      isSuperAdmin
                        ? 'border-amber-500/50 bg-amber-50 text-amber-900 hover:bg-amber-100'
                        : isAdmin
                        ? 'border-indigo-500/40 bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                        : isEditor
                        ? 'border-blue-500/40 bg-blue-50 text-blue-900 hover:bg-blue-100'
                        : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isSuperAdmin ? (
                      <span className="text-amber-600">👑</span>
                    ) : isAdmin ? (
                      <span className="text-indigo-600">🛡️</span>
                    ) : isEditor ? (
                      <span className="text-blue-600">✏️</span>
                    ) : (
                      <span className="text-slate-500">👁️</span>
                    )}
                    <span>
                      {isSuperAdmin ? '主管理員' : isAdmin ? '管理員' : isEditor ? '編輯者' : '檢視者'}:{' '}
                      {currentUser.displayName || currentUser.username}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                        {isSuperAdmin
                          ? '👑 系統主管理員 (Super Admin)'
                          : isAdmin
                          ? '🛡️ 系統管理員 (Admin)'
                          : isEditor
                          ? '✏️ 協作編輯者 (Editor)'
                          : '👁️ 訪客檢視者 (Viewer)'}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                      {(currentUser.company || currentUser.department) && (
                        <p className="text-[11px] text-slate-500">
                          {[currentUser.company, currentUser.department].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="text-[11px] text-blue-600 font-medium pt-0.5">
                        {isSuperAdmin
                          ? '擁有最高權限（可刪除帳號、升降階、設定密碼）'
                          : isAdmin
                          ? '擁有內部管制、AI診斷與成員維護權限'
                          : isEditor
                          ? '可讀寫管制總表、檢視內部專案追蹤'
                          : '僅擁有唯讀檢視權限'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <>
                      <DropdownMenuGroup>
                        <Link href="/users" passHref>
                          <DropdownMenuItem className="cursor-pointer text-xs">
                            <Users className="mr-2 h-4 w-4" />
                            <span>成員與帳號管理</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link href="/clients" passHref>
                          <DropdownMenuItem className="cursor-pointer text-xs">
                            <Building2 className="mr-2 h-4 w-4" />
                            <span>客戶維護管理</span>
                          </DropdownMenuItem>
                        </Link>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={() => setIsChangeMyPasswordOpen(true)}
                    className="cursor-pointer text-xs text-slate-700"
                  >
                    <KeyRound className="mr-2 h-4 w-4 text-amber-600" />
                    <span>修改個人登入密碼</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="text-destructive focus:text-destructive cursor-pointer text-xs"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>登出系統 (切換為訪客)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-slate-700 border-slate-300 hover:text-primary hover:border-primary/50 transition-colors shadow-xs"
                onClick={() => setIsLoginDialogOpen(true)}
              >
                <Lock className="h-3.5 w-3.5" />
                登入系統
              </Button>
            )}
        </div>
      </div>

      {/* 導覽列分頁：燁輝進度管制表 vs 待辦事項 vs 行程管理 vs 專案差異分析 vs AI分析 */}
      <div className="w-full bg-slate-50/90 border-t border-b border-slate-200/80 px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* 1. 燁輝進度管制表 - 所有人皆可點擊 */}
          <Link
            href="/dashboard"
            prefetch={true}
            className={`px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
              pathname.startsWith('/dashboard') || pathname === '/'
                ? 'bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 border border-transparent'
            }`}
          >
            <span>📊 燁輝進度管制表</span>
          </Link>

          {/* 2. 待辦事項 - 管理者與編輯者開放，訪客提示登入 */}
          {isEditor ? (
            <Link
              href="/internal-tasks"
              prefetch={true}
              className={`px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
                pathname.startsWith('/internal-tasks')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 border border-transparent'
              }`}
            >
              <span>📋 待辦事項</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                toast({
                  title: '需要登入權限',
                  description: '「待辦事項」僅限登入成員檢視，請先登入帳號。',
                });
                setIsLoginDialogOpen(true);
              }}
              className="px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all bg-slate-100/90 text-slate-400 border border-slate-200/80 cursor-not-allowed hover:bg-slate-100"
              title="僅限登入成員存取 (未開放未登入訪客)"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>📋 待辦事項 (登入後檢視)</span>
            </button>
          )}

          {/* 3. 行程管理 - 管理者與編輯者開放，訪客提示登入 */}
          {isEditor ? (
            <Link
              href="/schedules"
              prefetch={true}
              className={`px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
                pathname.startsWith('/schedules')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 border border-transparent'
              }`}
            >
              <span>📅 行程管理</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                toast({
                  title: '需要登入權限',
                  description: '「行程管理」僅限登入成員檢視，請先登入帳號。',
                });
                setIsLoginDialogOpen(true);
              }}
              className="px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all bg-slate-100/90 text-slate-400 border border-slate-200/80 cursor-not-allowed hover:bg-slate-100"
              title="僅限登入成員存取 (未開放未登入訪客)"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>📅 行程管理 (登入後檢視)</span>
            </button>
          )}

          {/* 4. 專案差異分析 - 管理者與編輯者開放，訪客提示登入 */}
          {isEditor ? (
            <Link
              href="/project-variance"
              prefetch={true}
              className={`px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
                pathname.startsWith('/project-variance')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 border border-transparent'
              }`}
            >
              <span>📊 專案差異分析</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                toast({
                  title: '需要登入權限',
                  description: '「專案差異分析」僅限登入成員檢視，請先登入帳號。',
                });
                setIsLoginDialogOpen(true);
              }}
              className="px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all bg-slate-100/90 text-slate-400 border border-slate-200/80 cursor-not-allowed hover:bg-slate-100"
              title="僅限登入成員存取 (未開放未登入訪客)"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>📊 專案差異分析 (登入後檢視)</span>
            </button>
          )}

          {/* 5. 專案KM - 管理者與編輯者開放，訪客提示登入 */}
          {isEditor ? (
            <Link
              href="/km"
              prefetch={true}
              className={`px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
                pathname.startsWith('/km')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 border border-transparent'
              }`}
            >
              <span>📚 專案KM</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                toast({
                  title: '需要登入權限',
                  description: '「專案KM」僅限登入成員檢視，請先登入帳號。',
                });
                setIsLoginDialogOpen(true);
              }}
              className="px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all bg-slate-100/90 text-slate-400 border border-slate-200/80 cursor-not-allowed hover:bg-slate-100"
              title="僅限登入成員存取 (未開放未登入訪客)"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>📚 專案KM (登入後檢視)</span>
            </button>
          )}

          {/* 6. AI分析 - 僅主管理員與管理員開放，編輯者與訪客反灰禁用 */}
          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                if (pathname.startsWith('/internal-tasks')) {
                  window.dispatchEvent(new CustomEvent('open-ai-diagnosis'));
                } else {
                  router.push('/internal-tasks?ai=open');
                }
              }}
              className="px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200/80 shadow-2xs cursor-pointer active:scale-95"
              title="開啟 AI 全專案/個別專案延誤診斷與卡關歷程分析"
            >
              <Bot className="h-4 w-4 text-indigo-600" />
              <span>🤖 AI分析</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (isGuest) {
                  toast({
                    title: '需要管理者權限',
                    description: '「AI分析」僅限管理員以上使用，請先登入帳號。',
                  });
                  setIsLoginDialogOpen(true);
                } else {
                  toast({
                    title: '權限不足',
                    description: 'AI分析功能僅限管理員以上權限使用。編輯者權限為檢視內部專案與維護管制總表。',
                    variant: 'destructive',
                  });
                }
              }}
              className="px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all bg-slate-100/90 text-slate-400 border border-slate-200/80 shadow-none cursor-not-allowed hover:bg-slate-100"
              title="僅限管理員與主管理員使用"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>🤖 AI分析 (管理員專屬)</span>
            </button>
          )}

          {/* 7. PM學習地圖 - 億威電子 PMO 培訓與個人工作區 */}
          {isEditor ? (
            <Link
              href="/pm-learning"
              prefetch={true}
              className={`px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
                pathname.startsWith('/pm-learning')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 border border-transparent'
              }`}
            >
              <span>🎯 PM學習地圖</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                toast({
                  title: '需要登入權限',
                  description: '「PM學習地圖」僅限登入成員檢視，請先登入帳號。',
                });
                setIsLoginDialogOpen(true);
              }}
              className="px-3.5 py-1.5 sm:py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all bg-slate-100/90 text-slate-400 border border-slate-200/80 cursor-not-allowed hover:bg-slate-100"
              title="僅限登入成員存取 (未開放未登入訪客)"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>🎯 PM學習地圖 (登入後檢視)</span>
            </button>
          )}
        </div>
        <div className="text-xs text-slate-500 font-medium hidden lg:block">
          {pathname.startsWith('/clients')
            ? '🏢 客戶維護管理：管理所有合作客戶名單'
            : pathname.startsWith('/users')
            ? '👥 成員管理：維護系統使用者、所屬客戶與部門'
            : pathname.startsWith('/schedules')
            ? '📅 行程管理：跨廠調校、會議與國定假日行事曆'
            : pathname.startsWith('/km')
            ? '📚 專案KM：跨專案關鍵文件、教育訓練教材與驗收資料即時檢索'
            : pathname.startsWith('/project-variance')
            ? '📊 專案差異分析：四大階段預定規劃期程 vs 待辦事項實際進度比較'
            : pathname.startsWith('/pm-learning')
            ? '🎯 PM學習地圖：億威電子 PMO 團隊培訓、職能發展與個人工作區'
            : pathname.startsWith('/internal-tasks')
            ? '🎯 內部專案管理視圖：隨時掌握「等誰處理 (Waiting-on)」與跟催期程'
            : '👁️ 客戶視圖：燁輝智慧製造方案進度總覽'}
        </div>
      </div>

      <LoginDialog isOpen={isLoginDialogOpen} setIsOpen={setIsLoginDialogOpen} />
      {isChangeMyPasswordOpen && currentUser && (
        <ResetPasswordDialog
          isOpen={isChangeMyPasswordOpen}
          setIsOpen={setIsChangeMyPasswordOpen}
          user={currentUser as any}
          onSuccess={() => {
            toast({ title: '個人密碼修改成功', description: '下次登入請使用新密碼。' });
          }}
        />
      )}
    </header>
  );
}
