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
        if (filter === 'overdue') return sp.isOverdue;
        if (filter === 'completed') return (sp.latestLog?.completionPercentage ?? 0) === 100;
        if (filter === 'in_progress') return (sp.latestLog?.completionPercentage ?? 0) < 100 && !sp.isOnHold;
        if (filter === 'on-hold') return sp.isOnHold;
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
    if (!searchQuery && filter === 'all') {
      return fullProjects;
    }
  
    return fullProjects
      .map(project => {
        // Filter sub-projects first
        const filteredSubProjectsList = project.subProjects
          .filter(sp => {
            if (filter === 'overdue') return sp.isOverdue;
            if (filter === 'completed') return (sp.latestLog?.completionPercentage ?? 0) === 100;
            if (filter === 'in_progress') return (sp.latestLog?.completionPercentage ?? 0) < 100 && !project.isOnHold;
            if (filter === 'on-hold') return project.isOnHold;
            return true;
          });

        // If the main filter is "on-hold", we only care if the parent project matches.
        // If it does, we return it with all its sub-projects.
        if (filter === 'on-hold') {
            if (project.isOnHold) {
                // If there's a search query, we still need to filter by it.
                if (searchQuery) {
                     const projectMatchesQuery = (
                        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        project.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (project.tpmOfficeContact && project.tpmOfficeContact.toLowerCase().includes(searchQuery.toLowerCase()))
                     );
                     const subProjectsMatchQuery = project.subProjects.some(sp => sp.name.toLowerCase().includes(searchQuery.toLowerCase()));

                     if (projectMatchesQuery) return project; // return all subprojects
                     if (subProjectsMatchQuery) {
                         return { 
                             ...project, 
                             subProjects: project.subProjects.filter(sp => sp.name.toLowerCase().includes(searchQuery.toLowerCase()))
                         };
                     }
                     return null;
                }
                return project; // No search query, return the whole on-hold project
            }
            return null; // Project is not on hold
        }


        // Determine if the project itself matches the search query or if any of its filtered sub-projects match
        const projectMatchesQuery = (
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (project.tpmOfficeContact && project.tpmOfficeContact.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        const subProjectsMatchQuery = filteredSubProjectsList.some(sp => 
            sp.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
  
        if (searchQuery) {
          if (projectMatchesQuery) {
             // If project matches, return it with its filtered sub-projects
             return { ...project, subProjects: filteredSubProjectsList };
          } else if (subProjectsMatchQuery) {
             // If only sub-projects match, filter them further by the query
             const queryFilteredSubProjects = filteredSubProjectsList.filter(sp => 
                sp.name.toLowerCase().includes(searchQuery.toLowerCase())
             );
             if (queryFilteredSubProjects.length > 0) {
                return { ...project, subProjects: queryFilteredSubProjects };
             }
          }
          return null; // Neither project nor sub-projects match search query
        } else {
           // No search query, just return the project with sub-projects filtered by status
           if (filteredSubProjectsList.length > 0) {
              return { ...project, subProjects: filteredSubProjectsList };
           }
           // If the filter is 'completed' or 'overdue' and no sub-projects match, the whole project shouldn't be shown
            if (filter === 'completed' || filter === 'overdue' || filter === 'in_progress') {
                return null;
            }
           return project;
        }
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
      exportAllProjectsSummary(initialSubProjects, users);
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

  const onProjectUpdated = () => {
    setIsEditProjectOpen(false);
    refreshData();
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
