'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

interface AddProgressLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subProjectName: string;
  reportingPeriod: string;
  previousPlan?: string;
  previousRoadblocks?: string;
  previousPercentage?: number;
  onSubmit: (data: {
    executionSummary: string;
    nextWeekPlan: string;
    roadblocks: string;
    completionPercentage: number;
    reportingPeriod: string;
  }) => Promise<void>;
}

export function AddProgressLogDialog({
  open, onOpenChange, subProjectName, reportingPeriod,
  previousPlan, previousRoadblocks, previousPercentage,
  onSubmit,
}: AddProgressLogDialogProps) {
  const [loading, setLoading] = useState(false);
  const [executionSummary, setExecutionSummary] = useState(previousPlan || '');
  const [nextWeekPlan, setNextWeekPlan] = useState('');
  const [roadblocks, setRoadblocks] = useState(previousRoadblocks && previousRoadblocks !== '無' ? previousRoadblocks : '');
  const [completionPercentage, setCompletionPercentage] = useState(previousPercentage ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        executionSummary,
        nextWeekPlan,
        roadblocks: roadblocks || '無',
        completionPercentage,
        reportingPeriod,
      });
      // Reset
      setExecutionSummary('');
      setNextWeekPlan('');
      setRoadblocks('');
      setCompletionPercentage(0);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增週報 - {subProjectName}</DialogTitle>
          <DialogDescription>提報區間: {reportingPeriod}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>本週執行摘要 (自動帶入上週計畫)</Label>
            <Textarea
              value={executionSummary}
              onChange={e => setExecutionSummary(e.target.value)}
              rows={5}
              placeholder="請填寫本週的工作執行內容..."
            />
          </div>

          <div className="space-y-2">
            <Label>下週工作計畫</Label>
            <Textarea
              value={nextWeekPlan}
              onChange={e => setNextWeekPlan(e.target.value)}
              rows={3}
              placeholder="請填寫下週的工作計畫..."
            />
          </div>

          <div className="space-y-2">
            <Label>遭遇問題及風險</Label>
            <Textarea
              value={roadblocks}
              onChange={e => setRoadblocks(e.target.value)}
              rows={3}
              placeholder="如無問題請填寫「無」"
              className={roadblocks && roadblocks !== '無' ? 'border-red-300 bg-red-50' : ''}
            />
          </div>

          <div className="space-y-2">
            <Label>總體完成度 (%)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={100}
                value={completionPercentage}
                onChange={e => setCompletionPercentage(Number(e.target.value))}
                className="w-24"
              />
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    completionPercentage >= 100 ? 'bg-green-500' :
                    completionPercentage >= 80 ? 'bg-blue-500' :
                    completionPercentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(completionPercentage, 100)}%` }}
                />
              </div>
              <span className="text-sm font-bold w-12 text-right">{completionPercentage}%</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? '儲存中...' : '儲存週報'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
