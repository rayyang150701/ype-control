'use client';

import { useState, useRef, useEffect } from 'react';
import { SubProjectWithLatestLog, FullProject } from '@/types';
import { Button } from '@/components/ui/button';
import { Pencil, PauseCircle, CheckCircle2, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type TableViewProps = {
  groupedProjects: FullProject[];
  onEditProject: (projectId: string) => void;
  onSubProjectClick: (subProject: SubProjectWithLatestLog) => void;
  onAddLog: (subProject: SubProjectWithLatestLog) => void;
};

export function TableView({ groupedProjects, onEditProject, onSubProjectClick, onAddLog }: TableViewProps) {
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
  const [weekRange, setWeekRange] = useState('');
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };
  
  useEffect(() => {
    if (tableContainerRef.current && topScrollRef.current) {
      const scrollWidth = tableContainerRef.current.scrollWidth;
      const scrollbarContent = topScrollRef.current.querySelector('.scrollbar-content');
      if (scrollbarContent) {
        (scrollbarContent as HTMLDivElement).style.width = `${scrollWidth}px`;
      }
    }
  }, [groupedProjects]);

  useEffect(() => {
    const getWeekRangeStr = () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const formatShort = (date: Date) => {
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${m}/${d}`;
      };

      return `${formatShort(monday)} ~ ${formatShort(sunday)}`;
    };
    setWeekRange(getWeekRangeStr());
  }, []);


  const toggleExpand = (key: string) => {
    setExpandedCells(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const formatDate = (dateString?: string | Date, fieldType: 'expected' | 'actual' = 'expected') => {
    if (!dateString) {
        if (fieldType === 'actual') {
            return <span className="text-gray-400">進行中</span>;
        }
        return <span className="text-gray-400">未設定</span>;
    }
    return format(new Date(dateString), 'yyyy/MM/dd');
  };

  const renderCollapsibleText = (content: string | null | undefined, id: string, emptyText: string = '') => {
    const key = `collapsible-${id}`;
    const isExpanded = expandedCells[key];
    const needsExpand = content && (content.length > 80 || content.includes('\n')); 

    return (
      <div className="space-y-1">
        <p className={cn('break-words whitespace-pre-wrap text-xs md:text-sm', !isExpanded && needsExpand && 'line-clamp-3')}>
          {content || <span className="text-gray-400 italic">{emptyText}</span>}
        </p>
        {needsExpand && (
          <button
            onClick={() => toggleExpand(key)}
            className="text-blue-600 text-xs hover:underline"
          >
            {isExpanded ? '收合 ▲' : '查看更多 ▼'}
          </button>
        )}
      </div>
    );
  };

  const getCellBgColor = (project: FullProject, sp: SubProjectWithLatestLog, isSharedCell: boolean) => {
    const isEffectivelyOnHold = sp.isOnHold || sp.isParentOnHold;
    const isCompleted = (sp.latestLog?.completionPercentage ?? 0) === 100;

    if (isSharedCell) {
       return project.subProjects.indexOf(sp) % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
    }
    
    if (isCompleted) return 'bg-emerald-50/60';
    if (isEffectivelyOnHold) return 'bg-amber-50';
    
    return project.subProjects.indexOf(sp) % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
  };

  return (
    <div className="space-y-2 w-full">
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height: '12px' }}
      >
        <div className="scrollbar-content" style={{ height: '1px' }} />
      </div>

      <div ref={tableContainerRef} onScroll={handleTableScroll} className="overflow-x-auto rounded-lg border shadow-sm" style={{maxHeight: 'calc(100vh - 220px)'}}>
        <table className="min-w-full border-collapse bg-white table-auto">
           <colgroup>
             <col style={{minWidth: '60px'}} />
             <col style={{minWidth: '64px'}} />
             <col style={{minWidth: '160px'}} />
             <col style={{minWidth: '192px'}} />
             <col style={{minWidth: '192px'}} />
             <col style={{minWidth: '128px'}} />
             <col style={{minWidth: '128px'}} />
             <col style={{minWidth: '112px'}} />
             <col style={{minWidth: '160px'}} />
             <col style={{minWidth: '256px'}} />
             <col style={{minWidth: '256px'}} />
             <col style={{minWidth: '120px'}} />
             <col style={{minWidth: '80px'}} />
             <col style={{minWidth: '112px'}} />
             <col style={{minWidth: '112px'}} />
           </colgroup>
          <thead className="sticky top-0 z-30">
            <tr>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700 sticky left-0 z-40">操作</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700 sticky left-[60px] z-40">案號</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700 sticky left-[124px] z-40">主專案名稱</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">專案目的</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">現況/問題點</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">燁輝負責主管</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">TPM窗口</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">億威電子</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">子專案名稱</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">本週摘要 {weekRange && `(${weekRange})`}</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">下週計畫</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">問題與風險</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">進度</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">預計完成</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700">實際完成</th>
            </tr>
          </thead>
          <tbody>
            {groupedProjects.length > 0 ? (
              groupedProjects.map((project) => {
                if (project.subProjects.length === 0) return null;

                return project.subProjects.map((sp, subProjectIndex) => {
                  const isCompleted = (sp.latestLog?.completionPercentage ?? 0) === 100;
                  
                  return (
                    <tr
                      key={sp.id}
                      className={cn(
                        'hover:bg-blue-50/50 transition-colors',
                        isCompleted && 'hover:bg-emerald-100/50',
                        (sp.isOnHold || sp.isParentOnHold) && project.subProjects.length > 1 && 'hover:bg-amber-100/50'
                      )}
                    >
                      {subProjectIndex === 0 && (
                        <>
                          <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words sticky left-0 z-20", getCellBgColor(project, sp, true))} style={{ backgroundColor: getCellBgColor(project, sp, true)}}>
                            <Button variant="ghost" size="icon" onClick={() => onEditProject(project.id)} className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </td>
                          <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words sticky left-[60px] z-20", getCellBgColor(project, sp, true))} style={{ backgroundColor: getCellBgColor(project, sp, true) }}>{project.caseNumber}</td>
                          <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words sticky left-[124px] z-20", getCellBgColor(project, sp, true))} style={{ backgroundColor: getCellBgColor(project, sp, true)}}>
                            <div className='flex flex-col gap-1'>
                              <span className="font-semibold leading-tight">{project.name}</span>
                              {project.isOnHold && (
                                 <Badge className="bg-amber-500 text-white flex items-center gap-1 w-fit scale-90 origin-left">
                                    <PauseCircle className="h-3 w-3" />
                                    暫緩
                                 </Badge>
                              )}
                            </div>
                          </td>
                          <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words", getCellBgColor(project, sp, true))}>
                            {renderCollapsibleText(project.projectPurpose, `${project.id}-purpose`)}
                          </td>
                          <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words", getCellBgColor(project, sp, true))}>
                            {renderCollapsibleText(project.currentStatusAndIssues, `${project.id}-status`)}
                          </td>
                          <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words", getCellBgColor(project, sp, true))}>
                            {project.yiehPhuiProjectManager}
                          </td>
                          <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words", getCellBgColor(project, sp, true))}>
                            {project.tpmOfficeContact}
                          </td>
                          <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words", getCellBgColor(project, sp, true))}>
                            {project.egigaContact}
                          </td>
                        </>
                      )}
                      <td className={cn("border-b px-3 py-2 text-sm text-gray-800 break-words align-middle", getCellBgColor(project, sp, false))}>
                         <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onSubProjectClick(sp)}
                              className={cn(
                                "underline bg-transparent border-none p-0 cursor-pointer text-left font-medium leading-tight",
                                isCompleted ? "text-emerald-700 hover:text-emerald-900" : "text-blue-600 hover:text-blue-800"
                              )}
                            >
                              {sp.name}
                            </button>
                            
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button 
                                            onClick={() => onAddLog(sp)}
                                            className="text-blue-500 hover:text-blue-700 transition-transform hover:scale-110 active:scale-95"
                                        >
                                            <PlusCircle className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>新增週報</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {isCompleted && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            )}
                            {sp.isOnHold && !isCompleted && (
                              <Badge className="bg-amber-500 text-white flex items-center gap-1 scale-75 origin-left shrink-0">
                                <PauseCircle className="h-3 w-3" />
                                暫緩
                              </Badge>
                            )}
                          </div>
                      </td>
                      <td className={cn("border-b px-3 py-2 text-sm text-gray-800 break-words align-middle", getCellBgColor(project, sp, false))}>
                          {renderCollapsibleText(sp.latestLog?.executionSummary, `${sp.id}-summary`, '')}
                      </td>
                      <td className={cn("border-b px-3 py-2 text-sm text-gray-800 break-words align-middle", getCellBgColor(project, sp, false))}>
                          {renderCollapsibleText(sp.latestLog?.nextWeekPlan, `${sp.id}-plan`, '')}
                      </td>
                      <td className={cn("border-b px-3 py-2 text-sm break-words align-middle", getCellBgColor(project, sp, false))}>
                        {sp.latestLog?.roadblocks && (
                          <span className="rounded bg-red-100 px-2 py-1 text-red-700 font-medium text-xs">
                            {sp.latestLog.roadblocks}
                          </span>
                        )}
                      </td>
                      <td className={cn(
                        "border-b px-3 py-2 text-sm text-left align-middle font-bold", 
                        getCellBgColor(project, sp, false),
                        isCompleted ? "text-emerald-700" : "text-gray-800"
                      )}>
                        {sp.latestLog?.completionPercentage ?? 0}%
                      </td>
                      <td className={cn("border-b px-3 py-2 text-sm text-gray-800 break-words align-middle", getCellBgColor(project, sp, false))}>{formatDate(sp.expectedCompletionDate, 'expected')}</td>
                      <td className={cn("border-b px-3 py-2 text-sm text-gray-800 break-words align-middle", getCellBgColor(project, sp, false))}>{formatDate(sp.actualCompletionDate, 'actual')}</td>
                    </tr>
                  )
                })
              })
            ) : (
              <tr>
                <td colSpan={15} className="h-24 text-center text-muted-foreground italic">
                  查無符合條件的專案資料。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
