'use client';

import { useState, useMemo, useEffect } from 'react';
import type { SubProjectWithLatestLog, ProgressLog, FullProject, User } from '@/types';
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
import { NewLogDialog } from './new-log-dialog';
import { LoginDialog } from './login-dialog';
import { LinkedInternalProgressDialog } from './linked-internal-progress-dialog';
import { useAdmin } from '@/components/admin-context';

type DashboardClientProps = {
  initialSubProjects: SubProjectWithLatestLog[];
};

export function DashboardClient({ initialSubProjects }: DashboardClientProps) {
  const [subProjects, setSubProjects] = useState<SubProjectWithLatestLog[]>(initialSubProjects);
  const [fullProjects, setFullProjects] = useState<FullProject[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  // 權限控管狀態 (由全域 AdminContext 提供)
  const { isAdmin, setIsAdmin, isLoginDialogOpen, setIsLoginDialogOpen } = useAdmin();

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
    if (!isAdmin) return;
    setSubProjectForNewLog(subProject);
    setIsNewLogOpen(true);
  };

  const handleEditProjectClick = async (projectId: string) => {
    if (!isAdmin) return;
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
        onAddNewProject={() => setIsNewProjectOpen(true)}
        onOnHoldProject={() => setIsOnHoldProjectOpen(true)}
        onDeleteProject={() => setIsDeleteProjectOpen(true)}
        onReusmeProject={() => setIsResumeProjectOpen(true)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isAdmin={isAdmin}
        onAdminToggle={() => {
            if (isAdmin) {
                setIsAdmin(false);
            } else {
                setIsLoginDialogOpen(true);
            }
        }}
      />

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredSubProjects.map(sp => (
            <ProjectCard 
                key={`${sp.projectId}-${sp.id}`} 
                subProject={sp} 
                onCardClick={handleSubProjectClick} 
                onAddLog={() => handleAddLogClick(sp)}
                isAdmin={isAdmin}
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
            isAdmin={isAdmin}
            onViewInternalProgress={(internalProjectId) => {
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
          isAdmin={isAdmin}
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
