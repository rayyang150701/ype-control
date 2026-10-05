'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { Building2, Pin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { AttachmentsUploader } from './attachments-uploader';
import { createActionItem, updateActionItem, createPocProject, getClients } from '@/lib/actions';
import { useAdmin } from '@/components/admin-context';
import { TPM_PERSONNEL_NAMES } from '@/lib/tpm-helper';
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
  '1.1 設計階段',
  '1.1.1 評估',
  '1.1.2 報價',
  '1.1.3 簽呈',
  '1.2 施工階段',
  '1.3 驗證階段',
  '1.4 驗收階段',
  '1.4.1 教育訓練',
  '1.4.2 驗收結案',
];

const getLocalTodayDateStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

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
  const { currentUser } = useAdmin();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
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
  const [newProjectEvaluationDate, setNewProjectEvaluationDate] = useState<string>(() => getLocalTodayDateStr());

  const [title, setTitle] = useState(item?.title || '');
  const [isPinned, setIsPinned] = useState(item?.isPinned || false);
  const [phase, setPhase] = useState<ActionItemPhase>(item?.phase || '1.2 施工階段');
  const [status, setStatus] = useState<ActionItemStatus>(item?.status || 'pending');
  const [owner, setOwner] = useState(item?.owner || '');
  const [waitingOn, setWaitingOn] = useState(item?.waitingOn || '');
  const [dueDate, setDueDate] = useState(item?.dueDate ? item.dueDate.slice(0, 10) : '');
  const [completedAt, setCompletedAt] = useState(item?.completedAt ? item.completedAt.slice(0, 10) : '');
  const [lastUpdatedDate, setLastUpdatedDate] = useState<string>(() => getLocalTodayDateStr());
  const [notes, setNotes] = useState((item?.notes || '').replace(/<!--ATTACHMENTS:[\s\S]*?-->/g, '').trim());
  const [lessonLearnt, setLessonLearnt] = useState(item?.lessonLearnt || '');
  const [attachments, setAttachments] = useState<ActionItemAttachment[]>(item?.attachments || []);

  // 當附件完成上傳時，若為既有待辦，自動同步至資料庫以保證 100% 不漏失
  const handleAttachmentUploaded = async (
    newAttachment: ActionItemAttachment,
    updatedList: ActionItemAttachment[]
  ) => {
    if (item?.id) {
      try {
        const res = await updateActionItem(item.id, {
          attachments: updatedList,
        });
        if (res.success && res.data) {
          onSuccess(res.data as any);
          toast({
            title: '附件已自動儲存至待辦事項',
            description: `檔案「${newAttachment.name}」已同步存入 Google Drive 與待辦事項記錄中。`,
          });
        }
      } catch (e) {
        console.warn('附件背景自動儲存失敗，待手動點擊確認更新:', e);
      }
    }
  };

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

  // 公司名稱精確比對（確保「燁輝」與「燁輝燕巢」完全區隔，彼此互不包含）
  const isCompanyMatch = (userCompany?: string, targetCompany?: string): boolean => {
    if (!userCompany || !targetCompany) return false;
    const u = userCompany.trim();
    const t = targetCompany.trim();
    if (u === t) return true;

    // 清理括號與公司型態尾綴 (如 "億威 (EW)"、"燁輝企業股份有限公司")
    const cleanCompany = (str: string) =>
      str
        .replace(/（.*）|\(.*\)/g, '')
        .replace(/股份有限公司|有限公司/g, '')
        .trim();

    const cu = cleanCompany(u);
    const ct = cleanCompany(t);
    if (cu === ct) return true;

    // 嚴格隔離「燁輝」與「燁輝燕巢」
    const isU_Yanchao = cu.includes('燕巢') || u.includes('燕巢');
    const isT_Yanchao = ct.includes('燕巢') || t.includes('燕巢');
    if (isU_Yanchao !== isT_Yanchao) {
      return false;
    }

    // 燁輝與燁輝企業相容 (且兩者皆非燕巢)
    const isU_YP = cu === '燁輝' || cu === '燁輝企業';
    const isT_YP = ct === '燁輝' || ct === '燁輝企業';
    if (isU_YP && isT_YP) return true;

    // 億威與億威電子相容
    const isU_EMMT = cu.includes('億威');
    const isT_EMMT = ct.includes('億威');
    if (isU_EMMT && isT_EMMT) return true;

    // 其他一般客戶名稱比對（雙方皆非燁輝/燕巢/億威之一般比對）
    if (!isU_Yanchao && !isT_Yanchao && !isU_YP && !isT_YP && !isU_EMMT && !isT_EMMT) {
      if (cu.includes(ct) || ct.includes(cu)) return true;
    }

    return false;
  };

  // 根據選擇的責任歸屬 (客戶/單位，如「宇陽傳動」、「億威」、「燁輝」或「燁輝燕巢」)，精準挑選屬於該客戶的成員
  const selectedClientName = (owner || '').trim();

  const waitingOnMemberOptions = useMemo(() => {
    const optionsMap = new Map<string, { value: string; label: string; hint?: string }>();

    // 1. 若責任歸屬未指定或為空，顯示系統所有成員供選擇
    if (!selectedClientName || selectedClientName === '未指定') {
      users.forEach((u) => {
        const val = (u.displayName || u.username || u.email || '').trim();
        if (!val) return;
        const hint = u.department
          ? `${u.department}${u.clientName ? ` (${u.clientName})` : ''}`
          : (u.clientName ? `${u.clientName}` : (u.role === 'admin' ? '管理員' : '成員'));
        optionsMap.set(val, { value: val, label: val, hint });
      });
      effectiveClientOptions.forEach((c: Client) => {
        if (c.contactPerson && c.contactPerson.trim()) {
          const rawContacts = c.contactPerson.split(/[,，、;；/／\n]/);
          rawContacts.forEach((rc) => {
            const val = rc.trim();
            if (val && !optionsMap.has(val)) {
              optionsMap.set(val, { value: val, label: val, hint: `${c.name} 主要窗口` });
            }
          });
        }
      });
      return Array.from(optionsMap.values());
    }

    // 2. 當有指定責任歸屬客戶時，選單選項嚴格且僅來自「成員維護清單」(users) 與「客戶維護清單」(clients)！
    // (a) 屬於該客戶的成員清單 (users)
    users.forEach((u) => {
      let isMatch = false;
      if (u.clientName && isCompanyMatch(u.clientName, selectedClientName)) {
        isMatch = true;
      }
      const emailLower = u.email?.toLowerCase() || '';
      // 億威同仁信箱識別
      if (isCompanyMatch(selectedClientName, '億威') && emailLower.includes('emmt.com.tw')) {
        isMatch = true;
      }
      // 燁輝本部同仁信箱識別 (注意：若選取「燕巢」則絕對不可帶入燁輝一般信箱同仁)
      if (
        isCompanyMatch(selectedClientName, '燁輝') &&
        !selectedClientName.includes('燕巢') &&
        emailLower.includes('yiehphui.com.tw') &&
        !u.clientName?.includes('燕巢')
      ) {
        isMatch = true;
      }

      if (isMatch) {
        const val = (u.displayName || u.username || u.email || '').trim();
        if (val && !optionsMap.has(val)) {
          let hint = u.department
            ? `${u.department} (${selectedClientName})`
            : `${selectedClientName} 成員`;
          if (
            isCompanyMatch(selectedClientName, '燁輝') &&
            !selectedClientName.includes('燕巢') &&
            (u.department?.toUpperCase().includes('TPM') || TPM_PERSONNEL_NAMES.some((t) => val.includes(t)))
          ) {
            hint = `TPM (${selectedClientName})`;
          }
          optionsMap.set(val, { value: val, label: val, hint });
        }
      }
    });

    // 若責任歸屬為「燁輝」(本部，非燕巢)，補齊已知 TPM 窗口名冊供迅速點選
    if (
      isCompanyMatch(selectedClientName, '燁輝') &&
      !selectedClientName.includes('燕巢')
    ) {
      TPM_PERSONNEL_NAMES.forEach((name) => {
        if (!optionsMap.has(name)) {
          optionsMap.set(name, {
            value: name,
            label: name,
            hint: `TPM (${selectedClientName})`,
          });
        }
      });
    }

    // (b) 該客戶在「客戶維護清單」(clients) 中設定的官方聯絡人 (contactPerson)
    const matchedClients = effectiveClientOptions.filter((c: Client) =>
      isCompanyMatch(c.name, selectedClientName)
    );
    matchedClients.forEach((clientRecord) => {
      if (clientRecord.contactPerson && clientRecord.contactPerson.trim()) {
        const rawContacts = clientRecord.contactPerson.split(/[,，、;；/／\n]/);
        rawContacts.forEach((rc) => {
          const val = rc.trim();
          if (val && !optionsMap.has(val)) {
            optionsMap.set(val, {
              value: val,
              label: val,
              hint: `${clientRecord.name} 主要窗口`,
            });
          }
        });
      }
    });

    return Array.from(optionsMap.values());
  }, [users, selectedClientName, effectiveClientOptions]);

  useEffect(() => {
    if (open) {
      const todayStr = getLocalTodayDateStr();
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
        // 每次打開編輯待辦時，自動預設填入當天最新存檔日期（若同專案在2, 5, 10天分別更新，存檔皆為當天最新日期）
        setLastUpdatedDate(todayStr);
        setNotes((item.notes || '').replace(/<!--ATTACHMENTS:[\s\S]*?-->/g, '').trim());
        setLessonLearnt(item.lessonLearnt || '');
        setAttachments(item.attachments || []);
        setIsPinned(Boolean(item.isPinned));
      } else {
        const targetProjId = defaultProjectId || (projects[0]?.id || '');
        const targetProj = projects.find((p) => p.id === targetProjId);
        setProjectId(targetProjId);
        setIsCreatingNewProject(false);
        setNewProjectName('');
        setNewProjectCaseNumber('');
        setNewProjectCategory('評估案');
        setNewProjectEvaluationDate(todayStr);
        setTitle('');
        setPhase('1.2 施工階段');
        setStatus('pending');
        setOwner(targetProj?.clientName || '燁輝');
        setWaitingOn('');
        setDueDate('');
        setCompletedAt('');
        setLastUpdatedDate(todayStr);
        setNotes('');
        setLessonLearnt('');
        setAttachments([]);
        setIsPinned(false);
      }
    }
  }, [open, item, defaultProjectId, projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploadingAttachments) {
      toast({
        title: '檔案仍在直傳雲端硬碟中',
        description: '請等待附件上傳完成後再行儲存，避免附件漏存。',
        variant: 'destructive',
      });
      return;
    }
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
          evaluationDate: newProjectEvaluationDate || new Date().toISOString().slice(0, 10),
          kickoffDate: newProjectCategory === '已開案' ? (newProjectEvaluationDate || new Date().toISOString().slice(0, 10)) : undefined,
        });

        if (!pocRes.success || !pocRes.data) {
          toast({ title: '建立新專案失敗', description: pocRes.message, variant: 'destructive' });
          setIsSubmitting(false);
          return;
        }
        targetProjectId = pocRes.data.id;
      }

      const cleanNotes = (notes || '').replace(/<!--ATTACHMENTS:[\s\S]*?-->/g, '').trim();

      // 存檔時自動寫入當下最新存檔時間（若手動調整日期則依指定日期）
      const now = new Date();
      const todayStr = getLocalTodayDateStr();
      let saveUpdatedAt = now.toISOString();
      if (lastUpdatedDate) {
        if (lastUpdatedDate === todayStr) {
          saveUpdatedAt = now.toISOString();
        } else {
          saveUpdatedAt = new Date(`${lastUpdatedDate}T${now.toTimeString().slice(0, 8)}`).toISOString();
        }
      }

      const operator = currentUser ? {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.username || currentUser.email,
        email: currentUser.email,
        role: currentUser.role,
        department: currentUser.department,
      } : undefined;

      if (item?.id) {
        const res = await updateActionItem(item.id, {
          title,
          phase,
          status,
          owner: owner === '未指定' ? '' : owner,
          waitingOn,
          dueDate: dueDate || null,
          completedAt: status === 'completed' ? (completedAt ? new Date(completedAt).toISOString() : null) : null,
          updatedAt: saveUpdatedAt,
          notes: cleanNotes,
          lessonLearnt,
          attachments,
          isPinned,
          operator,
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
          updatedAt: saveUpdatedAt,
          notes: cleanNotes,
          lessonLearnt,
          attachments,
          isPinned,
          operator,
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
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2 h-8">
                    <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                      {newProjectCategory === '評估案' ? '📅 評估日:' : '🚀 開案日:'}
                    </span>
                    <input
                      type="date"
                      value={newProjectEvaluationDate}
                      onChange={(e) => setNewProjectEvaluationDate(e.target.value)}
                      className="text-xs bg-transparent border-0 outline-none w-full text-slate-700 font-medium cursor-pointer"
                    />
                  </div>
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

          {/* 置頂追蹤（近期特別加強追蹤） */}
          <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
            isPinned
              ? 'bg-amber-50/95 border-amber-300 ring-1 ring-amber-300/50 text-amber-950 shadow-2xs'
              : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100/70'
          }`}>
            <label htmlFor="action-item-pin-checkbox" className="flex items-start sm:items-center gap-2.5 cursor-pointer select-none flex-1">
              <input
                type="checkbox"
                id="action-item-pin-checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="mt-0.5 sm:mt-0 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold flex items-center gap-1 text-amber-950">
                  <Pin className={`h-3.5 w-3.5 ${isPinned ? 'text-amber-600 fill-amber-500' : 'text-slate-400'}`} />
                  📌 置頂追蹤（近期特別加強追蹤）
                </span>
                <span className="text-[11px] text-muted-foreground">
                  — 勾選後該待辦將固定置頂於總覽與清單最前，並以淺黃色背景突顯
                </span>
              </div>
            </label>
            {isPinned && (
              <span className="text-[10px] bg-amber-200/90 text-amber-900 font-bold px-2 py-0.5 rounded-full shrink-0 ml-2">
                已設置頂
              </span>
            )}
          </div>

          {/* 階段與狀態 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold flex items-center h-5">專案階段</Label>
              <Select value={phase} onValueChange={(val) => setPhase(val as ActionItemPhase)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectGroup>
                    <SelectLabel className="font-bold text-slate-900 bg-slate-100/90 py-1 px-2 text-xs">
                      1.1 設計階段
                    </SelectLabel>
                    <SelectItem value="1.1 設計階段">1.1 設計階段</SelectItem>
                    <SelectItem value="1.1.1 評估">　↳ 1.1.1 評估</SelectItem>
                    <SelectItem value="1.1.2 報價">　↳ 1.1.2 報價</SelectItem>
                    <SelectItem value="1.1.3 簽呈">　↳ 1.1.3 簽呈</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectItem value="1.2 施工階段" className="font-semibold text-slate-900">
                      1.2 施工階段
                    </SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectItem value="1.3 驗證階段" className="font-semibold text-slate-900">
                      1.3 驗證階段
                    </SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="font-bold text-slate-900 bg-slate-100/90 py-1 px-2 text-xs">
                      1.4 驗收階段
                    </SelectLabel>
                    <SelectItem value="1.4 驗收階段">1.4 驗收階段</SelectItem>
                    <SelectItem value="1.4.1 教育訓練">　↳ 1.4.1 教育訓練</SelectItem>
                    <SelectItem value="1.4.2 驗收結案">　↳ 1.4.2 驗收結案</SelectItem>
                  </SelectGroup>
                  {/* 若既有舊資料屬於舊階段名詞，動態保留供顯示/選擇 */}
                  {item?.phase && ![
                    '1.1 設計階段', '1.1.1 評估', '1.1.2 報價', '1.1.3 簽呈',
                    '1.2 施工階段', '1.3 驗證階段',
                    '1.4 驗收階段', '1.4.1 教育訓練', '1.4.2 驗收結案'
                  ].includes(item.phase) && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="text-xs text-amber-700 bg-amber-50 py-1 px-2">歷史舊階段標籤</SelectLabel>
                        <SelectItem value={item.phase}>{item.phase}</SelectItem>
                      </SelectGroup>
                    </>
                  )}
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
                  {effectiveClientOptions.map((c: Client) => {
                    const clean = c.name.replace(/（.*）|\(.*\)/g, '').trim();
                    return (
                      <SelectItem key={c.id} value={clean}>
                        {clean}
                      </SelectItem>
                    );
                  })}
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

          {/* 預計完成日、最近更新日 與 實際完成日 */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${status === 'completed' ? 'md:grid-cols-3' : ''} gap-3`}>
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

            <div>
              <Label className="text-sm font-semibold flex items-center justify-between h-5">
                <span>最近更新日</span>
                <span className="text-[10px] font-normal text-blue-600 font-medium">預設當天最新存檔日期</span>
              </Label>
              <Input
                type="date"
                className="mt-1 bg-blue-50/20 border-slate-300 focus:border-blue-500"
                value={lastUpdatedDate}
                onChange={(e) => setLastUpdatedDate(e.target.value)}
              />
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
            <div className="flex items-center justify-between flex-wrap gap-1">
              <Label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>📝 歷程紀錄 / 追蹤說明</span>
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const tag = `${now.getMonth() + 1}/${now.getDate()}, `;
                    setNotes((prev) => (prev ? `${tag}${prev}` : tag));
                    setLastUpdatedDate(now.toISOString().slice(0, 10));
                  }}
                  className="h-6 px-2 text-[11px] text-blue-700 bg-blue-50/80 border-blue-200 hover:bg-blue-100 cursor-pointer"
                  title="在紀錄最開頭插入今日進度日期標籤並同步更新日"
                >
                  + 插入今日日期 ({new Date().getMonth() + 1}/{new Date().getDate()})
                </Button>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  可記錄詳細進程（支援自由拖拉展開高度）
                </span>
              </div>
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
            onUploadingChange={setIsUploadingAttachments}
            onAttachmentUploaded={handleAttachmentUploaded}
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

          {isUploadingAttachments && (
            <div className="text-xs text-blue-700 bg-blue-50/90 border border-blue-200 p-2.5 rounded-md flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0" />
              <span>
                檔案正在直傳 Google 雲端硬碟中，完成後將自動加入附件清單，請稍候片刻再儲存...
              </span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploadingAttachments}
              className={isUploadingAttachments ? 'opacity-80 cursor-not-allowed' : ''}
            >
              {isSubmitting
                ? '儲存中...'
                : isUploadingAttachments
                ? '檔案直傳中，請稍候...'
                : item
                ? '確認更新'
                : '建立待辦'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
