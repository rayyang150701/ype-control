'use client';

import React, { useState, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, BookOpen, ExternalLink, Calendar, Users, Layers } from 'lucide-react';
import { PMLearningCourse } from '@/types/pm-learning';
import { User } from '@/types';
import { createPMLearningCourse, updatePMLearningCourse } from '@/lib/pm-learning-actions';
import { useToast } from '@/hooks/use-toast';

interface CourseFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pmoMembers: User[];
  courseToEdit?: PMLearningCourse | null;
  onSuccess: (course: PMLearningCourse) => void;
  currentUserId?: string;
  defaultAssignedUserId?: string;
}

const CATEGORY_OPTIONS = [
  '專案管理與治理',
  '智慧製造與技術',
  '敏捷方法與協同',
  '跨部門溝通與談判',
  '合約架構與成本管控',
  '品質工程與驗收規範',
];

export function CourseFormDialog({
  isOpen,
  onClose,
  pmoMembers,
  courseToEdit,
  onSuccess,
  currentUserId,
  defaultAssignedUserId,
}: CourseFormDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [instructorOrPlatform, setInstructorOrPlatform] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [externalUrl, setExternalUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [checklistItems, setChecklistItems] = useState<string[]>([
    '觀看完成核心課程章節',
    '繳交學習重點心得或筆記',
    '完成實務情境演練或專案落地驗收',
  ]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // 初始化欄位
  useEffect(() => {
    if (courseToEdit) {
      setTitle(courseToEdit.title);
      setInstructorOrPlatform(courseToEdit.instructorOrPlatform);
      setCategory(courseToEdit.category || CATEGORY_OPTIONS[0]);
      setExternalUrl(courseToEdit.externalUrl || '');
      setStartDate(courseToEdit.startDate || '');
      setEndDate(courseToEdit.endDate || '');
      setDescription(courseToEdit.description || '');
      setAssignedUserIds(courseToEdit.assignedUserIds || []);
      setChecklistItems(
        courseToEdit.defaultChecklist && courseToEdit.defaultChecklist.length > 0
          ? courseToEdit.defaultChecklist
          : ['觀看完成核心課程章節', '繳交學習重點心得或筆記']
      );
    } else {
      setTitle('');
      setInstructorOrPlatform('');
      setCategory(CATEGORY_OPTIONS[0]);
      setExternalUrl('');
      const today = new Date().toISOString().slice(0, 10);
      setStartDate(today);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setEndDate(nextMonth.toISOString().slice(0, 10));
      setDescription('');
      // 預設指派成員 (若從個人工作區新增，預設指派自己；若從團隊新增則全選)
      if (defaultAssignedUserId) {
        setAssignedUserIds([defaultAssignedUserId]);
      } else {
        setAssignedUserIds(pmoMembers.map((m) => m.uid));
      }
      setChecklistItems([
        '觀看完成核心課程章節 1~3',
        '繳交學習重點心得筆記',
        '實機測試或專案應用驗收',
      ]);
    }
  }, [courseToEdit, isOpen, pmoMembers, defaultAssignedUserId]);

  const handleToggleMember = (uid: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleAddChecklist = () => {
    if (!newChecklistText.trim()) return;
    setChecklistItems((prev) => [...prev, newChecklistText.trim()]);
    setNewChecklistText('');
  };

  const handleRemoveChecklist = (index: number) => {
    setChecklistItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: '請填寫課程名稱', variant: 'destructive' });
      return;
    }
    if (!instructorOrPlatform.trim()) {
      toast({ title: '請填寫講師或培訓平台', variant: 'destructive' });
      return;
    }
    if (assignedUserIds.length === 0) {
      toast({ title: '請至少指派一位受訓成員', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const assignedNames = assignedUserIds.map((uid) => {
        const found = pmoMembers.find((m) => m.uid === uid);
        return found?.displayName || found?.email || '成員';
      });

      if (courseToEdit) {
        const res = await updatePMLearningCourse(courseToEdit.id, {
          title: title.trim(),
          instructorOrPlatform: instructorOrPlatform.trim(),
          category,
          externalUrl: externalUrl.trim(),
          startDate,
          endDate,
          description: description.trim(),
          assignedUserIds,
          assignedUserNames: assignedNames,
          defaultChecklist: checklistItems,
        });

        if (res.success && res.data) {
          toast({ title: '課程更新成功', description: `已更新「${title}」` });
          onSuccess(res.data);
          onClose();
        } else {
          toast({ title: '更新失敗', description: res.message, variant: 'destructive' });
        }
      } else {
        const res = await createPMLearningCourse({
          title: title.trim(),
          instructorOrPlatform: instructorOrPlatform.trim(),
          category,
          externalUrl: externalUrl.trim(),
          startDate,
          endDate,
          description: description.trim(),
          assignedUserIds,
          assignedUserNames: assignedNames,
          defaultChecklist: checklistItems,
          initialChecklist: checklistItems,
          createdBy: currentUserId || defaultAssignedUserId || 'user',
        });

        if (res.success && res.data) {
          toast({ title: '課程指派成功', description: `已新增「${title}」並指派成員` });
          onSuccess(res.data);
          onClose();
        } else {
          toast({ title: '建立失敗', description: res.message, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: '操作發生錯誤', description: err?.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold">
                {courseToEdit ? '編輯 PM 培訓課程' : '建立新 PM 培訓課程與指派'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                設定課程核心目標、傳送門連結、排定期程，並指派億威電子 PMO 部門成員。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 課程名稱 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              課程名稱 <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：智慧製造專案管理與四大階段變更控制實務"
              required
            />
          </div>

          {/* 講師 / 平台 與 分類 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                講師 / 培訓平台 <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={instructorOrPlatform}
                onChange={(e) => setInstructorOrPlatform(e.target.value)}
                placeholder="例如：工研院產業學院、Hahow、PMI、內部專案研討"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                課程領域類別
              </Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 外部傳送門連結 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
              外部傳送門連結 (影片 / 線上教室 / 官方教材網址)
            </Label>
            <Input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="例如：https://college.itri.org.tw/... 或 Google 雲端教材連結"
            />
          </div>

          {/* 預計起訖日 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                預計開始日
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                預計完成日 (結訓期限)
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* 指派成員 (限定億威電子 PMO 部門) */}
          <div className="space-y-2 p-3 bg-slate-50 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-indigo-600" />
                指派受訓成員 (限定 億威電子 · PMO專案管理部門)
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-blue-600 hover:text-blue-800"
                  onClick={() => setAssignedUserIds(pmoMembers.map((m) => m.uid))}
                >
                  全選
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-slate-500 hover:text-slate-800"
                  onClick={() => setAssignedUserIds([])}
                >
                  清空
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {pmoMembers.map((member) => {
                const isSelected = assignedUserIds.includes(member.uid);
                return (
                  <label
                    key={member.uid}
                    className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-medium'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleMember(member.uid)}
                    />
                    <div className="truncate">
                      <div className="font-semibold truncate">{member.displayName || member.email}</div>
                      <div className="text-[10px] text-slate-400">億威 · {member.department || 'PMO'}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 預設待辦檢核清單 (Checklist) */}
          <div className="space-y-2 p-3 bg-slate-50 border rounded-lg">
            <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-emerald-600" />
              預設待辦檢核項目 (成員工作區將自動帶出此清單)
            </Label>
            
            <div className="space-y-1.5">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded border text-xs">
                  <span className="text-slate-400 font-mono text-[10px] w-4">{index + 1}.</span>
                  <span className="flex-1 text-slate-700">{item}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklist(index)}
                    className="text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Input
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklist();
                  }
                }}
                placeholder="新增檢核項，例如：「看完第4~6章」、「繳交心得與實作成果」"
                className="text-xs h-8"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddChecklist}
                className="h-8 text-xs shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                新增項目
              </Button>
            </div>
          </div>

          {/* 課程說明 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">課程簡述與核心效益</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="說明此課程在專案管理實務上的目標、期許成員學到的關鍵能力..."
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmitting ? '處理中...' : courseToEdit ? '確認更新課程' : '發佈課程並指派'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
