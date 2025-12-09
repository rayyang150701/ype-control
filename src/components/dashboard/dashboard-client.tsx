'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { SubProjectWithLatestLog, ProgressLog } from '@/types';
import { ProjectCard } from './project-card';
import { EmptyState } from '@/components/shared/empty-state';
import { TimelineModal } from './timeline-modal';
import { FilterControls } from './filter-controls';
import { exportAllProjectsSummary, exportSubProjectHistory } from '@/lib/excel-export';
import { getProgressLogsForSubProject } from '@/lib/actions';
import { NewProjectDialog } from './new-project-dialog';

type DashboardClientProps = {
  initialSubProjects: SubProjectWithLatestLog[];
};

export function DashboardClient({ initialSubProjects }: DashboardClientProps) {
  const [subProjects, setSubProjects] = useState<SubProjectWithLatestLog[]>(initialSubProjects);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  
  const [selectedSubProject, setSelectedSubProject] = useState<SubProjectWithLatestLog | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineLogs, setTimelineLogs] = useState<ProgressLog[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const router = useRouter();


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
          sp.ownerName?.toLowerCase().includes(query)
        );
      });
  }, [subProjects, searchQuery, filter]);

  const handleCardClick = async (subProject: SubProjectWithLatestLog) => {
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

  const handleExportHistory = () => {
    if (selectedSubProject) {
        exportSubProjectHistory(selectedSubProject, timelineLogs);
    }
  }

  const handleExportAll = () => {
    exportAllProjectsSummary(initialSubProjects);
  }

  const onLogAdded = (newLog: ProgressLog, subProjectId: string) => {
    // In a real app, you would refetch or update the state more robustly.
    // For this simulation, we just close the dialog.
    console.log('Log added for', subProjectId, newLog);
    router.refresh();
  };

  const onProjectAdded = () => {
    setIsNewProjectOpen(false);
    // Refreshes server-side props and re-renders Server Components.
    router.refresh();
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
      />

      {filteredSubProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSubProjects.map(sp => (
            <ProjectCard key={sp.id} subProject={sp} onCardClick={handleCardClick} onLogAdded={onLogAdded}/>
          ))}
        </div>
      ) : (
        <EmptyState
          title="無符合條件的專案"
          description="請嘗試調整您的篩選條件或清除搜尋關鍵字。"
        />
      )}

      {selectedSubProject && (
        <TimelineModal
          isOpen={isTimelineOpen}
          setIsOpen={setIsTimelineOpen}
          subProject={selectedSubProject}
          logs={timelineLogs}
          isLoading={isTimelineLoading}
          onExport={handleExportHistory}
        />
      )}

      <NewProjectDialog 
        isOpen={isNewProjectOpen}
        setIsOpen={setIsNewProjectOpen}
        onProjectAdded={onProjectAdded}
      />
    </>
  );
}
