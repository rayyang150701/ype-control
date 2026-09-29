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
import { CalendarDays, Plus, Trash2, Edit, Zap, Check } from 'lucide-react';
import { Holiday } from '@/types/businessTrip';
import { saveHoliday, deleteHoliday } from '@/lib/actions';
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
  { month: 10, day: 10, name: '國慶日' },
];

export function HolidayManagementDialog({
  open,
  onOpenChange,
  holidays,
  currentYear,
  onHolidaysChange,
}: HolidayManagementDialogProps) {
  const { toast } = useToast();
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('國定假日');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddYear, setQuickAddYear] = useState(currentYear);
  const [quickAddSelections, setQuickAddSelections] = useState<boolean[]>(
    COMMON_TAIWAN_HOLIDAY_TEMPLATES.map(() => false)
  );
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setEditingHoliday(null);
    setFormDate('');
    setFormName('');
    setFormCategory('國定假日');
    setIsCustomCategory(false);
  };

  const startEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormDate(holiday.date);
    setFormName(holiday.name);
    const cat = holiday.category || (holiday.isStatutory ? '國定假日' : '公司假');
    setFormCategory(cat);
    setIsCustomCategory(!HOLIDAY_PRESET_CATEGORIES.includes(cat));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = formCategory.trim() || '國定假日';
    if (!formDate || !formName.trim()) {
      toast({
        variant: 'destructive',
        title: '欄位未齊全',
        description: '請填寫日期與假日名稱',
      });
      return;
    }

    try {
      setIsSaving(true);
      const isStatutory = finalCategory === '國定假日' || editingHoliday?.isStatutory || false;
      const res = await saveHoliday({
        id: editingHoliday?.id || `h-${formDate}-${Date.now().toString().slice(-4)}`,
        date: formDate,
        name: formName.trim(),
        category: finalCategory,
        isStatutory,
      });

      if (res.success) {
        toast({ title: '儲存成功', description: res.message });
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
              <div className="sm:col-span-3">
                <Label className="text-xs font-semibold text-gray-600">日期</Label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 border rounded-lg text-sm bg-white"
                  required
                />
              </div>
              <div className="sm:col-span-3">
                <Label className="text-xs font-semibold text-gray-600">放假類別</Label>
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
              <div className="sm:col-span-4">
                <Label className="text-xs font-semibold text-gray-600">假日名稱</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例：廠區年度歲修、元旦"
                  className="mt-1 h-9 text-sm"
                  required
                />
              </div>
              <div className="sm:col-span-2 flex gap-1.5">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="w-full bg-red-600 hover:bg-red-700 text-white text-xs h-9"
                >
                  {editingHoliday ? '更新' : '新增'}
                </Button>
                {editingHoliday && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                    className="text-xs h-9"
                  >
                    取消
                  </Button>
                )}
              </div>
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
