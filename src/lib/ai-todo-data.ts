import { getActionItems, getAllProjectsForInternal } from '@/lib/actions';
import { createClient } from '@/lib/supabase/server';

/** AI 快速輸入只處理「明確標記為內部」的專案；外部（客戶管制表）專案不可被比對或寫入 */
export async function getAiTodoScope() {
  const [projects, items, flags] = await Promise.all([
    getAllProjectsForInternal(),
    getActionItems(),
    createClient().from('projects').select('id, on_hold_notes'),
  ]);
  if (flags.error) throw new Error('讀不到專案資料，請稍後再試');
  const internalIds = new Set(
    (flags.data || []).filter((p: any) => {
      try { return JSON.parse(p.on_hold_notes)?.isInternal === true; } catch { return false; }
    }).map((p: any) => p.id)
  );
  return {
    projects: projects.filter((p) => internalIds.has(p.id)),
    items: items.filter((i) => internalIds.has(i.projectId)),
    internalIds,
  };
}
