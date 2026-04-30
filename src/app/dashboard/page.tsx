'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, LayoutGrid, List, Plus, PauseCircle, PlayCircle, Trash2, Download, Clock, Edit } from 'lucide-react';
import { CreateProjectDialog } from '@/components/create-project-dialog';
import { EditProjectDialog } from '@/components/edit-project-dialog';
import { AddProgressLogDialog } from '@/components/add-progress-log-dialog';
import { ProgressHistoryDialog } from '@/components/progress-history-dialog';
import { HoldProjectDialog, ResumeProjectDialog } from '@/components/hold-resume-dialogs';
import { DeleteProjectDialog } from '@/components/delete-project-dialog';
import { exportProjectsToExcel } from '@/lib/export-excel';
import { createProject, updateProject, addProgressLog, setProjectOnHold, resumeProjects, deleteSubProjects, deleteProject } from '@/lib/actions';
import type { FullProject, SubProjectWithLatestLog, User } from '@/types';

type ViewMode = 'card' | 'table';
type FilterType = 'all' | 'active' | 'on-hold' | 'overdue' | 'completed';

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<FullProject[]>([]);
  const [users, setUsers] = useState<{uid:string;displayName:string}[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState<FullProject|null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<SubProjectWithLatestLog|null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<SubProjectWithLatestLog|null>(null);
  const [holdOpen, setHoldOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FullProject|null>(null);

  const loadData = useCallback(async () => {
    try {
      const [projRes, userRes] = await Promise.all([
        fetch('/api/projects'), fetch('/api/users')
      ]);
      const projData = await projRes.json();
      const userData = await userRes.json();
      setProjects(projData.projects || []);
      setUsers(userData.users || []);
    } catch (e) { console.error('載入資料失敗', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const allSubProjects = useMemo(() =>
    projects.flatMap(p => (p.subProjects||[]).map(sp => ({...sp, _parent: p}))),
  [projects]);

  const filtered = useMemo(() => {
    let r = allSubProjects;
    if (filter === 'active') r = r.filter(sp => !sp.isOverdue && !sp.isParentOnHold && !sp.isOnHold && sp.latestLog?.completionPercentage !== 100);
    if (filter === 'on-hold') r = r.filter(sp => sp.isParentOnHold || sp.isOnHold);
    if (filter === 'overdue') r = r.filter(sp => sp.isOverdue);
    if (filter === 'completed') r = r.filter(sp => sp.latestLog?.completionPercentage === 100);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(sp => sp.name.toLowerCase().includes(q) || sp.projectCaseNumber?.toLowerCase().includes(q) || sp.projectName?.toLowerCase().includes(q) || (sp as any)._parent?.tpmOfficeContact?.toLowerCase().includes(q));
    }
    return r;
  }, [allSubProjects, filter, searchQuery]);

  const canEdit = user?.role === 'admin' || user?.role === 'editor';
  const weekRange = getWeekRange();

  // Handlers
  const handleCreate = async (data: any) => {
    await createProject({...data, subProjects: data.subProjects.map((sp:any) => ({...sp, expectedCompletionDate: undefined, actualCompletionDate: undefined}))});
    await loadData();
  };
  const handleEdit = async (pid: string, data: any, origIds: string[]) => {
    await updateProject(pid, {...data, subProjects: data.subProjects.map((sp:any) => ({...sp, expectedCompletionDate: undefined, actualCompletionDate: undefined}))}, origIds);
    await loadData();
  };
  const handleAddLog = async (data: any) => {
    if (!logTarget) return;
    await addProgressLog(logTarget.projectId, logTarget.id, data);
    await loadData();
  };
  const handleHold = async (pid: string, spIds: string[], data: any) => {
    await setProjectOnHold(pid, spIds, {reason: data.reason, startDate: new Date(data.startDate), notes: data.notes});
    await loadData();
  };
  const handleResume = async (pids: string[], spsByProject: Record<string,string[]>) => {
    await resumeProjects(pids, spsByProject);
    await loadData();
  };
  const handleExport = () => exportProjectsToExcel(projects);
  const handleDelete = async (projectId: string) => {
    await deleteProject(projectId);
    await loadData();
  };

  const openAddLog = (sp: SubProjectWithLatestLog) => { setLogTarget(sp); setLogOpen(true); };
  const openHistory = (sp: SubProjectWithLatestLog) => { setHistoryTarget(sp); setHistoryOpen(true); };
  const openEditProject = (p: FullProject) => { setEditProject(p); setEditOpen(true); };
  const openDeleteProject = (p: FullProject) => { setDeleteTarget(p); setDeleteOpen(true); };

  if (loading) return <div className="flex h-[60vh] items-center justify-center text-muted-foreground animate-pulse">載入中...</div>;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="全部子專案" value={allSubProjects.length} color="blue" />
        <StatCard label="進行中" value={allSubProjects.filter(sp=>!sp.isOverdue&&!sp.isOnHold&&!sp.isParentOnHold&&sp.latestLog?.completionPercentage!==100).length} color="green" />
        <StatCard label="逾期未報" value={allSubProjects.filter(sp=>sp.isOverdue).length} color="red" />
        <StatCard label="暫緩中" value={allSubProjects.filter(sp=>sp.isOnHold||sp.isParentOnHold).length} color="amber" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜尋案號、名稱、窗口..." className="pl-10" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={v=>setFilter(v as FilterType)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有專案</SelectItem>
            <SelectItem value="active">排除已完成</SelectItem>
            <SelectItem value="on-hold">暫緩中</SelectItem>
            <SelectItem value="overdue">逾期未報</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <button onClick={()=>setViewMode('card')} className={`p-2 rounded-l-md ${viewMode==='card'?'bg-primary text-white':'hover:bg-accent'}`}><LayoutGrid className="h-4 w-4"/></button>
          <button onClick={()=>setViewMode('table')} className={`p-2 rounded-r-md ${viewMode==='table'?'bg-primary text-white':'hover:bg-accent'}`}><List className="h-4 w-4"/></button>
        </div>
        {canEdit && <>
          <Button size="sm" onClick={()=>setCreateOpen(true)}><Plus className="h-4 w-4 mr-1"/>新增專案</Button>
          <Button size="sm" variant="outline" onClick={()=>setHoldOpen(true)}><PauseCircle className="h-4 w-4 mr-1"/>暫緩</Button>
          <Button size="sm" variant="outline" onClick={()=>setResumeOpen(true)}><PlayCircle className="h-4 w-4 mr-1"/>恢復</Button>
        </>}
        <Button size="sm" variant="outline" className="bg-green-600 text-white hover:bg-green-700" onClick={handleExport}><Download className="h-4 w-4 mr-1"/>匯出總表</Button>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? '找不到符合的結果' : '目前沒有專案資料'}
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(sp => <Card key={sp.id} sp={sp} canEdit={canEdit} onAddLog={openAddLog} onHistory={openHistory} onEdit={()=>openEditProject((sp as any)._parent)} onDelete={()=>openDeleteProject((sp as any)._parent)} />)}
        </div>
      ) : (
        <Table sps={filtered} canEdit={canEdit} onEdit={sp=>openEditProject((sp as any)._parent)} onDelete={sp=>openDeleteProject((sp as any)._parent)} onAddLog={openAddLog} onHistory={openHistory} weekRange={weekRange} />
      )}

      {/* All Dialogs */}
      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate} users={users} />
      <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={editProject} onSubmit={handleEdit} users={users} />
      {logTarget && <AddProgressLogDialog open={logOpen} onOpenChange={setLogOpen} subProjectName={logTarget.name} reportingPeriod={weekRange} previousPlan={logTarget.latestLog?.nextWeekPlan} previousRoadblocks={logTarget.latestLog?.roadblocks} previousPercentage={logTarget.latestLog?.completionPercentage} onSubmit={handleAddLog} />}
      {historyTarget && <ProgressHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} subProjectName={historyTarget.name} projectCaseNumber={historyTarget.projectCaseNumber||''} projectId={historyTarget.projectId} subProjectId={historyTarget.id} />}
      <HoldProjectDialog open={holdOpen} onOpenChange={setHoldOpen} projects={projects} onSubmit={handleHold} />
      <ResumeProjectDialog open={resumeOpen} onOpenChange={setResumeOpen} projects={projects} onSubmit={handleResume} />
      <DeleteProjectDialog open={deleteOpen} onOpenChange={setDeleteOpen} project={deleteTarget} onConfirm={handleDelete} />
    </div>
  );
}

