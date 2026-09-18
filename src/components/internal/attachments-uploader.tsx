'use client';

import * as React from 'react';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  UploadCloud,
  File,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Archive,
  ExternalLink,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Copy,
  Check,
} from 'lucide-react';
import { formatFileSize, getFileCategory, uploadFileToDrive, deleteFileFromDrive } from '@/lib/drive-upload';
import { copyToClipboard } from '@/lib/utils';
import type { ActionItemAttachment } from '@/types';

interface AttachmentsUploaderProps {
  attachments: ActionItemAttachment[];
  onChange: (newAttachments: ActionItemAttachment[]) => void;
  disabled?: boolean;
  onUploadingChange?: (isUploading: boolean) => void;
  onAttachmentUploaded?: (newAttachment: ActionItemAttachment, updatedList: ActionItemAttachment[]) => void;
}

interface UploadTask {
  tempId: string;
  file: File;
  percent: number;
  status: 'requesting_session' | 'uploading' | 'publishing' | 'done' | 'error';
  speedText?: string;
  stageMessage?: string;
  errorMsg?: string;
}

export function AttachmentsUploader({
  attachments,
  onChange,
  disabled = false,
  onUploadingChange,
  onAttachmentUploaded,
}: AttachmentsUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = async (url?: string, name?: string, fileId?: string) => {
    if (!url || url === '#') {
      toast({ title: '無法複製', description: '無效的檔案雲端連結', variant: 'destructive' });
      return;
    }
    const success = await copyToClipboard(url);
    if (success) {
      if (fileId) setCopiedId(fileId);
      setTimeout(() => {
        setCopiedId((prev) => (prev === fileId ? null : prev));
      }, 2000);
      toast({
        title: '已複製雲端分享連結',
        description: name ? `檔案「${name}」的 Google Drive 雲端連結已複製到剪貼簿！` : '雲端連結已複製到剪貼簿！',
      });
    } else {
      toast({
        title: '複製失敗',
        description: '無法存取剪貼簿，請手動複製網址',
        variant: 'destructive',
      });
    }
  };

  // 維護最新 attachments 參照，防止長時間非同步上傳後的 stale closure 造成覆蓋遺失
  const attachmentsRef = useRef(attachments);
  React.useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // 回報上傳狀態給父元件 (控制送出按鈕與提示防呆)
  const isUploadingAny = tasks.some((t) => t.status !== 'done' && t.status !== 'error');
  React.useEffect(() => {
    onUploadingChange?.(isUploadingAny);
  }, [isUploadingAny, onUploadingChange]);

  const handleFiles = async (files: FileList | File[]) => {
    if (disabled || files.length === 0) return;

    const fileList = Array.from(files);
    const newTasks: UploadTask[] = fileList.map((f) => ({
      tempId: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      file: f,
      percent: 0,
      status: 'requesting_session',
      stageMessage: '準備上傳中...',
    }));

    setTasks((prev) => [...prev, ...newTasks]);

    // 平行上傳每個檔案至 Google Drive
    for (const task of newTasks) {
      uploadSingleFile(task);
    }
  };

  const uploadSingleFile = async (task: UploadTask) => {
    try {
      const attachment = await uploadFileToDrive(task.file, (percent, status, info) => {
        setTasks((prev) =>
          prev.map((t) =>
            t.tempId === task.tempId
              ? {
                  ...t,
                  percent,
                  status,
                  speedText: info?.speedText,
                  stageMessage: info?.stageMessage,
                }
              : t
          )
        );
      });

      // 成功完成：使用最新 ref 疊加新附件，排除重複
      const currentList = attachmentsRef.current || [];
      const updatedList = [
        ...currentList.filter((a) => a.id !== attachment.id && a.fileId !== attachment.id),
        attachment,
      ];

      onChange(updatedList);
      onAttachmentUploaded?.(attachment, updatedList);

      // 更新 task 狀態為完成，稍後自動淡出移除
      setTasks((prev) =>
        prev.map((t) =>
          t.tempId === task.tempId
            ? { ...t, percent: 100, status: 'done', stageMessage: '上傳完成！已加入待辦附件' }
            : t
        )
      );

      setTimeout(() => {
        setTasks((prev) => prev.filter((t) => t.tempId !== task.tempId));
      }, 2500);

      toast({
        title: '附件已上傳至雲端硬碟',
        description: `檔案「${task.file.name}」已完成直傳與權限發布。`,
      });
    } catch (err: any) {
      console.error('上傳失敗:', err);
      const msg = err?.message || '上傳失敗，請確認網路或雲端硬碟設定';
      setTasks((prev) =>
        prev.map((t) => (t.tempId === task.tempId ? { ...t, status: 'error', errorMsg: msg } : t))
      );
      toast({
        title: '上傳失敗',
        description: msg,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveAttachment = async (id: string, name?: string) => {
    if (disabled) return;
    // 立即從畫面清單移除，提供無延遲流暢回饋
    onChange(attachments.filter((a) => (a.id !== id && a.fileId !== id)));

    // 同步自 Google 雲端硬碟移至垃圾桶
    try {
      await deleteFileFromDrive(id);
      toast({
        title: '已同步移除附件',
        description: name ? `檔案「${name}」已自雲端硬碟移至垃圾桶。` : '檔案已自雲端硬碟移至垃圾桶。',
      });
    } catch (err) {
      console.warn('雲端硬碟刪除同步失敗:', err);
    }
  };

  const handleDismissTask = (tempId: string) => {
    setTasks((prev) => prev.filter((t) => t.tempId !== tempId));
  };

  const renderFileIcon = (mimeType: string, name: string) => {
    const cat = getFileCategory(mimeType, name);
    switch (cat) {
      case 'image':
        return <ImageIcon className="h-4 w-4 text-sky-600 shrink-0" />;
      case 'pdf':
        return <FileText className="h-4 w-4 text-rose-600 shrink-0" />;
      case 'sheet':
        return <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />;
      case 'doc':
        return <FileText className="h-4 w-4 text-blue-600 shrink-0" />;
      case 'archive':
        return <Archive className="h-4 w-4 text-amber-600 shrink-0" />;
      default:
        return <File className="h-4 w-4 text-slate-500 shrink-0" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold flex items-center gap-1.5 h-5 text-slate-800">
          <Paperclip className="h-3.5 w-3.5 text-slate-500" />
          <span>待辦事項附件 (Google Drive 直傳)</span>
          {attachments.length > 0 && (
            <span className="text-[11px] font-normal text-muted-foreground ml-1">
              ({attachments.length} 個附件)
            </span>
          )}
        </label>
        <span className="text-[10px] text-muted-foreground">
          避開 4.5MB 限制 · 不限檔案數
        </span>
      </div>

      {/* 拖曳上傳放置區 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (!disabled && e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => {
          if (!disabled && fileInputRef.current) {
            fileInputRef.current.click();
          }
        }}
        className={`relative border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/50'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 bg-slate-50/30'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <div className="flex flex-col items-center justify-center gap-1 py-1">
          <UploadCloud className="h-6 w-6 text-slate-400" />
          <p className="text-xs text-slate-700 font-medium">
            點擊此處選擇檔案，或將檔案拖曳至此 (可多選)
          </p>
          <p className="text-[10px] text-slate-400">
            支援所有檔案格式 (PDF、圖檔、Excel、ZIP 等)，檔案將直傳至專屬 Google 雲端資料夾
          </p>
        </div>
      </div>

      {/* 正在上傳中的任務清單 */}
      {tasks.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {tasks.map((task) => (
            <div
              key={task.tempId}
              className="border border-slate-200 rounded-md p-2.5 bg-white text-xs space-y-1.5 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                  {task.status === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                  ) : task.status === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                  )}
                  <span className="truncate font-medium text-slate-800" title={task.file.name}>{task.file.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                    ({formatFileSize(task.file.size)})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {task.speedText && task.status === 'uploading' && (
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono font-medium">
                      {task.speedText}
                    </span>
                  )}
                  <span className="text-[11px] font-mono font-semibold text-slate-600">
                    {task.status === 'requesting_session' && '準備中...'}
                    {task.status === 'uploading' && `${task.percent}%`}
                    {task.status === 'publishing' && `${task.percent}% (雲端儲存中)`}
                    {task.status === 'done' && '完成'}
                    {task.status === 'error' && '失敗'}
                  </span>
                  {task.status === 'error' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-slate-400 hover:text-slate-600"
                      onClick={() => handleDismissTask(task.tempId)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              </div>

              {task.status !== 'error' && (
                <Progress
                  value={task.percent}
                  className="h-2 bg-slate-100 rounded-full overflow-hidden"
                  indicatorClassName={
                    task.status === 'done'
                      ? 'bg-emerald-500'
                      : task.status === 'publishing'
                      ? 'bg-indigo-500 animate-pulse'
                      : 'bg-blue-600 transition-all duration-300'
                  }
                />
              )}

              {task.stageMessage && task.status !== 'done' && task.status !== 'error' && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping shrink-0" />
                  <span className="truncate">{task.stageMessage}</span>
                </div>
              )}

              {task.status === 'publishing' && task.file.size > 10 * 1024 * 1024 && (
                <div className="text-[10.5px] text-amber-800 bg-amber-50/80 p-1.5 rounded border border-amber-200/60 leading-normal">
                  💡 20MB 以上大檔案，Google Drive 正在進行雲端轉碼與分享權限設定（約需 5~10 秒），完成後將自動加入列表。
                </div>
              )}

              {task.errorMsg && (
                <p className="text-[11px] text-rose-600 leading-tight bg-rose-50 p-1.5 rounded">
                  {task.errorMsg}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 已完成上傳的附件清單 */}
      {attachments.length > 0 && (
        <div className="space-y-1 pt-1 max-h-48 overflow-y-auto pr-0.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between gap-2 p-2 rounded-md bg-slate-50/80 border border-slate-200 text-xs hover:bg-slate-100/60 transition-colors"
            >
              <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                {renderFileIcon(att.mimeType, att.name)}
                <span className="truncate font-medium text-slate-800" title={att.name}>
                  {att.name}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {formatFileSize(att.size)}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-slate-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
                  onClick={() => {
                    const shareUrl = att.webViewLink || att.webContentLink || (att.id || att.fileId ? `https://drive.google.com/file/d/${att.id || att.fileId}/view` : '');
                    handleCopyLink(shareUrl, att.name, att.id || att.fileId);
                  }}
                  title="複製此檔案的 Google 雲端分享連結 (其他人無登入權限亦可下載/檢視)"
                >
                  {copiedId === (att.id || att.fileId) ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">已複製</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 text-slate-500" />
                      <span>複製連結</span>
                    </>
                  )}
                </Button>

                {att.webViewLink && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
                    asChild
                  >
                    <a href={att.webViewLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                      檢視
                    </a>
                  </Button>
                )}

                {att.webContentLink && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px] text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 gap-1"
                    asChild
                  >
                    <a href={att.webContentLink} target="_blank" rel="noopener noreferrer">
                      <Download className="h-3 w-3" />
                      下載
                    </a>
                  </Button>
                )}

                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    onClick={() => handleRemoveAttachment(att.id || att.fileId || '', att.name)}
                    title="移除此附件並移至雲端硬碟垃圾桶"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
