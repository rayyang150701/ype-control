'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PMLearningCourse, PMLearningViewMode, DEFAULT_PM_CATEGORIES, PMLearningContentType } from '@/types/pm-learning';
import { User, Client } from '@/types';
import { useAdmin } from '@/components/admin-context';
import { TeamView } from './team-view';
import { MyLearningView } from './my-learning-view';
import { WeeklyKPIView } from './weekly-kpi-view';
import { CourseFormDialog } from './course-form-dialog';
import { CategoryManagerDialog } from './category-manager-dialog';
import { getPMLearningCourses } from '@/lib/pm-learning-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Compass,
  Users,
  User as UserIcon,
  GraduationCap,
  Sparkles,
  Layers,
  ArrowRight,
  BarChart3,
  Lock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PMLearningClientProps {
  initialCourses: PMLearningCourse[];
  users: User[];
  clients: Client[];
  initialCategories?: string[];
}

class PMErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PM Learning Hub 畫面渲染捕捉異常:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const fullDetails = [
        `Error: ${this.state.error?.name || 'Error'}: ${this.state.error?.message || ''}`,
        '',
        '--- Error Stack ---',
        this.state.error?.stack || 'No stack available',
        '',
        '--- Component Stack ---',
        this.state.errorInfo?.componentStack || 'No component stack available',
      ].join('\n');

      return (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 sm:p-8 text-center space-y-4 shadow-xs my-4 max-w-4xl mx-auto">
          <div className="text-rose-600 font-bold text-base">⚠️ 畫面載入發生暫時性顯示問題</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            系統已攔截渲染錯誤。下方提供即時除錯追蹤棧 (Component Stack)，可直接查看具體出錯之組件位置：
          </p>
          {this.state.error && (
            <div className="text-left bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono max-w-3xl mx-auto overflow-auto border border-slate-800 space-y-3 shadow-inner">
              <div className="text-rose-400 font-bold text-sm">
                {this.state.error.name}: {this.state.error.message}
              </div>

              {this.state.errorInfo?.componentStack && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="text-emerald-400 font-semibold text-xs mb-1">
                    📌 發生錯誤的組件調用棧 (Component Stack)：
                  </div>
                  <pre className="text-[11px] font-mono text-emerald-300 bg-black/40 p-3 rounded border border-slate-800 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}

              {this.state.error.stack && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="text-amber-400 font-semibold text-xs mb-1">
                    🔍 原始 JS 調用堆疊 (Error Stack)：
                  </div>
                  <pre className="text-[10px] font-mono text-slate-400 bg-black/40 p-3 rounded border border-slate-800 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                    {this.state.error.stack}
                  </pre>
                </div>
              )}
            </div>
          )}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                try {
                  navigator.clipboard.writeText(fullDetails);
                  alert('已複製錯誤堆疊資訊至剪貼簿！');
                } catch {
                  // fallback
                }
              }}
              variant="outline"
              className="text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              📋 複製錯誤堆疊 (Copy Stack)
            </Button>
            <Button
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              🔄 重新整理畫面
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function PMLearningClient({
  initialCourses,
  users,
  clients,
  initialCategories = DEFAULT_PM_CATEGORIES,
}: PMLearningClientProps) {
  const router = useRouter();
  const { currentUser, isEditor, isAdmin, permissions, isLoaded, setIsLoginDialogOpen } = useAdmin();
  const [courses, setCourses] = useState<PMLearningCourse[]>(initialCourses);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<PMLearningViewMode>('personal');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogInitialType, setCreateDialogInitialType] = useState<PMLearningContentType>('course');
  const [courseToEdit, setCourseToEdit] = useState<PMLearningCourse | null>(null);
  const [defaultAssignedUserId, setDefaultAssignedUserId] = useState<string | undefined>(undefined);

  // 開啟建立對話框，可指定預設受訓成員與預設載體型態 (如文章/影音/閱讀)
  const handleOpenCreateDialog = (targetUserId?: string, initialType: PMLearningContentType = 'course') => {
    setDefaultAssignedUserId(targetUserId);
    setCreateDialogInitialType(initialType);
    setCourseToEdit(null);
    setIsCreateDialogOpen(true);
  };

  // 篩選限定「億威電子 · PMO / PM 部門」人員清單
  const pmoMembers = useMemo(() => {
    const list = (users || []).filter((u) => {
      const isEmmt = (u.clientName || '').includes('億威');
      const dept = (u.department || '').toLowerCase().trim();
      const isPmoDept =
        dept === 'pm' ||
        dept === 'pmo' ||
        dept.includes('專案') ||
        dept.includes('管理');
      const isStaffRole = u.role === 'super_admin' || u.role === 'admin';
      return (isEmmt && (isPmoDept || isStaffRole)) || dept === 'pm' || dept === 'pmo';
    });

    // 若篩選為空（防呆），則使用所有億威成員
    if (list.length === 0) {
      return (users || []).filter((u) => (u.clientName || '').includes('億威'));
    }
    return list;
  }, [users]);

  // 尋找名字/帳號/Email 含有 james 的 PMO 成員
  const findJamesMember = (members: User[]): User | undefined => {
    return members.find((m) => {
      const d = (m.displayName || '').toLowerCase();
      const u = (m.username || '').toLowerCase();
      const e = (m.email || '').toLowerCase();
      return d.includes('james') || u.includes('james') || e.includes('james');
    });
  };

  // 個人視角目前選中的受訓成員 UID：預設為 James
  const [activeUserId, setActiveUserId] = useState<string>(() => {
    const james = findJamesMember(pmoMembers);
    if (james) return james.uid;
    if (currentUser && pmoMembers.some((m) => m.uid === currentUser.uid)) {
      return currentUser.uid;
    }
    return pmoMembers[0]?.uid || '';
  });

  const [isManualSelection, setIsManualSelection] = useState<boolean>(false);

  // 當 pmoMembers 載入或更新時，若尚未手動指定，優先鎖定預設為 James
  useEffect(() => {
    if (!isManualSelection && pmoMembers.length > 0) {
      const james = findJamesMember(pmoMembers);
      let targetId = '';
      if (james) {
        targetId = james.uid;
      } else if (currentUser && pmoMembers.some((m) => m.uid === currentUser.uid)) {
        targetId = currentUser.uid;
      } else if (!activeUserId) {
        targetId = pmoMembers[0].uid;
      }
      
      if (targetId && activeUserId !== targetId) {
        setActiveUserId(targetId);
      }
    }
  }, [currentUser, pmoMembers, isManualSelection, activeUserId]);

  // 確保前端狀態中的 course 資料具備嚴格的陣列與物件預設值
  const sanitizeCourse = (course: PMLearningCourse): PMLearningCourse => {
    return {
      ...course,
      assignedUserIds: Array.isArray(course.assignedUserIds) ? course.assignedUserIds : [],
      assignedUserNames: Array.isArray(course.assignedUserNames) ? course.assignedUserNames : [],
      defaultChecklist: Array.isArray(course.defaultChecklist) ? course.defaultChecklist : [],
      memberProgress:
        course.memberProgress && typeof course.memberProgress === 'object'
          ? course.memberProgress
          : {},
    };
  };

  // 新增或更新課程回調
  const handleCourseSaved = (savedCourse: PMLearningCourse) => {
    const cleanCourse = sanitizeCourse(savedCourse);
    setCourses((prev) => {
      const index = prev.findIndex((c) => c.id === cleanCourse.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = cleanCourse;
        return copy;
      }
      return [cleanCourse, ...prev];
    });

    // 若為新填寫之自訂領域，自動加入即時 categories 狀態中
    if (cleanCourse.category?.trim()) {
      setCategories((prev) => {
        const cat = cleanCourse.category.trim();
        return prev.includes(cat) ? prev : [...prev, cat];
      });
    }
  };

  // 刪除課程回調
  const handleCourseDeleted = (deletedCourseId: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== deletedCourseId));
  };

  // 單堂課程進度更新回調
  const handleCourseUpdated = (updatedCourse: PMLearningCourse) => {
    const cleanCourse = sanitizeCourse(updatedCourse);
    setCourses((prev) =>
      prev.map((c) => (c.id === cleanCourse.id ? cleanCourse : c))
    );
  };

  // 從團隊視角點選某成員直接跳轉個人視角
  const handleSelectMemberInPersonalView = (userId: string) => {
    setIsManualSelection(true);
    setActiveUserId(userId);
    setViewMode('personal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoaded && !permissions.map.canView) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-slate-200 shadow-md flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1.5">專案-Map 限管理者存取</h2>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            「專案-Map」為最高機密工作區，僅限系統管理者 (Admin) 存取。<br />
            請切換或登入具備管理者權限之帳號。
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setIsLoginDialogOpen(true)}>管理員登入</Button>
            <Button size="sm" variant="outline" onClick={() => router.push('/dashboard')}>返回總表</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 頂部頁頭：標題、副標題與大視角切換器 (Toggle) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-xl bg-linear-to-tr from-indigo-600 to-blue-600 text-white shadow-xs">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                  專案-Map
                </h1>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold">
                  億威電子 · PMO 專案管理處
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                聚焦專案四大階段治理、智慧製造技術通訊、敏捷交付與個人專業心得精進
              </p>
            </div>
          </div>
        </div>

        {/* 三視角 Toggle 切換器 */}
        <div className="flex flex-wrap items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-stretch md:self-auto shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setViewMode('team')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'team'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>主管 / 團隊視角 (Team View)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('personal')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'personal'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserIcon className="h-4 w-4" />
            <span>個人工作區 (My Learning)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('weekly')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'weekly'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>週完成與時數 (Weekly & Hours)</span>
          </button>
        </div>
      </div>

      {/* 視角展示區：以 Error Boundary 包覆防止任何極端例外毀損全站 */}
      <PMErrorBoundary>
        {/* 視角一：主管 / 團隊視角 */}
        {viewMode === 'team' && (
          <TeamView
            courses={courses}
            pmoMembers={pmoMembers}
            currentUser={currentUser}
            categories={categories}
            onOpenCategoryManager={() => setIsCategoryDialogOpen(true)}
            onOpenCreateDialog={(uid, initialType) => handleOpenCreateDialog(uid, initialType)}
            onEditCourse={(c) => {
              setCourseToEdit(c);
              setIsCreateDialogOpen(true);
            }}
            onCourseDeleted={handleCourseDeleted}
            onSelectMemberInPersonalView={handleSelectMemberInPersonalView}
            onCourseUpdated={handleCourseUpdated}
          />
        )}

        {/* 視角二：個人視角 (My Learning / 個人工作區) */}
        {viewMode === 'personal' && (
          <MyLearningView
            courses={courses}
            pmoMembers={pmoMembers}
            activeUserId={activeUserId}
            onActiveUserIdChange={(id) => {
              setIsManualSelection(true);
              setActiveUserId(id);
            }}
            currentUser={currentUser}
            categories={categories}
            onOpenCategoryManager={() => setIsCategoryDialogOpen(true)}
            onCourseUpdated={handleCourseUpdated}
            onOpenCreateDialog={(uid, initialType) => handleOpenCreateDialog(uid, initialType)}
            onEditCourse={(c) => {
              setCourseToEdit(c);
              setIsCreateDialogOpen(true);
            }}
            onCourseDeleted={handleCourseDeleted}
          />
        )}

        {/* 視角三：週完成與時數 KPI 管制 (Weekly & Hours) */}
        {viewMode === 'weekly' && (
          <WeeklyKPIView
            courses={courses}
            pmoMembers={pmoMembers}
            currentUser={currentUser}
            onSelectMemberInPersonalView={handleSelectMemberInPersonalView}
            onCourseUpdated={handleCourseUpdated}
          />
        )}

        {/* 課程新增 / 編輯對話框 */}
        <CourseFormDialog
          isOpen={isCreateDialogOpen}
          onClose={() => {
            setIsCreateDialogOpen(false);
            setCourseToEdit(null);
            setDefaultAssignedUserId(undefined);
          }}
          pmoMembers={pmoMembers}
          courseToEdit={courseToEdit}
          currentUserId={currentUser?.uid}
          defaultAssignedUserId={defaultAssignedUserId}
          availableCategories={categories}
          onOpenCategoryManager={() => setIsCategoryDialogOpen(true)}
          initialType={createDialogInitialType}
          onSuccess={handleCourseSaved}
        />

        {/* 課程領域管理維護對話框 */}
        <CategoryManagerDialog
          isOpen={isCategoryDialogOpen}
          onClose={() => setIsCategoryDialogOpen(false)}
          categories={categories}
          courses={courses}
          onCategoriesChange={setCategories}
          onCoursesUpdated={async () => {
            const fresh = await getPMLearningCourses();
            setCourses(fresh);
          }}
        />
      </PMErrorBoundary>
    </div>
  );
}
