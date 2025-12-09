'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { SubProjectWithLatestLog, ProgressLog } from '@/types';
import { format } from 'date-fns';
import { Download, Pencil } from 'lucide-react';
import { Separator } from '../ui/separator';
import { EditLogDialog } from './edit-log-dialog';

type TimelineModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  subProject: SubProjectWithLatestLog;
  logs: ProgressLog[];
  isLoading: boolean;
  onExport: () => void;
  onLogUpdated: (updatedLog: ProgressLog, subProjectId: string) => void;
  onEditProject: (projectId: string) => void;
};

export function TimelineModal({ isOpen, setIsOpen, subProject, logs, isLoading, onExport, onLogUpdated, onEditProject }: TimelineModalProps) {
  const [editingLog, setEditingLog] = useState<ProgressLog | null>(null);

  const handleEditClick = (log: ProgressLog) => {
    setEditingLog(log);
  };

  const handleLogUpdated = (updatedLog: ProgressLog) => {
    onLogUpdated(updatedLog, subProject.id);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader className='flex-row items-center justify-between pr-6'>
            <div>
              <DialogTitle className="font-headline text-2xl">{subProject.name} - 歷史週報</DialogTitle>
              <DialogDescription>
                {subProject.projectCaseNumber} {subProject.projectName}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEditProject(subProject.projectId)}>
                <Pencil className="mr-2 h-4 w-4" />
                編輯專案
            </Button>
          </DialogHeader>
          <div className="flex-grow min-h-0">
              <ScrollArea className="h-full pr-6">
              {isLoading ? (
                  <TimelineSkeleton />
              ) : (
                  <div className="relative pl-6">
                  {/* Vertical line */}
                  <div className="absolute left-8 top-0 h-full w-0.5 bg-border" />
                  <div className="space-y-8">
                      {logs.map((log) => (
                      <TimelineItem 
                        key={log.id} 
                        log={log} 
                        onEditClick={handleEditClick}
                      />
                      ))}
                  </div>
                  </div>
              )}
              </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onExport} disabled={isLoading || logs.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              匯出歷史紀錄
            </Button>
            <Button onClick={() => setIsOpen(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {editingLog && subProject && (
        <EditLogDialog
          isOpen={!!editingLog}
          setIsOpen={() => setEditingLog(null)}
          subProjectId={subProject.id}
          log={editingLog}
          onLogUpdated={handleLogUpdated}
        />
      )}
    </>
  );
}

const TimelineItem = ({ log, onEditClick }: { log: ProgressLog; onEditClick: (log: ProgressLog) => void; }) => (
    <div className="relative flex items-start">
        <div className="absolute left-[-2px] top-[5px] flex h-5 w-5 items-center justify-center rounded-full bg-primary">
        <div className="h-2 w-2 rounded-full bg-primary-foreground" />
        </div>
        <div className="ml-10 w-full">
            <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-primary">{log.reportingPeriod}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    {format(new Date(log.updatedAt as string), 'yyyy/MM/dd HH:mm')} by {log.createdByName}
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditClick(log)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
            </div>
            <div className="space-y-4 rounded-md border p-4">
                <LogSection title="本週摘要" content={log.executionSummary} />
                <LogSection title="下週計畫" content={log.nextWeekPlan} />
                <LogSection title="問題 / 風險" content={log.roadblocks || '無'} />
                <Separator />
                <div className='flex justify-end'>
                    <p className="text-sm font-medium">完成度: {log.completionPercentage}%</p>
                </div>
            </div>
        </div>
  </div>
);

const LogSection = ({ title, content }: { title: string; content: string }) => (
  <div>
    <h4 className="font-bold text-sm">{title}</h4>
    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{content}</p>
  </div>
);

const TimelineSkeleton = () => (
    <div className="space-y-8">
        {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="w-full space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-24 w-full" />
            </div>
        </div>
        ))}
  </div>
);
