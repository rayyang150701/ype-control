'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { SubProjectWithLatestLog, ProgressLog, FullProject } from '@/types';
import { ProjectCard } from './project-card';
import { EmptyState } from '@/components/shared/empty-state';
import { TimelineModal } from './timeline-modal';
import { FilterControls } from './filter-controls';
import { exportAllProjectsSummary, exportSubProjectHistory } from '@/lib/excel-export';
import { getProgressLogsForSubProject, getUsers, updateProject, getFullProjectById, getSubProjectsWithLatestLogs, getFullProjects } from '@/lib/actions';
import { NewProjectDialog } from './new-project-dialog';
import { EditProjectDialog } from './edit-project-dialog';
import { TableView } from './table-view';


type DashboardClientProps = {
  initialSubProjects: SubProjectWithLatestLog[];
};

export function DashboardClient({ initialSubProjects }: DashboardClientProps) {
  const [subProjects, setSubProjects] = useState<SubProjectWithLatestLog[]>(initialSubProjects);
  const [fullProjects, setFullProjects] = useState<FullProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  const [selectedSubProject, setSelectedSubProject] = useState<SubProjectWithLatestLog | null>(null);
  const [selectedFullProject, setSelectedFullProject] = useState<FullProject | null>(null);

  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineLogs, setTimelineLogs] = useState<ProgressLog[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    async function fetchFullProjects() {
      if (viewMode === 'table') {
        const projects = await getFullProjects();
        setFullProjects(projects);
      }
    }
    fetchFullProjects();
  }, [viewMode]);


  const filteredSubProjects = useMemo(() => {
    return subProjects
      .filter(sp => {
        if (filter === 'overdue') return sp.isOverdue;
        if (filter === 'completed') return (sp.latestLog?.completionPercentage ?? 0) === 100;
        return true;
      })
      .filter(sp => {
        const query = searchQuery.toLowerCase();
        if (!query) return true;
        return (
          sp.name.toLowerCase().includes(query) ||
          sp.projectName?.toLowerCase().includes(query) ||
          sp.projectCaseNumber?.toLowerCase().includes(query) ||
          sp.tpmOfficeContact?.toLowerCase().includes(query)
        );
      });
  }, [subProjects, searchQuery, filter]);

  const filteredFullProjects = useMemo(() => {
    if (!searchQuery && filter === 'all') {
      return fullProjects;
    }
  
    return fullProjects
      .map(project => {
        const filteredSubProjects = project.subProjects
          .filter(sp => {
            if (filter === 'overdue') return sp.isOverdue;
            if (filter === 'completed') return (sp.latestLog?.completionPercentage ?? 0) === 100;
            return true;
          })
          .filter(sp => {
            const query = searchQuery.toLowerCase();
            if (!query) return true;
            return (
              sp.name.toLowerCase().includes(query) ||
              project.name.toLowerCase().includes(query) ||
              project.caseNumber.toLowerCase().includes(query) ||
              project.tpmOfficeContact?.toLowerCase().includes(query)
            );
          });
  
        return { ...project, subProjects: filteredSubProjects };
      })
      .filter(project => project.subProjects.length > 0);
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
    } finally {
      setIsTimelineLoading(false);
    }
  };

  const handleEditProjectClick = async (projectId: string) => {
    const fullProject = await getFullProjectById(projectId);
    if(fullProject){
      setSelectedFullProject(fullProject);
      setIsTimelineOpen(false); // Close timeline modal if open
      setIsEditProjectOpen(true);
    } else {
        // handle error, maybe show a toast
    }
  };

  const handleExportHistory = async () => {
    if (selectedSubProject) {
        const users = await getUsers();
        exportSubProjectHistory(selectedSubProject, timelineLogs, users);
    }
  }

  const handleExportAll = async () => {
    const users = await getUsers();
    exportAllProjectsSummary(initialSubProjects, users);
  }

  const onLogAdded = (newLog: ProgressLog, subProjectId: string) => {
    setSubProjects(prevSubProjects =>
      prevSubProjects.map(sp => {
        if (sp.id === subProjectId) {
          // Check if this new log is later than the current latestLog
          const isNewer = !sp.latestLog || new Date(newLog.updatedAt as string) > new Date(sp.latestLog.updatedAt as string);
          
          return {
            ...sp,
            latestLog: isNewer ? newLog : sp.latestLog,
            isOverdue: false, // Assume adding a log resolves overdue status
          };
        }
        return sp;
      })
    );
  
    // If the timeline for the updated project is open, add the new log
    if (selectedSubProject?.id === subProjectId) {
      // Add to timeline and sort
      setTimelineLogs(prevLogs => [newLog, ...prevLogs].sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime()));
    }
  };

  const onLogUpdated = (updatedLog: ProgressLog, subProjectId: string) => {
    // Update the log in the timeline view
    if (selectedSubProject?.id === subProjectId) {
      setTimelineLogs(prevLogs =>
        prevLogs.map(log => (log.id === updatedLog.id ? updatedLog : log))
      );
    }
  
    // Update the latestLog on the card if the updated log is the latest one
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
    const updatedSubProjects = await getSubProjectsWithLatestLogs();
    setSubProjects(updatedSubProjects);
    if (viewMode === 'table') {
      const updatedFullProjects = await getFullProjects();
      setFullProjects(updatedFullProjects);
    }
  };


  const onProjectAdded = () => {
    setIsNewProjectOpen(false);
    refreshData();
  }

  const onProjectUpdated = () => {
    setIsEditProjectOpen(false);
    refreshData();
  }

  return (
    <>
      <FilterControls
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filter={filter}
        setFilter={setFilter}
        onExportAll={handleExportAll}
        onAddNewProject={() => setIsNewProjectOpen(true)}
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
    </>
  );
}
