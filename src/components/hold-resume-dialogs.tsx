'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import type { FullProject, SubProjectWithLatestLog } from '@/types';

interface HoldProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: FullProject[];
  onSubmit: (projectId: string, subProjectIds: string[], data: {
    reason: string;
    startDate: string;
    endDate?: string;
    notes?: string;
  }) => Promise<void>;
}

export function HoldProjectDialog({ open, onOpenChange, projects, onSubmit }: HoldProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSubProjectIds, setSelectedSubProjectIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const activeSubProjects = selectedProject?.subProjects?.filter(sp => !sp.isOnHold && !sp.isParentOnHold) || [];

  const toggleSubProject = (spId: string) => {
    setSelectedSubProjectIds(prev =>
      prev.includes(spId) ? prev.filter(id => id !== spId) : [...prev, spId]
    );
  };

  const selectAll = () => {
    setSelectedSubProjectIds(activeSubProjects.map(sp => sp.id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || selectedSubProjectIds.length === 0 || !reason) return;
    setLoading(true);
    try {
      await onSubmit(selectedProjectId, selectedSubProjectIds, {
        reason,
        startDate: new Date().toISOString(),
        notes,
      });
      setSelectedProjectId('');
      setSelectedSubProjectIds([]);
      setReason('');
      setNotes('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>⏸ 設定專案暫緩</DialogTitle>
          <DialogDescription>選擇要暫緩的專案與子專案，並填寫暫緩原因。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>選擇專案</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedProjectId}
              onChange={e => { setSelectedProjectId(e.target.value); setSelectedSubProjectIds([]); }}
            >
              <option value="">-- 選擇專案 --</option>
              {projects.filter(p => p.status !== 'on-hold').map(p => (
                <option key={p.id} value={p.id}>{p.caseNumber} - {p.name}</option>
              ))}
            </select>
          </div>

          {selectedProject && activeSubProjects.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>選擇子專案</Label>
                <button type="button" className="text-xs text-primary hover:underline" onClick={selectAll}>全選</button>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                {activeSubProjects.map(sp => (
                  <label key={sp.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSubProjectIds.includes(sp.id)}
                      onChange={() => toggleSubProject(sp.id)}
                      className="rounded"
                    />
                    <span className="text-sm">{sp.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>暫緩原因 *</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} required rows={2} placeholder="請說明暫緩原因..." />
          </div>

          <div className="space-y-2">
            <Label>備註</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="其他備註事項..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={loading || selectedSubProjectIds.length === 0} className="bg-amber-500 hover:bg-amber-600">
              {loading ? '處理中...' : '確認暫緩'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ResumeProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: FullProject[];
  onSubmit: (projectIds: string[], subProjectsByProject: Record<string, string[]>) => Promise<void>;
}

export function ResumeProjectDialog({ open, onOpenChange, projects, onSubmit }: ResumeProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const onHoldProjects = projects.filter(p =>
    p.status === 'on-hold' || p.subProjects?.some(sp => sp.isOnHold)
  );

  const toggleItem = (projectId: string, subProjectId: string) => {
    setSelections(prev => {
      const current = prev[projectId] || [];
      const updated = current.includes(subProjectId)
        ? current.filter(id => id !== subProjectId)
        : [...current, subProjectId];
      return { ...prev, [projectId]: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const projectIds = Object.keys(selections).filter(pid => {
      const project = onHoldProjects.find(p => p.id === pid);
      const onHoldSps = project?.subProjects?.filter(sp => sp.isOnHold || sp.isParentOnHold) || [];
      return selections[pid]?.length === onHoldSps.length;
    });
    setLoading(true);
    try {
      await onSubmit(projectIds, selections);
      setSelections({});
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const totalSelected = Object.values(selections).flat().length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>▶️ 恢復專案</DialogTitle>
          <DialogDescription>選擇要恢復的暫緩中專案/子專案。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {onHoldProjects.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">目前沒有暫緩中的專案。</p>
          ) : (
            <div className="space-y-3">
              {onHoldProjects.map(p => {
                const onHoldSps = p.subProjects?.filter(sp => sp.isOnHold || sp.isParentOnHold) || [];
                return (
                  <div key={p.id} className="border rounded-lg p-3 bg-amber-50">
                    <p className="font-medium text-sm mb-2">{p.caseNumber} - {p.name}</p>
                    <div className="space-y-1">
                      {onHoldSps.map(sp => (
                        <label key={sp.id} className="flex items-center gap-2 p-1 hover:bg-amber-100 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(selections[p.id] || []).includes(sp.id)}
                            onChange={() => toggleItem(p.id, sp.id)}
                            className="rounded"
                          />
                          <span className="text-sm">{sp.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={loading || totalSelected === 0} className="bg-green-600 hover:bg-green-700">
              {loading ? '處理中...' : `恢復 ${totalSelected} 個子專案`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
