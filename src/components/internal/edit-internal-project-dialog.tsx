'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { updateInternalProject, deleteInternalProject, clearActionItemsForProject, getClients } from '@/lib/actions';
import { Edit2, Calendar, Trash2, UserCheck, Users, Building2, ShieldCheck, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { FullProject, User, Client, ProjectSourceType } from '@/types';

interface EditInternalProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: FullProject | null;
  users?: User[];
  clients?: Client[];
  onSuccess: (updatedProject: any) => void;
  onDeleted?: (deletedProjectId: string) => void;
  onActionItemsCleared?: (projectId: string) => void;
}

export function EditInternalProjectDialog({
  open,
  onOpenChange,
  project,
  users = [],
  clients: initialClients = [],
  onSuccess,
  onDeleted,
  onActionItemsCleared,
}: EditInternalProjectDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cachedProject, setCachedProject] = useState<{ id: string; name: string } | null>(null);
  const [clientList, setClientList] = useState<Client[]>(initialClients);

  const [name, setName] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [category, setCategory] = useState<'評估案' | '已開案'>('評估案');
  const [internalStatus, setInternalStatus] = useState<'in_progress' | 'completed' | 'terminated'>('in_progress');
  const [sourceType, setSourceType] = useState<ProjectSourceType>('億威內部自建專案');
  const [clientName, setClientName] = useState('燁輝');
  const [responsiblePm, setResponsiblePm] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [evaluationDate, setEvaluationDate] = useState('');
  const [kickoffDate, setKickoffDate] = useState('');
  const [projectPurpose, setProjectPurpose] = useState('');
  const [showClearActionItemsConfirm, setShowClearActionItemsConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // 判斷此專案是否為燁輝列管正式專案（受外部管制總表保護）
  const activeProj = project || (cachedProject ? { ...cachedProject, sourceType, caseNumber, clientName } : null);
  const currentCaseNum = (caseNumber || activeProj?.caseNumber || '').trim();
  const isPocCase = !currentCaseNum || currentCaseNum.toUpperCase() === 'POC';
  const isOfficialYiehPhui =
    sourceType === '燁輝列管專案' ||
    activeProj?.sourceType === '燁輝列管專案' ||
    (!isPocCase && (clientName === '燁輝' || activeProj?.clientName === '燁輝'));

  // 載入客戶名單
  useEffect(() => {
    if (open && clientList.length === 0) {
      getClients().then((res) => {
        if (res && res.length > 0) setClientList(res);
      });
    }
  }, [open, clientList.length]);

  useEffect(() => {
    if (project) {
      setCachedProject({ id: project.id, name: project.name });
      setName(project.name || '');
      setCaseNumber(project.caseNumber || '');
      const cat = project.projectCategory || (project.status === 'poc' ? '評估案' : '已開案');
      setCategory(cat);
      const st = project.internalStatus || (project.status === 'completed' ? 'completed' : (project.status === 'cancelled' ? 'terminated' : 'in_progress'));
      setInternalStatus(st);
      
      const src = project.sourceType || (cat === '評估案' ? '億威內部自建專案' : '燁輝列管專案');
      setSourceType(src);
      setClientName(project.clientName || '燁輝');
      
      const pm = project.responsiblePm || project.tpmOfficeContact || project.egigaContact || '';
      setResponsiblePm(pm);

      const contact = project.clientContact || project.yiehPhuiProjectManager || '';
      setClientContact(contact);

      setExpectedCompletionDate(project.expectedCompletionDate || '');
      setEvaluationDate(project.evaluationDate || (cat === '評估案' ? (project.createdAt ? String(project.createdAt).slice(0, 10) : '') : ''));
      setKickoffDate(project.kickoffDate || (cat === '已開案' && project.evaluationDate ? (project.createdAt ? String(project.createdAt).slice(0, 10) : '') : ''));
      setProjectPurpose(project.projectPurpose || '');
    }
  }, [project, open]);

  const handleCategoryChange = (newCat: '評估案' | '已開案') => {
    setCategory(newCat);
    if (newCat === '評估案') {
      if (!caseNumber.trim()) {
        setCaseNumber('POC');
      }
    } else if (newCat === '已開案') {
      setCaseNumber((prev) => prev.replace(/^POC[\s\-_]*/i, '').trim());
      // 若切換為已開案且無開案日，自動預設為今日
      if (!kickoffDate) {
        setKickoffDate(new Date().toISOString().slice(0, 10));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!name.trim()) {
      toast({ title: '請輸入專案名稱', variant: 'destructive' });
      return;
    }

    let finalCaseNumber = caseNumber.trim();
    if (category === '已開案') {
      finalCaseNumber = finalCaseNumber.replace(/^POC[\s\-_]*/i, '').trim();
    } else if (category === '評估案' && !finalCaseNumber) {
      finalCaseNumber = 'POC';
    }

    setIsSubmitting(true);
    try {
      const res = await updateInternalProject(project.id, {
        name: name.trim(),
        caseNumber: finalCaseNumber,
        category,
        internalStatus,
        sourceType,
        clientName: clientName.trim() || '燁輝',
        responsiblePm: responsiblePm.trim(),
        clientContact: clientContact.trim(),
        expectedCompletionDate: expectedCompletionDate || null,
        evaluationDate: evaluationDate || null,
        kickoffDate: kickoffDate || null,
        tpmOfficeContact: responsiblePm.trim(),
        projectPurpose,
      });

      if (res.success) {
        toast({ title: '更新成功', description: `內部專案「${name}」已完成更新！` });
        onOpenChange(false);
        onSuccess(res.data);
      } else {
        toast({ title: '更新失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '更新異常', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogChange = (newOpen: boolean) => {
    if (!newOpen && (showDeleteConfirm || isDeleting)) {
      return; // 正在刪除或確認時，禁止關閉主對話框
    }
    onOpenChange(newOpen);
  };

  const handleDeleteProject = async () => {
    const targetProject = project || cachedProject;
    if (!targetProject) {
      toast({ title: '刪除失敗', description: '找不到專案資料，請重新整理頁面後再試', variant: 'destructive' });
      return;
    }
    setIsDeleting(true);
    try {
      const res = await deleteInternalProject(targetProject.id);
      if (res.success) {
        toast({ title: '刪除成功', description: res.message });
        setShowDeleteConfirm(false);
        onOpenChange(false);
        onDeleted?.(targetProject.id);

        setTimeout(() => {
          document.body.style.pointerEvents = '';
          document.body.style.overflow = '';
        }, 50);
      } else {
        toast({ title: '刪除受阻', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '刪除異常', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearActionItems = async () => {
    const targetProject = project || cachedProject;
    if (!targetProject) return;
    setIsClearing(true);
    try {
      const res = await clearActionItemsForProject(targetProject.id);
      if (res.success) {
        toast({ title: '已清空內部待辦', description: res.message });
        setShowClearActionItemsConfirm(false);
        onActionItemsCleared?.(targetProject.id);
      } else {
        toast({ title: '清空失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '清空異常', description: err.message, variant: 'destructive' });
    } finally {
      setIsClearing(false);
    }
  };

  // 整理 PM 下拉選項清單 (一律只選部門為 PM 的成員；若無則備援顯示所有成員並標註部門)
  const pmUsers = users.filter((u) => u.department?.trim().toUpperCase() === 'PM');
  const availablePmUsers = pmUsers.length > 0 ? pmUsers : users;
  const pmOptions = availablePmUsers.map((u) => ({
    value: u.displayName || u.email,
    label: u.displayName || u.email,
    hint: u.department ? `部門: ${u.department}` : (u.role === 'admin' ? '管理員' : '成員'),
  }));

  // 智慧寬容客戶名稱比對 (如「億威」相容「億威電子」、「億威 (EW)」等)
  const isClientMatch = (userClient?: string, targetClient?: string) => {
    if (!userClient || !targetClient) return false;
    const u = userClient.toLowerCase().replace(/（.*）|\(.*\)/g, '').trim();
    const t = targetClient.toLowerCase().replace(/（.*）|\(.*\)/g, '').trim();
    if (!u || !t) return false;
    if (u === t || u.includes(t) || t.includes(u)) return true;
    if (u.includes('億威') && t.includes('億威')) return true;
    if (u.includes('燁輝') && t.includes('燁輝')) return true;
    return false;
  };

  // 客戶窗口預設建議名單 (直接從成員管理中挑選「所屬客戶」符合該專案客戶的使用者；備援加上客戶表主要窗口)
  const matchedClientUsers = users.filter((u) => {
    if (u.clientName && isClientMatch(u.clientName, clientName || '燁輝')) return true;
    const emailLower = u.email?.toLowerCase() || '';
    if ((clientName || '燁輝').includes('億威') && emailLower.includes('emmt.com.tw')) return true;
    if ((clientName || '燁輝').includes('燁輝') && emailLower.includes('yiehphui.com.tw')) return true;
    return false;
  });
  const clientUserContacts = matchedClientUsers.map((u) => u.displayName || u.email);
  const clientMainContact = clientList.find((c) => c.name === clientName)?.contactPerson;

  const contactOptions = Array.from(
    new Set([
      ...clientUserContacts,
      ...(clientMainContact ? [clientMainContact] : []),
      // 若為燁輝專案且尚未建立任何對應成員，備援放入燁輝預設聯絡人
      ...(clientUserContacts.length === 0 && (clientName || '').includes('燁輝') ? ['黃裕峰', '張簡'] : []),
    ])
  ).filter(Boolean);

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => {
            if (showDeleteConfirm || isDeleting) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if (showDeleteConfirm || isDeleting) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Edit2 className="h-5 w-5 text-indigo-600" />
              編輯專案設定與欄位
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              可調整專案名稱、來源型態、客戶名稱、負責PM、客戶窗口、狀態與預估完成日。
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* 1. 專案來源型態 (3選1) */}
            <div>
              <Label className="text-xs font-semibold">專案來源型態 *</Label>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSourceType('燁輝列管專案');
                    setClientName('燁輝');
                  }}
                  className={`py-2 px-2 rounded-md text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                    sourceType === '燁輝列管專案'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>🏢 燁輝列管專案</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType('億威內部自建專案')}
                  className={`py-2 px-2 rounded-md text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                    sourceType === '億威內部自建專案'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>🏭 億威自建專案</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType('其他專案')}
                  className={`py-2 px-2 rounded-md text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                    sourceType === '其他專案' || sourceType === '其他智慧製造專案'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>⚙️ 其他專案</span>
                </button>
              </div>
            </div>

            {/* 2. 專案類別與狀態 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">專案執行類別 *</Label>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('評估案')}
                    className={`py-1.5 px-2 rounded-md text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                      category === '評估案'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>📝 評估案</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCategoryChange('已開案')}
                    className={`py-1.5 px-2 rounded-md text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                      category === '已開案'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>🚀 已開案</span>
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">專案生命週期狀態 *</Label>
                <Select value={internalStatus} onValueChange={(val: any) => setInternalStatus(val)}>
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue placeholder="選擇狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_progress">⏳ 進行中 / 評估中</SelectItem>
                    <SelectItem value="completed">✅ 已結案 (完成)</SelectItem>
                    <SelectItem value="terminated">⛔ 專案終止 (取消)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 3. 客戶名稱 (下拉式) */}
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                客戶名稱 (下拉式) *
              </Label>
              <Select value={clientName} onValueChange={setClientName}>
                <SelectTrigger className="mt-1 text-xs h-9">
                  <SelectValue placeholder="請選擇客戶名稱" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {clientList.length > 0 ? (
                    clientList.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="燁輝">燁輝 (預設)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 4. 專案名稱 */}
            <div>
              <Label className="text-xs font-semibold">專案名稱 *</Label>
              <Input
                className="mt-1 text-xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* 5. 負責 PM 與 客戶窗口 (下拉式 + 保留輸入快速選擇) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 text-slate-500" />
                  負責 PM 是誰 (下拉/輸入)
                </Label>
                <div className="mt-1">
                  <SearchableCombobox
                    value={responsiblePm}
                    onChange={setResponsiblePm}
                    options={pmOptions}
                    placeholder="選擇成員或直接輸入..."
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-slate-500" />
                  客戶窗口是誰 (下拉/輸入)
                </Label>
                <div className="mt-1">
                  <SearchableCombobox
                    value={clientContact}
                    onChange={setClientContact}
                    options={contactOptions}
                    placeholder="選擇窗口或直接輸入..."
                  />
                </div>
              </div>
            </div>

            {/* 評估歷時資訊卡片 (當有評估日或開案日時呈現) */}
            {(() => {
              if (!evaluationDate) return null;
              if (category === '已開案') {
                const endTimestamp = kickoffDate ? new Date(kickoffDate).getTime() : Date.now();
                const diffMs = endTimestamp - new Date(evaluationDate).getTime();
                const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
                return (
                  <div className="flex items-center gap-2 p-2.5 rounded-md text-xs border bg-emerald-50/80 text-emerald-800 border-emerald-200 shadow-2xs">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>已開案 · 評估耗時共 <strong>{days}</strong> 天 ({evaluationDate} 評估 ➔ {kickoffDate || '已開案'})</span>
                  </div>
                );
              } else {
                const diffMs = Date.now() - new Date(evaluationDate).getTime();
                const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
                return (
                  <div className="flex items-center gap-2 p-2.5 rounded-md text-xs border bg-purple-50/80 text-purple-800 border-purple-200 shadow-2xs">
                    <Clock className="h-4 w-4 text-purple-600 shrink-0" />
                    <span>評估中 · 自 {evaluationDate} 至今已評估 <strong>{days}</strong> 天</span>
                  </div>
                );
              }
            })()}

            {/* 6. 評估與開案時程 (評估日期、轉已開案日期、預估完成日) */}
            <div className={`grid ${category === '已開案' ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5`}>
              <div>
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-purple-600" />
                    評估起始日期
                  </span>
                  {evaluationDate && (
                    <button
                      type="button"
                      onClick={() => setEvaluationDate('')}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >
                      清除
                    </button>
                  )}
                </Label>
                <Input
                  type="date"
                  className="mt-1 text-xs h-9 border-purple-200 focus-visible:ring-purple-400"
                  value={evaluationDate}
                  onChange={(e) => setEvaluationDate(e.target.value)}
                />
              </div>

              {category === '已開案' && (
                <div>
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                      轉已開案日期
                    </span>
                    {kickoffDate && (
                      <button
                        type="button"
                        onClick={() => setKickoffDate('')}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline"
                      >
                        清除
                      </button>
                    )}
                  </Label>
                  <Input
                    type="date"
                    className="mt-1 text-xs h-9 border-emerald-200 focus-visible:ring-emerald-400"
                    value={kickoffDate}
                    onChange={(e) => setKickoffDate(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    預估完成日期
                  </span>
                  {expectedCompletionDate && (
                    <button
                      type="button"
                      onClick={() => setExpectedCompletionDate('')}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >
                      清除
                    </button>
                  )}
                </Label>
                <Input
                  type="date"
                  className="mt-1 text-xs h-9"
                  value={expectedCompletionDate}
                  onChange={(e) => setExpectedCompletionDate(e.target.value)}
                />
              </div>
            </div>

            {/* 7. 案號代碼 */}
            <div>
              <Label className="text-xs font-semibold">案號代碼</Label>
              <Input
                className="mt-1 text-xs font-mono"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
              />
            </div>

            {/* 7. 專案目的說明 */}
            <div>
              <Label className="text-xs font-semibold">專案目的 / 說明 (選填)</Label>
              <Textarea
                className="mt-1 min-h-[60px] text-xs"
                placeholder="簡要描述此案的目標、可行性驗證重點或預期效益..."
                value={projectPurpose}
                onChange={(e) => setProjectPurpose(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3 flex flex-row items-center justify-between sm:justify-between w-full border-t">
              {/* 刪除 / 移除內部專案按鈕區 */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (project) {
                      setCachedProject({ id: project.id, name: project.name });
                    }
                    setShowDeleteConfirm(true);
                  }}
                  className="gap-1 text-xs h-8"
                  title={isOfficialYiehPhui ? "自內部專案管制中移除（燁輝管制總表 100% 完整保留）" : "刪除此內部專案 (POC)"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isOfficialYiehPhui ? '自內部專案移除' : '刪除此內部專案 (POC)'}
                </Button>

                {isOfficialYiehPhui && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (project) {
                        setCachedProject({ id: project.id, name: project.name });
                      }
                      setShowClearActionItemsConfirm(true);
                    }}
                    className="gap-1 text-xs h-8 text-slate-600 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50"
                    title="僅清空此專案的內部待辦追蹤項目，仍保留此專案於內部清單中"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    僅清空內部待辦
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? '儲存中...' : '儲存變更'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 刪除/自內部專案移除防呆確認對話框 */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && isDeleting) return;
          setShowDeleteConfirm(nextOpen);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              {isOfficialYiehPhui
                ? `確認將專案「${project?.name || cachedProject?.name || ''}」自內部管制移除？`
                : `確認刪除內部專案「${project?.name || cachedProject?.name || ''}」？`}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2.5 text-xs">
              {isOfficialYiehPhui ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 leading-relaxed space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>億威內部自主管理・燁輝總表 100% 留存隔離保證</span>
                  </div>
                  <p>
                    此操作僅會將本專案由「<strong>內部專案與待辦歷程追蹤</strong>」介面中移除，並清空內部待辦事項。
                  </p>
                  <p className="font-bold text-emerald-800">
                    ✅ 【燁輝進度管制總表】上的專案主檔、案號代碼、子專案與所有歷史週報紀錄【100% 完整留存】，絕不連動刪除！
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 leading-relaxed space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>純內部評估案 (POC) 刪除</span>
                  </div>
                  <p>
                    此專案為純內部 POC / 評估案，刪除僅會移除內部專案基本資料與待辦記錄，<strong>【絕對不會】影響任何外部燁輝管制總表、子專案與週報紀錄</strong>。
                  </p>
                </div>
              )}
              <p className="text-slate-600">
                {isOfficialYiehPhui
                  ? '移除後此專案將不再出現在內部追蹤清單中（若未來重新指派內部待辦可再自動加入），外部管制總表依然完好無缺。'
                  : '此動作刪除後將無法復原，請確認是否繼續執行？'}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setShowDeleteConfirm(false)}
            >
              取消返回
            </Button>
            <Button
              type="button"
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting
                ? (isOfficialYiehPhui ? '正在自內部移除...' : '正在刪除專案...')
                : (isOfficialYiehPhui ? '確認自內部專案移除（保留燁輝總表）' : '確認刪除此內部專案')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 清空內部待辦防呆確認對話框 */}
      <AlertDialog
        open={showClearActionItemsConfirm}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && isClearing) return;
          setShowClearActionItemsConfirm(nextOpen);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              確認清空專案「{project?.name || cachedProject?.name || ''}」的內部待辦事項？
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs">
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-900 font-medium leading-relaxed">
                🛡️ <strong>安全隔離保證</strong>：此操作僅會清空內部專案管理介面下的所有待辦追蹤記錄與附件，<strong>【絕對不會】刪除或影響【燁輝管制總表】上的專案主檔、子專案進度與任何對外週報紀錄</strong>！
              </div>
              <p className="text-slate-700 pt-1">
                清空後該專案的內部待辦事項數將重設為 0，專案本身依然完整保留於管制總表與內部列表中。
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isClearing}
              onClick={() => setShowClearActionItemsConfirm(false)}
            >
              取消返回
            </Button>
            <Button
              type="button"
              onClick={handleClearActionItems}
              disabled={isClearing}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {isClearing ? '正在清空待辦事項...' : '確認清空內部待辦事項'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
