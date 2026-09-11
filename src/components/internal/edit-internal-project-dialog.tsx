'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { updateInternalProject } from '@/lib/actions';
import { Edit2, Calendar } from 'lucide-react';
import type { FullProject, User } from '@/types';

interface EditInternalProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: FullProject | null;
  users?: User[];
  onSuccess: (updatedProject: any) => void;
}

export function EditInternalProjectDialog({
  open,
  onOpenChange,
  project,
  users = [],
  onSuccess,
}: EditInternalProjectDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [category, setCategory] = useState<'評估案' | '已開案'>('評估案');
  const [internalStatus, setInternalStatus] = useState<'in_progress' | 'completed' | 'terminated'>('in_progress');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [tpmOfficeContact, setTpmOfficeContact] = useState('');
  const [projectPurpose, setProjectPurpose] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setCaseNumber(project.caseNumber || '');
      const cat = project.projectCategory || (project.status === 'poc' ? '評估案' : '已開案');
      setCategory(cat);
      const st = project.internalStatus || (project.status === 'completed' ? 'completed' : (project.status === 'cancelled' ? 'terminated' : 'in_progress'));
      setInternalStatus(st);
      setExpectedCompletionDate(project.expectedCompletionDate || '');
      setTpmOfficeContact(project.tpmOfficeContact || '');
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
        expectedCompletionDate: expectedCompletionDate || null,
        tpmOfficeContact,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Edit2 className="h-5 w-5 text-indigo-600" />
            編輯內部專案設定
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            可調整專案名稱、案號、分類（評估案/已開案）、狀態、以及專案層級預估完成日。
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 專案類別切換 */}
          <div>
            <Label className="text-xs font-semibold">專案類別 *</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setCategory('評估案')}
                className={`py-2 px-3 rounded-md text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  category === '評估案'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>📝 評估案 (POC / 前期)</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('已開案')}
                className={`py-2 px-3 rounded-md text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  category === '已開案'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>🚀 已開案 (正式執行)</span>
              </button>
            </div>
          </div>

          {/* 專案生命週期狀態 */}
          <div>
            <Label className="text-xs font-semibold">專案生命週期狀態 *</Label>
            <Select value={internalStatus} onValueChange={(val: any) => setInternalStatus(val)}>
              <SelectTrigger className="mt-1 text-xs">
                <SelectValue placeholder="請選擇專案狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_progress">⏳ 進行中 / 評估中</SelectItem>
                <SelectItem value="completed">✅ 已結案 (手動完成)</SelectItem>
                <SelectItem value="terminated">⛔ 專案終止 (不繼續執行)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 專案名稱 */}
          <div>
            <Label className="text-xs font-semibold">專案名稱 *</Label>
            <Input
              className="mt-1 text-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* 案號代碼與負責人 */}
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
              <Label className="text-xs font-semibold">內部負責人 / TPM窗口</Label>
              {users.length > 0 ? (
                <Select value={tpmOfficeContact} onValueChange={setTpmOfficeContact}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="請選擇成員" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    <SelectItem value="未指定">-- 暫不指定 --</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.uid} value={u.displayName || u.email}>
                        {u.displayName} ({u.role === 'admin' ? '管理員' : '成員'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="mt-1 text-xs"
                  placeholder="例如：徐智宏、Winona"
                  value={tpmOfficeContact}
                  onChange={(e) => setTpmOfficeContact(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* 專案預估完成日期 */}
          <div>
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                專案預估完成日期 (選填，綁定整個專案)
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
              className="mt-1 text-xs"
              value={expectedCompletionDate}
              onChange={(e) => setExpectedCompletionDate(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              設定此專案整體的目標交付日，專案卡片將會自動計算剩餘天數或逾期天數。
            </p>
          </div>

          {/* 專案目的說明 */}
          <div>
            <Label className="text-xs font-semibold">專案目的 / 說明 (選填)</Label>
            <Textarea
              className="mt-1 min-h-[70px] text-xs"
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
              {isSubmitting ? '儲存中...' : '儲存變更'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
