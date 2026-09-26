'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { AttachmentsUploader } from '@/components/internal/attachments-uploader';
import { useToast } from '@/hooks/use-toast';
import { createActionItem } from '@/lib/actions';
import { KM_CATEGORIES, KMDocumentCategory } from '@/lib/km-helper';
import { MAJOR_PHASES } from '@/lib/phase-constants';
import type { FullProject, ActionItemAttachment, ProjectActionItem } from '@/types';
import { UploadCloud, Check, FileText } from 'lucide-react';

interface UploadKMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: FullProject[];
  defaultProjectId?: string;
  onSuccess: (newActionItem: ProjectActionItem) => void;
}

export function UploadKMDialog({
  open,
  onOpenChange,
  projects,
  defaultProjectId,
  onSuccess,
}: UploadKMDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 專案選擇 (可打字搜尋)
  const [selectedProjectValue, setSelectedProjectValue] = useState<string>(
    () => {
      if (defaultProjectId) {
        const found = projects.find((p) => p.id === defaultProjectId);
        return found ? `[${found.caseNumber || '未編號'}] ${found.name}` : '';
      }
      return projects.length > 0
        ? `[${projects[0].caseNumber || '未編號'}] ${projects[0].name}`
        : '';
    }
  );

  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<KMDocumentCategory>('training');
  const [phase, setPhase] = useState('1.4 驗收階段');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<ActionItemAttachment[]>([]);

  // 專案下拉可搜尋選項
  const projectComboboxOptions = projects.map((p) => ({
    value: `[${p.caseNumber || '未編號'}] ${p.name}`,
    label: `[${p.caseNumber || '未編號'}] ${p.name}`,
    hint: p.clientName || '燁輝',
  }));

  // 找到當前選取的專案實體
  const matchedProject = projects.find(
    (p) =>
      `[${p.caseNumber || '未編號'}] ${p.name}` === selectedProjectValue ||
      p.id === selectedProjectValue
  );

  const handleCategoryChange = (val: KMDocumentCategory) => {
    setDocCategory(val);
    // 依類別自動預填最符合的專案階段，省去手動調整
    if (val === 'training') setPhase('1.4.1 教育訓練');
    else if (val === 'acceptance') setPhase('1.4.2 驗收結案');
    else if (val === 'quotation') setPhase('1.1.2 報價');
    else if (val === 'specification') setPhase('1.1 設計階段');
    else if (val === 'meeting') setPhase('1.2 施工階段');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedProject) {
      toast({ title: '請選擇所屬專案', description: '請由清單搜尋並選擇欲歸檔之專案', variant: 'destructive' });
      return;
    }
    if (!docTitle.trim()) {
      toast({ title: '請輸入文件名稱或主旨', variant: 'destructive' });
      return;
    }
    if (attachments.length === 0) {
      toast({ title: '尚未上傳檔案', description: '請至少上傳一份文件檔案', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedCatMeta = KM_CATEGORIES.find((c) => c.key === docCategory);
      const catPrefix = selectedCatMeta ? `[${selectedCatMeta.shortLabel}] ` : '';
      const finalTitle = docTitle.startsWith('[') ? docTitle : `${catPrefix}${docTitle}`;

      const res = await createActionItem({
        projectId: matchedProject.id,
        title: finalTitle,
        phase: phase || '1.4 驗收階段',
        status: 'completed', // KM 歸檔文件預設為已完成狀態
        owner: 'KM知識庫',
        waitingOn: '',
        notes: notes ? `【KM分類：${selectedCatMeta?.label}】\n${notes}` : `【KM分類：${selectedCatMeta?.label}】`,
        attachments,
      });

      if (res.success && res.data) {
        toast({
          title: '文件已成功歸檔至專案 KM',
          description: `「${docTitle}」(${attachments.length} 個附件) 已同步建檔於專案 ${matchedProject.name}`,
        });
        onSuccess(res.data as any);
        onOpenChange(false);
        // 清空表單
        setDocTitle('');
        setNotes('');
        setAttachments([]);
      } else {
        toast({ title: '歸檔失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '上傳異常', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-indigo-600" />
            <DialogTitle className="text-xl font-bold">上傳新專案 KM 文件</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            上傳教育訓練教材、設計圖面、報價單或驗收報告至 Google Drive，系統將自動納入專案 KM 知識檢索庫。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* 1. 所屬專案 (支援可搜尋輸入) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>所屬專案 * (可輸入關鍵字或案號搜尋)</span>
              {matchedProject && (
                <span className="text-[11px] text-indigo-600 font-medium">
                  已選定：{matchedProject.name}
                </span>
              )}
            </Label>
            <SearchableCombobox
              value={selectedProjectValue}
              onChange={setSelectedProjectValue}
              options={projectComboboxOptions}
              placeholder="輸入專案名稱或案號搜尋..."
              className="text-xs"
            />
          </div>

          {/* 2. 文件主題與文件類別 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">
                文件名稱 / 主旨 *
              </Label>
              <Input
                placeholder="例如：雙鏡頭操作說明手冊、教育訓練簡報..."
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">
                文件類別 (KM 分類標籤) *
              </Label>
              <Select value={docCategory} onValueChange={(v) => handleCategoryChange(v as KMDocumentCategory)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KM_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.key} value={cat.key} className="text-xs">
                      <span className="mr-1.5">{cat.icon}</span>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 3. 關聯專案階段 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">
              關聯專案階段 (自動建立待辦歷程歸檔)
            </Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.1 設計階段">1.1 設計階段 (整體)</SelectItem>
                <SelectItem value="1.1.1 評估">　↳ 1.1.1 評估</SelectItem>
                <SelectItem value="1.1.2 報價">　↳ 1.1.2 報價</SelectItem>
                <SelectItem value="1.1.3 簽呈">　↳ 1.1.3 簽呈</SelectItem>
                <SelectItem value="1.2 施工階段">1.2 施工階段</SelectItem>
                <SelectItem value="1.3 驗證階段">1.3 驗證階段</SelectItem>
                <SelectItem value="1.4 驗收階段">1.4 驗收階段 (整體)</SelectItem>
                <SelectItem value="1.4.1 教育訓練">　↳ 1.4.1 教育訓練</SelectItem>
                <SelectItem value="1.4.2 驗收結案">　↳ 1.4.2 驗收結案</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 4. 文件內容描述 / 備註 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">
              文件備註 / 關鍵字說明 (選填)
            </Label>
            <Textarea
              placeholder="可輸入相關關鍵字、版本號、操作說明或適用對象，方便日後搜尋..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs min-h-[60px]"
            />
          </div>

          {/* 5. 檔案上傳元件 (拖曳上傳至 Google Drive) */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold text-slate-800">
              檔案上傳 (支援 PDF / PPT / Word / Excel / 圖檔 / 壓縮檔) *
            </Label>
            <AttachmentsUploader
              attachments={attachments}
              onChange={setAttachments}
              onUploadingChange={setIsUploading}
            />
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isUploading}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploading || attachments.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
            >
              <Check className="h-4 w-4 mr-1.5" />
              {isSubmitting ? '歸檔儲存中...' : isUploading ? '檔案上傳中...' : '確認歸檔至專案 KM'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
