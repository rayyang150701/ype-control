'use client';

import { useState, useMemo, useEffect } from 'react';
import type { SubProjectWithLatestLog, ProgressLog, FullProject, User, WeeklySnapshotItem } from '@/types';
import { ProjectCard } from './project-card';
import { TimelineModal } from './timeline-modal';
import { FilterControls } from './filter-controls';
import { exportAllProjectsSummary, exportSubProjectHistory, exportWeeklyProjectsSummary } from '@/lib/excel-export';
import { 
  getProgressLogsForSubProject, 
  getUsers, 
  getFullProjectById, 
  getSubProjectsWithLatestLogs, 
  getFullProjects,
  saveWeeklySnapshotAction,
  getWeeklySnapshotsListAction,
  getWeeklySnapshotDataAction,
  getHistoricalWeeklyProjectsAction
} from '@/lib/actions';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { NewProjectDialog } from './new-project-dialog';
import { EditProjectDialog } from './edit-project-dialog';
import { TableView } from './table-view';
import { DeleteProjectDialog } from './delete-project-dialog';
import { OnHoldDialog } from './on-hold-dialog';
import { ResumeProjectDialog } from './resume-project-dialog';
import { NewLogDialog } from './new-log-dialog';
import { LoginDialog } from './login-dialog';
import { LinkedInternalProgressDialog } from './linked-internal-progress-dialog';
import { useAdmin } from '@/components/admin-context';
import { useToast } from '@/hooks/use-toast';

type DashboardClientProps = {
  initialSubProjects: SubProjectWithLatestLog[];
};

