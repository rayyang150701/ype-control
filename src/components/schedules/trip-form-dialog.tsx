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
import { Plus, Trash2, Calendar, Clock, MapPin, Users, Building, FileText, Check } from 'lucide-react';
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
    notes: '',
  });

  const [travelerModes, setTravelerModes] = useState<('select' | 'other')[]>(['select']);
  const [customTravelers, setCustomTravelers] = useState<string[]>(['']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 提取人員列表（包含使用者名稱）
  const userOptions = useMemo(() => {
    return users
      .map((u) => u.displayName || u.username || u.email)
      .filter((name): name is string => Boolean(name && name.trim()));
  }, [users]);

  // 提取既有專案中的 TPM 負責人名單作為快速選項
  const tpmOptions = useMemo(() => {
    const list = new Set<string>();
    projects.forEach((p) => {
      if (p.tpmOfficeContact?.trim()) list.add(p.tpmOfficeContact.trim());
      if (p.yiehPhuiProjectManager?.trim()) list.add(p.yiehPhuiProjectManager.trim());
    });
    // 也可加入常規人員
    userOptions.forEach((u) => list.add(u));
    return Array.from(list);
  }, [projects, userOptions]);

  // 依據傳入的 trip 或 selectedDate 初始化
  useEffect(() => {
    if (open) {
      if (trip) {
        const trvs = trip.travelers && trip.travelers.length > 0 ? trip.travelers : [''];
        const modes: ('select' | 'other')[] = trvs.map((name) =>
          userOptions.includes(name) ? 'select' : 'other'
        );
        const customs = trvs.map((name, i) => (modes[i] === 'other' ? name : ''));

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
          notes: trip.notes || '',
        });
        setTravelerModes(modes);
        setCustomTravelers(customs);
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
          notes: '',
        });
        setTravelerModes(['select']);
        setCustomTravelers(['']);
      }
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open, trip, selectedDate, defaultCustomerId, clients, userOptions]);

  const handleAddTraveler = () => {
    setFormData((prev) => ({
      ...prev,
      travelers: [...prev.travelers, ''],
    }));
    setTravelerModes((prev) => [...prev, 'select']);
    setCustomTravelers((prev) => [...prev, '']);
  };

  const handleRemoveTraveler = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      travelers: prev.travelers.filter((_, i) => i !== index),
    }));
    setTravelerModes((prev) => prev.filter((_, i) => i !== index));
    setCustomTravelers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTravelerChange = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      travelers: prev.travelers.map((t, i) => (i === index ? value : t)),
    }));
  };

  const handleTravelerModeChange = (index: number, mode: 'select' | 'other') => {
    setTravelerModes((prev) => prev.map((m, i) => (i === index ? mode : m)));
    if (mode === 'select') {
      handleTravelerChange(index, '');
      setCustomTravelers((prev) => prev.map((c, i) => (i === index ? '' : c)));
    }
  };

  const handleCustomTravelerChange = (index: number, value: string) => {
    setCustomTravelers((prev) => prev.map((c, i) => (i === index ? value : c)));
    handleTravelerChange(index, value);
  };

  const handleTravelerSelectChange = (index: number, value: string) => {
    if (value === '__OTHER__') {
      handleTravelerModeChange(index, 'other');
    } else {
      handleTravelerChange(index, value);
    }
  };

  // 當專案改變時，自動關聯專案名稱與對應客戶（若客戶未指定）
  const handleProjectChange = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      // 嘗試根據專案的 clientName 尋找客戶
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
    setFormData((prev) => ({
      ...prev,
      customerId,
      customerName: client ? client.name : '',
    }));
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

          {/* 出差人員 */}
          <div>
            <Label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
              <span>出差參與人員 <span className="text-red-500">*</span></span>
              <button
                type="button"
                onClick={handleAddTraveler}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ 增加人員</span>
              </button>
            </Label>
            <div className="space-y-2 mt-1.5">
              {formData.travelers.map((traveler, index) => (
                <div key={index} className="flex items-center gap-2">
                  {travelerModes[index] === 'other' ? (
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={customTravelers[index] || ''}
                        onChange={(e) => handleCustomTravelerChange(index, e.target.value)}
                        placeholder="請輸入姓名 (如：張工程師)"
                        className="text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleTravelerModeChange(index, 'select')}
                        className="text-xs text-blue-600"
                      >
                        切換下拉
                      </Button>
                    </div>
                  ) : (
                    <select
                      value={traveler || ''}
                      onChange={(e) => handleTravelerSelectChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-md text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- 請選擇同仁 --</option>
                      {userOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value="__OTHER__">✏️ 其他（手動自填姓名）</option>
                    </select>
                  )}

                  {formData.travelers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTraveler(index)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded transition"
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

          {/* 出差類別 */}
          <div>
            <Label className="text-sm font-semibold text-gray-700">行程類別</Label>
            <div className="grid grid-cols-3 gap-3 mt-1.5">
              {TRIP_CATEGORIES.map((cat) => (
                <label
                  key={cat.value}
                  className={`flex items-center gap-2.5 p-2.5 border rounded-xl cursor-pointer transition ${
                    formData.category === cat.value
                      ? 'border-blue-500 bg-blue-50/50 shadow-xs'
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
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm font-medium text-gray-800">{cat.label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* TPM 與 確認狀態 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold text-gray-700">TPM 負責人 (可選)</Label>
              <input
                list="tpm-options-list"
                value={formData.tpm}
                onChange={(e) => setFormData({ ...formData, tpm: e.target.value })}
                placeholder="輸入或選擇 TPM 姓名"
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="tpm-options-list">
                {tpmOptions.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
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
