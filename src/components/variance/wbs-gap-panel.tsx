'use client';

import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Lock, Plus, Trash2, Wand2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { applyDefaultWbsTemplate, lockProjectWbsBaseline, saveProjectWbs } from '@/lib/actions';
import { MAJOR_PHASES, MajorPhaseKey } from '@/lib/phase-constants';
import { computeWbsGap } from '@/lib/wbs-gap';
import type { FullProject, ProjectActionItem, WbsItem } from '@/types';

interface Props {
  project: FullProject;
  actionItems: ProjectActionItem[];
  canManage: boolean;
  onWbsChange: (wbsItems: WbsItem[], lockedAt: string | null) => void;
}

const fmt = (d?: string | null) => (d ? d.slice(0, 10).replace(/-/g, '/') : '—');

export function WbsGapPanel({ project, actionItems, canManage, onWbsChange }: Props) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const wbsItems = project.wbsItems || [];
  const lockedAt = project.wbsBaselineLockedAt || null;

  const projectItems = useMemo(
    () => actionItems.filter((a) => a.projectId === project.id),
    [actionItems, project.id]
  );
  const rows = useMemo(() => computeWbsGap(wbsItems, projectItems, todayStr), [wbsItems, projectItems, todayStr]);
  const unlinkedCount = projectItems.filter((a) => !a.wbsItemId).length;
  const totalDelay = rows.reduce((m, r) => Math.max(m, r.delayDays), 0);

  const handleApplyTemplate = async () => {
    setBusy(true);
    const res = await applyDefaultWbsTemplate(project.id);
    setBusy(false);
    if (res.success && res.data) {
      onWbsChange(res.data.wbsItems, lockedAt);
      toast({ title: '已套用預設二階範本', description: '請編輯工作包填入基準起訖日，確認後再鎖定基準。' });
    } else {
      toast({ title: '套用失敗', description: res.message, variant: 'destructive' });
    }
  };

  const handleLock = async () => {
    if (!window.confirm('鎖定後，既有工作包的基準起訖日將無法再修改（延誤天數以此為準）。確定鎖定？')) return;
    setBusy(true);
    const res = await lockProjectWbsBaseline(project.id);
    setBusy(false);
    if (res.success) {
      onWbsChange(
        wbsItems.map((i) => (i.baselineStart && i.baselineEnd ? i : { ...i, addedAfterLock: true })),
        res.lockedAt || new Date().toISOString()
      );
      toast({ title: '基準已鎖定' });
    } else {
      toast({ title: '無法鎖定', description: res.message, variant: 'destructive' });
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            第二階 WBS 基準 vs 預估（延誤追蹤）
            {lockedAt && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                <Lock className="h-3 w-3" /> 基準已鎖定 {fmt(lockedAt)}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            基準日不變；待辦造成的延期會累計到所屬工作包，點開可看是哪個待辦、延幾天、原因。
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {wbsItems.length === 0 ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={handleApplyTemplate}>
                <Wand2 className="h-4 w-4 mr-1" /> 套用預設二階範本
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> 編輯工作包／基準
                </Button>
                {!lockedAt && (
                  <Button size="sm" disabled={busy} onClick={handleLock}>
                    <Lock className="h-4 w-4 mr-1" /> 鎖定基準
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {wbsItems.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          此專案尚未建立第二階工作包。{canManage ? '可按右上角「套用預設二階範本」開始。' : ''}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-xs mb-3">
            <span className="rounded-md bg-slate-100 px-2 py-1">
              最大延誤：<b className={totalDelay > 0 ? 'text-red-600' : 'text-emerald-700'}>{totalDelay} 天</b>
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1">
              尚未歸屬工作包的待辦：<b className={unlinkedCount > 0 ? 'text-amber-600' : ''}>{unlinkedCount} 項</b>
            </span>
          </div>

          {MAJOR_PHASES.map((ph) => {
            const phRows = rows.filter((r) => r.wbs.phaseKey === ph.key);
            if (phRows.length === 0) return null;
            return (
              <div key={ph.key} className="mb-3">
                <div className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-t-md px-3 py-1.5">
                  {ph.fullName}
                </div>
                <div className="border border-t-0 border-slate-200 rounded-b-md divide-y divide-slate-100">
                  {phRows.map((r) => {
                    const open = !!expanded[r.wbs.id];
                    return (
                      <div key={r.wbs.id}>
                        <button
                          type="button"
                          className="w-full grid grid-cols-12 gap-2 items-center px-3 py-2 text-left text-xs hover:bg-slate-50"
                          onClick={() => setExpanded((p) => ({ ...p, [r.wbs.id]: !open }))}
                        >
                          <span className="col-span-5 flex items-center gap-1 font-medium text-slate-800">
                            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <span className="text-slate-400">{r.wbs.code}</span> {r.wbs.name}
                            {r.wbs.addedAfterLock && (
                              <span className="ml-1 text-[10px] text-slate-500 border rounded px-1">鎖定後追加</span>
                            )}
                          </span>
                          <span className="col-span-3 text-slate-600">
                            基準 {r.hasBaseline ? `${fmt(r.wbs.baselineStart)} ~ ${fmt(r.wbs.baselineEnd).slice(5)}` : '未設定'}
                          </span>
                          <span className="col-span-2 text-slate-600">
                            {r.forecastEnd ? `${r.isDone ? '完成' : '預估'} ${fmt(r.forecastEnd).slice(5)}` : '尚無待辦'}
                          </span>
                          <span className="col-span-2 text-right font-bold">
                            {!r.hasBaseline ? (
                              <span className="text-slate-400">—</span>
                            ) : r.delayDays > 0 ? (
                              <span className="text-red-600">延誤 {r.delayDays} 天</span>
                            ) : (
                              <span className="text-emerald-700">{r.isDone ? '準時' : '未延誤'}</span>
                            )}
                            <span className="ml-2 font-normal text-slate-400">
                              {r.completedCount}/{r.linkedCount}
                            </span>
                          </span>
                        </button>
                        {open && (
                          <div className="bg-slate-50 px-6 py-2 text-xs space-y-2">
                            {r.causes.length === 0 ? (
                              <div className="text-slate-500">
                                {r.linkedCount === 0 ? '尚未有待辦歸屬到此工作包。' : '此工作包的待辦沒有延期。'}
                              </div>
                            ) : (
                              r.causes.map((c) => (
                                <div key={c.item.id} className="rounded-md border border-slate-200 bg-white p-2">
                                  <div className="flex justify-between gap-2">
                                    <span className="font-semibold text-slate-800">{c.item.title}</span>
                                    <span className="text-red-600 font-bold shrink-0">
                                      {c.overBaselineDays > 0 && `超出基準 ${c.overBaselineDays} 天`}
                                      {c.overBaselineDays > 0 && c.slipDays > 0 && '；'}
                                      {c.slipDays > 0 && `自身延期 ${c.slipDays} 天`}
                                    </span>
                                  </div>
                                  {c.reasons.length === 0 ? (
                                    <div className="text-amber-600 mt-1">尚未記錄延期原因</div>
                                  ) : (
                                    <ul className="mt-1 space-y-0.5 text-slate-600">
                                      {c.reasons.map((h, i) => (
                                        <li key={i}>
                                          {fmt(h.at)}：{fmt(h.from)} → {fmt(h.to)}（
                                          {h.delayDays > 0 ? `+${h.delayDays}` : h.delayDays} 天）
                                          {h.category && <b className="ml-1">[{h.category}]</b>}
                                          {h.reason ? ` ${h.reason}` : <span className="text-amber-600"> 未填原因</span>}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      {editOpen && (
        <WbsEditDialog
          projectId={project.id}
          items={wbsItems}
          locked={!!lockedAt}
          onClose={() => setEditOpen(false)}
          onSaved={(items) => {
            onWbsChange(items, lockedAt);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}

function WbsEditDialog({
  projectId, items, locked, onClose, onSaved,
}: {
  projectId: string;
  items: WbsItem[];
  locked: boolean;
  onClose: () => void;
  onSaved: (items: WbsItem[]) => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<WbsItem[]>(items);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(items), [items]);

  const update = (id: string, patch: Partial<WbsItem>) =>
    setDraft((d) => d.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const add = (phaseKey: MajorPhaseKey) => {
    const ph = MAJOR_PHASES.find((p) => p.key === phaseKey)!;
    const count = draft.filter((i) => i.phaseKey === phaseKey).length;
    setDraft((d) => [
      ...d,
      { id: `new_${Math.random().toString(36).slice(2, 10)}`, phaseKey, code: `${ph.code}.${count + 1}`, name: '新工作包', baselineStart: null, baselineEnd: null },
    ]);
  };

  const save = async () => {
    setSaving(true);
    const payload = draft.map((i) => (i.id.startsWith('new_') ? { ...i, id: '' } : i));
    const res = await saveProjectWbs(projectId, payload);
    setSaving(false);
    if (res.success && res.data) {
      toast({ title: '已儲存' });
      onSaved(res.data.wbsItems);
    } else {
      toast({ title: '儲存失敗', description: res.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯第二階工作包與基準日</DialogTitle>
          <DialogDescription>
            {locked
              ? '基準已鎖定：既有工作包的基準日不可修改，仍可改名或刪除；新增的工作包不計延誤。'
              : '填入每個工作包的基準起訖日，確認後回到頁面按「鎖定基準」。'}
          </DialogDescription>
        </DialogHeader>
        {MAJOR_PHASES.map((ph) => (
          <div key={ph.key} className="mb-2">
            <div className="flex items-center justify-between text-sm font-bold text-slate-700 mb-1">
              {ph.fullName}
              <Button size="sm" variant="ghost" onClick={() => add(ph.key)}>
                <Plus className="h-4 w-4 mr-1" /> 新增
              </Button>
            </div>
            {draft.filter((i) => i.phaseKey === ph.key).map((i) => (
              <div key={i.id} className="grid grid-cols-12 gap-2 mb-1.5 items-center">
                <Input className="col-span-2 h-8 text-xs" value={i.code} onChange={(e) => update(i.id, { code: e.target.value })} />
                <Input className="col-span-5 h-8 text-xs" value={i.name} onChange={(e) => update(i.id, { name: e.target.value })} />
                <Input type="date" className="col-span-2 h-8 text-xs" disabled={locked && !i.id.startsWith('new_')}
                  value={i.baselineStart?.slice(0, 10) || ''} onChange={(e) => update(i.id, { baselineStart: e.target.value || null })} />
                <Input type="date" className="col-span-2 h-8 text-xs" disabled={locked && !i.id.startsWith('new_')}
                  value={i.baselineEnd?.slice(0, 10) || ''} onChange={(e) => update(i.id, { baselineEnd: e.target.value || null })} />
                <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8 text-red-500"
                  onClick={() => setDraft((d) => d.filter((x) => x.id !== i.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ))}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button disabled={saving} onClick={save}>{saving ? '儲存中…' : '儲存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
