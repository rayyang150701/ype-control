
'use client';

import { useState, useRef, useEffect } from 'react';
import { SubProjectWithLatestLog, FullProject } from '@/types';
import { Button } from '@/components/ui/button';
import { Pencil, PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';

type TableViewProps = {
  groupedProjects: FullProject[];
  onEditProject: (projectId: string) => void;
  onSubProjectClick: (subProject: SubProjectWithLatestLog) => void;
};

export function TableView({ groupedProjects, onEditProject, onSubProjectClick }: TableViewProps) {
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
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

  const getWeekRange = () => {
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
  
  const renderCollapsibleText = (content: string | null | undefined, id: string, emptyText: string = '尚未填寫') => {
    const key = `collapsible-${id}`;
    const isExpanded = expandedCells[key];
    const needsExpand = content && (content.length > 80 || content.includes('\n')); 

    return (
      <div className="space-y-1">
        <p className={cn('break-words whitespace-pre-wrap', !isExpanded && needsExpand && 'line-clamp-3')}>
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
    if (!isEffectivelyOnHold) {
      return project.subProjects.indexOf(sp) % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    }
  
    // If on hold:
    if (project.subProjects.length === 1) {
      return 'bg-amber-50'; // Whole row is colored
    }
  
    // Multiple sub-projects
    if (isSharedCell) {
       return project.subProjects.indexOf(sp) % 2 === 0 ? 'bg-white' : 'bg-gray-50'; // Shared cells keep normal alternating color
    } else {
      return 'bg-amber-50'; // Only sub-project specific cells are colored
    }
  };

  return (
    <div className="space-y-2">
      {/* Top scrollbar */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height: '16px' }}
      >
        <div className="scrollbar-content" style={{ height: '1px' }} />
      </div>

      <div ref={tableContainerRef} onScroll={handleTableScroll} className="overflow-x-auto rounded-lg border" style={{maxHeight: 'calc(100vh - 250px)'}}>
        <table className="min-w-full border-collapse bg-white table-auto">
           <colgroup><col style={{minWidth: '60px'}} /><col style={{minWidth: '64px'}} /><col style={{minWidth: '160px'}} /><col style={{minWidth: '192px'}} /><col style={{minWidth: '192px'}} /><col style={{minWidth: '128px'}} /><col style={{minWidth: '128px'}} /><col style={{minWidth: '112px'}} /><col style={{minWidth: '160px'}} /><col style={{minWidth: '256px'}} /><col style={{minWidth: '256px'}} /><col style={{minWidth: '120px'}} /><col style={{minWidth: '80px'}} /><col style={{minWidth: '112px'}} /><col style={{minWidth: '112px'}} /></colgroup>
          <thead className="sticky top-0 z-30">
            <tr>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700 sticky left-0 z-40">操作</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700 sticky left-[60px] z-40">主專案案號</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700 sticky left-[124px] z-40">主專案名稱</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">專案目的</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">現況/問題點</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">燁輝專案負責主管與分機</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">TPM管理室窗口</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">億威電子</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">子專案名稱</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">本週執行摘要 ({getWeekRange()})</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">下週工作計畫</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">遭遇問題及風險</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">總體完成度</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">預計完成日</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">實際完成日</th>
            </tr>
          </thead>
          <tbody>
            {groupedProjects.map((project) => {
              if (project.subProjects.length === 0) {
                return (
                  <tr key={project.id}>
                    <td className="border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words sticky left-0 z-20 bg-white">
                      <Button variant="ghost" size="icon" onClick={() => onEditProject(project.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words sticky left-[60px] z-20 bg-white">{project.caseNumber}</td>
                    <td className="border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words sticky left-[124px] z-20 bg-white">
                      <div className='flex items-center gap-2'>
                        <span>{project.name}</span>
                        {project.isOnHold && (
                           <Badge className="bg-amber-500 text-white flex items-center gap-1">
                              <PauseCircle className="h-3 w-3" />
                              主專案暫緩中
                           </Badge>
                        )}
                      </div>
                    </td>
                    <td className="border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words">
                      {renderCollapsibleText(project.projectPurpose, `${project.id}-purpose`)}
                    </td>
                    <td className="border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words">
                      {renderCollapsibleText(project.currentStatusAndIssues, `${project.id}-status`)}
                    </td>
                    <td className="border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words">
                      {project.yiehPhuiProjectManager || <span className="text-gray-400 italic">尚未填寫</span>}
                    </td>
                    <td className="border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words">
                      {project.tpmOfficeContact || <span className="text-gray-400 italic">尚未填寫</span>}
                    </td>
                    <td className="border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words">
                      {project.egigaContact || <span className="text-gray-400 italic">尚未填寫</span>}
                    </td>
                    <td colSpan={7} className="border-b px-3 py-2 text-center text-sm text-gray-500 italic">
                        此專案下沒有符合目前篩選條件的子專案
                    </td>
                  </tr>
                );
              }

              return project.subProjects.map((sp, subProjectIndex) => (
                <tr
                  key={sp.id}
                  className={cn(
                    'hover:bg-blue-50',
                    (sp.isOnHold || sp.isParentOnHold) && project.subProjects.length > 1 && 'hover:bg-amber-100/50'
                  )}
                >
                  {subProjectIndex === 0 && (
                    <>
                      <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words sticky left-0 z-20", getCellBgColor(project, sp, true))} style={{ backgroundColor: getCellBgColor(project, sp, true)}}>
                        <Button variant="ghost" size="icon" onClick={() => onEditProject(project.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                      <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words sticky left-[60px] z-20", getCellBgColor(project, sp, true))} style={{ backgroundColor: getCellBgColor(project, sp, true) }}>{project.caseNumber}</td>
                      <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words sticky left-[124px] z-20", getCellBgColor(project, sp, true))} style={{ backgroundColor: getCellBgColor(project, sp, true)}}>
                        <div className='flex items-center gap-2'>
                          <span>{project.name}</span>
                          {project.isOnHold && (
                             <Badge className="bg-amber-500 text-white flex items-center gap-1">
                                <PauseCircle className="h-3 w-3" />
                                主專案暫緩中
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
                        {project.yiehPhuiProjectManager || <span className="text-gray-400 italic">尚未填寫</span>}
                      </td>
                      <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words", getCellBgColor(project, sp, true))}>
                        {project.tpmOfficeContact || <span className="text-gray-400 italic">尚未填寫</span>}
                      </td>
                      <td rowSpan={project.subProjects.length} className={cn("border-b border-r px-3 py-2 text-sm text-gray-800 align-middle break-words", getCellBgColor(project, sp, true))}>
                        {project.egigaContact || <span className="text-gray-400 italic">尚未填寫</span>}
                      </td>
                    </>
                  )}
                  <td className={cn("border-b px-3 py-2 text-sm text-gray-800 break-words align-middle", getCellBgColor(project, sp, false))}>
                     <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSubProjectClick(sp)}
                          className="text-blue-600 underline hover:text-blue-800 bg-transparent border-none p-0 cursor-pointer text-left"
                        >
                          {sp.name}
                        </button>
                        {sp.isOnHold && (
                          <Badge className="bg-amber-500 text-white flex items-center gap-1">
                            <PauseCircle className="h-3 w-3" />
                            暫緩中
                          </Badge>
                        )}
                      </div>
                  </td>
                  <td className={cn("border-b px-3 py-2 text-sm text-gray-800 break-words align-middle", getCellBgColor(project, sp, false))}>
                      {renderCollapsibleText(sp.latestLog?.executionSummary, `${sp.id}-summary`, '無')}
                  </td>
                  <td className={cn("border-b px-3 py-2 text-sm text-gray-800 break-words align-middle", getCellBgColor(project, sp, false))}>
                      {renderCollapsibleText(sp.latestLog?.nextWeekPlan, `${sp.id}-plan`, '無')}
                  </td>
                  <td className={cn("border-b px-3 py-2 text-sm break-words align-middle", getCellBgColor(project, sp, false))}>
                    {sp.latestLog?.roadblocks ? (
                      <span className="rounded bg-red-100 px-2 py-1 text-red-700">
                        {sp.latestLog.roadblocks}
                      </span>
                    ) : (
                      <span className="text-gray-400">無</span>
                    )}
                  </td>
                  <td className={cn("border-b px-3 py-2 text-sm text-left text-gray-800 align-middle", getCellBgColor(project, sp, false))}>{sp.latestLog?.completionPercentage ?? 0}%</td>
                  <td className={cn("border-b px-3 py-2 text-sm text-gray-800 break-words align-middle", getCellBgColor(project, sp, false))}>{formatDate(sp.expectedCompletionDate, 'expected')}</td>
                  <td className={cn("border-b px-3 py-2 text-sm text-gray-800 break-words align-middle", getCellBgColor(project, sp, false))}>{formatDate(sp.actualCompletionDate, 'actual')}</td>
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