export function DashboardClient({ initialSubProjects }: DashboardClientProps) {
  const { toast } = useToast();
  const [subProjects, setSubProjects] = useState<SubProjectWithLatestLog[]>(initialSubProjects);
  const [fullProjects, setFullProjects] = useState<FullProject[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  // 權限控管狀態 (由全域 AdminContext 提供)
  const { isAdmin, isEditor, isGuest, setIsAdmin, isLoginDialogOpen, setIsLoginDialogOpen, currentUser } = useAdmin();

  // 每週管制表快照與歷史週次清單
  const [weeklySnapshots, setWeeklySnapshots] = useState<WeeklySnapshotItem[]>([]);
  const [isSnapshotting, setIsSnapshotting] = useState(false);

  // 當前週週期資訊 (例如 2026/09/14 - 09/20)
  const currentPeriodInfo = useMemo(() => {
    const now = new Date();
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    const sunday = endOfWeek(now, { weekStartsOn: 1 });
    const key = `${format(monday, 'yyyy-MM-dd')}_${format(sunday, 'yyyy-MM-dd')}`;
    const label = `${format(monday, 'yyyy/MM/dd')} - ${format(sunday, 'MM/dd')}`;
    return { key, label };
  }, []);

  const loadWeeklySnapshots = async () => {
    try {
      const list = await getWeeklySnapshotsListAction();
      setWeeklySnapshots(list);
    } catch (e) {
      console.error('載入每週快照列表失敗:', e);
    }
  };

  useEffect(() => {
    loadWeeklySnapshots();
  }, []);

  // 轉存本週專案資料 (同週覆蓋)
  const handleSaveCurrentWeekSnapshot = async () => {
    if (!isEditor) {
      setIsLoginDialogOpen(true);
      return;
    }
    setIsSnapshotting(true);
    try {
      const targetProjects = fullProjects.length > 0 ? fullProjects : await getFullProjects();
      const targetUsers = users.length > 0 ? users : await getUsers();

      const res = await saveWeeklySnapshotAction(
        currentPeriodInfo.key,
        currentPeriodInfo.label,
        targetProjects,
        targetUsers,
        currentUser?.displayName || currentUser?.username || '管理者'
      );

      if (res.success) {
        toast({
          title: '轉出存檔成功！',
          description: `已將當前全專案管制表轉存至 ${currentPeriodInfo.label}（同週舊資料已覆蓋更新）。`,
        });
        await loadWeeklySnapshots();
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      toast({
        title: '轉存失敗',
        description: err.message || '無法儲存本週快照',
        variant: 'destructive',
      });
    } finally {
      setIsSnapshotting(false);
    }
  };

  // 下拉選取週次直接匯出 Excel
  const handleExportWeek = async (weekKey: string) => {
    if (!isEditor) {
      setIsLoginDialogOpen(true);
      toast({
        title: '權限不足',
        description: '只有編輯者以上權限才可下載每週管制表。',
        variant: 'destructive',
      });
      return;
    }

    const targetWeek = weeklySnapshots.find((w) => w.key === weekKey);
    const periodLabel = targetWeek?.label || weekKey;

    toast({
      title: '正在產生週報 Excel...',
      description: `準備匯出 ${periodLabel} 管制表`,
    });

    try {
      // 1. 優先從 Storage 快照讀取已轉存版本
      const snapshot = await getWeeklySnapshotDataAction(weekKey);
      if (snapshot && snapshot.projects && snapshot.projects.length > 0) {
        exportWeeklyProjectsSummary(
          snapshot.projects,
          snapshot.users || users,
          snapshot.periodLabel || periodLabel,
          snapshot.savedAt
        );
        toast({
          title: '匯出成功！',
          description: `已下載 ${periodLabel} 管制表（歷史轉存版）`,
        });
        return;
      }

      // 2. 若為本週且尚未點擊轉存，以當前最新專案進度直接匯出
      if (weekKey === currentPeriodInfo.key) {
        const currentProjects = fullProjects.length > 0 ? fullProjects : await getFullProjects();
        exportWeeklyProjectsSummary(
          currentProjects,
          users,
          currentPeriodInfo.label,
          new Date().toISOString()
        );
        toast({
          title: '匯出成功！',
          description: `已下載 ${currentPeriodInfo.label} 即時管制表`,
        });
        return;
      }

      // 3. 若為過去週次但未建立 Storage 快照，自 progress_logs 動態彙整該週進度匯出
      const historicalProjects = await getHistoricalWeeklyProjectsAction(periodLabel);
      exportWeeklyProjectsSummary(
        historicalProjects,
        users,
        periodLabel
      );
      toast({
        title: '匯出成功！',
        description: `已依 ${periodLabel} 歷史日誌彙整並下載週報 Excel`,
      });
    } catch (err: any) {
      console.error('匯出週報失敗:', err);
      toast({
        title: '匯出失敗',
        description: err.message || '產生週報 Excel 發生錯誤',
        variant: 'destructive',
      });
    }
  };

  const [selectedSubProject, setSelectedSubProject] = useState<SubProjectWithLatestLog | null>(null);
  const [selectedFullProject, setSelectedFullProject] = useState<FullProject | null>(null);
  const [subProjectForNewLog, setSubProjectForNewLog] = useState<SubProjectWithLatestLog | null>(null);

  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineLogs, setTimelineLogs] = useState<ProgressLog[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
  const [isOnHoldProjectOpen, setIsOnHoldProjectOpen] = useState(false);
  const [isResumeProjectOpen, setIsResumeProjectOpen] = useState(false);
  const [isNewLogOpen, setIsNewLogOpen] = useState(false);
  const [isInternalProgressOpen, setIsInternalProgressOpen] = useState(false);
  const [selectedInternalProjectId, setSelectedInternalProjectId] = useState<string | undefined>(undefined);

  const refreshData = async () => {
    try {
      const [updatedSubs, updatedFulls, updatedUsers] = await Promise.all([
        getSubProjectsWithLatestLogs(),
        getFullProjects(),
        getUsers()
      ]);
      setSubProjects(updatedSubs);
      setFullProjects(updatedFulls);
      setUsers(updatedUsers);
    } catch (error) {
      console.error("Refresh failed", error);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const activeOwners = useMemo(() => {
    const ownerIdsInProjects = new Set(subProjects.map(sp => sp.owner));
    return users.filter(user => ownerIdsInProjects.has(user.uid));
  }, [users, subProjects]);

  const filteredSubProjects = useMemo(() => {
    return subProjects
      .filter(sp => {
        const isEffectivelyOnHold = sp.isOnHold || sp.isParentOnHold;
        if (statusFilter === 'overdue') {
          if (isEffectivelyOnHold || (sp.latestLog?.completionPercentage ?? 0) === 100) return false;
          return sp.isOverdue;
        }
        if (statusFilter === 'completed') return (sp.latestLog?.completionPercentage ?? 0) === 100;
        if (statusFilter === 'in_progress') return !isEffectivelyOnHold && (sp.latestLog?.completionPercentage ?? 0) < 100;
        if (statusFilter === 'on-hold') return isEffectivelyOnHold;
        return true;
      })
      .filter(sp => {
        if (ownerFilter === 'all') return true;
        return sp.owner === ownerFilter;
      })
      .filter(sp => {
        const query = searchQuery.toLowerCase();
        if (!query) return true;
        return (
          sp.name.toLowerCase().includes(query) || 
          sp.projectCaseNumber?.toLowerCase().includes(query) || 
          sp.projectName?.toLowerCase().includes(query) ||
          sp.tpmOfficeContact?.toLowerCase().includes(query) ||
          sp.ownerName?.toLowerCase().includes(query)
        );
      });
  }, [subProjects, searchQuery, statusFilter, ownerFilter]);

  const filteredFullProjects = useMemo(() => {
    return fullProjects
      .map(project => ({
        ...project,
        subProjects: project.subProjects.filter(sp => 
          filteredSubProjects.some(fsp => fsp.id === sp.id)
        )
      }))
      .filter(project => project.subProjects.length > 0);
  }, [fullProjects, filteredSubProjects]);

  const handleSubProjectClick = async (subProject: SubProjectWithLatestLog) => {
    setSelectedSubProject(subProject);
    setIsTimelineOpen(true);
    setIsTimelineLoading(true);
    try {
      const logs = await getProgressLogsForSubProject(subProject.projectId, subProject.id);
      setTimelineLogs(logs);
    } catch (e) {
      setTimelineLogs([]);
    } finally {
      setIsTimelineLoading(false);
    }
  };

  const handleAddLogClick = (subProject: SubProjectWithLatestLog) => {
    if (!isEditor) {
      toast({
        title: '需要編輯權限',
        description: '新增週報僅限系統編輯者與管理者填寫。',
        variant: 'destructive',
      });
      setIsLoginDialogOpen(true);
      return;
    }
    setSubProjectForNewLog(subProject);
    setIsNewLogOpen(true);
  };

  const handleEditProjectClick = async (projectId: string) => {
    if (!isEditor) {
      toast({
        title: '需要編輯權限',
        description: '編輯專案僅限系統編輯者與管理者操作。',
        variant: 'destructive',
      });
      setIsLoginDialogOpen(true);
      return;
    }
    const fullProject = await getFullProjectById(projectId);
    if (fullProject) {
      setSelectedFullProject(fullProject);
      setIsTimelineOpen(false);
      setIsEditProjectOpen(true);
    }
  };

  const onOperationSuccess = () => {
    setIsNewProjectOpen(false);
    setIsEditProjectOpen(false);
    setIsDeleteProjectOpen(false);
    isOnHoldProjectOpen && setIsOnHoldProjectOpen(false);
    isResumeProjectOpen && setIsResumeProjectOpen(false);
    setIsNewLogOpen(false);
    refreshData();
    setTimeout(() => {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    }, 50);
  };

  return (
    <div className="w-full">
      <FilterControls
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        ownerFilter={ownerFilter}
        setOwnerFilter={setOwnerFilter}
        owners={activeOwners}
        onExportAll={() => exportAllProjectsSummary(filteredFullProjects, users)}
        onAddNewProject={() => {
          if (!isEditor) {
            setIsLoginDialogOpen(true);
            return;
          }
          setIsNewProjectOpen(true);
        }}
        onOnHoldProject={() => {
          if (!isEditor) {
            setIsLoginDialogOpen(true);
            return;
          }
          setIsOnHoldProjectOpen(true);
        }}
        onDeleteProject={() => {
          if (!isEditor) {
            setIsLoginDialogOpen(true);
            return;
          }
          setIsDeleteProjectOpen(true);
        }}
        onReusmeProject={() => {
          if (!isEditor) {
            setIsLoginDialogOpen(true);
            return;
          }
          setIsResumeProjectOpen(true);
        }}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isAdmin={isAdmin}
        isEditor={isEditor}
        onAdminToggle={() => {
            if (isEditor) {
                setIsAdmin(false);
            } else {
                setIsLoginDialogOpen(true);
            }
        }}
        weeklySnapshots={weeklySnapshots}
        onExportWeek={handleExportWeek}
        onSaveCurrentWeekSnapshot={handleSaveCurrentWeekSnapshot}
        isSnapshotting={isSnapshotting}
        currentWeekLabel={currentPeriodInfo.label}
      />

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredSubProjects.map(sp => (
            <ProjectCard 
                key={`${sp.projectId}-${sp.id}`} 
                subProject={sp} 
                onCardClick={handleSubProjectClick} 
                onAddLog={() => handleAddLogClick(sp)}
                isAdmin={isEditor}
            />
          ))}
          {filteredSubProjects.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground">
              查無符合條件的專案。
            </div>
          )}
        </div>
      ) : (
        <TableView 
            groupedProjects={filteredFullProjects} 
            onEditProject={handleEditProjectClick} 
            onSubProjectClick={handleSubProjectClick} 
            onAddLog={handleAddLogClick}
            isAdmin={isEditor}
            onViewInternalProgress={(internalProjectId) => {
              if (!isEditor) {
                toast({
                  title: '需要登入權限',
                  description: '內部專案待辦追蹤與跟催歷程僅限系統登入成員檢視。',
                  variant: 'destructive',
                });
                setIsLoginDialogOpen(true);
                return;
              }
              setSelectedInternalProjectId(internalProjectId);
              setIsInternalProgressOpen(true);
            }}
        />
      )}

      {selectedSubProject && (
        <TimelineModal
          isOpen={isTimelineOpen}
          setIsOpen={setIsTimelineOpen}
          subProject={selectedSubProject}
          logs={timelineLogs}
          isLoading={isTimelineLoading}
          onExport={async () => exportSubProjectHistory(selectedSubProject, timelineLogs, await getUsers())}
          onLogUpdated={refreshData}
          onEditProject={handleEditProjectClick}
          isAdmin={isEditor}
        />
      )}

      <NewProjectDialog isOpen={isNewProjectOpen} setIsOpen={setIsNewProjectOpen} onProjectAdded={onOperationSuccess} />
      {selectedFullProject && <EditProjectDialog isOpen={isEditProjectOpen} setIsOpen={setIsEditProjectOpen} project={selectedFullProject} onProjectUpdated={onOperationSuccess} />}
      <DeleteProjectDialog isOpen={isDeleteProjectOpen} setIsOpen={setIsDeleteProjectOpen} projects={fullProjects} onProjectDeleted={onOperationSuccess} />
      <OnHoldDialog isOpen={isOnHoldProjectOpen} setIsOpen={setIsOnHoldProjectOpen} projects={fullProjects} onSuccess={onOperationSuccess} />
      <ResumeProjectDialog isOpen={isResumeProjectOpen} setIsOpen={setIsResumeProjectOpen} projects={fullProjects} onSuccess={onOperationSuccess} />
      
      {subProjectForNewLog && (
        <NewLogDialog 
            isOpen={isNewLogOpen} 
            setIsOpen={setIsNewLogOpen} 
            subProject={subProjectForNewLog} 
            onLogAdded={onOperationSuccess} 
        />
      )}

      <LinkedInternalProgressDialog
        open={isInternalProgressOpen}
        onOpenChange={setIsInternalProgressOpen}
        internalProjectId={selectedInternalProjectId}
      />

      <LoginDialog 
        isOpen={isLoginDialogOpen} 
        setIsOpen={setIsLoginDialogOpen} 
        onLoginSuccess={() => setIsAdmin(true)} 
      />
    </div>
  );
}
