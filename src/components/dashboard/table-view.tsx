'use client';

import { useState, useRef, useEffect } from 'react';
import { SubProjectWithLatestLog, FullProject } from '@/types';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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

  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return <span className="text-gray-400">進行中</span>;
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
  
  const renderCollapsibleCell = (project: FullProject, field: 'projectPurpose' | 'currentStatusAndIssues') => {
    const content = project[field] || '';
    const key = `${project.id}-${field}`;
    const isExpanded = expandedCells[key];
    const needsExpand = content.length > 200; 

    return (
      <div className="space-y-1">
        <p className={cn('whitespace-pre-wrap', !isExpanded && 'line-clamp-5')}>
          {content}
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

      <div ref={tableContainerRef} onScroll={handleTableScroll} className="overflow-x-auto rounded-lg border">
        <table className="min-w-full border-collapse bg-white table-auto">
           <colgroup><col style={{ minWidth: '64px' }} /><col style={{ minWidth: '160px' }} /><col style={{ minWidth: '192px' }} /><col style={{ minWidth: '192px' }} /><col style={{ minWidth: '128px' }} /><col style={{ minWidth: '128px' }} /><col style={{ minWidth: '112px' }} /><col style={{ minWidth: '160px' }} /><col style={{ minWidth: '96px' }} /><col style={{ minWidth: '256px' }} /><col style={{ minWidth: '256px' }} /><col style={{ minWidth: '224px' }} /><col style={{ minWidth: '80px' }} /><col style={{ minWidth: '80px' }} /><col style={{ minWidth: '112px' }} /><col style={{ minWidth: '112px' }} /></colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700 sticky left-0 z-20">主專案案號</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700 sticky left-16 z-20">主專案名稱</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700 sticky left-56 z-20">專案目的</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">現況/問題點</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">燁輝專案負責主管與分機</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">TPM管理室窗口</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">億威電子</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">子專案名稱</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">負責人</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">本週執行摘要 ({getWeekRange()})</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">下週工作計畫</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">遭遇問題及風險</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">總體完成度</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">操作</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">預計完成日</th>
              <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">實際完成日</th>
            </tr>
          </thead>
          <tbody>
            {groupedProjects.map((project, projectIndex) =>
              project.subProjects.map((sp, subProjectIndex) => (
                <tr
                  key={sp.id}
                  className={cn(
                    'hover:bg-blue-50',
                    projectIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  )}
                >
                  {subProjectIndex === 0 && (
                    <>
                      <td rowSpan={project.subProjects.length} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top break-words sticky left-0 z-10" style={{ backgroundColor: projectIndex % 2 === 0 ? 'white' : '#F9FAFB' }}>{project.caseNumber}</td>
                      <td rowSpan={project.subProjects.length} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top break-words sticky left-16 z-10" style={{ backgroundColor: projectIndex % 2 === 0 ? 'white' : '#F9FAFB' }}>{project.name}</td>
                      <td rowSpan={project.subProjects.length} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top break-words sticky left-56 z-10" style={{ backgroundColor: projectIndex % 2 === 0 ? 'white' : '#F9FAFB' }}>{renderCollapsibleCell(project, 'projectPurpose')}</td>
                      <td rowSpan={project.subProjects.length} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top break-words">{renderCollapsibleCell(project, 'currentStatusAndIssues')}</td>
                      <td rowSpan={project.subProjects.length} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top break-words">{project.yiehPhuiProjectManager}</td>
                      <td rowSpan={project.subProjects.length} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top break-words">{project.tpmOfficeContact}</td>
                      <td rowSpan={project.subProjects.length} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top break-words">{project.egigaContact}</td>
                    </>
                  )}
                  <td className="border-b px-3 py-2 text-sm text-gray-800 break-words align-top">
                    <button
                      type="button"
                      onClick={() => onSubProjectClick(sp)}
                      className="text-blue-600 underline hover:text-blue-800 bg-transparent border-none p-0 cursor-pointer text-left"
                    >
                      {sp.name}
                    </button>
                  </td>
                  <td className="border-b px-3 py-2 text-sm text-gray-800 break-words align-top">{sp.ownerName}</td>
                  <td className="border-b px-3 py-2 text-sm text-gray-800 break-words whitespace-pre-wrap align-top">
                      {sp.latestLog?.executionSummary || <span className="text-gray-400">無</span>}
                  </td>
                  <td className="border-b px-3 py-2 text-sm text-gray-800 break-words whitespace-pre-wrap align-top">
                      {sp.latestLog?.nextWeekPlan || <span className="text-gray-400">無</span>}
                  </td>
                  <td className="border-b px-3 py-2 text-sm break-words align-top">
                    {sp.latestLog?.roadblocks ? (
                      <span className="rounded bg-red-100 px-2 py-1 text-red-700 whitespace-pre-wrap">
                        {sp.latestLog.roadblocks}
                      </span>
                    ) : (
                      <span className="text-gray-400">無</span>
                    )}
                  </td>
                  <td className="border-b px-3 py-2 text-sm text-center text-gray-800 align-top">{sp.latestLog?.completionPercentage ?? 0}%</td>
                  <td className="border-b px-3 py-2 text-sm text-gray-800 align-top">
                    <Button variant="ghost" size="icon" onClick={() => onEditProject(sp.projectId)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                   <td className="border-b px-3 py-2 text-sm text-gray-800 break-words align-top">{formatDate(sp.expectedCompletionDate)}</td>
                  <td className="border-b px-3 py-2 text-sm text-gray-800 break-words align-top">{formatDate(sp.actualCompletionDate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
