'use client';

import { useState, useMemo, useEffect } from 'react';
import type { SubProjectWithLatestLog, ProgressLog, FullProject } from '@/types';
import { ProjectCard } from './project-card';
import { TimelineModal } from './timeline-modal';
import { FilterControls } from './filter-controls';
import { exportAllProjectsSummary, exportSubProjectHistory } from '@/lib/excel-export';
import { getProgressLogsForSubProject, getUsers, getFullProjectById, getSubProjectsWithLatestLogs, getFullProjects } from '@/lib/actions';
import { NewProjectDialog } from './new-project-dialog';
import { EditProjectDialog } from './edit-project-dialog';
import { TableView } from './table-view';
import { DeleteProjectDialog } from './delete-project-dialog';
import { OnHoldDialog } from './on-hold-dialog';
import { ResumeProjectDialog } from './resume-project-dialog';

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
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
  const [isOnHoldProjectOpen, setIsOnHoldProjectOpen] = useState(false);
  const [isResumeProjectOpen, setIsResumeProjectOpen] = useState(false);

  // 核心：全域刷新，徹底替換狀態，避免前端殘留重複資料
  const refreshData = async () => {
    try {
      const [updatedSubs, updatedFulls] = await Promise.all([
        getSubProjectsWithLatestLogs(),
        getFullProjects()
      ]);
      setSubProjects(updatedSubs);
      setFullProjects(updatedFulls);
    } catch (error) {
      console.error("Refresh failed", error);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

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
        return sp.name.toLowerCase().includes(query) || sp.projectCaseNumber?.toLowerCase().includes(query) || sp.projectName?.toLowerCase().includes(query);
      });
  }, [subProjects, searchQuery, filter]);

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

  const handleEditProjectClick = async (projectId: string) => {
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
    refreshData();
  };

  return (
    <>
      <FilterControls
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filter={filter}
        setFilter={setFilter}
        onExportAll={() => exportAllProjectsSummary(fullProjects, [])}
        onAddNewProject={() => setIsNewProjectOpen(true)}
        onOnHoldProject={() => setIsOnHoldProjectOpen(true)}
        onDeleteProject={() => setIsDeleteProjectOpen(true)}
        onReusmeProject={() => setIsResumeProjectOpen(true)}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSubProjects.map(sp => (
            <ProjectCard key={`${sp.projectId}-${sp.id}`} subProject={sp} onCardClick={handleSubProjectClick} onLogAdded={refreshData}/>
          ))}
        </div>
      ) : (
        <TableView groupedProjects={fullProjects} onEditProject={handleEditProjectClick} onSubProjectClick={handleSubProjectClick} />
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
        />
      )}

      <NewProjectDialog isOpen={isNewProjectOpen} setIsOpen={setIsNewProjectOpen} onProjectAdded={onOperationSuccess} />
      {selectedFullProject && <EditProjectDialog isOpen={isEditProjectOpen} setIsOpen={setIsEditProjectOpen} project={selectedFullProject} onProjectUpdated={onOperationSuccess} />}
      <DeleteProjectDialog isOpen={isDeleteProjectOpen} setIsOpen={setIsDeleteProjectOpen} projects={fullProjects} onProjectDeleted={onOperationSuccess} />
      <OnHoldDialog isOpen={isOnHoldProjectOpen} setIsOpen={setIsOnHoldProjectOpen} projects={fullProjects} onSuccess={onOperationSuccess} />
      <ResumeProjectDialog isOpen={isResumeProjectOpen} setIsOpen={setIsResumeProjectOpen} projects={fullProjects} onSuccess={onOperationSuccess} />
    </>
  );
}
