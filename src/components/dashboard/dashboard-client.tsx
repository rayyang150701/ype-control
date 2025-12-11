'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { SubProjectWithLatestLog, ProgressLog, FullProject } from '@/types';
import { ProjectCard } from './project-card';
import { EmptyState } from '@/components/shared/empty-state';
import { TimelineModal } from './timeline-modal';
import { FilterControls } from './filter-controls';
import { exportAllProjectsSummary, exportSubProjectHistory } from '@/lib/excel-export';
import { getProgressLogsForSubProject, getUsers, updateProject, getFullProjectById, getSubProjectsWithLatestLogs, getFullProjects, deleteProject } from '@/lib/actions';
import { NewProjectDialog } from './new-project-dialog';
import { EditProjectDialog } from './edit-project-dialog';
import { TableView } from './table-view';
import { DeleteProjectDialog } from './delete-project-dialog';
import { useToast } from '@/hooks/use-toast';


type DashboardClientProps = {
  initialSubProjects: SubProjectWithLatestLog[];
};

export function DashboardClient({ initialSubProjects }: DashboardClientProps) {
  const [subProjects, setSubProjects] = useState<SubProjectWithLatestLog[]>(initialSubProjects);
  const [fullProjects, setFullProjects] = useState<FullProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isClient, setIsClient] = useState(false);
  
  const [selectedSubProject, setSelectedSubProject] = useState<SubProjectWithLatestLog | null>(null);
  const [selectedFullProject, setSelectedFullProject] = useState<FullProject | null>(null);

  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineLogs, setTimelineLogs] = useState<ProgressLog[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 初始載入時獲取完整專案列表
  useEffect(() => {
    async function fetchFullProjects() {
      try {
        const projects = await getFullProjects();
        setFullProjects(projects);
      } catch (error) {
        console.error("Failed to fetch full projects", error);
        toast({
          title: "載入失敗",
          description: "無法載入專案列表",
          variant: "destructive",
        });
      }
    }
    fetchFullProjects();
  }, []); // 只在初始化時執行一次

  // 當子專案更新時,重新獲取完整專案列表
  useEffect(() => {
    if (subProjects !== initialSubProjects) {
      async function refreshFullProjects() {
        try {
          const projects = await getFullProjects();
          setFullProjects(projects);
        } catch (error) {
          console.error("Failed to refresh full projects", error);
        }
      }
      refreshFullProjects();
    }
  }, [subProjects, initialSubProjects]);

  const filteredSubProjects = useMemo(() => {
    return subProjects
      .filter(sp => {
        const isEffectivelyOnHold = sp.isOnHold || sp.isParentOnHold;
        if (filter === 'overdue') return sp.isOverdue && !isEffectivelyOnHold;
        if (filter === 'completed') return (sp.latestLog?.completionPercentage ?? 0) === 100;
        if (filter === 'in_progress') return !isEffectivelyOnHold && (sp.latestLog?.completionPercentage ?? 0) < 100;
        if (filter === 'on-hold') return isEffectivelyOnHold;
        return true;
      })
      .filter(sp => {
        const query = searchQuery.toLowerCase();
        if (!query) return true;
        return (
          sp.name.toLowerCase().includes(query) ||
          (sp.projectCaseNumber && sp.projectCaseNumber.toLowerCase().includes(query)) ||
          (sp.projectName && sp.projectName.toLowerCase().includes(query)) ||
          (sp.tpmOfficeContact && sp.tpmOfficeContact.toLowerCase().includes(query))
        );
      });
  }, [subProjects, searchQuery, filter]);

  const filteredFullProjects = useMemo(() => {
    const query = searchQuery.toLowerCase();
  
    return fullProjects
      .map(project => {
        const filteredSubProjectsList = project.subProjects.filter(sp => {
          const isEffectivelyOnHold = sp.isOnHold || sp.isParentOnHold;
          if (filter === 'overdue') return sp.isOverdue && !isEffectivelyOnHold;
          if (filter === 'completed') return (sp.latestLog?.completionPercentage ?? 0) === 100;
          if (filter === 'in_progress') return !isEffectivelyOnHold && (sp.latestLog?.completionPercentage ?? 0) < 100;
          if (filter === 'on-hold') return isEffectivelyOnHold;
          return true; // 'all'
        });
  
        // If no sub-projects match the status filter, don't include the project at all
        if (filteredSubProjectsList.length === 0 && filter !== 'all') {
            if (!query) return null; // If no query, definitely hide
            // If there is a query, check if the project itself matches, but has no matching subprojects
            const projectMatchesQuery =
                project.name.toLowerCase().includes(query) ||
                project.caseNumber.toLowerCase().includes(query) ||
                (project.tpmOfficeContact && project.tpmOfficeContact.toLowerCase().includes(query));
            if (projectMatchesQuery && filteredSubProjectsList.length === 0) {
                 return { ...project, subProjects: [] }; // Show project, but no sub-projects
            }
            return null;
        }
  
        // If there's a search query, filter further
        if (query) {
          const projectMatchesQuery =
            project.name.toLowerCase().includes(query) ||
            project.caseNumber.toLowerCase().includes(query) ||
            (project.tpmOfficeContact && project.tpmOfficeContact.toLowerCase().includes(query));
  
          // Filter sub-projects that match the query
          const subProjectsMatchQueryList = filteredSubProjectsList.filter(sp =>
            sp.name.toLowerCase().includes(query)
          );
  
          // If the project itself matches, include all its status-filtered sub-projects
          if (projectMatchesQuery) {
            return { ...project, subProjects: filteredSubProjectsList };
          }
  
          // If only some sub-projects match, include only those
          if (subProjectsMatchQueryList.length > 0) {
            return { ...project, subProjects: subProjectsMatchQueryList };
          }
  
          // If neither the project nor any sub-projects match the query, exclude the project
          return null;
        }
  
        // No search query, so return the project with its status-filtered sub-projects
        return { ...project, subProjects: filteredSubProjectsList };
      })
      .filter((project): project is FullProject => project !== null);
  }, [fullProjects, searchQuery, filter]);


  const handleSubProjectClick = async (subProject: SubProjectWithLatestLog) => {
    setSelectedSubProject(subProject);
    setIsTimelineOpen(true);
    setIsTimelineLoading(true);
    try {
      const logs = await getProgressLogsForSubProject(subProject.id);
      setTimelineLogs(logs);
    } catch (error) {
      console.error("Failed to fetch logs", error);
      setTimelineLogs([]);
      toast({
        title: "載入失敗",
        description: "無法載入進度記錄",
        variant: "destructive",
      });
    } finally {
      setIsTimelineLoading(false);
    }
  };

  const handleEditProjectClick = async (projectId: string) => {
    try {
      const fullProject = await getFullProjectById(projectId);
      if (fullProject) {
        setSelectedFullProject(fullProject);
        setIsTimelineOpen(false);
        setIsEditProjectOpen(true);
      } else {
        toast({
          title: "載入失敗",
          description: "無法找到該專案",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch project", error);
      toast({
        title: "載入失敗",
        description: "無法載入專案資料",
        variant: "destructive",
      });
    }
  };

  const handleExportHistory = async () => {
    if (selectedSubProject) {
      try {
        const users = await getUsers();
        exportSubProjectHistory(selectedSubProject, timelineLogs, users);
      } catch (error) {
        console.error("Export failed", error);
        toast({
          title: "匯出失敗",
          description: "無法匯出歷史記錄",
          variant: "destructive",
        });
      }
    }
  };

  const handleExportAll = async () => {
    try {
      const users = await getUsers();
      const allSubProjects = await getSubProjectsWithLatestLogs();
      exportAllProjectsSummary(allSubProjects, users);
    } catch (error) {
      console.error("Export all failed", error);
      toast({
        title: "匯出失敗",
        description: "無法匯出所有專案摘要",
        variant: "destructive",
      });
    }
  };

  const onLogAdded = (newLog: ProgressLog, subProjectId: string) => {
    setSubProjects(prevSubProjects =>
      prevSubProjects.map(sp => {
        if (sp.id === subProjectId) {
          const isNewer = !sp.latestLog || new Date(newLog.updatedAt as string) > new Date(sp.latestLog.updatedAt as string);
          
          return {
            ...sp,
            latestLog: isNewer ? newLog : sp.latestLog,
            isOverdue: false,
          };
        }
        return sp;
      })
    );
  
    if (selectedSubProject?.id === subProjectId) {
      setTimelineLogs(prevLogs => [newLog, ...prevLogs].sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime()));
    }
  };

  const onLogUpdated = (updatedLog: ProgressLog, subProjectId: string) => {
    if (selectedSubProject?.id === subProjectId) {
      setTimelineLogs(prevLogs =>
        prevLogs.map(log => (log.id === updatedLog.id ? updatedLog : log))
      );
    }
  
    setSubProjects(prevSubProjects =>
      prevSubProjects.map(sp => {
        if (sp.id === subProjectId) {
          const isUpdatedLogLatest = sp.latestLog?.id === updatedLog.id;
          if (isUpdatedLogLatest) {
            return { ...sp, latestLog: updatedLog };
          }
        }
        return sp;
      })
    );
  };
  
  const refreshData = async () => {
    try {
      const updatedSubProjects = await getSubProjectsWithLatestLogs();
      setSubProjects(updatedSubProjects);
      const updatedFullProjects = await getFullProjects();
      setFullProjects(updatedFullProjects);
    } catch (error) {
      console.error("Failed to refresh data", error);
      toast({
        title: "重新整理失敗",
        description: "無法更新資料",
        variant: "destructive",
      });
    }
  };

  const onProjectAdded = () => {
    setIsNewProjectOpen(false);
    refreshData();
  };

  const onProjectUpdated = (updatedProject: FullProject) => {
    setIsEditProjectOpen(false);
    // 精準更新 fullProjects 狀態
    setFullProjects(prevProjects => 
      prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p)
    );
  
    // 從更新後的 fullProject 重新組合 subProjects 列表
    setSubProjects(prevSubProjects => {
      const otherSubProjects = prevSubProjects.filter(sp => sp.projectId !== updatedProject.id);
      return [...otherSubProjects, ...updatedProject.subProjects];
    });
  
    // 如果正在編輯的專案被更新，也更新 selectedFullProject
    if (selectedFullProject && selectedFullProject.id === updatedProject.id) {
      setSelectedFullProject(updatedProject);
    }
  };

  const onProjectDeleted = () => {
    setIsDeleteProjectOpen(false);
    toast({ title: "專案已成功刪除" });
    refreshData();
  };

  return (
    <>
      <FilterControls
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filter={filter}
        setFilter={setFilter}
        onExportAll={handleExportAll}
        onAddNewProject={() => setIsNewProjectOpen(true)}
        onDeleteProject={() => setIsDeleteProjectOpen(true)}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {viewMode === 'grid' && (
        <>
          {filteredSubProjects.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredSubProjects.map(sp => (
                <ProjectCard key={sp.id} subProject={sp} onCardClick={handleSubProjectClick} onLogAdded={onLogAdded}/>
              ))}
            </div>
          ) : (
            <EmptyState
              title="無符合條件的專案"
              description="請嘗試調整您的篩選條件或清除搜尋關鍵字。"
            />
          )}
        </>
      )}

      {viewMode === 'table' && (
        <>
          {filteredFullProjects.length > 0 ? (
            <TableView 
              groupedProjects={filteredFullProjects}
              onEditProject={handleEditProjectClick}
              onSubProjectClick={handleSubProjectClick}
            />
          ) : (
            <EmptyState
              title="無符合條件的專案"
              description="請嘗試調整您的篩選條件或清除搜尋關鍵字。"
            />
          )}
        </>
      )}

      {selectedSubProject && (
        <TimelineModal
          isOpen={isTimelineOpen}
          setIsOpen={setIsTimelineOpen}
          subProject={selectedSubProject}
          logs={timelineLogs}
          isLoading={isTimelineLoading}
          onExport={handleExportHistory}
          onLogUpdated={onLogUpdated}
          onEditProject={handleEditProjectClick}
        />
      )}

      <NewProjectDialog 
        isOpen={isNewProjectOpen}
        setIsOpen={setIsNewProjectOpen}
        onProjectAdded={onProjectAdded}
      />
      
      {selectedFullProject && (
        <EditProjectDialog
          isOpen={isEditProjectOpen}
          setIsOpen={setIsEditProjectOpen}
          project={selectedFullProject}
          onProjectUpdated={onProjectUpdated}
        />
      )}

      {isClient && (
        <DeleteProjectDialog
          isOpen={isDeleteProjectOpen}
          setIsOpen={setIsDeleteProjectOpen}
          projects={fullProjects}
          onProjectDeleted={onProjectDeleted}
        />
      )}
    </>
  );
}
