import { differenceInDays, parseISO, isValid } from 'date-fns';
import type { ProjectActionItem, WbsItem } from '@/types';

export interface WbsDelayCause {
  item: ProjectActionItem;
  itemEnd: string;            // 該待辦的實際/預計結束日
  overBaselineDays: number;   // 超出工作包基準結束日的天數
  slipDays: number;           // 該待辦自身預計日往後延的總天數（現行預計日 - 原始預計日）
  reasons: { at: string; from: string | null; to: string | null; delayDays: number; reason?: string; category?: string }[];
}

export interface WbsGapRow {
  wbs: WbsItem;
  hasBaseline: boolean;
  linkedCount: number;
  completedCount: number;
  isDone: boolean;
  forecastEnd: string | null;   // 目前預估（或實際）完成日
  delayDays: number;            // 相對基準結束日的延誤天數（≥0）
  causes: WbsDelayCause[];
}

const d10 = (v?: string | null) => (v ? String(v).slice(0, 10) : null);

function daysBetween(later: string, earlier: string): number {
  const a = parseISO(later);
  const b = parseISO(earlier);
  return isValid(a) && isValid(b) ? differenceInDays(a, b) : 0;
}

/** 單一待辦的結束日：已完成取完成日；未完成取預計日，若已逾期則為今日 */
export function itemEndDate(item: ProjectActionItem, todayStr: string): string | null {
  if (item.status === 'completed') return d10(item.completedAt) || d10(item.dueDate);
  const due = d10(item.dueDate);
  if (!due) return null;
  return due < todayStr ? todayStr : due;
}

export function computeWbsGap(
  wbsItems: WbsItem[],
  actionItems: ProjectActionItem[],
  todayStr: string
): WbsGapRow[] {
  return wbsItems.map((wbs) => {
    const linked = actionItems.filter((a) => a.wbsItemId === wbs.id);
    const completedCount = linked.filter((a) => a.status === 'completed').length;
    const closedAt = d10(wbs.completedAt);
    const isDone = !!closedAt || (linked.length > 0 && completedCount === linked.length);
    const baselineEnd = d10(wbs.baselineEnd);
    const hasBaseline = !wbs.addedAfterLock && !!baselineEnd && !!d10(wbs.baselineStart);

    const ends = linked.map((a) => itemEndDate(a, todayStr)).filter((x): x is string => !!x).sort();
    const forecastEnd = closedAt || (ends.length ? ends[ends.length - 1] : null);
    const delayDays = hasBaseline && forecastEnd && baselineEnd ? Math.max(0, daysBetween(forecastEnd, baselineEnd)) : 0;

    const causes: WbsDelayCause[] = linked
      .map((item) => {
        const itemEnd = itemEndDate(item, todayStr) || '';
        const overBaselineDays = hasBaseline && itemEnd && baselineEnd ? Math.max(0, daysBetween(itemEnd, baselineEnd)) : 0;
        const orig = d10(item.originalDueDate);
        const cur = d10(item.dueDate);
        const slipDays = orig && cur ? Math.max(0, daysBetween(cur, orig)) : 0;
        const reasons = (item.dueDateHistory || []).map((h) => ({
          at: h.changedAt,
          from: h.from,
          to: h.to,
          delayDays: h.delayDays,
          reason: h.reason,
          category: h.reasonCategory,
        }));
        return { item, itemEnd, overBaselineDays, slipDays, reasons };
      })
      .filter((c) => c.overBaselineDays > 0 || c.slipDays > 0)
      .sort((a, b) => b.overBaselineDays - a.overBaselineDays || b.slipDays - a.slipDays);

    return { wbs, hasBaseline, linkedCount: linked.length, completedCount, isDone, forecastEnd, delayDays, causes };
  });
}
