'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RotateCcw,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import {
  savePMLearningCategories,
  renamePMLearningCategory,
  deletePMLearningCategory,
} from '@/lib/pm-learning-actions';
import { PMLearningCourse, DEFAULT_PM_CATEGORIES } from '@/types/pm-learning';
import { useToast } from '@/hooks/use-toast';

interface CategoryManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  courses: PMLearningCourse[];
  onCategoriesChange: (newCategories: string[]) => void;
  onCoursesUpdated?: () => void;
}

export function CategoryManagerDialog({
  isOpen,
  onClose,
  categories,
  courses,
  onCategoriesChange,
  onCoursesUpdated,
}: CategoryManagerDialogProps) {
  const { toast } = useToast();
  const [newCatName, setNewCatName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 計算每個領域有多少門課程使用
  const categoryCourseCountMap = React.useMemo(() => {
    const map = new Map<string, number>();
    courses.forEach((c) => {
      const cat = c.category?.trim();
      if (cat) {
        map.set(cat, (map.get(cat) || 0) + 1);
      }
    });
    return map;
  }, [courses]);

  // 新增領域
  const handleAddCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      toast({ title: '請輸入領域名稱', variant: 'destructive' });
      return;
    }
    if (categories.includes(trimmed)) {
      toast({ title: '該領域名稱已存在', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = [...categories, trimmed];
      const res = await savePMLearningCategories(updated);
      if (res.success) {
        toast({ title: '新增成功', description: `已加入「${trimmed}」課程領域` });
        onCategoriesChange(updated);
        setNewCatName('');
      } else {
        toast({ title: '新增失敗', description: res.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: '發生錯誤', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 開始編輯某個領域
  const handleStartEdit = (index: number, currentName: string) => {
    setEditingIndex(index);
    setEditingValue(currentName);
  };

  // 取消編輯
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  // 確認編輯重新命名
  const handleSaveRename = async (oldName: string) => {
    const newTrimmed = editingValue.trim();
    if (!newTrimmed) {
      toast({ title: '領域名稱不可為空', variant: 'destructive' });
      return;
    }
    if (newTrimmed === oldName) {
      handleCancelEdit();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await renamePMLearningCategory(oldName, newTrimmed);
      if (res.success) {
        toast({ title: '重新命名成功', description: res.message });
        const updated = categories.map((c) => (c === oldName ? newTrimmed : c));
        onCategoriesChange(updated);
        handleCancelEdit();
        if (onCoursesUpdated) onCoursesUpdated();
      } else {
        toast({ title: '修改失敗', description: res.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: '發生錯誤', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 刪除領域
  const handleDelete = async (categoryName: string) => {
    const count = categoryCourseCountMap.get(categoryName) || 0;
    const confirmMsg =
      count > 0
        ? `目前有 ${count} 門課程正在使用「${categoryName}」領域，確定要自選單中移除嗎？（既有課程仍會保留此文字）`
        : `確定要刪除「${categoryName}」領域嗎？`;

    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      const res = await deletePMLearningCategory(categoryName);
      if (res.success) {
        toast({ title: '已移除領域', description: `已移除「${categoryName}」` });
        const updated = categories.filter((c) => c !== categoryName);
        onCategoriesChange(updated);
      } else {
        toast({ title: '刪除失敗', description: res.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: '發生錯誤', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 一鍵恢復預設 6 大領域
  const handleRestoreDefaults = async () => {
    if (!window.confirm('確定要將課程領域重設回系統預設的 6 大領域分類嗎？')) return;
    setIsSubmitting(true);
    try {
      const res = await savePMLearningCategories(DEFAULT_PM_CATEGORIES);
      if (res.success) {
        toast({ title: '已重設為預設領域', description: '已恢復系統預設之 6 大核心領域' });
        onCategoriesChange(DEFAULT_PM_CATEGORIES);
      }
    } catch (e: any) {
      toast({ title: '發生錯誤', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Tag className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold">
                維護與編輯「課程領域」
              </DialogTitle>
              <DialogDescription className="text-xs">
                新增自訂培訓領域、重新命名現有名稱（將自動連動所有課程）或刪除舊領域。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
          {/* 快速新增區 */}
          <div className="p-3 bg-slate-50 border rounded-xl space-y-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              快速新增自訂領域類別
            </span>
            <div className="flex gap-2">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                placeholder="例如：工廠自動化通訊、資安與合規、AI實務應用..."
                className="text-xs h-9 bg-white"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                onClick={handleAddCategory}
                disabled={isSubmitting || !newCatName.trim()}
                className="h-9 px-3.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                新增領域
              </Button>
            </div>
          </div>

          {/* 既有領域清單 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
              <span>現有領域清單 ({categories.length} 個類別)</span>
              <button
                type="button"
                onClick={handleRestoreDefaults}
                disabled={isSubmitting}
                className="text-[11px] text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                title="恢復系統預設的 6 大領域"
              >
                <RotateCcw className="h-3 w-3" />
                <span>恢復預設類別</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {categories.map((cat, index) => {
                const count = categoryCourseCountMap.get(cat) || 0;
                const isEditing = editingIndex === index;

                return (
                  <div
                    key={cat}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                      isEditing
                        ? 'bg-blue-50/70 border-blue-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveRename(cat);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                          className="h-8 text-xs bg-white flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(cat)}
                          className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                          title="儲存並同步更新關聯課程"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="p-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors"
                          title="取消"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-semibold text-slate-800 truncate">
                            {cat}
                          </span>
                          {count > 0 ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-slate-50 text-slate-500 border-slate-200"
                            >
                              <BookOpen className="h-2.5 w-2.5 mr-1 text-slate-400" />
                              {count} 門課程
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-slate-400">(無課程使用)</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(index, cat)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="重新命名此領域"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cat)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="刪除此領域"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100 flex justify-between items-center">
          <span className="text-[11px] text-slate-400">
            修改後會即時同步至所有選單與篩選項目
          </span>
          <Button type="button" onClick={onClose} className="h-8 text-xs font-semibold">
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
