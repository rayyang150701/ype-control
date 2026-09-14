import { NextRequest, NextResponse } from 'next/server';
import { getActionItems, getFullProjects } from '@/lib/actions';
import { differenceInCalendarDays } from 'date-fns';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { projectId } = body;

    const actionItems = await getActionItems(projectId);
    const projects = await getFullProjects();
    const targetProject = projectId ? projects.find(p => p.id === projectId) : null;

    if (actionItems.length === 0) {
      return NextResponse.json({
        success: true,
        analysis: {
          projectTitle: targetProject ? targetProject.name : '全部專案',
          totalItems: 0,
          completedCount: 0,
          pendingCount: 0,
          blockedCount: 0,
          totalDelayedDays: 0,
          delayedItemsCount: 0,
          topDelayReasons: ['尚無足夠的待辦或歷程資料可供分析'],
          bottlenecks: [],
          lessonsLearnedSummary: '暫無歷程紀錄。請先新增待辦事項與歷程事件。',
          actionableAdvice: '建議為專案建立評估、簽呈、採購或施工等階段之待辦項目與預計完成日，以啟動 AI 跟催診斷。'
        }
      });
    }

    const today = new Date();
    let totalDelayedDays = 0;
    let delayedItemsCount = 0;
    const delayedReasons: string[] = [];
    const waitingMap: Record<string, { count: number; delayedDays: number }> = {};
    const phaseMap: Record<string, { count: number; delayedDays: number }> = {};
    const lessons: string[] = [];

    let totalWorkDays = 0;
    let completedWithWorkDaysCount = 0;
    let totalRescheduledCount = 0;

    for (const item of actionItems) {
      if (item.lessonLearnt && item.lessonLearnt.trim()) {
        lessons.push(item.lessonLearnt.trim());
      }

      // 累計實際工作天數
      if (item.startedAt && item.completedAt) {
        const days = differenceInCalendarDays(new Date(item.completedAt), new Date(item.startedAt));
        if (days >= 0) {
          totalWorkDays += days;
          completedWithWorkDaysCount++;
        }
      }

      // 累計延期調整次數
      if (item.dueDateHistory && item.dueDateHistory.length > 0) {
        totalRescheduledCount += item.dueDateHistory.length;
      }

      if (item.dueDate) {
        const dueDate = new Date(item.dueDate);
        const endDate = item.completedAt ? new Date(item.completedAt) : today;
        const diffDays = differenceInCalendarDays(endDate, dueDate);

        if (diffDays > 0) {
          totalDelayedDays += diffDays;
          delayedItemsCount++;
          const reason = item.waitingOn 
            ? `${item.title} (等候: ${item.waitingOn}，延誤 ${diffDays} 天)`
            : `${item.title} (延誤 ${diffDays} 天)`;
          delayedReasons.push(reason);

          if (item.waitingOn) {
            const key = item.waitingOn.trim();
            if (!waitingMap[key]) waitingMap[key] = { count: 0, delayedDays: 0 };
            waitingMap[key].count++;
            waitingMap[key].delayedDays += diffDays;
          }

          if (item.phase) {
            const phaseKey = item.phase.trim();
            if (!phaseMap[phaseKey]) phaseMap[phaseKey] = { count: 0, delayedDays: 0 };
            phaseMap[phaseKey].count++;
            phaseMap[phaseKey].delayedDays += diffDays;
          }
        }
      }
    }

    const avgWorkDays = completedWithWorkDaysCount > 0 ? Math.round(totalWorkDays / completedWithWorkDaysCount) : 0;

    // 依卡關延誤天數排序
    const bottlenecks = Object.entries(waitingMap)
      .map(([party, stat]) => ({
        party,
        count: stat.count,
        delayedDays: stat.delayedDays,
        status: stat.delayedDays > 7 ? '嚴重卡關' : '需密切跟催'
      }))
      .sort((a, b) => b.delayedDays - a.delayedDays);

    const completedCount = actionItems.filter(i => i.status === 'completed').length;
    const blockedCount = actionItems.filter(i => i.status === 'blocked').length;
    const pendingCount = actionItems.filter(i => i.status === 'pending' || i.status === 'in_progress').length;

    // AI 生成建議 (若有 GEMINI_API_KEY 則呼叫 Gemini，否則以智慧專家引擎輸出)
    let aiAdvice = '';
    let aiLessonsSummary = '';

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const prompt = `你是一位資深的製造業專案管理與智慧製造專家。請依據以下專案歷程數據，提供簡潔扼要的：
1. 實際施作時間與延誤瓶頸分析 (60字以內，包含平均工期與延期頻率之解讀)
2. 具體可執行的跟催行動建議 (100字以內)
3. 歷程經驗檢討 (Lesson Learnt) 總結 (100字以內)

專案名稱: ${targetProject ? targetProject.name : '全廠專案綜合分析'}
總待辦項目: ${actionItems.length}
已完成: ${completedCount}
卡關中: ${blockedCount}
已完成項目平均施作天數: ${completedWithWorkDaysCount > 0 ? `${avgWorkDays} 天 (${completedWithWorkDaysCount} 項有紀錄)` : '尚無足夠施作天數紀錄'}
項目時程調整/延期累計次數: ${totalRescheduledCount} 次
總累計延誤天數: ${totalDelayedDays} 天
延誤項目數: ${delayedItemsCount}
主要卡關對象與天數: ${JSON.stringify(bottlenecks)}
歷史檢討紀錄: ${lessons.join('；') || '尚無手動輸入檢討'}
`;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });
        if (res.ok) {
          const json = await res.json();
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            aiAdvice = text;
          }
        }
      } catch (e) {
        console.error('Gemini API 呼叫失敗，退回智慧專家引擎:', e);
      }
    }

    if (!aiAdvice) {
      // 內建智慧專家引擎分析
      const topBottleneck = bottlenecks[0];
      const adviceParts = [];
      if (avgWorkDays > 0) {
        adviceParts.push(`已完成項目平均施作工期為 ${avgWorkDays} 天，累計發生 ${totalRescheduledCount} 次時程調整。`);
      }
      if (topBottleneck) {
        adviceParts.push(`目前最大卡關熱點為「${topBottleneck.party}」，已累計卡關延遲 ${topBottleneck.delayedDays} 天，建議立即安排主管階層介入或發出公文/會議追蹤。`);
      }
      if (blockedCount > 0) {
        adviceParts.push(`現有 ${blockedCount} 個項目標記為等候卡關狀態，需確認是簽呈會簽延遲或是規格需求變更。`);
      } else {
        adviceParts.push(`專案整體推進順暢，請持續維持預計到期日前 3 天的預先提醒機制。`);
      }
      aiAdvice = adviceParts.join(' ');

      aiLessonsSummary = lessons.length > 0
        ? lessons.join(' | ')
        : '過去歷程主要延誤點集中於「外部廠商交期」與「跨單位簽呈流程」，未來建議在評估階段即明訂廠商合約罰則與會簽限時機制。';
    }

    return NextResponse.json({
      success: true,
      analysis: {
        projectTitle: targetProject ? targetProject.name : '全廠專案綜合分析',
        totalItems: actionItems.length,
        completedCount,
        pendingCount,
        blockedCount,
        totalDelayedDays,
        delayedItemsCount,
        avgWorkDays: completedWithWorkDaysCount > 0 ? avgWorkDays : null,
        totalRescheduledCount,
        topDelayReasons: delayedReasons.slice(0, 5),
        bottlenecks,
        lessonsLearnedSummary: aiLessonsSummary,
        actionableAdvice: aiAdvice
      }
    });

  } catch (error: any) {
    console.error('AI 專案分析 API 異常:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'AI 分析發生錯誤' },
      { status: 500 }
    );
  }
}
