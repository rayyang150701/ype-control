'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Calendar, Clock, MapPin, Users, Building, FileText, Check, UtensilsCrossed, Sparkles, Filter } from 'lucide-react';
import { BusinessTrip, TRIP_CATEGORIES, TIME_OPTIONS, TripCategory, TripStatus } from '@/types/businessTrip';
import type { Client, Project, User } from '@/types';
import { formatDate } from '@/lib/calendar-helper';

interface TripFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: BusinessTrip | null;
  selectedDate?: Date | null;
  clients: Client[];
  projects: Project[];
  users: User[];
  defaultCustomerId?: string;
  onSave: (tripData: Omit<BusinessTrip, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function TripFormDialog({
  open,
  onOpenChange,
  trip,
  selectedDate,
  clients,
  projects,
  users,
  defaultCustomerId,
  onSave,
}: TripFormDialogProps) {
  const [formData, setFormData] = useState({
    subject: '',
    projectId: '',
    projectName: '',
    travelers: [''],
    location: '',
    customerId: '',
    customerName: '',
    startDate: formatDate(new Date()),
    endDate: formatDate(new Date()),
    startTime: '09:00',
    endTime: '17:00',
    category: 'business' as TripCategory,
    tpm: '',
    status: 'pending' as TripStatus,
    lunchBoxes: 0,
    notes: '',
  });

  // 人員選擇之客戶/單位篩選條件 (預設全部或隨關聯客戶連動)
  const [travelerClientFilter, setTravelerClientFilter] = useState<string>('all');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 判斷關聯客戶是否為燁輝相關
  const isYiehPhui = useMemo(() => {
    return Boolean(
      (formData.customerName && formData.customerName.includes('燁輝')) ||
      (formData.customerId && clients.find((c) => c.id === formData.customerId)?.name.includes('燁輝'))
    );
  }, [formData.customerName, formData.customerId, clients]);

  // 提取所有可供篩選的客戶/單位列表
  const clientFilterOptions = useMemo(() => {
    const list = new Set<string>();
    clients.forEach((c) => {
      if (c.name?.trim()) list.add(c.name.trim());
    });
    users.forEach((u) => {
      if (u.clientName?.trim()) list.add(u.clientName.trim());
      if (u.department?.trim()) list.add(u.department.trim());
    });
    return Array.from(list);
  }, [clients, users]);

  // 所有同仁與人員名冊
  const allPersonnelList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; department?: string; clientName?: string }>();
    users.forEach((u) => {
      const name = (u.displayName || u.username || u.email || '').trim();
      if (name) {
        map.set(name, {
          id: u.uid,
          name,
          department: u.department?.trim(),
          clientName: u.clientName?.trim(),
        });
      }
    });

    // 從既有專案中補充相關聯絡人 (若尚未在 user 表)
    projects.forEach((p) => {
      const pClient = p.clientName?.trim();
      if (p.tpmOfficeContact?.trim() && !map.has(p.tpmOfficeContact.trim())) {
        map.set(p.tpmOfficeContact.trim(), { id: `p-tpm-${p.id}`, name: p.tpmOfficeContact.trim(), department: 'TPM', clientName: pClient });
      }
      if (p.yiehPhuiProjectManager?.trim() && !map.has(p.yiehPhuiProjectManager.trim())) {
        map.set(p.yiehPhuiProjectManager.trim(), { id: `p-ypm-${p.id}`, name: p.yiehPhuiProjectManager.trim(), department: '燁輝PM', clientName: '燁輝' });
      }
      if (p.clientContact?.trim() && !map.has(p.clientContact.trim())) {
        map.set(p.clientContact.trim(), { id: `p-cc-${p.id}`, name: p.clientContact.trim(), clientName: pClient });
      }
      if (p.responsiblePm?.trim() && !map.has(p.responsiblePm.trim())) {
        map.set(p.responsiblePm.trim(), { id: `p-rpm-${p.id}`, name: p.responsiblePm.trim(), department: 'PM' });
      }
    });

    return Array.from(map.values());
  }, [users, projects]);

  // 依據 travelerClientFilter 篩選對應人名
  const filteredPersonnelOptions = useMemo(() => {
    if (!travelerClientFilter || travelerClientFilter === 'all') {
      return allPersonnelList;
    }
    const filterLower = travelerClientFilter.toLowerCase();
    return allPersonnelList.filter((p) => {
      const matchClient = p.clientName?.toLowerCase().includes(filterLower);
      const matchDept = p.department?.toLowerCase().includes(filterLower);
      if (travelerClientFilter.includes('燁輝')) {
        return matchClient || matchDept || p.department?.toUpperCase().includes('TPM');
      }
      return matchClient || matchDept;
    });
  }, [allPersonnelList, travelerClientFilter]);

  // 燁輝專屬 TPM 名單 (當客戶為燁輝時優先提取 部門=TPM 與 燁輝人員)
  const yiehPhuiTpmOptions = useMemo(() => {
    const list = new Set<string>();
    allPersonnelList.forEach((p) => {
      const isDeptTpm = p.department?.toUpperCase().includes('TPM');
      const isClientYp = p.clientName?.includes('燁輝') || p.department?.includes('燁輝');
      if (isDeptTpm || isClientYp) {
        list.add(p.name);
      }
    });

    // 專案的 TPM 與 燁輝窗口
    projects
      .filter((p) => p.clientName?.includes('燁輝'))
      .forEach((p) => {
        if (p.tpmOfficeContact?.trim()) list.add(p.tpmOfficeContact.trim());
        if (p.yiehPhuiProjectManager?.trim()) list.add(p.yiehPhuiProjectManager.trim());
      });

    // 若篩選為空，提供常規人員與所有專案 TPM
    if (list.size === 0) {
      projects.forEach((p) => {
        if (p.tpmOfficeContact?.trim()) list.add(p.tpmOfficeContact.trim());
      });
      allPersonnelList.forEach((p) => list.add(p.name));
    }

    return Array.from(list);
  }, [allPersonnelList, projects]);

  // 一般 TPM 選項名單 (非燁輝時)
  const regularTpmOptions = useMemo(() => {
    const list = new Set<string>();
    projects.forEach((p) => {
      if (p.tpmOfficeContact?.trim()) list.add(p.tpmOfficeContact.trim());
      if (p.yiehPhuiProjectManager?.trim()) list.add(p.yiehPhuiProjectManager.trim());
    });
    allPersonnelList.forEach((p) => list.add(p.name));
    return Array.from(list);
  }, [projects, allPersonnelList]);

  // 依據傳入的 trip 或 selectedDate 初始化
  useEffect(() => {
    if (open) {
      if (trip) {
        const trvs = trip.travelers && trip.travelers.length > 0 ? trip.travelers : [''];
        setFormData({
          subject: trip.subject || '',
          projectId: trip.projectId || '',
          projectName: trip.projectName || '',
          travelers: trvs,
          location: trip.location || '',
          customerId: trip.customerId || '',
          customerName: trip.customerName || '',
          startDate: trip.startDate || formatDate(new Date()),
          endDate: trip.endDate || formatDate(new Date()),
          startTime: trip.startTime || '09:00',
          endTime: trip.endTime || '17:00',
          category: trip.category || 'business',
          tpm: trip.tpm || '',
          status: trip.status || 'pending',
          lunchBoxes: trip.lunchBoxes || 0,
          notes: trip.notes || '',
        });

        if (trip.customerName) {
          setTravelerClientFilter(trip.customerName);
        } else {
          setTravelerClientFilter('all');
        }
      } else {
        const initDate = selectedDate ? formatDate(selectedDate) : formatDate(new Date());
        let initCustomerName = '';
        if (defaultCustomerId) {
          const matchedClient = clients.find((c) => c.id === defaultCustomerId);
          if (matchedClient) initCustomerName = matchedClient.name;
        }

        setFormData({
          subject: '',
          projectId: '',
          projectName: '',
          travelers: [''],
          location: '',
          customerId: defaultCustomerId || '',
          customerName: initCustomerName,
          startDate: initDate,
          endDate: initDate,
          startTime: '09:00',
          endTime: '17:00',
          category: 'business',
          tpm: '',
          status: 'pending',
          lunchBoxes: 0,
          notes: '',
        });

        if (initCustomerName) {
          setTravelerClientFilter(initCustomerName);
        } else {
          setTravelerClientFilter('all');
        }
      }
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open, trip, selectedDate, defaultCustomerId, clients]);

  const handleAddTraveler = () => {
    setFormData((prev) => ({
      ...prev,
      travelers: [...prev.travelers, ''],
    }));
  };

  const handleRemoveTraveler = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      travelers: prev.travelers.filter((_, i) => i !== index),
    }));
  };

  const handleTravelerChange = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      travelers: prev.travelers.map((t, i) => (i === index ? value : t)),
    }));
  };

  // 當專案改變時，自動關聯專案名稱與對應客戶（若客戶未指定）
  const handleProjectChange = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      let matchedClientId = formData.customerId;
      let matchedClientName = formData.customerName;

      if (!matchedClientName && proj.clientName) {
        matchedClientName = proj.clientName;
        const matched = clients.find((c) => c.name === proj.clientName);
        if (matched) matchedClientId = matched.id;
      }

      setFormData((prev) => ({
        ...prev,
        projectId,
        projectName: proj.name,
        customerId: matchedClientId,
        customerName: matchedClientName,
        tpm: prev.tpm || proj.tpmOfficeContact || '',
      }));

      if (matchedClientName) {
        setTravelerClientFilter(matchedClientName);
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        projectId: '',
        projectName: '',
      }));
    }
  };

  const handleCustomerChange = (customerId: string) => {
    const client = clients.find((c) => c.id === customerId);
    const newCustomerName = client ? client.name : '';
    setFormData((prev) => ({
      ...prev,
      customerId,
      customerName: newCustomerName,
      lunchBoxes: newCustomerName.includes('燁輝') ? prev.lunchBoxes : 0,
    }));

    if (newCustomerName) {
      setTravelerClientFilter(newCustomerName);
    } else {
      setTravelerClientFilter('all');
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.subject.trim()) {
      newErrors.subject = '請填寫出差行程主題';
    }
    const validTravelers = formData.travelers.filter((t) => t && t.trim().length > 0);
    if (validTravelers.length === 0) {
      newErrors.travelers = '請至少填寫或選擇一位出差人員';
    }
    if (!formData.location.trim()) {
      newErrors.location = '請輸入出差地點或廠區';
    }
    if (formData.endDate < formData.startDate) {
      newErrors.endDate = '結束日期不能早於開始日期';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      await onSave({
        subject: formData.subject.trim(),
        projectId: formData.projectId || undefined,
        projectName: formData.projectName || undefined,
        customerId: formData.customerId || undefined,
        customerName: formData.customerName || undefined,
        travelers: formData.travelers.map((t) => t.trim()).filter(Boolean),
        location: formData.location.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        category: formData.category,
        tpm: formData.tpm ? formData.tpm.trim() : undefined,
        status: formData.status,
        lunchBoxes: isYiehPhui ? Number(formData.lunchBoxes) || 0 : 0,
        notes: formData.notes ? formData.notes.trim() : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('儲存行程失敗:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl">
        <DialogHeader className="px-6 py-4 border-b bg-gray-50/80 sticky top-0 z-10">
          <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            {trip ? '編輯出差行程' : '新增出差行程'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 主題 */}
          <div>
            <Label className="text-sm font-semibold text-gray-700">
              行程主題 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="例：燁輝岡山廠產線感測器現場調校與會議"
              className="mt-1"
            />
            {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
          </div>

          {/* 專案與客戶 (2 欄) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold text-gray-700">關聯專案 (可選)</Label>
              <select
                value={formData.projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 請選擇專案 --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.clientName ? `(${p.clientName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm font-semibold text-gray-700">關聯客戶 (可選)</Label>
              <select
                value={formData.customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 請選擇客戶 --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 出差人員 (支援手動輸入 + 下拉選擇，以及依客戶別篩選人名) */}
          <div className="space-y-2 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <Label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span>出差參與人員 <span className="text-red-500">*</span></span>
              </Label>

              {/* 依客戶別過濾人名 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                  <Filter className="w-3 h-3 text-slate-400" />
                  依單位/客戶篩選：
                </span>
                <select
                  value={travelerClientFilter}
                  onChange={(e) => setTravelerClientFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="all">🌐 全部單位 / 所有同仁</option>
                  {clientFilterOptions.map((cName) => (
                    <option key={cName} value={cName}>
                      🏢 {cName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>
                💡 支援直接手動輸入任意姓名，或點選右側下拉選單快速帶入同仁名單
              </span>
              <button
                type="button"
                onClick={handleAddTraveler}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer ml-auto shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ 增加人員</span>
              </button>
            </div>

            <div className="space-y-2 mt-2">
              {formData.travelers.map((traveler, index) => (
                <div key={index} className="flex items-center gap-2">
                  {/* 手動輸入 + datalist 智慧補齊 */}
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      list={`traveler-datalist-${index}`}
                      value={traveler}
                      onChange={(e) => handleTravelerChange(index, e.target.value)}
                      placeholder="手動輸入姓名或點右側快速選取"
                      className="text-sm bg-white"
                    />
                    <datalist id={`traveler-datalist-${index}`}>
                      {filteredPersonnelOptions.map((p) => (
                        <option
                          key={`${p.name}-${p.id}`}
                          value={p.name}
                        >
                          {p.name} {p.department || p.clientName ? `(${[p.department, p.clientName].filter(Boolean).join(' · ')})` : ''}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* 下拉式快速選取 */}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleTravelerChange(index, e.target.value);
                      }
                    }}
                    className="w-36 sm:w-44 px-2 py-2 border rounded-md text-xs bg-white hover:bg-slate-50 text-slate-700 cursor-pointer focus:ring-1 focus:ring-blue-500 shrink-0"
                    title="從已篩選名單中快速選取帶入"
                  >
                    <option value="">▼ 快速選擇人員...</option>
                    {filteredPersonnelOptions.map((p) => (
                      <option key={`${p.name}-${p.id}`} value={p.name}>
                        {p.name} {p.department || p.clientName ? `(${[p.department, p.clientName].filter(Boolean).join(' · ')})` : ''}
                      </option>
                    ))}
                  </select>

                  {formData.travelers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTraveler(index)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded transition shrink-0 cursor-pointer"
                      title="移除此人員"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {errors.travelers && <p className="text-xs text-red-500 mt-1">{errors.travelers}</p>}
          </div>

          {/* 出差地點 */}
          <div>
            <Label className="text-sm font-semibold text-gray-700">
              出差地點 / 廠區 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="例：高雄市橋頭區燁輝三廠 塗裝研發中心"
              className="mt-1"
            />
            {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
          </div>

          {/* 日期與時間 (4 欄) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50/60 p-3.5 rounded-xl border border-gray-100">
            <div>
              <Label className="text-xs font-semibold text-gray-600">開始日期 *</Label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    startDate: newStart,
                    endDate: prev.endDate < newStart ? newStart : prev.endDate,
                  }));
                }}
                className="w-full mt-1 px-3 py-1.5 border rounded-md text-sm bg-white"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">開始時間 *</Label>
              <select
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 border rounded-md text-sm bg-white"
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">結束日期 *</Label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 border rounded-md text-sm bg-white"
              />
              {errors.endDate && <p className="text-[11px] text-red-500 mt-0.5">{errors.endDate}</p>}
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">結束時間 *</Label>
              <select
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 border rounded-md text-sm bg-white"
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 出差類別 (含出差、會議、線上會議、其他 4 種類別) */}
          <div>
            <Label className="text-sm font-semibold text-gray-700">行程類別</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-1.5">
              {TRIP_CATEGORIES.map((cat) => (
                <label
                  key={cat.value}
                  className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer transition ${
                    formData.category === cat.value
                      ? 'border-blue-500 bg-blue-50/60 shadow-xs ring-1 ring-blue-500'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.value}
                    checked={formData.category === cat.value}
                    onChange={() => setFormData({ ...formData, category: cat.value })}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs sm:text-sm font-medium text-gray-800 truncate">
                      {cat.label}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* TPM 與 確認狀態 (支援燁輝自動過濾 TPM 部門與人員名單) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700">
                  TPM 負責人 (可選)
                </Label>
                {isYiehPhui && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 flex items-center gap-0.5">
                    <Sparkles className="w-3 h-3" />
                    已連動燁輝/TPM
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1">
                {/* 手動輸入 + datalist 提示 */}
                <div className="relative flex-1">
                  <Input
                    list="tpm-options-list"
                    value={formData.tpm}
                    onChange={(e) => setFormData({ ...formData, tpm: e.target.value })}
                    placeholder={isYiehPhui ? '輸入或選擇 TPM / 燁輝窗口' : '輸入或選擇 TPM 姓名'}
                    className="text-sm bg-white"
                  />
                  <datalist id="tpm-options-list">
                    {(isYiehPhui ? yiehPhuiTpmOptions : regularTpmOptions).map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>

                {/* 下拉式快速選單 */}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setFormData((prev) => ({ ...prev, tpm: e.target.value }));
                    }
                  }}
                  className="w-28 px-2 py-2 border rounded-md text-xs bg-white text-slate-700 cursor-pointer shrink-0"
                  title="從名單快速點選帶入 TPM"
                >
                  <option value="">▼ 挑選...</option>
                  {(isYiehPhui ? yiehPhuiTpmOptions : regularTpmOptions).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {isYiehPhui && (
                <p className="text-[11px] text-amber-700 mt-1">
                  💡 關聯客戶包含「燁輝」：下拉已自動優先列出 TPM 部門同仁與燁輝窗口。
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm font-semibold text-gray-700">行程確認狀態</Label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TripStatus })}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">⏳ 待確認 (Pending)</option>
                <option value="confirmed">✅ 已確認 (Confirmed)</option>
              </select>
            </div>
          </div>

          {/* 燁輝廠區專屬：便當代訂數量 (僅當關聯客戶包含燁輝時顯示) */}
          {isYiehPhui && (
            <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-3 transition-all animate-fadeIn">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                  <span className="text-base">🍱</span>
                  <span>燁輝廠區便當代訂數量</span>
                  <span className="text-xs font-normal text-amber-700 hidden sm:inline">
                    (至廠調校/會議代訂登記)
                  </span>
                </Label>
                <span className="text-xs font-bold text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full border border-amber-300">
                  目前便當數: {formData.lunchBoxes || 0} 個
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 快速常用數量按鈕 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, lunchBoxes: num }))}
                      className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer border ${
                        formData.lunchBoxes === num
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-amber-100 hover:border-amber-300'
                      }`}
                    >
                      {num === 0 ? '無 (0)' : `${num} 個`}
                    </button>
                  ))}
                </div>

                {/* 步進輸入調整器 */}
                <div className="flex items-center border border-amber-300 rounded-lg overflow-hidden bg-white shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        lunchBoxes: Math.max(0, (prev.lunchBoxes || 0) - 1),
                      }))
                    }
                    className="px-2.5 py-1 text-gray-600 hover:bg-amber-100 text-sm font-bold cursor-pointer"
                    title="減少 1 個"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.lunchBoxes || 0}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        lunchBoxes: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    className="w-12 text-center text-sm py-1 border-0 focus:outline-hidden font-bold text-amber-950"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        lunchBoxes: (prev.lunchBoxes || 0) + 1,
                      }))
                    }
                    className="px-2.5 py-1 text-gray-600 hover:bg-amber-100 text-sm font-bold cursor-pointer"
                    title="增加 1 個"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-amber-800/80">
                ※ 此欄位將同步呈現於月曆卡片、週檢視總表與出差明細，方便總務及廠區同仁提前代訂餐點。
              </p>
            </div>
          )}

          {/* 出差重點彙整 (Key Takeaways) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-semibold text-gray-700">
                出差重點彙整 (Key Takeaways)
              </Label>
              <span className="text-xs text-gray-400">出差結束後3天內需補填</span>
            </div>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              placeholder="1. 本次出差核心結論與決議...&#10;2. 後續待辦事項與指派負責人...&#10;3. 現場異常或需列管風險..."
              className="font-mono text-sm leading-relaxed"
            />
          </div>

          <DialogFooter className="sticky bottom-0 bg-white pt-3 border-t">
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
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? '儲存中...' : trip ? '更新行程' : '建立行程'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
