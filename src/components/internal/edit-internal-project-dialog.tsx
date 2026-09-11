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
import { updateInternalProject, deleteProject, getClients } from '@/lib/actions';
import { Edit2, Calendar, Trash2, UserCheck, Users, Building2 } from 'lucide-react';
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
}

export function EditInternalProjectDialog({
  open,
  onOpenChange,
  project,
  users = [],
  clients: initialClients = [],
  onSuccess,
  onDeleted,
}: EditInternalProjectDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
  const [projectPurpose, setProjectPurpose] = useState('');

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
      setProjectPurpose(project.projectPurpose || '');
    }
  }, [project, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!name.trim()) {
      toast({ title: '請輸入專案名稱', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateInternalProject(project.id, {
        name: name.trim(),
        caseNumber: caseNumber.trim() || undefined,
        category,
        internalStatus,
        sourceType,
        clientName: clientName.trim() || '燁輝',
        responsiblePm: responsiblePm.trim(),
        clientContact: clientContact.trim(),
        expectedCompletionDate: expectedCompletionDate || null,
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

  const handleDeleteProject = async () => {
    if (!project) return;
    setIsDeleting(true);
    try {
      const res = await deleteProject(project.id);
      if (res.success) {
        toast({ title: '刪除成功', description: `專案「${project.name}」及所屬項目已全數刪除！` });
        setShowDeleteConfirm(false);
        onOpenChange(false);
        onDeleted?.(project.id);
      } else {
        toast({ title: '刪除失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '刪除異常', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
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

  // 客戶窗口預設建議名單 (直接從成員管理中挑選「所屬客戶」符合該專案客戶的使用者；備援加上客戶表主要窗口)
  const matchedClientUsers = users.filter((u) => {
    if (!u.clientName) return false;
    return u.clientName.trim().toLowerCase() === (clientName || '燁輝').trim().toLowerCase();
  });
  const clientUserContacts = matchedClientUsers.map((u) => u.displayName || u.email);
  const clientMainContact = clientList.find((c) => c.name === clientName)?.contactPerson;

  const contactOptions = Array.from(
    new Set([
      ...clientUserContacts,
      ...(clientMainContact ? [clientMainContact] : []),
      // 若尚未建立任何對應成員，備援放入預設聯絡人
      ...(clientUserContacts.length === 0 ? ['黃裕峰', '張簡'] : []),
    ])
  ).filter(Boolean);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                  onClick={() => setSourceType('其他智慧製造專案')}
                  className={`py-2 px-2 rounded-md text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                    sourceType === '其他智慧製造專案'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>⚙️ 其他智慧製造專案</span>
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
                    onClick={() => setCategory('評估案')}
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
                    onClick={() => setCategory('已開案')}
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

            {/* 6. 案號代碼與預估完成日 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">案號代碼</Label>
                <Input
                  className="mt-1 text-xs font-mono"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    專案預估完成日期
                  </span>
                  {expectedCompletionDate && (
                    <button
                      type="button"
                      onClick={() => setExpectedCompletionDate('')}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >
                      清除日期
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
              {/* 刪除專案按鈕 */}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="gap-1 text-xs h-8"
              >
                <Trash2 className="h-3.5 w-3.5" />
                刪除此專案全部項目
              </Button>

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

      {/* 刪除專案二次防呆確認對話框 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              確認刪除專案「{project?.name}」？
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs">
              <p>
                ⚠️ 警告：此操作將會<strong>直接刪除該專案的所有內容</strong>，包括：
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>專案主檔與所有基本資訊</li>
                <li>專案下所屬的<strong>所有內部待辦追蹤項目與歷程記錄</strong></li>
                <li>專案下所屬的<strong>所有子專案與相關週報紀錄</strong></li>
                <li>解除與其他專案的所有雙向關聯</li>
              </ul>
              <p className="text-rose-600 font-semibold pt-1">
                此動作刪除後將無法復原，請確認是否繼續執行？
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消返回</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '正在刪除專案項目...' : '確認刪除此專案'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
