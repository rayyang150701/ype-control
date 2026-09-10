'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createActionItem, updateActionItem } from '@/lib/actions';
import type { ProjectActionItem, FullProject, ActionItemPhase, ActionItemStatus } from '@/types';

interface ActionItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ProjectActionItem | null;
  defaultProjectId?: string;
  projects: FullProject[];
  onSuccess: () => void;
}

const PHASES: ActionItemPhase[] = [
  '評估階段',
  '報價/設計',
  '簽呈核決',
  '開發/施工',
  '驗證測試',
  '驗收結案',
];

export function ActionItemDialog({
  open,
  onOpenChange,
  item,
  defaultProjectId,
  projects,
  onSuccess,
}: ActionItemDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [projectId, setProjectId] = useState(item?.projectId || defaultProjectId || '');
  const [title, setTitle] = useState(item?.title || '');
  const [phase, setPhase] = useState<ActionItemPhase>(item?.phase || '開發/施工');
  const [status, setStatus] = useState<ActionItemStatus>(item?.status || 'pending');
  const [owner, setOwner] = useState(item?.owner || '');
  const [waitingOn, setWaitingOn] = useState(item?.waitingOn || '');
  const [dueDate, setDueDate] = useState(item?.dueDate ? item.dueDate.slice(0, 10) : '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [lessonLearnt, setLessonLearnt] = useState(item?.lessonLearnt || '');

  useEffect(() => {
    if (open) {
      if (item) {
        setProjectId(item.projectId);
        setTitle(item.title);
        setPhase(item.phase);
        setStatus(item.status);
        setOwner(item.owner || '');
        setWaitingOn(item.waitingOn || '');
        setDueDate(item.dueDate ? item.dueDate.slice(0, 10) : '');
        setNotes(item.notes || '');
        setLessonLearnt(item.lessonLearnt || '');
      } else {
        setProjectId(defaultProjectId || (projects[0]?.id || ''));
        setTitle('');
        setPhase('開發/施工');
        setStatus('pending');
        setOwner('');
        setWaitingOn('');
        setDueDate('');
        setNotes('');
        setLessonLearnt('');
      }
    }
  }, [open, item, defaultProjectId, projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: '請輸入事項標題', variant: 'destructive' });
      return;
    }
    if (!projectId) {
      toast({ title: '請選擇所屬專案', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (item?.id) {
        const res = await updateActionItem(item.id, {
          title,
          phase,
          status,
          owner,
          waitingOn,
          dueDate: dueDate || null,
          notes,
          lessonLearnt,
        });
        if (res.success) {
          toast({ title: '更新成功', description: '待辦歷程已成功儲存' });
          onSuccess();
          onOpenChange(false);
        } else {
          toast({ title: '更新失敗', description: res.message, variant: 'destructive' });
        }
      } else {
        const res = await createActionItem({
          projectId,
          title,
          phase,
          status,
          owner,
          waitingOn,
          dueDate: dueDate || null,
          notes,
          lessonLearnt,
        });
        if (res.success) {
          toast({ title: '新增成功', description: '待辦事項已建立' });
          onSuccess();
          onOpenChange(false);
        } else {
          toast({ title: '新增失敗', description: res.message, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: '操作失敗', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {item ? '編輯專案待辦與歷程' : '新增專案待辦與歷程'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 所屬專案 */}
          <div>
            <Label className="text-sm font-semibold">所屬專案 *</Label>
            <Select value={projectId} onValueChange={setProjectId} disabled={!!item}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="請選擇專案" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    [{p.caseNumber}] {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 事項標題 */}
          <div>
            <Label className="text-sm font-semibold">事項 / 事件名稱 *</Label>
            <Input
              className="mt-1"
              placeholder="例如：廠商億威提供雙鏡頭報價、簽呈核決會勘、停電施工..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* 階段與狀態 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">專案階段</Label>
              <Select value={phase} onValueChange={(val) => setPhase(val as ActionItemPhase)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-semibold">目前狀態</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as ActionItemStatus)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ 待處理 (Pending)</SelectItem>
                  <SelectItem value="in_progress">🔄 處理中 (In Progress)</SelectItem>
                  <SelectItem value="blocked">🚨 等候卡關中 (Blocked)</SelectItem>
                  <SelectItem value="completed">✅ 已完成 (Done)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 等誰處理 & 內部負責人 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold text-rose-600">
                目前等誰處理 (卡關跟催對象)
              </Label>
              <Input
                className="mt-1 border-rose-300 focus:border-rose-500"
                placeholder="例如：等億威報價、等採購議價、等資訊部課長核簽"
                value={waitingOn}
                onChange={(e) => setWaitingOn(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-sm font-semibold">內部負責人 (PM / 窗口)</Label>
              <Input
                className="mt-1"
                placeholder="例如：徐智宏、Winona"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
          </div>

          {/* 預計完成日 */}
          <div>
            <Label className="text-sm font-semibold">預計完成日 (跟催基準點)</Label>
            <Input
              type="date"
              className="mt-1"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* 歷程紀錄說明 */}
          <div>
            <Label className="text-sm font-semibold">歷程紀錄 / 說明</Label>
            <Textarea
              className="mt-1 min-h-[70px]"
              placeholder="記錄事件經過、會議結論、重要溝通紀錄..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* 經驗檢討 (Lesson Learnt) */}
          <div className="rounded-md bg-amber-50/60 p-3 border border-amber-200">
            <Label className="text-sm font-semibold text-amber-900">
              💡 經驗檢討與改善對策 (Lesson Learnt)
            </Label>
            <Textarea
              className="mt-1 min-h-[60px] bg-white"
              placeholder="結案或里程碑檢討：未來遇類似專案可採取的改善對策..."
              value={lessonLearnt}
              onChange={(e) => setLessonLearnt(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '儲存中...' : item ? '確認更新' : '建立待辦'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
