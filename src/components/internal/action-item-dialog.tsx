'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { createActionItem, updateActionItem, createPocProject } from '@/lib/actions';
import type { ProjectActionItem, FullProject, ActionItemPhase, ActionItemStatus, User, Client } from '@/types';

interface ActionItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ProjectActionItem | null;
  defaultProjectId?: string;
  projects: FullProject[];
  users?: User[];
  clients?: Client[];
  onSuccess: (savedItem?: ProjectActionItem) => void;
}

const PHASES: ActionItemPhase[] = [
  '評估階段',
  '報價/設計',
  '簽呈核決',
  '開發/施工',
  '驗證測試',
  '驗收結案',
];

export function ActionItemDialog({
  open,
  onOpenChange,
  item,
  defaultProjectId,
  projects,
  users = [],
  clients = [],
  onSuccess,
}: ActionItemDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 客戶清單整合
  const clientList: Client[] = clients.length > 0 ? clients : [
    { id: 'c-1', name: '燁輝', code: 'YP', createdAt: '' },
    { id: 'c-2', name: '億威', code: 'EW', createdAt: '' },
  ];

  const [projectId, setProjectId] = useState(item?.projectId || defaultProjectId || '');
  const [isCreatingNewProject, setIsCreatingNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCaseNumber, setNewProjectCaseNumber] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState<'評估案' | '已開案'>('評估案');

  const [title, setTitle] = useState(item?.title || '');
  const [phase, setPhase] = useState<ActionItemPhase>(item?.phase || '開發/施工');
  const [status, setStatus] = useState<ActionItemStatus>(item?.status || 'pending');
  const [owner, setOwner] = useState(item?.owner || '');
  const [waitingOn, setWaitingOn] = useState(item?.waitingOn || '');
  const [dueDate, setDueDate] = useState(item?.dueDate ? item.dueDate.slice(0, 10) : '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [lessonLearnt, setLessonLearnt] = useState(item?.lessonLearnt || '');

  // 根據選擇的責任歸屬 (客戶/單位，如「億威」或「燁輝」)，從成員名單中挑選屬於該客戶的成員
  const selectedClientName = (owner || '燁輝').trim();
  const matchedMembers = users.filter((u) => {
    if (!u.clientName) return false;
    return u.clientName.trim().toLowerCase() === selectedClientName.toLowerCase();
  });

  // 如果該客戶目前還沒有在成員管理中維護成員，或尚未匹配到，備援提供該客戶的主要窗口或全部成員
  const clientContactPerson = clientList.find((c) => c.name === selectedClientName)?.contactPerson;
  const waitingOnMemberOptions = Array.from(
    new Set([
      ...matchedMembers.map((u) => ({
        value: u.displayName || u.email,
        label: u.displayName || u.email,
        hint: u.department ? `${u.department}` : (u.role === 'admin' ? '管理員' : '成員'),
      })),
      ...(clientContactPerson ? [{ value: clientContactPerson, label: clientContactPerson, hint: '客戶主要窗口' }] : []),
    ])
  );

  useEffect(() => {
    if (open) {
      if (item) {
        setProjectId(item.projectId);
        setIsCreatingNewProject(false);
        setTitle(item.title);
        setPhase(item.phase);
        setStatus(item.status);
        setOwner(item.owner || '');
        setWaitingOn(item.waitingOn || '');
        setDueDate(item.dueDate ? item.dueDate.slice(0, 10) : '');
        setNotes(item.notes || '');
        setLessonLearnt(item.lessonLearnt || '');
      } else {
        const targetProjId = defaultProjectId || (projects[0]?.id || '');
        const targetProj = projects.find((p) => p.id === targetProjId);
        setProjectId(targetProjId);
        setIsCreatingNewProject(false);
        setNewProjectName('');
        setNewProjectCaseNumber('');
        setTitle('');
        setPhase('開發/施工');
        setStatus('pending');
        setOwner(targetProj?.clientName || '燁輝');
        setWaitingOn('');
        setDueDate('');
        setNotes('');
        setLessonLearnt('');
      }
    }
  }, [open, item, defaultProjectId, projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: '請輸入事項標題', variant: 'destructive' });
      return;
    }
    if (!isCreatingNewProject && !projectId) {
      toast({ title: '請選擇所屬專案或建立新專案', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      let targetProjectId = projectId;

      if (!item && isCreatingNewProject) {
        if (!newProjectName.trim()) {
          toast({ title: '請輸入新專案名稱', variant: 'destructive' });
          setIsSubmitting(false);
          return;
        }

        const pocRes = await createPocProject({
          name: newProjectName.trim(),
          category: newProjectCategory,
          caseNumber: newProjectCaseNumber.trim() || undefined,
          tpmOfficeContact: owner || undefined,
        });

        if (!pocRes.success || !pocRes.data) {
          toast({ title: '建立新專案失敗', description: pocRes.message, variant: 'destructive' });
          setIsSubmitting(false);
          return;
        }
        targetProjectId = pocRes.data.id;
      }

      if (item?.id) {
        const res = await updateActionItem(item.id, {
          title,
          phase,
          status,
          owner: owner === '未指定' ? '' : owner,
          waitingOn,
          dueDate: dueDate || null,
          notes,
          lessonLearnt,
        });
        if (res.success) {
          toast({ title: '更新成功', description: '待辦歷程已成功儲存' });
          onSuccess(res.data as any);
          onOpenChange(false);
        } else {
          toast({ title: '更新失敗', description: res.message, variant: 'destructive' });
        }
      } else {
        const res = await createActionItem({
          projectId: targetProjectId,
          title,
          phase,
          status,
          owner: owner === '未指定' ? '' : owner,
          waitingOn,
          dueDate: dueDate || null,
          notes,
          lessonLearnt,
        });
        if (res.success) {
          toast({ title: '新增成功', description: '待辦事項已建立！' });
          onSuccess(res.data as any);
          onOpenChange(false);
        } else {
          toast({ title: '新增失敗', description: res.message, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: '操作失敗', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {item ? '編輯專案待辦與歷程' : '新增專案待辦與歷程'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 所屬專案選擇或直接新增 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-semibold">所屬專案項目 *</Label>
              {!item && (
                <button
                  type="button"
                  onClick={() => setIsCreatingNewProject(!isCreatingNewProject)}
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                >
                  {isCreatingNewProject ? '◀ 返回選擇現有專案' : '➕ 建立全新專案 (評估案 / 已開案)'}
                </button>
              )}
            </div>

            {isCreatingNewProject ? (
              <div className="p-3 border rounded-md bg-purple-50/50 border-purple-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-purple-900 font-semibold">
                  <span>🧪 建立內部專案項目</span>
                  <span className="text-[11px] font-normal text-purple-700">(不公開於客戶管制表)</span>
                </div>

                {/* 專案類別切換 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewProjectCategory('評估案')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                      newProjectCategory === '評估案'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>📝 評估案 (POC / 前期)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProjectCategory('已開案')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                      newProjectCategory === '已開案'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>🚀 已開案 (執行中)</span>
                  </button>
                </div>

                <div>
                  <Input
                    placeholder={newProjectCategory === '評估案' ? "輸入評估專案名稱 (例如：POC-堆高機雙鏡頭自主防撞評估)" : "輸入開案名稱 (例如：全廠設備連網通訊介面升級)"}
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="bg-white text-sm"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="案號代碼 (選填，如: POC-01)"
                    value={newProjectCaseNumber}
                    onChange={(e) => setNewProjectCaseNumber(e.target.value)}
                    className="bg-white text-xs h-8"
                  />
                  <span className="text-[11px] text-muted-foreground flex items-center">
                    未填將自動配發案號
                  </span>
                </div>
              </div>
            ) : (
              <Select
                value={projectId}
                onValueChange={(val) => {
                  setProjectId(val);
                  const selectedP = projects.find((p) => p.id === val);
                  if (selectedP?.clientName) {
                    setOwner(selectedP.clientName);
                  }
                }}
                disabled={!!item}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="請選擇專案" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.projectCategory === '評估案' ? '📝 [評估案] ' : '🚀 [已開案] '}[{p.caseNumber}] {p.name} {p.clientName ? `(${p.clientName})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 事項標題 */}
          <div>
            <Label className="text-sm font-semibold">事項 / 事件名稱 *</Label>
            <Input
              className="mt-1"
              placeholder="例如：廠商億威提供雙鏡頭報價、簽呈核決會勘、停電施工..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* 階段與狀態 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">專案階段</Label>
              <Select value={phase} onValueChange={(val) => setPhase(val as ActionItemPhase)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-semibold">目前狀態</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as ActionItemStatus)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ 待處理 (Pending)</SelectItem>
                  <SelectItem value="in_progress">🔄 處理中 (In Progress)</SelectItem>
                  <SelectItem value="blocked">🚨 等候卡關中 (Blocked)</SelectItem>
                  <SelectItem value="completed">✅ 已完成 (Done)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 責任歸屬 & 目前等誰處理 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                責任歸屬 (客戶/單位)
              </Label>
              <Select value={owner || '燁輝'} onValueChange={setOwner}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="選擇責任歸屬客戶" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {clientList.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name} {c.code ? `(${c.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-semibold text-rose-600 flex items-center justify-between">
                <span>目前等誰處理 (卡關跟催對象)</span>
                {owner && <span className="text-[11px] font-normal text-rose-500 font-sans">({owner} 成員)</span>}
              </Label>
              <div className="mt-1">
                <SearchableCombobox
                  value={waitingOn}
                  onChange={setWaitingOn}
                  options={waitingOnMemberOptions}
                  placeholder={
                    waitingOnMemberOptions.length > 0
                      ? `選擇 ${owner || '客戶'} 成員或輸入...`
                      : '輸入等候對象或處理事項...'
                  }
                />
              </div>
            </div>
          </div>

          {/* 預計完成日 */}
          <div>
            <Label className="text-sm font-semibold">預計完成日 (跟催基準點)</Label>
            <Input
              type="date"
              className="mt-1"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* 歷程紀錄說明 */}
          <div>
            <Label className="text-sm font-semibold">歷程紀錄 / 說明</Label>
            <Textarea
              className="mt-1 min-h-[70px]"
              placeholder="記錄事件經過、會議結論、重要溝通紀錄..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* 經驗檢討 (Lesson Learnt) */}
          <div className="rounded-md bg-amber-50/60 p-3 border border-amber-200">
            <Label className="text-sm font-semibold text-amber-900">
              💡 經驗檢討與改善對策 (Lesson Learnt)
            </Label>
            <Textarea
              className="mt-1 min-h-[60px] bg-white"
              placeholder="結案或里程碑檢討：未來遇類似專案可採取的改善對策..."
              value={lessonLearnt}
              onChange={(e) => setLessonLearnt(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '儲存中...' : item ? '確認更新' : '建立待辦'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
