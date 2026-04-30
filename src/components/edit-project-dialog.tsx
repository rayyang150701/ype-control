'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import type { FullProject } from '@/types';

interface SubProjectInput {
  id?: string;
  name: string;
  owner: string;
}

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: FullProject | null;
  onSubmit: (projectId: string, data: any, originalSubProjectIds: string[]) => Promise<void>;
  users: { uid: string; displayName: string }[];
}

export function EditProjectDialog({ open, onOpenChange, project, onSubmit, users }: EditProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [caseNumber, setCaseNumber] = useState('');
  const [name, setName] = useState('');
  const [projectPurpose, setProjectPurpose] = useState('');
  const [currentStatusAndIssues, setCurrentStatusAndIssues] = useState('');
  const [yiehPhuiProjectManager, setYiehPhuiProjectManager] = useState('');
  const [tpmOfficeContact, setTpmOfficeContact] = useState('');
  const [egigaContact, setEgigaContact] = useState('');
  const [subProjects, setSubProjects] = useState<SubProjectInput[]>([]);
  const [originalSubProjectIds, setOriginalSubProjectIds] = useState<string[]>([]);

  useEffect(() => {
    if (project && open) {
      setCaseNumber(project.caseNumber || '');
      setName(project.name || '');
      setProjectPurpose(project.projectPurpose || '');
      setCurrentStatusAndIssues(project.currentStatusAndIssues || '');
      setYiehPhuiProjectManager(project.yiehPhuiProjectManager || '');
      setTpmOfficeContact(project.tpmOfficeContact || '');
      setEgigaContact(project.egigaContact || '');
      const sps = (project.subProjects || []).map(sp => ({
        id: sp.id,
        name: sp.name,
        owner: sp.owner || '',
      }));
      setSubProjects(sps.length > 0 ? sps : [{ name: '', owner: '' }]);
      setOriginalSubProjectIds(sps.map(sp => sp.id!).filter(Boolean));
    }
  }, [project, open]);

  const addSubProject = () => {
    setSubProjects(prev => [...prev, { name: '', owner: '' }]);
  };

  const removeSubProject = (index: number) => {
    if (subProjects.length <= 1) return;
    setSubProjects(prev => prev.filter((_, i) => i !== index));
  };

  const updateSubProject = (index: number, field: keyof SubProjectInput, value: string) => {
    setSubProjects(prev => prev.map((sp, i) => i === index ? { ...sp, [field]: value } : sp));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !caseNumber || !name) return;
    setLoading(true);
    try {
      await onSubmit(project.id, {
        caseNumber, name, projectPurpose, currentStatusAndIssues,
        yiehPhuiProjectManager, tpmOfficeContact, egigaContact,
        subProjects,
      }, originalSubProjectIds);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯專案</DialogTitle>
          <DialogDescription>修改主專案資料及子專案列表。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>主專案案號 *</Label>
              <Input value={caseNumber} onChange={e => setCaseNumber(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>主專案名稱 *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>專案目的</Label>
            <Textarea value={projectPurpose} onChange={e => setProjectPurpose(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>現況/問題點</Label>
            <Textarea value={currentStatusAndIssues} onChange={e => setCurrentStatusAndIssues(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>燁輝專案負責主管與分機</Label>
              <Input value={yiehPhuiProjectManager} onChange={e => setYiehPhuiProjectManager(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>TPM管理室窗口</Label>
              <Input value={tpmOfficeContact} onChange={e => setTpmOfficeContact(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>億威電子</Label>
              <Input value={egigaContact} onChange={e => setEgigaContact(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">子專案列表</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSubProject}>
                <Plus className="h-3 w-3 mr-1" /> 新增子專案
              </Button>
            </div>
            {subProjects.map((sp, i) => (
              <div key={sp.id || i} className="flex gap-3 items-start p-3 border rounded-lg bg-gray-50">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="子專案名稱 *"
                    value={sp.name}
                    onChange={e => updateSubProject(i, 'name', e.target.value)}
                    required
                  />
                </div>
                <div className="w-40">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={sp.owner}
                    onChange={e => updateSubProject(i, 'owner', e.target.value)}
                  >
                    <option value="">選擇負責人</option>
                    {users.map(u => (
                      <option key={u.uid} value={u.uid}>{u.displayName}</option>
                    ))}
                  </select>
                </div>
                {subProjects.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSubProject(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={loading}>
              {loading ? '儲存中...' : '儲存變更'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
