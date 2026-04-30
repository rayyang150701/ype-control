'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';

interface SubProjectInput {
  name: string;
  owner: string;
}

interface CreateProjectData {
  caseNumber: string;
  name: string;
  projectPurpose: string;
  currentStatusAndIssues: string;
  yiehPhuiProjectManager: string;
  tpmOfficeContact: string;
  egigaContact: string;
  subProjects: SubProjectInput[];
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateProjectData) => Promise<void>;
  users: { uid: string; displayName: string }[];
}

export function CreateProjectDialog({ open, onOpenChange, onSubmit, users }: CreateProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CreateProjectData>({
    caseNumber: '',
    name: '',
    projectPurpose: '',
    currentStatusAndIssues: '',
    yiehPhuiProjectManager: '',
    tpmOfficeContact: '',
    egigaContact: '',
    subProjects: [{ name: '', owner: '' }],
  });

  const updateField = (field: keyof CreateProjectData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addSubProject = () => {
    setForm(prev => ({
      ...prev,
      subProjects: [...prev.subProjects, { name: '', owner: '' }],
    }));
  };

  const removeSubProject = (index: number) => {
    if (form.subProjects.length <= 1) return;
    setForm(prev => ({
      ...prev,
      subProjects: prev.subProjects.filter((_, i) => i !== index),
    }));
  };

  const updateSubProject = (index: number, field: keyof SubProjectInput, value: string) => {
    setForm(prev => ({
      ...prev,
      subProjects: prev.subProjects.map((sp, i) => i === index ? { ...sp, [field]: value } : sp),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.caseNumber || !form.name || form.subProjects.some(sp => !sp.name)) return;
    setLoading(true);
    try {
      await onSubmit(form);
      setForm({
        caseNumber: '', name: '', projectPurpose: '', currentStatusAndIssues: '',
        yiehPhuiProjectManager: '', tpmOfficeContact: '', egigaContact: '',
        subProjects: [{ name: '', owner: '' }],
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增專案</DialogTitle>
          <DialogDescription>建立新的主專案及其下的子專案。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="caseNumber">主專案案號 *</Label>
              <Input id="caseNumber" value={form.caseNumber} onChange={e => updateField('caseNumber', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">主專案名稱 *</Label>
              <Input id="name" value={form.name} onChange={e => updateField('name', e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">專案目的</Label>
            <Textarea id="purpose" value={form.projectPurpose} onChange={e => updateField('projectPurpose', e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">現況/問題點</Label>
            <Textarea id="status" value={form.currentStatusAndIssues} onChange={e => updateField('currentStatusAndIssues', e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>燁輝專案負責主管與分機</Label>
              <Input value={form.yiehPhuiProjectManager} onChange={e => updateField('yiehPhuiProjectManager', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>TPM管理室窗口</Label>
              <Input value={form.tpmOfficeContact} onChange={e => updateField('tpmOfficeContact', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>億威電子</Label>
              <Input value={form.egigaContact} onChange={e => updateField('egigaContact', e.target.value)} />
            </div>
          </div>

          {/* Sub Projects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">子專案列表</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSubProject}>
                <Plus className="h-3 w-3 mr-1" /> 新增子專案
              </Button>
            </div>
            {form.subProjects.map((sp, i) => (
              <div key={i} className="flex gap-3 items-start p-3 border rounded-lg bg-gray-50">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="子專案名稱 *"
                    value={sp.name}
                    onChange={e => updateSubProject(i, 'name', e.target.value)}
                    required
                  />
                </div>
                <div className="w-40 space-y-2">
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
                {form.subProjects.length > 1 && (
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
              {loading ? '建立中...' : '儲存變更'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
