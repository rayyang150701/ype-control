'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createPocProject } from '@/lib/actions';
import { FolderPlus } from 'lucide-react';

interface NewPocProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newProject?: any) => void;
}

export function NewPocProjectDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewPocProjectDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [tpmOfficeContact, setTpmOfficeContact] = useState('');
  const [projectPurpose, setProjectPurpose] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: '請輸入專案名稱', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createPocProject({
        name,
        caseNumber: caseNumber || undefined,
        tpmOfficeContact,
        projectPurpose,
      });

      if (res.success) {
        toast({ title: '建立成功', description: `內部專案「${name}」已建立！` });
        setName('');
        setCaseNumber('');
        setTpmOfficeContact('');
        setProjectPurpose('');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <FolderPlus className="h-5 w-5 text-purple-600" />
            新增內部專案 / POC 評估項目
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            此專案僅供內部管制作業與待辦追蹤，<span className="text-purple-700 font-medium">不會出現在燁輝客戶端的進度管制總表</span>。
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-semibold">專案名稱 (POC / 新評估) *</Label>
            <Input
              className="mt-1"
              placeholder="例如：POC-堆高機雙鏡頭自主防撞評估"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">案號 / 代號 (選填)</Label>
              <Input
                className="mt-1"
                placeholder="例如：POC-01 (未填自動產生)"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">TPM 窗口 / 負責人 (選填)</Label>
              <Input
                className="mt-1"
                placeholder="例如：徐智宏、Winona"
                value={tpmOfficeContact}
                onChange={(e) => setTpmOfficeContact(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">專案目的 / 評估說明 (選填)</Label>
            <Textarea
              className="mt-1 min-h-[70px] text-xs"
              placeholder="簡要描述此 POC 評估案的目標、可行性驗證重點..."
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
