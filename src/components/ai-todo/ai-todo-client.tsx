'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Loader2, Save, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/components/admin-context';
import { useToast } from '@/hooks/use-toast';
import {
  AI_TODO_MAX_CHARS, AI_TODO_PHASES, AI_TODO_STATUSES, AI_TODO_STATUS_LABEL,
  buildFollowUp, findMissing, openItems, retarget, taipeiToday, type AiTodoKind, type AiTodoProposal,
} from '@/lib/ai-todo';
import { formTemplate, isBlankForm, isForm, parseForm } from '@/lib/ai-todo-form';
import { applyAiTodo, loadAiTodoScope, deleteAiTodoDraft, listAiTodoDrafts, saveAiTodoDraft, type AiTodoDraft } from '@/lib/ai-todo-actions';
import type { ProjectActionItem } from '@/types';

type ProjectLite = { id: string; name: string; caseNumber: string };
interface Props { projects: ProjectLite[]; items: ProjectActionItem[]; people: string[]; clientNames: string[]; companyOf: Record<string, string> }
/** decision：使用者對「新增或合併」的回答；空值代表尚未回答，不可寫入 */
type Row = AiTodoProposal & { checked: boolean; decision: '' | 'new' | 'merge'; expanded?: boolean; saved?: boolean; error?: string; allowNewPerson?: boolean };
type MissingLevel = 'required' | 'suggested' | undefined;

