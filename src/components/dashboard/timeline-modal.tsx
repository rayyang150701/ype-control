'use client';

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
import { Download } from 'lucide-react';
import { Separator } from '../ui/separator';

type TimelineModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  subProject: SubProjectWithLatestLog;
  logs: ProgressLog[];
  isLoading: boolean;
  onExport: () => void;
};

export function TimelineModal({ isOpen, setIsOpen, subProject, logs, isLoading, onExport }: TimelineModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">{subProject.name} - 歷史週報</DialogTitle>
          <DialogDescription>
            {subProject.projectCaseNumber} {subProject.projectName}
          </DialogDescription>
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
                    {logs.map((log, index) => (
                    <TimelineItem key={log.id} log={log} isLast={index === logs.length - 1} />
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
  );
}

const TimelineItem = ({ log, isLast }: { log: ProgressLog; isLast: boolean }) => (
    <div className="relative flex items-start">
        <div className="absolute left-[-2px] top-[5px] flex h-5 w-5 items-center justify-center rounded-full bg-primary">
        <div className="h-2 w-2 rounded-full bg-primary-foreground" />
        </div>
        <div className="ml-10 w-full">
            <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-primary">{log.reportingPeriod}</p>
                <p className="text-xs text-muted-foreground">
                {format(new Date(log.updatedAt as string), 'yyyy/MM/dd HH:mm')} by {log.createdByName}
                </p>
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
