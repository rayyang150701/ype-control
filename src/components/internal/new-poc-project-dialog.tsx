'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createPocProject, getClients } from '@/lib/actions';
import { FolderPlus, Calendar, UserCheck, Users, Building2, Briefcase, Sparkles } from 'lucide-react';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { User, Client, ProjectSourceType } from '@/types';

interface NewPocProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users?: User[];
  clients?: Client[];
  defaultName?: string;
  defaultClientName?: string;
  onSuccess: (newProject?: any) => void;
}

// 移除客戶名稱後方括號註記 (如「燁輝 (王伯展)」->「燁輝」)，只顯示純客戶名稱
const cleanClientName = (str?: string) => (str || '').replace(/（.*）|\(.*\)/g, '').trim();

export function NewPocProjectDialog({
  open,
  onOpenChange,
  users = [],
  clients: initialClients = [],
  defaultName = '',
  defaultClientName = '',
  onSuccess,
}: NewPocProjectDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientList, setClientList] = useState<Client[]>(initialClients);

  const [category, setCategory] = useState<'評估案' | '已開案'>('評估案');
  const [sourceType, setSourceType] = useState<ProjectSourceType>('億威內部自建專案');
  const [clientName, setClientName] = useState(() => cleanClientName(defaultClientName) || '億威電子');
  const [name, setName] = useState(defaultName || '');
  const [caseNumber, setCaseNumber] = useState('POC');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [evaluationDate, setEvaluationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [responsiblePm, setResponsiblePm] = useState('');
  const [tpmOfficeContact, setTpmOfficeContact] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [vendorOrSupplier, setVendorOrSupplier] = useState('');
  const [projectPurpose, setProjectPurpose] = useState('');

  // 當彈窗開啟且有傳入預設專案名稱/客戶名稱時，自動帶入
  useEffect(() => {
    if (open) {
      if (defaultName) setName(defaultName);
      if (defaultClientName) {
        const clean = cleanClientName(defaultClientName);
        setClientName(clean);
        if (clean.includes('燁輝')) {
          setSourceType('燁輝列管專案');
        } else if (clean.includes('億威')) {
          setSourceType('億威內部自建專案');
        } else {
          setSourceType('其他專案');
        }
      } else {
        if (sourceType === '億威內部自建專案' && (!clientName || clientName === '燁輝')) {
          setClientName('億威電子');
        }
      }
    }
  }, [open, defaultName, defaultClientName]);

  const handleCategoryChange = (newCat: '評估案' | '已開案') => {
    setCategory(newCat);
    if (sourceType === '燁輝請購案') {
      if (!caseNumber.trim() || caseNumber === 'POC') {
        setCaseNumber('PUR');
      }
    } else if (newCat === '評估案') {
      if (!caseNumber.trim() || caseNumber === 'PUR') {
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

  // 切換專案來源型態時，自動聯動切換對應的客戶名稱與案號代碼
  const handleSourceTypeChange = (newSourceType: ProjectSourceType) => {
    setSourceType(newSourceType);
    if (newSourceType === '燁輝請購案') {
      setClientName('燁輝');
      if (!caseNumber.trim() || caseNumber === 'POC') {
        setCaseNumber('PUR');
      }
    } else if (newSourceType === '燁輝列管專案') {
      setClientName('燁輝');
      if (caseNumber === 'PUR') {
        setCaseNumber(category === '評估案' ? 'POC' : '');
      }
    } else if (newSourceType === '億威內部自建專案') {
      setClientName('億威電子');
      if (caseNumber === 'PUR') {
        setCaseNumber(category === '評估案' ? 'POC' : '');
      }
    } else if (newSourceType === '其他專案' || newSourceType === '其他智慧製造專案') {
      if (clientName === '燁輝' || clientName === '億威電子') {
        setClientName('');
      }
      if (caseNumber === 'PUR') {
        setCaseNumber(category === '評估案' ? 'POC' : '');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: '請輸入專案名稱', variant: 'destructive' });
      return;
    }

    const finalClient = cleanClientName(clientName) || (sourceType === '億威內部自建專案' ? '億威電子' : ((sourceType === '燁輝列管專案' || sourceType === '燁輝請購案') ? '燁輝' : '其他客戶'));
    if (!finalClient) {
      toast({ title: '請選擇或輸入客戶名稱', variant: 'destructive' });
      return;
    }

    let finalCaseNumber = caseNumber.trim();
    if (sourceType === '燁輝請購案') {
      if (!finalCaseNumber) finalCaseNumber = 'PUR';
    } else if (category === '已開案') {
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
        clientName: finalClient,
        responsiblePm: responsiblePm.trim(),
        clientContact: clientContact.trim(),
        vendorOrSupplier: vendorOrSupplier.trim() || undefined,
        caseNumber: finalCaseNumber || undefined,
        expectedCompletionDate: expectedCompletionDate || undefined,
        evaluationDate: evaluationDate || undefined,
        tpmOfficeContact: tpmOfficeContact.trim() || undefined,
        projectPurpose,
      });

      if (res.success) {
        toast({ title: '建立成功', description: `內部專案「${name}」已建立！` });
        setName('');
        setCaseNumber('POC');
        setExpectedCompletionDate('');
        setEvaluationDate(new Date().toISOString().slice(0, 10));
        setResponsiblePm('');
        setTpmOfficeContact('');
        setClientContact('');
        setVendorOrSupplier('');
        setProjectPurpose('');
        setCategory('評估案');
        setSourceType('億威內部自建專案');
        setClientName('億威電子');
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

  // 預設常見 TPM 人員名單
  const defaultTpmNames = ['陳家姷', '陳家炳', '陳家炘', '徐智宏', '賴冠廷', '胡春如', '許家豪', '蔣永政', '蘇煥鈞', '鄭文芳'];

  // 整理 PM 下拉選項清單 (嚴格排除 TPM 成員，只選內部 PM 或非 TPM 成員)
  const pmUsers = users.filter((u) => {
    const dept = (u.department || '').trim().toUpperCase();
    const name = (u.displayName || u.email || '').trim();
    if (dept.includes('TPM') || defaultTpmNames.some((n) => name.includes(n))) return false;
    return dept === 'PM';
  });
  const fallbackPmUsers = users.filter((u) => {
    const dept = (u.department || '').trim().toUpperCase();
    const name = (u.displayName || u.email || '').trim();
    return !dept.includes('TPM') && !defaultTpmNames.some((n) => name.includes(n));
  });
  const availablePmUsers = pmUsers.length > 0 ? pmUsers : fallbackPmUsers;
  const pmOptions = availablePmUsers.map((u) => ({
    value: u.displayName || u.email,
    label: u.displayName || u.email,
    hint: u.department ? `部門: ${u.department}` : (u.role === 'admin' ? '管理員' : '成員'),
  }));

  // 整理 TPM 窗口下拉選項清單 (部門為 TPM 的燁輝同仁或在 TPM 名單中者)
  const tpmOptions = useMemo(() => {
    const list: { value: string; label: string; hint?: string }[] = [];
    const seen = new Set<string>();

    users.forEach((u) => {
      const name = (u.displayName || u.email || '').trim();
      const dept = (u.department || '').trim().toUpperCase();
      const comp = (u.clientName || '').trim();
      if ((dept.includes('TPM') || defaultTpmNames.some((n) => name.includes(n))) && !comp.includes('億威') && !comp.includes('燕巢')) {
        if (!seen.has(name) && name) {
          seen.add(name);
          list.push({
            value: name,
            label: name,
            hint: '燁輝 · TPM',
          });
        }
      }
    });

    defaultTpmNames.forEach((n) => {
      if (!seen.has(n)) {
        seen.add(n);
        list.push({
          value: n,
          label: n,
          hint: '燁輝 · TPM',
        });
      }
    });

    return list;
  }, [users]);

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

  // 外包供應商選項清單：來源來自客戶欄位 (clients) + 窗口/成員，格式為「"廠商" + "名字"」
  const vendorSupplierOptions = useMemo(() => {
    const list: { value: string; label: string; hint?: string }[] = [];
    const seen = new Set<string>();

    clientList.forEach((c) => {
      const vendorName = c.name?.trim();
      if (!vendorName) return;

      // 1. 若該客戶在客戶維護中有設定主要窗口 (contactPerson)
      if (c.contactPerson && c.contactPerson.trim()) {
        const itemVal = `${vendorName} - ${c.contactPerson.trim()}`;
        if (!seen.has(itemVal)) {
          seen.add(itemVal);
          list.push({
            value: itemVal,
            label: itemVal,
            hint: `主要窗口`,
          });
        }
      }

      // 2. 尋找成員管理 (users) 中屬於該客戶的成員 (displayName)
      const matchedUsers = users.filter((u) => {
        if (u.clientName && isClientMatch(u.clientName, vendorName)) return true;
        const emailLower = u.email?.toLowerCase() || '';
        if (vendorName.includes('億威') && emailLower.includes('emmt.com.tw')) return true;
        if (vendorName.includes('燁輝') && emailLower.includes('yiehphui.com.tw')) return true;
        return false;
      });

      matchedUsers.forEach((u) => {
        const userName = (u.displayName || u.email || '').trim();
        if (!userName) return;
        const itemVal = `${vendorName} - ${userName}`;
        if (!seen.has(itemVal)) {
          seen.add(itemVal);
          list.push({
            value: itemVal,
            label: itemVal,
            hint: u.department ? `部門: ${u.department}` : `廠商成員`,
          });
        }
      });

      // 3. 也保留單純廠商名稱的選項 (供若尚無特定窗口名字時選取)
      if (!seen.has(vendorName)) {
        seen.add(vendorName);
        list.push({
          value: vendorName,
          label: vendorName,
          hint: c.code ? `代碼: ${c.code}` : `廠商/客戶`,
        });
      }
    });

    return list;
  }, [clientList, users]);

  // 客戶窗口預設建議名單 (直接從成員管理中挑選「所屬客戶」符合該專案客戶的使用者；備援加上客戶表主要窗口)
  const matchedClientUsers = users.filter((u) => {
    if (u.clientName && isClientMatch(u.clientName, clientName || '燁輝')) return true;
    const emailLower = u.email?.toLowerCase() || '';
    if ((clientName || '燁輝').includes('億威') && emailLower.includes('emmt.com.tw')) return true;
    if ((clientName || '燁輝').includes('燁輝') && emailLower.includes('yiehphui.com.tw')) return true;
    return false;
  });
  const clientUserContacts = matchedClientUsers.map((u) => u.displayName || u.email);
  const clientMainContact = clientList.find((c) => cleanClientName(c.name) === cleanClientName(clientName))?.contactPerson;

  const contactOptions = useMemo(() => {
    const list: { value: string; label: string; hint?: string }[] = [];
    const seen = new Set<string>();

    const targetClient = clientName || '燁輝';

    // 1. 該客戶主要窗口
    if (clientMainContact && clientMainContact.trim()) {
      const p = clientMainContact.trim();
      seen.add(p);
      list.push({
        value: p,
        label: p,
        hint: `${targetClient} · 主要窗口`,
      });
    }

    // 2. 該客戶所屬成員
    clientUserContacts.forEach((p) => {
      if (p && !seen.has(p)) {
        seen.add(p);
        list.push({
          value: p,
          label: p,
          hint: `${targetClient} · 所屬成員`,
        });
      }
    });

    // 3. 備援名單
    if (list.length === 0 && targetClient.includes('燁輝')) {
      ['黃裕峰', '張簡'].forEach((p) => {
        list.push({
          value: p,
          label: p,
          hint: `燁輝 · 預設窗口`,
        });
      });
    }

    return list;
  }, [clientUserContacts, clientMainContact, clientName]);

  // 整理純淨客戶選單 (移除後方括號註記，並去重)
  const cleanClientList = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];

    // 1. 確保系統標準企業必然在選單中
    const standardClients = ['燁輝', '億威電子'];
    standardClients.forEach((name) => {
      seen.add(name);
      list.push({ id: `std-${name}`, name });
    });

    // 2. 加入資料庫已有的客戶
    clientList.forEach((c) => {
      const clean = cleanClientName(c.name);
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        list.push({ id: c.id, name: clean });
      }
    });

    // 3. 加入成員中綁定的客戶
    users.forEach((u) => {
      if (u.clientName) {
        const clean = cleanClientName(u.clientName);
        if (clean && !seen.has(clean)) {
          seen.add(clean);
          list.push({ id: `usr-${clean}`, name: clean });
        }
      }
    });

    return list;
  }, [clientList, users]);

  const clientOptions = useMemo(() => {
    return cleanClientList.map((c) => ({
      value: c.name,
      label: c.name,
      hint: c.name === '燁輝' ? '企業集團' : c.name === '億威電子' ? '內部自建' : '往來客戶',
    }));
  }, [cleanClientList]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-w-[95vw] max-h-[92vh] overflow-y-auto z-[60]">
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
          {/* 1. 專案來源型態 (4選1) */}
          <div>
            <Label className="text-xs font-semibold">專案來源型態 *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => handleSourceTypeChange('燁輝列管專案')}
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
                onClick={() => handleSourceTypeChange('燁輝請購案')}
                className={`py-2 px-2 rounded-md text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                  sourceType === '燁輝請購案'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>📑 燁輝請購案</span>
              </button>

              <button
                type="button"
                onClick={() => handleSourceTypeChange('億威內部自建專案')}
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
                onClick={() => handleSourceTypeChange('其他專案')}
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
                客戶名稱 (下拉/輸入) *
              </Label>
              <div className="mt-1">
                <SearchableCombobox
                  value={clientName}
                  onChange={(val) => setClientName(cleanClientName(val))}
                  options={clientOptions}
                  placeholder={sourceType === '其他專案' ? "請選擇或直接輸入客戶名稱..." : "請選擇客戶..."}
                  emptyHint="可直接輸入新客戶名稱"
                />
              </div>
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

          {/* 4. 負責 PM、TPM 窗口 與 客戶/現場窗口 (下拉式 + 保留手動輸入) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1 text-blue-700">
                <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                負責 PM (億威)
              </Label>
              <div className="mt-1">
                <SearchableCombobox
                  value={responsiblePm}
                  onChange={setResponsiblePm}
                  options={pmOptions}
                  placeholder="選擇 PM 或輸入..."
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold flex items-center gap-1 text-amber-700">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                TPM 窗口 (燁輝)
              </Label>
              <div className="mt-1">
                <SearchableCombobox
                  value={tpmOfficeContact}
                  onChange={setTpmOfficeContact}
                  options={tpmOptions}
                  placeholder="選擇 TPM 窗口..."
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold flex items-center gap-1 text-slate-700">
                <Users className="h-3.5 w-3.5 text-slate-500" />
                客戶 / 現場窗口
              </Label>
              <div className="mt-1">
                <SearchableCombobox
                  value={clientContact}
                  onChange={setClientContact}
                  options={contactOptions}
                  placeholder="選擇窗口或輸入..."
                />
              </div>
            </div>
          </div>

          {/* 5. 評估/開案日期 與 預估完成日 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-purple-600" />
                  {category === '評估案' ? '評估起始日期 (評估日)' : '正式開案日期 (立案日)'}
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

          {/* 6. 案號代碼與外包供應商 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">
                案號代碼 {sourceType === '燁輝請購案' ? '(請購案預設為 PUR)' : '(評估案預設為 POC)'}
              </Label>
              <Input
                className="mt-1 text-xs font-mono"
                placeholder={sourceType === '燁輝請購案' ? "例如：PUR" : (category === '評估案' ? "POC" : "留空自動編號或填入案號")}
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                外包供應商 (下拉/輸入)
              </Label>
              <div className="mt-1">
                <SearchableCombobox
                  value={vendorOrSupplier}
                  onChange={setVendorOrSupplier}
                  options={vendorSupplierOptions}
                  placeholder="選擇供應商 (廠商+名字) 或直接輸入..."
                />
              </div>
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
