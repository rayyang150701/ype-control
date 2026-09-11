'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createPocProject, getClients } from '@/lib/actions';
import { FolderPlus, Calendar, UserCheck, Users, Building2 } from 'lucide-react';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { User, Client, ProjectSourceType } from '@/types';

interface NewPocProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users?: User[];
  clients?: Client[];
  onSuccess: (newProject?: any) => void;
}

export function NewPocProjectDialog({
  open,
  onOpenChange,
  users = [],
  clients: initialClients = [],
  onSuccess,
}: NewPocProjectDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientList, setClientList] = useState<Client[]>(initialClients);

  const [category, setCategory] = useState<'評估案' | '已開案'>('評估案');
  const [sourceType, setSourceType] = useState<ProjectSourceType>('億威內部自建專案');
  const [clientName, setClientName] = useState('燁輝');
  const [name, setName] = useState('');
  const [caseNumber, setCaseNumber] = useState('POC');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [responsiblePm, setResponsiblePm] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [projectPurpose, setProjectPurpose] = useState('');

  const handleCategoryChange = (newCat: '評估案' | '已開案') => {
    setCategory(newCat);
    if (newCat === '評估案') {
      if (!caseNumber.trim()) {
        setCaseNumber('POC');
      }
    } else if (newCat === '已開案') {
      setCaseNumber((prev) => prev.replace(/^POC[\s\-_]*/i, '').trim());
    }
  };

  // 若父層沒傳 clients，主動載入客戶清單
  useEffect(() => {
    if (open && clientList.length === 0) {
      getClients().then((res) => {
        if (res && res.length > 0) setClientList(res);
      });
    }
  }, [open, clientList.length]);

  // 當專案來源型態變更為「燁輝列管專案」時，自動切換客戶為「燁輝」
  useEffect(() => {
    if (sourceType === '燁輝列管專案') {
      setClientName('燁輝');
    }
  }, [sourceType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const res = await createPocProject({
        name,
        category,
        sourceType,
        clientName: clientName.trim() || '燁輝',
        responsiblePm: responsiblePm.trim(),
        clientContact: clientContact.trim(),
        caseNumber: finalCaseNumber || undefined,
        expectedCompletionDate: expectedCompletionDate || undefined,
        tpmOfficeContact: responsiblePm.trim(),
        projectPurpose,
      });

      if (res.success) {
        toast({ title: '建立成功', description: `內部專案「${name}」已建立！` });
        setName('');
        setCaseNumber('POC');
        setExpectedCompletionDate('');
        setResponsiblePm('');
        setClientContact('');
        setProjectPurpose('');
        setCategory('評估案');
        setSourceType('億威內部自建專案');
        setClientName('燁輝');
        onOpenChange(false);
        onSuccess(res.data);
      } else {
        toast({ title: '建立失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '建立異常', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <FolderPlus className="h-5 w-5 text-purple-600" />
            新增內部專案 (評估案 / 已開案)
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            此專案供內部管制作業與待辦追蹤，可設定所屬來源型態、客戶名稱、負責PM及窗口。
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 1. 專案來源型態 (3選1) */}
          <div>
            <Label className="text-xs font-semibold">專案來源型態 *</Label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => setSourceType('燁輝列管專案')}
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

          {/* 2. 專案類別與客戶名稱 */}
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
                  <span>📝 評估案 (POC)</span>
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
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                客戶名稱 (下拉式) *
              </Label>
              <Select value={clientName} onValueChange={setClientName}>
                <SelectTrigger className="mt-1 text-xs h-9">
                  <SelectValue placeholder="請選擇客戶" />
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
          </div>

          {/* 3. 專案名稱 */}
          <div>
            <Label className="text-xs font-semibold">專案名稱 *</Label>
            <Input
              className="mt-1 text-xs"
              placeholder={category === '評估案' ? "例如：POC-堆高機雙鏡頭自主防撞評估" : "例如：全廠設備連網通訊介面升級"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* 4. 負責 PM 與 客戶窗口 (下拉式 + 保留手動輸入) */}
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

          {/* 5. 案號代碼與預估完成日 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">案號代碼 (評估案預設為 POC)</Label>
              <Input
                className="mt-1 text-xs font-mono"
                placeholder={category === '評估案' ? "POC" : "留空自動編號或填入案號"}
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-500" />
                  專案預估完成日期 (選填)
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

          {/* 6. 專案目的說明 */}
          <div>
            <Label className="text-xs font-semibold">專案目的 / 說明 (選填)</Label>
            <Textarea
              className="mt-1 min-h-[60px] text-xs"
              placeholder="簡要描述此案的目標、可行性驗證重點或預期效益..."
              value={projectPurpose}
              onChange={(e) => setProjectPurpose(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? '建立中...' : '確認建立專案'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