const KIND: Record<AiTodoKind, { label: string; cls: string }> = {
  create: { label: '🆕 新增', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  update: { label: '✏️ 更新', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  complete: { label: '✅ 完成', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  unclear: { label: '❓ 待確認', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};
const STORE_KEY = 'ype_ai_todo_text';
const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-2 text-base sm:text-sm';
const due = (i: ProjectActionItem) => (i.dueDate || '').slice(0, 10);

function Field({ label, missing, children }: { label: string; missing?: MissingLevel; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 text-xs text-slate-600">
      {label}
      {missing === 'required' && <span className="ml-1 font-bold text-rose-600">必填</span>}
      {missing === 'suggested' && <span className="ml-1 text-amber-700">未提到</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function AiTodoClient({ projects: pageProjects, items: pageItems, people, clientNames, companyOf }: Props) {
  const { isSuperAdmin, isLoaded, currentUser, setIsLoginDialogOpen } = useAdmin();
  const { toast } = useToast();
  const router = useRouter();
  // 按「帶入」時取回的最新資料；頁面重新取得資料後改用頁面的
  const [fresh, setFresh] = useState<{ projects: ProjectLite[]; items: ProjectActionItem[] } | null>(null);
  useEffect(() => setFresh(null), [pageProjects, pageItems]);
  const projects = fresh?.projects ?? pageProjects;
  const items = fresh?.items ?? pageItems;
  const [mode, setMode] = useState<'form' | 'free'>('form');
  const [formText, setFormText] = useState(formTemplate());
  const [freeText, setFreeText] = useState('');
  const text = mode === 'form' ? formText : freeText;
  const setText = mode === 'form' ? setFormText : setFreeText;
  const blank = mode === 'form' ? isBlankForm(formText) : !freeText.trim();
  const dirty = !isBlankForm(formText) || !!freeText.trim();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [messageDate, setMessageDate] = useState(taipeiToday());
  const [rows, setRows] = useState<Row[]>([]);
  const [parsed, setParsed] = useState(false);
  const [busy, setBusy] = useState<'' | 'parse' | 'save' | 'draft'>('');
  const [drafts, setDrafts] = useState<AiTodoDraft[]>([]);
  const [draftError, setDraftError] = useState('');
  const [tab, setTab] = useState<'overdue' | 'week' | 'all'>('overdue');

  const reset = () => { setFormText(formTemplate()); setFreeText(''); setMessageDate(taipeiToday()); setRows([]); setParsed(false); };

  const refreshDrafts = async () => {
    try {
      const res = await listAiTodoDrafts();
      setDrafts(res.drafts);
      setDraftError(res.error || '');
    } catch {
      setDraftError('草稿讀取失敗');
    }
  };

  // 每次進入都是空白；清掉舊版留在瀏覽器的內容
  useEffect(() => {
    try { localStorage.removeItem(STORE_KEY); } catch {}
  }, []);
  // 有未處理的文字時，關閉或重新整理前提醒
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => { if (isSuperAdmin) refreshDrafts(); }, [isSuperAdmin]);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const owners = useMemo(() => Array.from(new Set([...clientNames, ...items.map((i) => i.owner).filter(Boolean)])), [clientNames, items]);
  const peopleSet = useMemo(() => new Set([...people, ...items.map((i) => i.waitingOn || '').filter(Boolean)]), [people, items]);
  const projectLabel = (id: string | null) => {
    const p = id ? projectMap.get(id) : undefined;
    return p ? `${p.caseNumber ? `[${p.caseNumber}] ` : ''}${p.name}` : '';
  };

  const pending = rows.filter((r) => !r.saved);
  const followUp = buildFollowUp(pending, (id) => itemMap.get(id)?.title || '');
  const canSave = (r: Row) => !!r.decision && !findMissing(r).required.length && (r.decision === 'new' || !!r.itemId);
  const ready = pending.filter((r) => r.checked && canSave(r));
  const patch = (id: string, data: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, error: undefined, ...data } : r)));

  const todayStr = taipeiToday();
  const weekEnd = new Date(new Date(`${todayStr}T00:00:00Z`).getTime() + 7 * 864e5).toISOString().slice(0, 10);
  const open = useMemo(() => openItems(items).sort((a, b) => (due(a) || '9999').localeCompare(due(b) || '9999')), [items]);
  const groups = {
    overdue: open.filter((i) => due(i) && due(i) < todayStr),
    week: open.filter((i) => due(i) >= todayStr && due(i) <= weekEnd),
    all: open,
  };

  // 有疑慮的（原文對不上、缺必填）與會改到既有待辦的，預設不勾，需人工確認
  const showProposals = (proposals: AiTodoProposal[]) => {
    setRows(proposals.map((p): Row => {
      // 明講「新增」就不再詢問；明講更新／完成則先帶入 AI 找到的那筆，仍需自己勾選
      const sure = p.kind === 'create' && (!p.relatedItemId || p.explicit);
      const merge = p.explicit && (p.kind === 'update' || p.kind === 'complete');
      // 框架填寫時有對不到的內容，也要看過再勾
      const doubt = mode === 'form' && !!p.question;
      return { ...p, decision: sure ? 'new' : merge ? 'merge' : '', expanded: doubt, checked: sure && !doubt && p.evidenceVerified && !findMissing(p).required.length };
    }));
    setParsed(true);
  };

  const focusAt = (pos: number) =>
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(pos, pos); });

  // 再加一筆：沿用上一筆的專案
  const addBlock = () => {
    const project = (formText.match(/^\s*專案\s*[:：].*$/gm) || []).pop()?.replace(/^\s*專案\s*[:：]/, '').trim() || '';
    const head = `${formText.trimEnd()}\n\n`;
    const block = formTemplate(project);
    setFormText(head + block);
    setRows([]);
    setParsed(false);
    focusAt(head.length + (project ? block.indexOf('\n事項：') + 4 : block.indexOf('\n')));
  };

  const onFormKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.shiftKey || mode !== 'form') return;
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (!blank && messageDate && !busy) parse(); return; }
    // 在行尾按 Enter：跳到下一題，不插入空行
    const el = e.currentTarget;
    const pos = el.selectionStart;
    if (pos !== el.selectionEnd || el.value[pos] !== '\n') return;
    const next = el.value.slice(pos + 1).split('\n')[0];
    if (!isForm(next)) return;
    e.preventDefault();
    focusAt(pos + 1 + next.length);
  };

  const parse = async () => {
    if (pending.some((r) => r.checked) && !window.confirm('還有未寫入的項目，重新整理會清掉，要繼續嗎？')) return;
    if (mode === 'form') {
      setBusy('parse');
      try {
        // 先取最新專案與待辦，剛在別頁新增或改名的也對得到
        const latest = await loadAiTodoScope();
        setFresh(latest);
        showProposals(parseForm(formText, messageDate, {
          ...latest, owners, people: Array.from(peopleSet), companyOf, speaker: currentUser?.displayName || '',
        }));
      } catch (e: any) {
        toast({ title: '無法帶入', description: e.message, variant: 'destructive' });
      } finally {
        setBusy('');
      }
      return;
    }
    setBusy('parse');
    try {
      const res = await fetch('/api/ai/parse-todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, messageDate, speaker: currentUser?.displayName || '' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || '整理失敗');
      showProposals(json.proposals);
      router.refresh();
    } catch (e: any) {
      toast({ title: '整理失敗', description: e.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    setBusy('save');
    const operator = currentUser
      ? { uid: currentUser.uid, name: currentUser.displayName, email: currentUser.email, role: currentUser.role, department: currentUser.department }
      : undefined;
    let ok = 0;
    for (const r of ready) {
      try {
        const res = await applyAiTodo(r, { operator, allowNewPerson: r.allowNewPerson });
        if (res.success) ok++;
        patch(r.id, res.success ? { saved: true } : { error: res.message });
      } catch {
        patch(r.id, { error: '連線中斷，請先到專案待辦確認是否已寫入，再決定是否重試', checked: false });
      }
    }
    toast({ title: `已寫入 ${ok} 筆${ok < ready.length ? `，${ready.length - ok} 筆失敗` : ''}`, variant: ok < ready.length ? 'destructive' : 'default' });
    // 全部處理完就清空；還有失敗或未處理的則保留
    if (ok > 0 && ok === pending.length) reset();
    setBusy('');
    router.refresh();
  };

  const saveDraft = async () => {
    setBusy('draft');
    try {
      const res = await saveAiTodoDraft(text, messageDate, currentUser?.displayName || '');
      toast({ title: res.message, variant: res.success ? 'default' : 'destructive' });
      if (res.success) { reset(); await refreshDrafts(); }
    } catch {
      toast({ title: '草稿儲存失敗，文字仍保留在輸入框', variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const removeDraft = async (d: AiTodoDraft) => {
    if (!window.confirm('刪除這份草稿？')) return;
    try {
      const res = await deleteAiTodoDraft(d.id);
      if (!res.success) toast({ title: res.message, variant: 'destructive' });
    } catch {
      toast({ title: '刪除失敗', variant: 'destructive' });
    }
    await refreshDrafts();
  };

  const loadDraft = (d: AiTodoDraft) => {
    if (dirty && text !== d.content && !window.confirm('輸入框已有文字，要用草稿取代嗎？')) return;
    const toForm = isForm(d.content);
    setMode(toForm ? 'form' : 'free');
    (toForm ? setFormText : setFreeText)(d.content);
    setMessageDate(d.messageDate);
    setRows([]);
    setParsed(false);
  };

  if (!isLoaded) return <div className="py-12 text-center text-muted-foreground">載入中...</div>;
  if (!isSuperAdmin) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-slate-600">AI 快速輸入目前僅限管理者使用。</p>
        {!currentUser && <Button onClick={() => setIsLoginDialogOpen(true)}>登入系統</Button>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">快速輸入待辦</h1>
        <Link href="/internal-tasks" className="text-sm text-blue-700 hover:underline">回專案待辦</Link>
      </div>

      <section className="space-y-3 rounded-lg border bg-white p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {([['form', '框架填寫'], ['free', '貼對話／口述（AI）']] as const).map(([k, label]) => (
            <Button key={k} size="sm" aria-pressed={mode === k} variant={mode === k ? 'default' : 'outline'} disabled={!!busy} onClick={() => { if (k !== mode) { setMode(k); setRows([]); setParsed(false); } }}>{label}</Button>
          ))}
        </div>
        <Textarea
          ref={inputRef}
          readOnly={busy === 'parse'}
          onKeyDown={onFormKey}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // 題目內容改了就收掉舊結果，避免寫入改之前的內容
            if (mode === 'form') { setRows([]); setParsed(false); }
          }}
          maxLength={AI_TODO_MAX_CHARS}
          rows={mode === 'form' ? 9 : 8}
          aria-label="貼上或口述的內容"
          placeholder="電腦：貼上 LINE 或社群對話。手機：點這裡，再按鍵盤上的麥克風口述。"
          className="text-base"
        />
        {mode === 'form' && (
          <p className="text-xs text-slate-600">
            直接在題目後面輸入或口述，按 Enter 跳下一題，Ctrl+Enter 帶入；不填的留空。專案、人名、單位可打簡稱；期限可打「12/4」「下週三」「3天後」「月底」。
          </p>
        )}
        {mode === 'free' && <p className="text-xs text-slate-600">口述範例：「新增，核一廠，提供施工計畫書，等候 James，負責億威電子，12 月 4 號前完成」</p>}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="訊息日期（換算「明天、下週三」用）">
            <Input type="date" value={messageDate} onChange={(e) => setMessageDate(e.target.value)} className="w-44" />
          </Field>
          <Button onClick={parse} disabled={blank || !messageDate || !!busy} className="gap-1.5">
            {busy === 'parse' ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'free' && <Sparkles className="h-4 w-4" />}{mode === 'form' ? '帶入' : '整理'}
          </Button>
          {mode === 'form' && <Button variant="outline" onClick={addBlock} disabled={blank || !!busy}>再加一筆</Button>}
          <Button variant="outline" onClick={saveDraft} disabled={blank || !messageDate || !!busy} className="gap-1.5">
            <Save className="h-4 w-4" />存草稿
          </Button>
          <Button variant="ghost" onClick={reset} disabled={!!busy}>清空</Button>
        </div>
        <p className="text-xs text-muted-foreground">{mode === 'form' ? '框架填寫不使用 AI。' : '按「整理」會把這段文字，以及專案名稱、未完成待辦與人員名單送到 AI 服務。'}確認前不會寫入資料。</p>
        {text.length >= AI_TODO_MAX_CHARS && <p className="text-xs font-semibold text-rose-600">已達 {AI_TODO_MAX_CHARS} 字上限，超過的部分沒有貼入，請分段處理。</p>}
        {draftError && <p className="text-xs text-amber-700">{draftError}</p>}
        {drafts.length > 0 && (
          <div className="space-y-1 border-t pt-2">
            <div className="text-xs font-semibold text-slate-600">草稿（{drafts.length}）</div>
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <button className="min-w-0 flex-1 truncate py-1.5 text-left text-sm text-blue-700 hover:underline" disabled={!!busy} onClick={() => loadDraft(d)}>
                  {d.messageDate}　{d.content}
                </button>
                <Button variant="ghost" size="icon" aria-label="刪除草稿" onClick={() => removeDraft(d)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {parsed && rows.length === 0 && <p className="rounded-lg border p-4 text-sm text-slate-600">這段內容沒有需要處理的待辦。</p>}

      {rows.length > 0 && (
        <section className="space-y-3">
          {rows.map((r) => {
            const missing = findMissing(r);
            const state = (f: string): MissingLevel =>
              missing.required.includes(f) ? 'required' : missing.suggested.includes(f) ? 'suggested' : undefined;
            const current = r.itemId ? itemMap.get(r.itemId) : undefined;
            const isChange = r.kind === 'update' || r.kind === 'complete';
            const related = itemMap.get(r.relatedItemId || '');
            const sameProject = open.filter((i) => i.projectId === r.projectId);
            const newPerson = !!r.waitingOn && !peopleSet.has(r.waitingOn);
            const allDiffs: [string, string, string][] = current
              ? [
                  ['事項', current.title, r.title],
                  ['狀態', AI_TODO_STATUS_LABEL[current.status] || current.status, AI_TODO_STATUS_LABEL[r.status] || ''],
                  ['階段', current.phase, r.phase],
                  ['負責單位', current.owner, r.owner],
                  ['等候對象', current.waitingOn || '', r.waitingOn],
                  ['期限', due(current), r.dueDate],
                  ['備註（附加在後）', '', r.note],
                ]
              : [];
            const diffs = allDiffs.filter(([, , to]) => to);
            return (
              <div key={r.id} className={`space-y-3 rounded-lg border bg-white p-3 sm:p-4 ${r.saved ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  {r.kind !== 'unclear' && !r.saved && (
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      aria-label="寫入這筆"
                      checked={r.checked && canSave(r)}
                      disabled={!!busy || !canSave(r)}
                      onChange={(e) => patch(r.id, { checked: e.target.checked })}
                    />
                  )}
                  <Badge variant="outline" className={KIND[r.kind].cls}>{KIND[r.kind].label}</Badge>
                  {!r.saved && r.kind !== 'unclear' && !r.decision && <span className="text-sm font-semibold text-rose-600">請先回答：新增或合併</span>}
                  {r.saved && <span className="text-sm font-semibold text-emerald-700">已寫入</span>}
                  {missing.required.length > 0 && <span className="text-sm font-semibold text-rose-600">缺：{missing.required.join('、')}</span>}
                  {missing.suggested.length > 0 && <span className="text-sm text-amber-700">未提到：{missing.suggested.join('、')}</span>}
                </div>

                <p className="break-words text-sm text-slate-600">
                  原文：「{r.evidence || '（無）'}」
                  {!r.evidenceVerified && <span className="ml-1 font-semibold text-rose-600">⚠️ 在原文找不到這段，請自行核對</span>}
                </p>
                {r.question && <p className="break-words text-sm text-rose-700">{r.question}</p>}

                <fieldset disabled={!!busy || r.saved} className="min-w-0 space-y-3">
                  {r.kind !== 'unclear' && !r.saved && (
                    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                      <p className="font-semibold">
                        {r.decision
                          ? `處理方式（可改）${related && r.decision === 'new' ? `：另有相近待辦「${related.title}」` : ''}`
                          : related
                          ? `找到相近的待辦「${related.title}」。這段內容要合併進現有待辦，還是新增一筆？`
                          : '這段內容要合併進現有待辦，還是新增一筆？'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button" size="sm" aria-pressed={r.decision === 'new'}
                          variant={r.decision === 'new' ? 'default' : 'outline'}
                          onClick={() => {
                            const next = r.kind === 'create' ? r : retarget(r, null, current || null);
                            patch(r.id, { ...next, decision: 'new', checked: !findMissing(next).required.length });
                          }}
                        >
                          新增一筆待辦
                        </Button>
                        <Button
                          type="button" size="sm" aria-pressed={r.decision === 'merge'}
                          variant={r.decision === 'merge' ? 'default' : 'outline'}
                          onClick={() => {
                            // AI 判為更新／完成時沿用它的建議；原本是新增則先帶入相近的那筆
                            const next = r.kind === 'create' && related ? retarget(r, related, null) : r;
                            patch(r.id, { ...next, decision: 'merge', checked: next.kind !== 'create' && !findMissing(next).required.length });
                          }}
                        >
                          合併到現有待辦
                        </Button>
                      </div>
                      {r.decision === 'merge' && (
                        <label className="block text-xs text-slate-600">
                          合併到哪一筆
                          <select
                            className={`${selectCls} mt-1`}
                            value={r.itemId || ''}
                            onChange={(e) => {
                              const target = itemMap.get(e.target.value);
                              if (!target) return;
                              const next = retarget(r, target, null);
                              patch(r.id, { ...next, checked: !findMissing(next).required.length });
                            }}
                          >
                            {!r.itemId && <option value="">請選擇</option>}
                            <optgroup label="同專案">
                              {sameProject.map((i) => <option key={i.id} value={i.id}>{i.title}（期限 {due(i) || '無'}）</option>)}
                            </optgroup>
                            <optgroup label="其他專案">
                              {open.filter((i) => !sameProject.includes(i)).map((i) => <option key={i.id} value={i.id}>{i.title}（{i.projectName}）</option>)}
                            </optgroup>
                          </select>
                        </label>
                      )}
                    </div>
                  )}
                  {isChange && current && (
                    <div className="text-sm">
                      <div className="font-semibold">{projectLabel(current.projectId) || current.projectName}｜{current.title}</div>
                      {!r.saved && diffs.map(([label, from, to]) => (
                        <div key={label} className="break-words">
                          {label}：{from && <><span className="text-slate-500 line-through">{from}</span> → </>}<b>{to}</b>
                        </div>
                      ))}
                    </div>
                  )}

                  {r.kind === 'unclear' && (
                    <Button variant="outline" size="sm" onClick={() => patch(r.id, { kind: 'create', status: 'pending', title: r.title || r.evidence, decision: 'new' })}>
                      改為新增待辦
                    </Button>
                  )}

                  {r.kind === 'create' && r.decision === 'new' && !r.saved && (
                    <div className="space-y-0.5 break-words text-sm">
                      <div className="font-semibold">{projectLabel(r.projectId) || '（未指定專案）'}｜{r.title || '（未填事項）'}</div>
                      <div className="text-slate-600">
                        期限：{r.dueDate || '未提到'}　等候：{r.waitingOn || '未提到'}　負責：{r.owner || '未提到'}
                        {r.ownerInferred && <span className="text-amber-700">（依等候對象帶入）</span>}
                      </div>
                      {r.note && <div className="text-slate-600">備註：{r.note}</div>}
                    </div>
                  )}
                  {r.kind !== 'unclear' && r.decision && (r.decision === 'new' || r.itemId) && !r.saved && missing.required.length === 0 && (
                    <Button type="button" variant="ghost" size="sm" aria-expanded={!!r.expanded} onClick={() => patch(r.id, { expanded: !r.expanded })}>
                      {r.expanded ? '收合欄位' : '修改欄位'}
                    </Button>
                  )}
                  {r.kind !== 'unclear' && r.decision && (r.decision === 'new' || r.itemId) && !r.saved && (r.expanded || missing.required.length > 0) && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {r.kind === 'create' && (
                        <Field label="專案" missing={state('專案')}>
                          <select className={selectCls} value={r.projectId || ''} onChange={(e) => patch(r.id, { projectId: e.target.value || null })}>
                            <option value="">請選擇</option>
                            {r.candidateProjectIds.length > 0 && (
                              <optgroup label="可能是">
                                {r.candidateProjectIds.map((id) => <option key={id} value={id}>{projectLabel(id)}</option>)}
                              </optgroup>
                            )}
                            <optgroup label="全部專案">
                              {projects.filter((p) => !r.candidateProjectIds.includes(p.id)).map((p) => (
                                <option key={p.id} value={p.id}>{projectLabel(p.id)}</option>
                              ))}
                            </optgroup>
                          </select>
                        </Field>
                      )}
                      <Field label={isChange ? '新事項名稱（不改留空）' : '事項'} missing={state('事項')}>
                        <Input value={r.title} onChange={(e) => patch(r.id, { title: e.target.value })} />
                      </Field>
                      <Field label="負責單位" missing={state('負責單位')}>
                        <select className={selectCls} value={r.owner} onChange={(e) => patch(r.id, { owner: e.target.value, ownerInferred: false })}>
                          <option value="">{isChange ? '不變更' : '請選擇'}</option>
                          {owners.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </Field>
                      <Field label="等候對象" missing={state('等候對象')}>
                        <Input list="ai-todo-people" value={r.waitingOn} onChange={(e) => patch(r.id, { waitingOn: e.target.value, allowNewPerson: false })} />
                      </Field>
                      <Field label="期限" missing={state('期限')}>
                        <Input type="date" value={r.dueDate} onChange={(e) => patch(r.id, { dueDate: e.target.value })} />
                      </Field>
                      {isChange && r.dueDate && (
                        <Field label="改期原因" missing={state('改期原因')}>
                          <Input value={r.dueDateReason} onChange={(e) => patch(r.id, { dueDateReason: e.target.value })} />
                        </Field>
                      )}
                      <Field label="階段" missing={state('階段')}>
                        <select className={selectCls} value={r.phase} onChange={(e) => patch(r.id, { phase: e.target.value })}>
                          <option value="">{isChange ? '不變更' : '未指定（預設 1.1 設計階段）'}</option>
                          {AI_TODO_PHASES.map((p) => <option key={p}>{p}</option>)}
                        </select>
                      </Field>
                      {r.kind === 'complete' ? (
                        <Field label="完成日（留空＝現在）">
                          <Input type="date" value={r.completedDate} onChange={(e) => patch(r.id, { completedDate: e.target.value })} />
                        </Field>
                      ) : (
                        <Field label="狀態">
                          <select className={selectCls} value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })}>
                            {isChange && <option value="">不變更</option>}
                            {AI_TODO_STATUSES.filter((s) => !isChange || s !== 'completed').map((s) => (
                              <option key={s} value={s}>{AI_TODO_STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Field label="備註">
                        <Input value={r.note} onChange={(e) => patch(r.id, { note: e.target.value })} />
                      </Field>
                    </div>
                  )}
                  {newPerson && r.kind !== 'unclear' && (
                    <label className="flex items-center gap-2 text-sm text-amber-800">
                      <input type="checkbox" checked={!!r.allowNewPerson} onChange={(e) => patch(r.id, { allowNewPerson: e.target.checked })} />
                      「{r.waitingOn}」不在人員名單，請確認姓名；勾選才會新增為人員
                    </label>
                  )}
                </fieldset>
                {r.error && <p className="text-sm font-semibold text-rose-600">{r.error}</p>}
                {!r.saved && (
                  <button className="text-xs text-slate-500 hover:underline" disabled={!!busy} onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}>
                    略過這筆
                  </button>
                )}
              </div>
            );
          })}
          <datalist id="ai-todo-people">{Array.from(peopleSet).map((p) => <option key={p} value={p} />)}</datalist>

          {followUp && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <b className="text-sm">缺漏追問（可貼回 LINE）</b>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    navigator.clipboard.writeText(followUp).then(
                      () => toast({ title: '已複製' }),
                      () => toast({ title: '複製失敗，請手動選取', variant: 'destructive' })
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" />複製
                </Button>
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm">{followUp}</pre>
            </div>
          )}

          <div className="sticky bottom-0 border-t bg-white/95 py-3">
            <Button onClick={save} disabled={!ready.length || !!busy} className="w-full gap-1.5 sm:w-auto">
              {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}確認寫入 {ready.length} 筆
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-2 rounded-lg border bg-white p-3 sm:p-4">
        <h2 className="font-semibold">目前待辦</h2>
        <div className="flex gap-2">
          {([['overdue', '已逾期'], ['week', '7 天內'], ['all', '全部']] as const).map(([k, label]) => (
            <Button key={k} size="sm" variant={tab === k ? 'default' : 'outline'} onClick={() => setTab(k)}>{label} {groups[k].length}</Button>
          ))}
        </div>
        {groups[tab].length === 0 && <p className="py-3 text-sm text-muted-foreground">沒有待辦</p>}
        {groups[tab].map((i) => (
          <div key={i.id} className="border-t py-2 text-sm">
            <div className="break-words font-medium">{i.title}</div>
            <div className="break-words text-xs text-slate-600">
              {i.projectName}
              <span className={due(i) && due(i) < todayStr ? 'font-semibold text-rose-600' : ''}>{due(i) || '無期限'}</span>
              {i.waitingOn && `　等候：${i.waitingOn}`}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