function StatCard({label,value,color}:{label:string;value:number;color:string}) {
  const colors: Record<string,string> = {blue:'bg-blue-50 border-blue-200 text-blue-700',green:'bg-green-50 border-green-200 text-green-700',red:'bg-red-50 border-red-200 text-red-700',amber:'bg-amber-50 border-amber-200 text-amber-700'};
  return <div className={`rounded-lg border p-4 ${colors[color]}`}><p className="text-sm opacity-80">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></div>;
}

function Card({sp,canEdit,onAddLog,onHistory,onEdit,onDelete}:{sp:SubProjectWithLatestLog&{_parent?:FullProject};canEdit:boolean;onAddLog:(s:SubProjectWithLatestLog)=>void;onHistory:(s:SubProjectWithLatestLog)=>void;onEdit:()=>void;onDelete:()=>void}) {
  const hold = sp.isParentOnHold||sp.isOnHold;
  const pct = sp.latestLog?.completionPercentage??0;
  const pColor = pct>=100?'bg-green-500':hold?'bg-amber-500':sp.isOverdue?'bg-red-500':'bg-blue-500';
  const border = sp.isOverdue?'border-red-300':hold?'border-amber-300':'border-gray-200';

  return (
    <div className={`relative bg-white rounded-lg border-2 ${border} shadow-sm hover:shadow-md transition-shadow flex flex-col`}>
      {sp.isOverdue&&!hold&&<div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"><Badge variant="destructive" className="text-xs px-3">逾期未報</Badge></div>}
      {hold&&<div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"><Badge variant="warning" className="text-xs px-3">⏸ 暫緩中</Badge></div>}
      <div className="p-4 flex-1 flex flex-col">
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{sp.projectCaseNumber}</span>
            <div className="flex gap-1">
              {canEdit&&<button onClick={onEdit} className="text-muted-foreground hover:text-primary p-0.5"><Edit className="h-3 w-3"/></button>}
              {canEdit&&<button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-0.5" title="刪除專案"><Trash2 className="h-3 w-3"/></button>}
              <button onClick={()=>onHistory(sp)} className="text-muted-foreground hover:text-primary p-0.5"><Clock className="h-3 w-3"/></button>
            </div>
          </div>
          <h3 className="font-bold text-sm leading-tight mt-0.5 line-clamp-2">{sp.name}</h3>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground mb-3">
          {sp._parent?.tpmOfficeContact&&<div className="flex justify-between"><span>TPM窗口</span><span className="font-medium text-foreground">{sp._parent.tpmOfficeContact}</span></div>}
          {sp.expectedCompletionDate&&<div className="flex justify-between"><span>預計完成日</span><span className="font-medium text-foreground">{new Date(sp.expectedCompletionDate).toLocaleDateString('zh-TW')}</span></div>}
        </div>
        {sp.latestLog&&<div className="space-y-2 text-xs flex-1">
          <div><p className="font-medium text-muted-foreground mb-0.5">本週摘要</p><p className="line-clamp-3 whitespace-pre-line">{sp.latestLog.executionSummary}</p></div>
          {sp.latestLog.nextWeekPlan&&<div><p className="font-medium text-muted-foreground mb-0.5">下週計畫</p><p className="line-clamp-2 whitespace-pre-line">{sp.latestLog.nextWeekPlan}</p></div>}
          {sp.latestLog.roadblocks&&sp.latestLog.roadblocks!=='無'&&<div className="p-2 rounded bg-red-50"><p className="font-medium text-muted-foreground mb-0.5">問題</p><p className="line-clamp-2 text-red-700">{sp.latestLog.roadblocks}</p></div>}
        </div>}
        <div className="mt-3 pt-3 border-t">
          <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">進度</span><span className="font-bold">{pct}%</span></div>
          <Progress value={pct} indicatorClassName={pColor}/>
        </div>
        {canEdit&&<button onClick={()=>onAddLog(sp)} className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-1.5 border-t"><Plus className="h-3 w-3"/>新增週報</button>}
      </div>
    </div>
  );
}

function Table({sps,canEdit,onEdit,onDelete,onAddLog,onHistory,weekRange}:{sps:(SubProjectWithLatestLog&{_parent?:FullProject})[];canEdit:boolean;onEdit:(s:SubProjectWithLatestLog)=>void;onDelete:(s:SubProjectWithLatestLog)=>void;onAddLog:(s:SubProjectWithLatestLog)=>void;onHistory:(s:SubProjectWithLatestLog)=>void;weekRange:string}) {
  const fmtDate = (d?:string) => d ? new Date(d).toLocaleDateString('zh-TW') : '';
  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
      <div className="min-w-[2200px]">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b text-xs">
            {canEdit&&<th className="px-2 py-3 text-left font-medium text-muted-foreground w-16 sticky left-0 bg-gray-50 z-10">操作</th>}
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-14">主專案案號</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-44">主專案名稱</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-44">專案目的</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-44">現況/問題點</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-36">燁輝專案負責主管與分機</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-28">TPM管理室窗口</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-20">億威電子</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-44">子專案名稱</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-72">本週執行摘要 ({weekRange})</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-56">下週工作計畫</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-44">遭遇問題及風險</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-16">完成度</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-24">預計完成日</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-24">實際完成日</th>
            <th className="px-2 py-3 text-left font-medium text-muted-foreground w-16">狀態</th>
          </tr></thead>
          <tbody>{sps.map(sp=>{
            const hold=sp.isParentOnHold||sp.isOnHold;
            const p=sp._parent;
            const hasRoadblock = sp.latestLog?.roadblocks && sp.latestLog.roadblocks !== '無';
            return <tr key={sp.id} className={`border-b hover:bg-gray-50 align-top ${hold?'bg-amber-50/50':''} ${sp.isOverdue?'bg-red-50/30':''}`}>
              {canEdit&&<td className="px-2 py-2 sticky left-0 bg-white z-10"><div className="flex gap-1">
                <button onClick={()=>onEdit(sp)} title="編輯專案" className="hover:bg-gray-100 p-1 rounded">✏️</button>
                <button onClick={()=>onAddLog(sp)} title="新增週報" className="hover:bg-gray-100 p-1 rounded">📝</button>
                <button onClick={()=>onDelete(sp)} title="刪除專案" className="hover:bg-gray-100 p-1 rounded text-red-400 hover:text-red-600">🗑️</button>
              </div></td>}
              <td className="px-2 py-2 text-xs font-medium">{sp.projectCaseNumber}</td>
              <td className="px-2 py-2 text-xs font-medium">{sp.projectName}</td>
              <td className="px-2 py-2 text-xs"><p className="line-clamp-3 whitespace-pre-line">{p?.projectPurpose||''}</p></td>
              <td className="px-2 py-2 text-xs"><p className="line-clamp-3 whitespace-pre-line">{p?.currentStatusAndIssues||''}</p></td>
              <td className="px-2 py-2 text-xs">{p?.yiehPhuiProjectManager||''}</td>
              <td className="px-2 py-2 text-xs">{p?.tpmOfficeContact||''}</td>
              <td className="px-2 py-2 text-xs">{p?.egigaContact||''}</td>
              <td className="px-2 py-2"><button onClick={()=>onHistory(sp)} className="text-primary hover:underline text-xs font-medium text-left">{sp.name}{sp.isOnHold&&<Badge variant="warning" className="ml-1 text-[9px] px-1">暫緩</Badge>}</button></td>
              <td className="px-2 py-2 text-xs"><p className="whitespace-pre-line line-clamp-4">{sp.latestLog?.executionSummary||'—'}</p></td>
              <td className="px-2 py-2 text-xs"><p className="whitespace-pre-line line-clamp-3">{sp.latestLog?.nextWeekPlan||''}</p></td>
              <td className={`px-2 py-2 text-xs ${hasRoadblock?'bg-red-50':''}`}><p className={`whitespace-pre-line line-clamp-3 ${hasRoadblock?'text-red-700 font-medium':''}`}>{sp.latestLog?.roadblocks||'無'}</p></td>
              <td className="px-2 py-2 text-xs font-bold text-center">{sp.latestLog?.completionPercentage??0}%</td>
              <td className="px-2 py-2 text-xs">{fmtDate(sp.expectedCompletionDate)}</td>
              <td className="px-2 py-2 text-xs">{fmtDate(sp.actualCompletionDate)}</td>
              <td className="px-2 py-2">{hold?<Badge variant="warning" className="text-[10px]">暫緩</Badge>:sp.isOverdue?<Badge variant="destructive" className="text-[10px]">逾期</Badge>:sp.latestLog?.completionPercentage===100?<Badge variant="success" className="text-[10px]">完成</Badge>:<Badge className="text-[10px]">正常</Badge>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function getWeekRange() {
  const now=new Date(),dow=now.getDay(),mon=new Date(now);
  mon.setDate(now.getDate()-(dow===0?6:dow-1));
  const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  const f=(d:Date)=>`${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  return `${f(mon)} ~ ${f(sun)}`;
}
