'use client';
import { format, differenceInDays } from 'date-fns';
import { PlusCircle, PauseCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SubProjectWithLatestLog, ProgressLog } from '@/types';
import { NewLogDialog } from './new-log-dialog';
import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';


type ProjectCardProps = {
  subProject: SubProjectWithLatestLog;
  onCardClick: (subProject: SubProjectWithLatestLog) => void;
  onLogAdded: (newLog: ProgressLog, subProjectId: string) => void;
};

export function ProjectCard({ subProject, onCardClick, onLogAdded }: ProjectCardProps) {
  const { latestLog, isOverdue } = subProject;
  const completionPercentage = latestLog?.completionPercentage ?? 0;
  const expectedDate = new Date(subProject.expectedCompletionDate as string);
  const delayDays = completionPercentage < 100 ? differenceInDays(new Date(), expectedDate) : 0;
  const isOnHold = subProject.isOnHold;

  const [isNewLogDialogOpen, setIsNewLogDialogOpen] = useState(false);

  const getProgressColor = () => {
    if (isOnHold) return 'bg-amber-500';
    if (delayDays > 7 || isOverdue) return 'bg-destructive';
    if (delayDays > 0) return 'bg-yellow-500';
    if (completionPercentage === 100) return 'bg-green-500';
    return 'bg-primary';
  };

  const handleAddLogClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsNewLogDialogOpen(true);
  };


  return (
    <>
      <Card
        className={cn(
          'flex cursor-pointer flex-col transition-all hover:shadow-lg hover:-translate-y-1',
          isOverdue && !isOnHold && 'border-destructive border-2',
          isOnHold && 'border-amber-400 border-2 bg-amber-50'
        )}
        onClick={() => onCardClick(subProject)}
      >
        <CardHeader className="relative pb-2">
           {isOnHold && (
            <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white flex items-center gap-1 z-10">
              <PauseCircle className="h-3 w-3" />
              暫緩中
            </Badge>
          )}
          {isOverdue && !isOnHold && (
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
            value={formatInTimeZone(expectedDate, 'UTC', 'yyyy/MM/dd')}
            isDelayed={delayDays > 0 && completionPercentage < 100 && !isOnHold}
            delayText={`延遲 ${delayDays} 天`}
          />
          <InfoSection label="本週摘要" content={latestLog?.executionSummary || '尚未回報'} maxLines={3} />
          <InfoSection label="下週計畫" content={latestLog?.nextWeekPlan || '尚未回報'} maxLines={2} />
          <InfoSection
            label="問題"
            content={latestLog?.roadblocks || '無'}
            highlight={!!latestLog?.roadblocks}
          />
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2 pt-4">
            <div className='w-full flex justify-between items-center text-xs text-muted-foreground'>
                <span>進度</span>
                <span>{completionPercentage}%</span>
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

          <Button variant="ghost" size="sm" className="w-full mt-2" onClick={handleAddLogClick}>
            <PlusCircle className="mr-2 h-4 w-4" />
            新增週報
          </Button>
        </CardFooter>
      </Card>
      <NewLogDialog 
        isOpen={isNewLogDialogOpen} 
        setIsOpen={setIsNewLogDialogOpen} 
        subProject={subProject} 
        onLogAdded={onLogAdded}
      />
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
    <div>
        <h4 className="mb-1 text-xs text-muted-foreground">{label}</h4>
        <p className={cn(
            'text-sm text-foreground',
            highlight && 'rounded-sm bg-destructive/10 p-1',
            maxLines === 2 && 'line-clamp-2',
            maxLines === 3 && 'line-clamp-3',
        )}>
            {content}
        </p>
    </div>
);
