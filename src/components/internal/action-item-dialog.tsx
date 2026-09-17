'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { AttachmentsUploader } from './attachments-uploader';
import { createActionItem, updateActionItem, createPocProject, getClients } from '@/lib/actions';
import type { ProjectActionItem, FullProject, ActionItemPhase, ActionItemStatus, User, Client, ActionItemAttachment } from '@/types';

interface ActionItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ProjectActionItem | null;
  defaultProjectId?: string;
  projects: FullProject[];
  users?: User[];
  clients?: Client[];
  actionItems?: ProjectActionItem[];
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
  clients: initialClients = [],
  actionItems = [],
  onSuccess,
}: ActionItemDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientList, setClientList] = useState<Client[]>(initialClients);

  // 若父層沒傳或需要更新 clients，主動載入客戶清單
  useEffect(() => {
    if (initialClients && initialClients.length > 0) {
      setClientList(initialClients);
    }
  }, [initialClients]);

  useEffect(() => {
    if (open && clientList.length === 0) {
      getClients().then((res) => {
        if (res && res.length > 0) setClientList(res);
      });
    }
  }, [open, clientList.length]);

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
  const [completedAt, setCompletedAt] = useState(item?.completedAt ? item.completedAt.slice(0, 10) : '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [lessonLearnt, setLessonLearnt] = useState(item?.lessonLearnt || '');
  const [attachments, setAttachments] = useState<ActionItemAttachment[]>(item?.attachments || []);

  // 組合客戶選項清單 (保證同時相容資料庫真實名稱與億威/燁輝別名)
  const effectiveClientOptions: Client[] = useMemo(() => {
    const list: Client[] = clientList.length > 0 ? [...clientList] : [
      { id: 'c-1', name: '燁輝', code: 'YP', createdAt: '' },
      { id: 'c-2', name: '億威電子', code: 'emmt', createdAt: '' },
    ];
    if (!list.some((c: Client) => c.name.includes('億威'))) {
      list.push({ id: 'c-emmt', name: '億威電子', code: 'emmt', createdAt: '' });
    }
    if (!list.some((c: Client) => c.name === '燁輝')) {
      list.push({ id: 'c-yp', name: '燁輝', code: 'YP', createdAt: '' });
    }
    if (owner && !list.some((c: Client) => c.name === owner)) {
      list.push({ id: `c-custom-${owner}`, name: owner, code: '', createdAt: '' });
    }
    return list;
  }, [clientList, owner]);

  // 智慧寬容客戶名稱比對 (如「億威」相容「億威電子」、「億威 (EW)」等)
  const normalizeClientName = (name?: string) => {
    if (!name) return '';
    return name.toLowerCase().replace(/（.*）|\(.*\)/g, '').trim();
  };

  const isClientMatch = (userClient?: string, targetClient?: string) => {
    if (!userClient || !targetClient) return false;
    const u = normalizeClientName(userClient);
    const t = normalizeClientName(targetClient);
    if (!u || !t) return false;
    if (u === t || u.includes(t) || t.includes(u)) return true;
    if (u.includes('億威') && t.includes('億威')) return true;
    if (u.includes('燁輝') && t.includes('燁輝')) return true;
    return false;
  };

  // 根據選擇的責任歸屬 (客戶/單位，如「宇陽傳動」、「億威」或「燁輝」)，精準挑選屬於該客戶的成員
  const selectedClientName = (owner || '').trim();

  const waitingOnMemberOptions = useMemo(() => {
    const optionsMap = new Map<string, { value: string; label: string; hint?: string }>();

    // 1. 若責任歸屬未指定或為空，顯示系統所有成員供選擇
    if (!selectedClientName || selectedClientName === '未指定') {
      users.forEach((u) => {
        const val = (u.displayName || u.email || '').trim();
        if (!val) return;
        const hint = u.department
          ? `${u.department}${u.clientName ? ` (${u.clientName})` : ''}`
          : (u.clientName ? `${u.clientName}` : (u.role === 'admin' ? '管理員' : '成員'));
        optionsMap.set(val, { value: val, label: val, hint });
      });
      return Array.from(optionsMap.values());
    }

    // 2. 當有指定客戶時，嚴格只帶出屬於該客戶的人選！
    // (a) 屬於該客戶的系統成員
    users.forEach((u) => {
      let isMatch = false;
      if (u.clientName && isClientMatch(u.clientName, selectedClientName)) {
        isMatch = true;
      }
      const emailLower = u.email?.toLowerCase() || '';
      if (selectedClientName.includes('億威') && emailLower.includes('emmt.com.tw')) {
        isMatch = true;
      }
      if (selectedClientName.includes('燁輝') && emailLower.includes('yiehphui.com.tw')) {
        isMatch = true;
      }

      if (isMatch) {
        const val = (u.displayName || u.email || '').trim();
        if (val && !optionsMap.has(val)) {
          const hint = u.department
            ? `${u.department} (${selectedClientName})`
            : `${selectedClientName} 成員`;
          optionsMap.set(val, { value: val, label: val, hint });
        }
      }
    });

    // (b) 該客戶基本資料中設定的主要窗口 (contactPerson)
    const clientRecord = effectiveClientOptions.find((c: Client) => isClientMatch(c.name, selectedClientName));
    if (clientRecord?.contactPerson && clientRecord.contactPerson.trim()) {
      const val = clientRecord.contactPerson.trim();
      if (!optionsMap.has(val)) {
        optionsMap.set(val, { value: val, label: val, hint: `${selectedClientName} 主要窗口` });
      }
    }

    // (c) 屬於該客戶的專案中所設定的客戶窗口 (clientContact)
    projects.forEach((p) => {
      if (p.clientName && isClientMatch(p.clientName, selectedClientName)) {
        if (p.clientContact && p.clientContact.trim()) {
          const val = p.clientContact.trim();
          if (!optionsMap.has(val)) {
            optionsMap.set(val, { value: val, label: val, hint: `${selectedClientName} 專案窗口` });
          }
        }
      }
    });

    // (d) 過去在待辦事項中，曾指定為此客戶 (或此客戶專案) 處理人 (waitingOn) 的歷程名單 (例如曾手動輸入過「賴冠廷」)
    if (actionItems && actionItems.length > 0) {
      actionItems.forEach((ai) => {
        if (!ai.waitingOn || !ai.waitingOn.trim()) return;
        let isMatch = false;
        if (ai.owner && isClientMatch(ai.owner, selectedClientName)) {
          isMatch = true;
        } else {
          const p = projects.find((proj) => proj.id === ai.projectId);
          if (p?.clientName && isClientMatch(p.clientName, selectedClientName)) {
            isMatch = true;
          }
        }
        if (isMatch) {
          const val = ai.waitingOn.trim();
          if (!optionsMap.has(val)) {
            optionsMap.set(val, { value: val, label: val, hint: `${selectedClientName} 曾處理人員` });
          }
        }
      });
    }

    return Array.from(optionsMap.values());
  }, [users, selectedClientName, effectiveClientOptions, projects, actionItems]);

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
        setCompletedAt(item.completedAt ? item.completedAt.slice(0, 10) : '');
        setNotes(item.notes || '');
        setLessonLearnt(item.lessonLearnt || '');
        setAttachments(item.attachments || []);
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
        setCompletedAt('');
        setNotes('');
        setLessonLearnt('');
        setAttachments([]);
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
          completedAt: status === 'completed' ? (completedAt ? new Date(completedAt).toISOString() : null) : null,
          notes,
          lessonLearnt,
          attachments,
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
          completedAt: status === 'completed' ? (completedAt ? new Date(completedAt).toISOString() : null) : null,
          notes,
          lessonLearnt,
          attachments,
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
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
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
              <Label className="text-sm font-semibold flex items-center h-5">專案階段</Label>
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
              <Label className="text-sm font-semibold flex items-center h-5">目前狀態</Label>
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
              <Label className="text-sm font-semibold flex items-center gap-1.5 h-5">
                <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>責任歸屬</span>
              </Label>
              <Select value={owner || '燁輝'} onValueChange={setOwner}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="選擇責任歸屬客戶" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {effectiveClientOptions.map((c: Client) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name} {c.code ? `(${c.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-semibold text-rose-600 flex items-center justify-between h-5">
                <span className="truncate">等誰處理</span>
                {owner && <span className="text-[11px] font-normal text-rose-500 font-sans truncate ml-1">({owner} 成員)</span>}
              </Label>
              <div className="mt-1">
                <SearchableCombobox
                  value={waitingOn}
                  onChange={setWaitingOn}
                  options={waitingOnMemberOptions}
                  placeholder={
                    waitingOnMemberOptions.length > 0
                      ? `選擇 ${owner || '客戶'} 成員或輸入...`
                      : `輸入 ${owner ? `${owner} ` : ''}成員姓名或處理事項...`
                  }
                  emptyHint={
                    owner
                      ? `「${owner}」尚無預設成員，可直接手動輸入姓名`
                      : '請先選擇責任歸屬客戶，或直接手動輸入姓名'
                  }
                />
              </div>
            </div>
          </div>

          {/* 預計完成日 與 實際完成日 */}
          <div className={`grid ${status === 'completed' ? 'grid-cols-2 gap-3' : 'grid-cols-1'}`}>
            <div>
              <Label className="text-sm font-semibold flex items-center h-5">預計完成日</Label>
              <Input
                type="date"
                className="mt-1"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              {item?.originalDueDate && item.originalDueDate !== dueDate && (
                <span className="text-[11px] text-amber-600 block mt-0.5">
                  📌 最初基準日：{item.originalDueDate}
                </span>
              )}
            </div>

            {status === 'completed' && (
              <div>
                <Label className="text-sm font-semibold text-emerald-700 flex items-center justify-between h-5">
                  <span>實際完成日</span>
                  <span className="text-[10px] font-normal text-muted-foreground">(留空以系統為準)</span>
                </Label>
                <Input
                  type="date"
                  className="mt-1 border-emerald-300 focus-visible:ring-emerald-500"
                  value={completedAt}
                  onChange={(e) => setCompletedAt(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 歷程紀錄說明 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>📝 歷程紀錄 / 追蹤說明</span>
              </Label>
              <span className="text-xs text-muted-foreground">
                可記錄詳細進程（支援自由拖拉展開高度）
              </span>
            </div>
            <Textarea
              className="min-h-[160px] text-sm leading-relaxed font-sans p-3 resize-y bg-slate-50/40 focus:bg-white border-slate-300 focus:border-indigo-400 transition-colors shadow-2xs"
              placeholder="詳細記錄事件經過、會勘會議結論、重要溝通紀錄或待突破事項..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* 附件上傳 (Google Drive 直傳) */}
          <AttachmentsUploader
            attachments={attachments}
            onChange={setAttachments}
            disabled={isSubmitting}
          />

          {/* 經驗檢討 (Lesson Learnt) */}
          <div className="rounded-lg bg-amber-50/70 p-3.5 border border-amber-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <span>💡 經驗檢討與改善對策 (Lesson Learnt)</span>
              </Label>
              <span className="text-[11px] text-amber-700/80">結案或里程碑檢討填寫</span>
            </div>
            <Textarea
              className="min-h-[85px] text-xs leading-relaxed bg-white border-amber-200 focus-visible:ring-amber-400 resize-y p-2.5 shadow-2xs"
              placeholder="未來若遇類似專案時，可採取的防範或改善對策（供後續專案傳承參考）..."
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
