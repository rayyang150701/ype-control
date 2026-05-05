'use client';
import { format, differenceInDays } from 'date-fns';
import { PlusCircle, PauseCircle, CheckCircle2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SubProjectWithLatestLog, ProgressLog } from '@/types';
import { useState, useEffect } from 'react';
import { formatInTimeZone } from 'date-fns-tz';


type ProjectCardProps = {
  subProject: SubProjectWithLatestLog;
  onCardClick: (subProject: SubProjectWithLatestLog) => void;
  onAddLog: () => void;
  isAdmin: boolean;
};

export function ProjectCard({ subProject, onCardClick, onAddLog, isAdmin }: ProjectCardProps) {
  const { latestLog, isOverdue } = subProject;
  const completionPercentage = latestLog?.completionPercentage ?? 0;
  const expectedDate = subProject.expectedCompletionDate ? new Date(subProject.expectedCompletionDate as string) : null;
  const isEffectivelyOnHold = subProject.isOnHold || subProject.isParentOnHold;
  const isCompleted = completionPercentage === 100;

  const [delayDays, setDelayDays] = useState(0);

  useEffect(() => {
    if (expectedDate && completionPercentage < 100 && !isEffectivelyOnHold) {
      const days = differenceInDays(new Date(), expectedDate);
      if (days > 0) setDelayDays(days);
    }
  }, [expectedDate, completionPercentage, isEffectivelyOnHold]);

  const getProgressColor = () => {
    if (isEffectivelyOnHold) return 'bg-amber-500';
    if (delayDays > 7 || isOverdue) return 'bg-destructive';
    if (delayDays > 0) return 'bg-yellow-500';
    if (isCompleted) return 'bg-emerald-500';
    return 'bg-primary';
  };

  const handleAddLogClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddLog();
  };


  return (
    <>
      <Card
        className={cn(
          'flex cursor-pointer flex-col transition-all hover:shadow-lg hover:-translate-y-1',
          isCompleted && 'border-emerald-500 border-2 bg-emerald-50 shadow-sm',
          !isCompleted && isOverdue && !isEffectivelyOnHold && 'border-destructive border-2',
          !isCompleted && isEffectivelyOnHold && 'border-amber-400 border-2 bg-amber-50'
        )}
        onClick={() => onCardClick(subProject)}
      >
        <CardHeader className="relative pb-2">
           {isCompleted && (
            <Badge className="absolute -top-2 -right-2 bg-emerald-600 text-white flex items-center gap-1 z-10 shadow-md">
              <CheckCircle2 className="h-3 w-3" />
              已完成
            </Badge>
          )}
           {!isCompleted && isEffectivelyOnHold && (
            <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white flex items-center gap-1 z-10">
              <PauseCircle className="h-3 w-3" />
              {subProject.isOnHold ? '子專案暫緩中' : '主專案暫緩中'}
            </Badge>
          )}
          {!isCompleted && isOverdue && !isEffectivelyOnHold && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 z-10">
              逾期未報
            </Badge>
          )}
          <CardDescription className="font-mono text-xs">{subProject.projectCaseNumber}</CardDescription>
          <CardTitle className="font-headline text-lg leading-tight">{subProject.name}</CardTitle>
          <CardDescription>{subProject.projectName}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-3 pt-2 text-sm">
          <InfoRow label="TPM管理室窗口" value={subProject.tpmOfficeContact ?? 'N/A'} />
          <InfoRow 
            label="預計完成日" 
            value={expectedDate ? formatInTimeZone(expectedDate, 'UTC', 'yyyy/MM/dd') : '未設定'}
            isDelayed={delayDays > 0 && !isCompleted}
            delayText={`延遲 ${delayDays} 天`}
          />
          <InfoSection label="本週摘要" content={latestLog?.executionSummary || ''} maxLines={3} />
          <InfoSection label="下週計畫" content={latestLog?.nextWeekPlan || ''} maxLines={2} />
          <InfoSection
            label="問題"
            content={latestLog?.roadblocks || ''}
            highlight={!!latestLog?.roadblocks}
          />
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2 pt-4">
            <div className='w-full flex justify-between items-center text-xs text-muted-foreground'>
                <span className={cn(isCompleted && "text-emerald-700 font-bold")}>進度</span>
                <span className={cn(isCompleted && "text-emerald-700 font-bold")}>{completionPercentage}%</span>
            </div>
            <TooltipProvider>
                <Tooltip>
                <TooltipTrigger className="w-full">
                    <Progress value={completionPercentage} indicatorClassName={getProgressColor()} />
                </TooltipTrigger>
                <TooltipContent>
                    <p>進度: {completionPercentage}%</p>
                    {latestLog && <p>上次更新: {format(new Date(latestLog.updatedAt as string), 'yyyy/MM/dd')}</p>}
                </TooltipContent>
                </Tooltip>
            </TooltipProvider>

          {isAdmin && (
            <Button variant="ghost" size="sm" className="w-full mt-2" onClick={handleAddLogClick} data-tour="add-new-log">
              <PlusCircle className="mr-2 h-4 w-4" />
              新增週報
            </Button>
          )}
        </CardFooter>
      </Card>
    </>
  );
}

const InfoRow = ({ label, value, isDelayed, delayText }: { label: string; value: string; isDelayed?: boolean; delayText?: string }) => (
    <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
            {isDelayed && <span className="font-bold text-destructive">{delayText}</span>}
            <span className="font-medium">{value}</span>
        </div>
    </div>
);

const InfoSection = ({ label, content, maxLines, highlight }: { label:string, content: string; maxLines?: number, highlight?: boolean }) => (
    <div className="min-h-[1.25rem]">
        <h4 className="mb-1 text-xs text-muted-foreground">{label}</h4>
        <p className={cn(
            'text-sm text-foreground min-h-[1em]',
            highlight && content && 'rounded-sm bg-destructive/10 p-1',
            maxLines === 2 && 'line-clamp-2',
            maxLines === 3 && 'line-clamp-3',
        )}>
            {content}
        </p>
    </div>
);
