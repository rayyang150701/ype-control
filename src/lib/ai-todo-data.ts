import { getActionItems, getAllProjectsForInternal } from '@/lib/actions';
import { createClient } from '@/lib/supabase/server';

/** AI 快速輸入只處理內部專案；外部（客戶管制表）專案不可被比對或寫入 */
export async function getAiTodoScope() {
  const [projects, items, flags] = await Promise.all([
    getAllProjectsForInternal(),
    getActionItems(),
    createClient().from('projects').select('id, case_number, status, on_hold_notes'),
  ]);
  if (flags.error) throw new Error('讀不到專案資料，請稍後再試');
  const internalIds = new Set(
    (flags.data || []).filter((p: any) => {
      let meta: any = {};
      try { meta = JSON.parse(p.on_hold_notes) || {}; } catch {}
      if (typeof meta.isInternal === 'boolean') return meta.isInternal;
      // 沒有標記的，只收內部才會有的評估案／自建案；其餘視為外部
      return ['evaluation', 'poc'].includes(p.status) || /^poc$/i.test((p.case_number || '').trim()) || meta.sourceType === '億威內部自建專案';
    }).map((p: any) => p.id)
  );
  return {
    projects: projects.filter((p) => internalIds.has(p.id)),
    items: items.filter((i) => internalIds.has(i.projectId)),
    internalIds,
  };
}
