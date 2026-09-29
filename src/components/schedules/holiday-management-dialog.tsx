'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDays, Plus, Trash2, Edit, Zap, Check, CalendarRange } from 'lucide-react';
import { Holiday } from '@/types/businessTrip';
import { saveHoliday, saveHolidaysBatch, deleteHoliday } from '@/lib/actions';
import { formatDate } from '@/lib/calendar-helper';
import { useToast } from '@/hooks/use-toast';

interface HolidayManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holidays: Holiday[];
  currentYear: number;
  onHolidaysChange: () => Promise<void> | void;
}

export const HOLIDAY_PRESET_CATEGORIES = [
  '國定假日',
  '彈性放假',
  '補假',
  '公司假',
  '廠區歲修',
  '颱風假',
  '其他放假',
];

const COMMON_TAIWAN_HOLIDAY_TEMPLATES = [
  { month: 1, day: 1, name: '元旦' },
  { month: 2, day: 28, name: '和平紀念日' },
  { month: 4, day: 4, name: '兒童節' },
  { month: 4, day: 5, name: '清明節' },
  { month: 5, day: 1, name: '勞動節' },
  { month: 6, day: 19, name: '端午節' },
  { month: 9, day: 25, name: '中秋節' },
  { month: 10, day: 10, name: '國慶日' },
];

