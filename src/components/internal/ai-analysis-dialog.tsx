'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, AlertTriangle, CheckCircle2, Clock, Users, Lightbulb, RefreshCw } from 'lucide-react';

interface AIAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projectName?: string;
}

interface AnalysisData {
  projectTitle: string;
  totalItems: number;
  completedCount: number;
  pendingCount: number;
  blockedCount: number;
  totalDelayedDays: number;
  delayedItemsCount: number;
  topDelayReasons: string[];
  bottlenecks: Array<{
    party: string;
    count: number;
    delayedDays: number;
    status: string;
  }>;
  lessonsLearnedSummary: string;
  actionableAdvice: string;
}

export function AIAnalysisDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: AIAnalysisDialogProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisData | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/analyze-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      if (json.success && json.analysis) {
        setData(json.analysis);
      }
    } catch (err) {
      console.error('執行 AI 分析失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      runAnalysis();
    }
  }, [open, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-primary">
              <Bot className="h-6 w-6 text-indigo-600" />
              AI 專案延誤診斷與歷程分析
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={runAnalysis}
              disabled={loading}
              className="gap-1 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              重新分析
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            分析標的：{projectName || data?.projectTitle || '全部列管專案'}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-muted-foreground">
              AI 正在盤點專案歷程、計算延遲天數與歸納卡關熱點...
            </p>
          </div>
        ) : data ? (
          <div className="space-y-4 pt-2">
            {/* 核心指標卡片 */}
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg border bg-slate-50 p-2.5 text-center">
                <div className="text-xs text-muted-foreground">總待辦歷程</div>
                <div className="text-lg font-bold text-slate-800">{data.totalItems} 項</div>
              </div>
              <div className="rounded-lg border bg-rose-50 p-2.5 text-center border-rose-200">
                <div className="text-xs text-rose-700">累計延誤天數</div>
                <div className="text-lg font-bold text-rose-600">{data.totalDelayedDays} 天</div>
              </div>
              <div className="rounded-lg border bg-amber-50 p-2.5 text-center border-amber-200">
                <div className="text-xs text-amber-700">卡關等候中</div>
                <div className="text-lg font-bold text-amber-600">{data.blockedCount} 項</div>
              </div>
              <div className="rounded-lg border bg-emerald-50 p-2.5 text-center border-emerald-200">
                <div className="text-xs text-emerald-700">已完結項目</div>
                <div className="text-lg font-bold text-emerald-600">{data.completedCount} 項</div>
              </div>
            </div>

            {/* AI 行動跟催建議 */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                <Bot className="h-4 w-4 text-indigo-600" />
                AI 專家跟催與行動對策
              </div>
              <p className="text-sm leading-relaxed text-indigo-950 whitespace-pre-line bg-white/70 rounded p-2.5 border border-indigo-100">
                {data.actionableAdvice}
              </p>
            </div>

            {/* 卡關對象與瓶頸排行榜 */}
            {data.bottlenecks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Users className="h-4 w-4 text-rose-600" />
                  卡關熱點對象排行榜 (Waiting-on Bottlenecks)
                </div>
                <div className="space-y-1.5">
                  {data.bottlenecks.map((b, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-xs bg-white"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700">
                          {idx + 1}. {b.party}
                        </span>
                        <Badge
                          variant={b.status === '嚴重卡關' ? 'destructive' : 'secondary'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {b.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>卡關項目：{b.count} 筆</span>
                        <span className="font-bold text-rose-600">
                          累計延誤：{b.delayedDays} 天
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 具體延誤議題清單 */}
            {data.topDelayReasons.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  延遲主要議題
                </div>
                <ul className="space-y-1 rounded-md border bg-slate-50/50 p-3 text-xs text-slate-700 list-disc list-inside">
                  {data.topDelayReasons.map((reason, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 歷史經驗檢討總結 */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                歷史歷程檢討總結 (Lesson Learnt)
              </div>
              <p className="text-xs text-amber-950 leading-relaxed bg-white/80 p-2 rounded border border-amber-100">
                {data.lessonsLearnedSummary}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            尚無分析資料
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button onClick={() => onOpenChange(false)}>關閉視窗</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
