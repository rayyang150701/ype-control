'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PMLearningCourse, PMLearningViewMode } from '@/types/pm-learning';
import { User, Client } from '@/types';
import { useAdmin } from '@/components/admin-context';
import { TeamView } from './team-view';
import { MyLearningView } from './my-learning-view';
import { CourseFormDialog } from './course-form-dialog';
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
} from 'lucide-react';

interface PMLearningClientProps {
  initialCourses: PMLearningCourse[];
  users: User[];
  clients: Client[];
}

export function PMLearningClient({
  initialCourses,
  users,
  clients,
}: PMLearningClientProps) {
  const { currentUser, isEditor, isAdmin } = useAdmin();
  const [courses, setCourses] = useState<PMLearningCourse[]>(initialCourses);
  const [viewMode, setViewMode] = useState<PMLearningViewMode>('team');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<PMLearningCourse | null>(null);

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

  // 個人視角目前選中的受訓成員 UID
  const [activeUserId, setActiveUserId] = useState<string>(() => {
    // 優先預設選中當前登入者 (若其屬於 PMO 成員)
    if (currentUser && pmoMembers.some((m) => m.uid === currentUser.uid)) {
      return currentUser.uid;
    }
    return pmoMembers[0]?.uid || '';
  });

  // 當 currentUser 載入完成且為 PMO 成員時自動同步
  useEffect(() => {
    if (currentUser && pmoMembers.some((m) => m.uid === currentUser.uid)) {
      setActiveUserId(currentUser.uid);
    } else if (!activeUserId && pmoMembers.length > 0) {
      setActiveUserId(pmoMembers[0].uid);
    }
  }, [currentUser, pmoMembers]);

  // 新增或更新課程回調
  const handleCourseSaved = (savedCourse: PMLearningCourse) => {
    setCourses((prev) => {
      const index = prev.findIndex((c) => c.id === savedCourse.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = savedCourse;
        return copy;
      }
      return [savedCourse, ...prev];
    });
  };

  // 刪除課程回調
  const handleCourseDeleted = (deletedCourseId: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== deletedCourseId));
  };

  // 單堂課程進度更新回調
  const handleCourseUpdated = (updatedCourse: PMLearningCourse) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c))
    );
  };

  // 從團隊視角點選某成員直接跳轉個人視角
  const handleSelectMemberInPersonalView = (userId: string) => {
    setActiveUserId(userId);
    setViewMode('personal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
                  PM 學習地圖
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

        {/* 雙視角 Toggle 切換器 */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-stretch md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('team')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
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
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'personal'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserIcon className="h-4 w-4" />
            <span>個人工作區 (My Learning)</span>
          </button>
        </div>
      </div>

      {/* 視角一：主管 / 團隊視角 */}
      {viewMode === 'team' && (
        <TeamView
          courses={courses}
          pmoMembers={pmoMembers}
          onOpenCreateDialog={() => {
            setCourseToEdit(null);
            setIsCreateDialogOpen(true);
          }}
          onEditCourse={(c) => {
            setCourseToEdit(c);
            setIsCreateDialogOpen(true);
          }}
          onCourseDeleted={handleCourseDeleted}
          onSelectMemberInPersonalView={handleSelectMemberInPersonalView}
        />
      )}

      {/* 視角二：個人視角 (My Learning / 個人工作區) */}
      {viewMode === 'personal' && (
        <MyLearningView
          courses={courses}
          pmoMembers={pmoMembers}
          activeUserId={activeUserId}
          onActiveUserIdChange={setActiveUserId}
          currentUser={currentUser}
          onCourseUpdated={handleCourseUpdated}
        />
      )}

      {/* 課程新增 / 編輯對話框 */}
      <CourseFormDialog
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setCourseToEdit(null);
        }}
        pmoMembers={pmoMembers}
        courseToEdit={courseToEdit}
        onSuccess={handleCourseSaved}
      />
    </div>
  );
}
