'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Download } from 'lucide-react';
import type { ProgressLog } from '@/types';
import { exportHistoryToExcel } from '@/lib/export-history';

interface ProgressHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subProjectName: string;
  projectCaseNumber: string;
  projectId: string;
  subProjectId: string;
}

export function ProgressHistoryDialog({
  open, onOpenChange, subProjectName, projectCaseNumber, projectId, subProjectId,
}: ProgressHistoryDialogProps) {
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && projectId && subProjectId) {
      loadLogs();
    }
  }, [open, projectId, subProjectId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/progress-logs?projectId=${projectId}&subProjectId=${subProjectId}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('載入歷史週報失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{subProjectName} - 歷史週報</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{projectCaseNumber} {subProjectName}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => exportHistoryToExcel(logs, subProjectName, projectCaseNumber)} disabled={logs.length === 0}>
              <Download className="h-3 w-3" /> 匯出歷史紀錄
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">載入中...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">尚無歷史週報</div>
          ) : (
            <div className="relative pl-6 space-y-0">
              {/* Timeline line */}
              <div className="absolute left-2.5 top-3 bottom-3 w-0.5 bg-blue-200" />

              {logs.map((log, index) => (
                <div key={log.id} className="relative pb-6">
                  {/* Timeline dot */}
                  <div className="absolute -left-3.5 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />

                  <div className="ml-4 border rounded-lg p-4 bg-white shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-blue-600">
                        {log.reportingPeriod || formatDate(log.updatedAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(log.updatedAt)} by {log.createdByName || log.createdBy}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="font-medium text-muted-foreground mb-0.5">本週摘要</p>
                        <p className="whitespace-pre-line">{log.executionSummary || '—'}</p>
                      </div>
                      {log.nextWeekPlan && (
                        <div>
                          <p className="font-medium text-muted-foreground mb-0.5">下週計畫</p>
                          <p className="whitespace-pre-line">{log.nextWeekPlan}</p>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-muted-foreground mb-0.5">問題 / 風險</p>
                        <p className={`whitespace-pre-line ${log.roadblocks && log.roadblocks !== '無' ? 'text-red-600 bg-red-50 p-2 rounded' : ''}`}>
                          {log.roadblocks || '無'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-muted-foreground">完成度:</span>
                        <span className="font-bold">{log.completionPercentage}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="destructive" onClick={() => onOpenChange(false)}>關閉</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${formatDate(dateStr)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
