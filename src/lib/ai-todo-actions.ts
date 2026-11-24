'use server';

import { createActionItem, updateActionItem } from '@/lib/actions';
import { getAiTodoScope } from '@/lib/ai-todo-data';
import { createClient } from '@/lib/supabase/server';
import { AI_TODO_MAX_CHARS, AI_TODO_PHASES, AI_TODO_STATUSES, findMissing, isValidDate, taipeiToday, type AiTodoProposal } from '@/lib/ai-todo';
import type { AuditOperator } from '@/types';

export interface AiTodoDraft {
  id: string;
  content: string;
  messageDate: string;
  createdAt: string;
}

/** 寫入一筆使用者已確認的建議 */
export async function applyAiTodo(
  p: AiTodoProposal,
  options: { operator?: AuditOperator; allowNewPerson?: boolean }
): Promise<{ success: boolean; message: string }> {
  const missing = findMissing(p).required;
  if (missing.length) return { success: false, message: `還缺：${missing.join('、')}` };
  if ([p.dueDate, p.completedDate].some((d) => d && !isValidDate(d))) return { success: false, message: '日期格式不正確' };
  if (p.status && !(AI_TODO_STATUSES as readonly string[]).includes(p.status)) return { success: false, message: '狀態不正確' };
  if (p.phase && !AI_TODO_PHASES.includes(p.phase)) return { success: false, message: '階段不正確' };

  const common = { operator: options.operator, skipUserDraft: !options.allowNewPerson };

  const { items, internalIds } = await getAiTodoScope();

  if (p.kind === 'create') {
    if (!internalIds.has(p.projectId!)) return { success: false, message: '只能寫入內部專案' };
    const res = await createActionItem({
      ...common,
      projectId: p.projectId!,
      title: p.title.trim(),
      phase: p.phase || '1.1 設計階段',
      status: p.status || 'pending',
      owner: p.owner,
      waitingOn: p.waitingOn,
      dueDate: p.dueDate || null,
      notes: p.note,
    });
    return { success: res.success, message: res.message };
  }

  const current = items.find((i) => i.id === p.itemId);
  if (!current) return { success: false, message: '找不到這筆待辦，可能已被刪除，請重新整理' };
  if (p.itemUpdatedAt && current.updatedAt !== p.itemUpdatedAt) {
    return { success: false, message: '這筆待辦在整理後已被更新過，請重新按「整理」' };
  }

  const res = await updateActionItem(current.id, {
    ...common,
    ...(p.title && { title: p.title }),
    ...(p.phase && { phase: p.phase }),
    ...(p.owner && { owner: p.owner }),
    ...(p.waitingOn && { waitingOn: p.waitingOn }),
    ...(p.dueDate && { dueDate: p.dueDate, dueDateReason: p.dueDateReason }),
    ...(p.status && { status: p.status }),
    ...(p.kind === 'complete' && { status: 'completed', completedAt: p.completedDate || null }),
    // 備註一律附加在後，不覆蓋；一併帶回附件，避免存在備註中的舊附件標記遺失
    ...(p.note && {
      notes: [current.notes, `[${taipeiToday()}] ${p.note}`].filter(Boolean).join('\n'),
      ...(current.attachments?.length && { attachments: current.attachments }),
    }),
  });
  return { success: res.success, message: res.message };
}

const draftError = (error: { code?: string; message?: string }) =>
  error.code === '42P01' || error.code === 'PGRST205'
    ? '草稿資料表尚未建立，請先在 Supabase 執行 create_ai_todo_drafts.sql'
    : error.message || '草稿存取失敗';

export async function listAiTodoDrafts(): Promise<{ drafts: AiTodoDraft[]; error?: string }> {
  const { data, error } = await createClient()
    .from('ai_todo_drafts').select('*').order('created_at', { ascending: false }).limit(30);
  if (error) return { drafts: [], error: draftError(error) };
  return {
    drafts: (data || []).map((d: any) => ({ id: d.id, content: d.content, messageDate: d.message_date, createdAt: d.created_at })),
  };
}

export async function saveAiTodoDraft(content: string, messageDate: string, createdBy: string) {
  const text = content.trim();
  if (!text || text.length > AI_TODO_MAX_CHARS || !isValidDate(messageDate)) return { success: false, message: '草稿內容或日期不正確' };
  const { error } = await createClient()
    .from('ai_todo_drafts').insert({ content: text, message_date: messageDate, created_by: createdBy });
  return error ? { success: false, message: draftError(error) } : { success: true, message: '已存成草稿，可在電腦上繼續處理' };
}

export async function deleteAiTodoDraft(id: string) {
  const { error } = await createClient().from('ai_todo_drafts').delete().eq('id', id);
  return error ? { success: false, message: draftError(error) } : { success: true, message: '草稿已刪除' };
}

/** 取得最新的內部專案與待辦，供框架填寫比對 */
export async function loadAiTodoScope() {
  const { projects, items } = await getAiTodoScope();
  return { projects: projects.map(({ id, name, caseNumber }) => ({ id, name, caseNumber })), items };
}