function calculateDays(start: string, end: string): number {
  if (!start || !end) return 1;
  const d1 = new Date(start.replace(/-/g, '/'));
  const d2 = new Date(end.replace(/-/g, '/'));
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 1;
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

export function HolidayManagementDialog({
  open,
  onOpenChange,
  holidays,
  currentYear,
  onHolidaysChange,
}: HolidayManagementDialogProps) {
  const { toast } = useToast();
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [editingGroupIds, setEditingGroupIds] = useState<string[]>([]);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('國定假日');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddYear, setQuickAddYear] = useState(currentYear);
  const [quickAddSelections, setQuickAddSelections] = useState<boolean[]>(
    COMMON_TAIWAN_HOLIDAY_TEMPLATES.map(() => false)
  );
  const [isSaving, setIsSaving] = useState(false);

  const dayCount = calculateDays(formStartDate, formEndDate || formStartDate);
  const isMultiDay = Boolean(formStartDate && formEndDate && formEndDate > formStartDate);

  const handleExtendDays = (days: number) => {
    if (!formStartDate) return;
    const d = new Date(formStartDate.replace(/-/g, '/'));
    d.setDate(d.getDate() + (days - 1));
    setFormEndDate(formatDate(d));
  };

  const resetForm = () => {
    setEditingHoliday(null);
    setEditingGroupIds([]);
    setFormStartDate('');
    setFormEndDate('');
    setFormName('');
    setFormCategory('國定假日');
    setIsCustomCategory(false);
  };

  const startEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormStartDate(holiday.date);

    // 智慧偵測是否有同名稱之連續假期區間 (例如中秋連假 9/25-9/28)
    const baseName = holiday.name.replace(/連假|假期|補假|初[一二三四五六七八九十]/g, '').trim();
    let currentD = new Date(holiday.date.replace(/-/g, '/'));
    let maxDateStr = holiday.date;
    const relatedIds: string[] = [holiday.id || holiday.date];

    for (let i = 1; i <= 30; i++) {
      const nextD = new Date(currentD);
      nextD.setDate(nextD.getDate() + 1);
      const nextStr = formatDate(nextD);
      const matched = holidays.find(
        (h) =>
          h.date === nextStr &&
          ((baseName && h.name.includes(baseName)) || h.name === holiday.name)
      );
      if (matched) {
        maxDateStr = nextStr;
        relatedIds.push(matched.id || matched.date);
        currentD = nextD;
      } else {
        break;
      }
    }

    setFormEndDate(maxDateStr);
    setEditingGroupIds(relatedIds);
    setFormName(holiday.name);
    const cat = holiday.category || (holiday.isStatutory ? '國定假日' : '公司假');
    setFormCategory(cat);
    setIsCustomCategory(!HOLIDAY_PRESET_CATEGORIES.includes(cat));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = formCategory.trim() || '國定假日';
    if (!formStartDate || !formName.trim()) {
      toast({
        variant: 'destructive',
        title: '欄位未齊全',
        description: '請填寫開始日期與假日名稱',
      });
      return;
    }

    const finalEndDate = !formEndDate || formEndDate < formStartDate ? formStartDate : formEndDate;

    try {
      setIsSaving(true);
      const isStatutory = finalCategory === '國定假日' || editingHoliday?.isStatutory || false;

      // 產生區間內的所有日期清單
      const d1 = new Date(formStartDate.replace(/-/g, '/'));
      const d2 = new Date(finalEndDate.replace(/-/g, '/'));
      const datesToSave: string[] = [];
      const cur = new Date(d1);
      while (cur <= d2) {
        datesToSave.push(formatDate(cur));
        cur.setDate(cur.getDate() + 1);
      }

      // 建立每一天的 Holiday 資料
      const holidaysToSave: Holiday[] = datesToSave.map((dateStr) => {
        let id = `h-${dateStr}`;
        if (editingHoliday && editingHoliday.date === dateStr) {
          id = editingHoliday.id;
        }
        return {
          id,
          date: dateStr,
          name: formName.trim(),
          category: finalCategory,
          isStatutory,
        };
      });

      // 取得需要被替換移除的舊 ID (若編輯時原有的舊日期未在新區間中)
      const removeIdsOrDates = editingGroupIds.filter((oldIdOrDate) => {
        const matchedOld = holidays.find((h) => h.id === oldIdOrDate || h.date === oldIdOrDate);
        return matchedOld && !datesToSave.includes(matchedOld.date);
      });

      const res = await saveHolidaysBatch(holidaysToSave, removeIdsOrDates);

      if (res.success) {
        toast({
          title: '儲存成功',
          description:
            datesToSave.length > 1
              ? `已成功為 ${formStartDate} 至 ${finalEndDate} (共 ${datesToSave.length} 天) 設定連假！`
              : `已成功儲存放假日！`,
        });
        resetForm();
        await onHolidaysChange();
      } else {
        toast({ variant: 'destructive', title: '儲存失敗', description: res.message });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '操作失敗', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (holiday: Holiday) => {
    if (!confirm(`確定要刪除「${holiday.name}」(${holiday.date}) 嗎？`)) return;

    try {
      const res = await deleteHoliday(holiday.id || holiday.date);
      if (res.success) {
        toast({ title: '已刪除', description: res.message });
        await onHolidaysChange();
      } else {
        toast({ variant: 'destructive', title: '刪除失敗', description: res.message });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '操作失敗', description: err.message });
    }
  };

  const handleQuickAdd = async () => {
    const selected = COMMON_TAIWAN_HOLIDAY_TEMPLATES.filter((_, i) => quickAddSelections[i]);
    if (selected.length === 0) {
      toast({ variant: 'destructive', title: '提示', description: '請至少勾選一個假日' });
      return;
    }

    try {
      setIsSaving(true);
      let count = 0;
      for (const t of selected) {
        const dateStr = `${quickAddYear}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
        await saveHoliday({
          id: `h-${dateStr}`,
          date: dateStr,
          name: t.name,
          category: '國定假日',
          isStatutory: true,
        });
        count++;
      }
      toast({ title: '快速新增成功', description: `已成功儲存 ${count} 筆國定假日` });
      setQuickAddSelections(COMMON_TAIWAN_HOLIDAY_TEMPLATES.map(() => false));
      setShowQuickAdd(false);
      await onHolidaysChange();
    } catch (err: any) {
      toast({ variant: 'destructive', title: '新增失敗', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // 按年份分組
  const groupedByYear = holidays.reduce<Record<number, Holiday[]>>((acc, h) => {
    const year = parseInt(h.date.slice(0, 4), 10) || currentYear;
    if (!acc[year]) acc[year] = [];
    acc[year].push(h);
    return acc;
  }, {});

  const sortedYears = Object.keys(groupedByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-2xl">
        <DialogHeader className="px-6 py-4 border-b bg-gray-50/80 sticky top-0 z-10">
          <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-red-600" />
            假日管理 (放假類別與行事曆維護)
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* 新增 / 編輯表單 */}
          <form onSubmit={handleSave} className="bg-red-50/50 border border-red-100 rounded-xl p-4">
            <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3">
              {editingHoliday ? '✏️ 編輯假日資訊' : '➕ 新增自訂假日'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* 開始日期 */}
              <div className="sm:col-span-3">
                <Label className="text-xs font-semibold text-gray-700">開始日期 *</Label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setFormStartDate(nextStart);
                    if (!formEndDate || formEndDate < nextStart) {
                      setFormEndDate(nextStart);
                    }
                  }}
                  className="w-full mt-1 px-2.5 py-1.5 border rounded-lg text-sm bg-white"
                  required
                />
              </div>

              {/* 結束日期 (支援連續假期區間) */}
              <div className="sm:col-span-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-700">結束日期</Label>
                  {isMultiDay && (
                    <span className="text-[10px] text-red-600 font-bold bg-red-100 px-1 py-0.2 rounded">
                      連放 {dayCount} 天
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={formEndDate}
                  min={formStartDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 border rounded-lg text-sm bg-white"
                  required
                />
              </div>

              {/* 放假類別 */}
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold text-gray-700">放假類別</Label>
                <select
                  value={
                    HOLIDAY_PRESET_CATEGORIES.includes(formCategory) && !isCustomCategory
                      ? formCategory
                      : '自訂'
                  }
                  onChange={(e) => {
                    if (e.target.value === '自訂') {
                      setIsCustomCategory(true);
                      setFormCategory('');
                    } else {
                      setIsCustomCategory(false);
                      setFormCategory(e.target.value);
                    }
                  }}
                  className="w-full mt-1 px-2.5 py-1.5 border rounded-lg text-sm bg-white font-medium text-red-700"
                >
                  {HOLIDAY_PRESET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="自訂">自訂類別...</option>
                </select>
                {isCustomCategory && (
                  <Input
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="自訂類別 (例: 廠慶假)"
                    className="mt-1 h-8 text-xs text-red-700"
                    required
                  />
                )}
              </div>

              {/* 假日名稱 */}
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold text-gray-700">假日名稱 *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例：中秋節、廠區歲修"
                  className="mt-1 h-9 text-sm"
                  required
                />
              </div>

              {/* 送出與取消按鈕 */}
              <div className="sm:col-span-2 flex gap-1.5">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="w-full bg-red-600 hover:bg-red-700 text-white text-xs h-9 font-bold"
                >
                  {editingHoliday
                    ? isMultiDay
                      ? '更新區間'
                      : '更新'
                    : isMultiDay
                    ? '批次新增'
                    : '新增'}
                </Button>
                {editingHoliday && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                    className="text-xs h-9 shrink-0"
                  >
                    取消
                  </Button>
                )}
              </div>
            </div>

            {/* 連假區間天數快速帶入與區間提示 */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2 border-t border-red-200/50">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-gray-500 font-medium">連假快速設定：</span>
                {[
                  { label: '單日 (1天)', days: 1 },
                  { label: '2天連假', days: 2 },
                  { label: '3天連假', days: 3 },
                  { label: '4天連假 (如中秋9/25-9/28)', days: 4 },
                  { label: '5天連假', days: 5 },
                ].map((item) => (
                  <button
                    key={item.days}
                    type="button"
                    onClick={() => handleExtendDays(item.days)}
                    className="text-[10px] px-2 py-0.5 rounded border border-red-200 bg-white hover:bg-red-100 text-red-700 font-medium transition cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {isMultiDay && (
                <span className="text-[11px] text-red-700 font-semibold bg-red-100/90 px-2.5 py-0.5 rounded-full border border-red-200">
                  🗓️ 連假區間：{formStartDate} ～ {formEndDate} (共 {dayCount} 天)
                </span>
              )}
            </div>

            {/* 常用類別快捷標籤 */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-red-200/60">
              <span className="text-[11px] text-gray-500 font-medium">快捷選取：</span>
              {HOLIDAY_PRESET_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setFormCategory(cat);
                    setIsCustomCategory(false);
                  }}
                  className={`text-[11px] px-2 py-0.5 rounded-full transition cursor-pointer ${
                    formCategory === cat && !isCustomCategory
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-white text-gray-600 hover:bg-red-100/70 border border-red-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </form>

          {/* 快速新增常用國定假日折疊面板 */}
          <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-3.5">
            <button
              type="button"
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="w-full flex items-center justify-between text-xs font-bold text-amber-800 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600" />
                <span>快速匯入/生成常見國定假日</span>
              </div>
              <span className="text-amber-700 text-xs font-normal">
                {showQuickAdd ? '收合 ▲' : '展開展開快速勾選 ▼'}
              </span>
            </button>

            {showQuickAdd && (
              <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-900 font-medium">指定年份：</span>
                  <input
                    type="number"
                    value={quickAddYear}
                    onChange={(e) => setQuickAddYear(Number(e.target.value))}
                    className="w-24 px-2 py-1 border rounded text-xs bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COMMON_TAIWAN_HOLIDAY_TEMPLATES.map((tpl, i) => {
                    const dateStr = `${quickAddYear}-${String(tpl.month).padStart(2, '0')}-${String(tpl.day).padStart(2, '0')}`;
                    const exists = holidays.some((h) => h.date === dateStr);

                    return (
                      <label
                        key={i}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                          exists
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : quickAddSelections[i]
                            ? 'bg-amber-100 border-amber-400 text-amber-900'
                            : 'bg-white border-amber-100 hover:bg-amber-50 text-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={exists}
                          checked={quickAddSelections[i]}
                          onChange={(e) => {
                            const next = [...quickAddSelections];
                            next[i] = e.target.checked;
                            setQuickAddSelections(next);
                          }}
                          className="rounded text-amber-600"
                        />
                        <span className="truncate">
                          {tpl.month}/{tpl.day} {tpl.name}
                        </span>
                        {exists && <span className="text-[10px] text-gray-400 ml-auto">已存在</span>}
                      </label>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleQuickAdd}
                  disabled={isSaving || quickAddSelections.every((v) => !v)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                >
                  確認匯入選取假日
                </Button>
              </div>
            )}
          </div>

          {/* 假日清單總覽 */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                已生效之國定與特定假日 ({holidays.length} 筆)
              </h4>
              <span className="text-xs text-gray-400">系統自動標註於月檢視與週檢視</span>
            </div>

            {holidays.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                目前尚未載入任何假日資訊
              </div>
            ) : (
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {sortedYears.map((year) => (
                  <div key={year} className="space-y-1.5">
                    <div className="text-xs font-bold text-gray-500 bg-gray-100/70 px-3 py-1 rounded-md">
                      {year} 年 ({groupedByYear[year].length} 天)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {groupedByYear[year].map((holiday) => (
                        <div
                          key={holiday.id}
                          className="flex items-center justify-between px-3 py-2 bg-red-50/50 border border-red-100 rounded-lg group text-xs hover:bg-red-50 transition"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-gray-600 shrink-0">{holiday.date}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded font-bold shrink-0 shadow-xs">
                              {holiday.category || (holiday.isStatutory ? '國定假日' : '放假')}
                            </span>
                            <span className="font-semibold text-red-700 truncate">{holiday.name}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                            <button
                              type="button"
                              onClick={() => startEdit(holiday)}
                              className="p-1 text-gray-500 hover:text-blue-600 rounded transition"
                              title="編輯"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(holiday)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                              title="刪除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
