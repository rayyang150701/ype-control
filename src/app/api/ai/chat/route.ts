import { NextRequest, NextResponse } from 'next/server';
import { getActionItems, getFullProjects } from '@/lib/actions';
import { differenceInCalendarDays } from 'date-fns';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function generateExpertResponse(
  question: string,
  targetProject: any,
  actionItems: any[],
  formattedItems: any[],
  bottlenecks: Record<string, { count: number; delayedDays: number }>,
  avgWorkDays: number,
  totalRescheduledCount: number,
  totalDelayedDays: number,
  lessons: string[]
): string {
  const q = question.toLowerCase();
  const projName = targetProject ? targetProject.name : '全廠專案';
  const completedCount = actionItems.filter((i) => i.status === 'completed').length;
  const blockedCount = actionItems.filter((i) => i.status === 'blocked').length;
  const pendingCount = actionItems.filter((i) => i.status === 'pending' || i.status === 'in_progress').length;

  const sortedBottlenecks = Object.entries(bottlenecks)
    .map(([party, stat]) => ({ party, ...stat }))
    .sort((a, b) => b.delayedDays - a.delayedDays);

  const topBottleneck = sortedBottlenecks[0];

  // 1. 卡關、等候誰
  if (q.includes('卡關') || q.includes('等候') || q.includes('瓶頸') || q.includes('誰') || q.includes('阻礙')) {
    if (sortedBottlenecks.length === 0 && blockedCount === 0) {
      return `### 🎯 【${projName}】卡關與等候對象分析

目前此專案**無任何標記為「卡關等候中」的事項**，整體推進狀態良好！

- **待辦總數**：共 ${actionItems.length} 項（已完成 ${completedCount} 項，執行中 ${pendingCount} 項）。
- **建議對策**：持續掌握預計完成日前 3 天之跟催，確保後續階段準時啟動。`;
    }

    let report = `### 🚨 【${projName}】主要卡關與等候對象分析\n\n`;
    report += `目前共有 **${blockedCount} 項**待辦事項處於卡關狀態，累計卡關延誤天數高達 **${totalDelayedDays} 天**。\n\n`;
    report += `#### 📌 卡關熱點排行榜 (Waiting-on Bottlenecks)：\n`;
    sortedBottlenecks.slice(0, 4).forEach((b, idx) => {
      report += `${idx + 1}. **等候：${b.party}** — 卡關項目 ${b.count} 筆，累計延誤 **${b.delayedDays} 天** (${b.delayedDays > 7 ? '⚠️ 嚴重卡關' : '需持續跟催'})\n`;
    });

    if (topBottleneck) {
      report += `\n#### 💡 專家跟催行動建議：\n`;
      report += `1. **核心突破點**：最大延誤對象為「**${topBottleneck.party}**」，建議專案經理（PM）直接安排實體協調會議或由主管層級直接會簽發文，避免停留於非同步郵件溝通。\n`;
      report += `2. **釐清原因**：確認卡關本質是「外部交期延遲」、「內部核決層級過長」或「規格需求不一致」，針對根因提供明確應對方案。\n`;
    }
    return report;
  }

  // 2. 時程、延誤、工期落差、延期次數
  if (q.includes('時程') || q.includes('延誤') || q.includes('工期') || q.includes('落差') || q.includes('延期') || q.includes('天數') || q.includes('何時完成')) {
    let report = `### ⏱ 【${projName}】實際施作工期與時程落差評估\n\n`;
    report += `- **已完成事項平均工期**：約 **${avgWorkDays > 0 ? `${avgWorkDays} 天` : '資料累計中'}**\n`;
    report += `- **時程調整/延期累計次數**：共 **${totalRescheduledCount} 次**\n`;
    report += `- **總累計延誤天數**：共 **${totalDelayedDays} 天**\n\n`;

    // 找出延期最多的項目
    const delayedItems = actionItems.filter((i) => i.dueDateHistory && i.dueDateHistory.length > 0);
    if (delayedItems.length > 0) {
      report += `#### 📅 延期調整頻率最高之事項：\n`;
      delayedItems.slice(0, 3).forEach((item, idx) => {
        const delays = item.dueDateHistory?.length || 0;
        report += `${idx + 1}. **${item.title}**：累計調整延期 **${delays} 次**（初版基準日: ${item.originalDueDate || '未記錄'} ➔ 最新預計: ${item.dueDate || '未設定'}）\n`;
      });
    }

    report += `\n#### 💡 工期落差分析與建議：\n`;
    report += `專案初期規劃預估通常較為樂觀，但執行期間易受簽呈核決與供應商交期影響。建議後續專案在「開發/施工」與「驗收」階段規劃時，將標準工期預留 15%~20% 之緩衝期（Buffer），以符合實際平均施作天數。`;
    return report;
  }

  // 3. 經驗檢討、Lesson Learnt
  if (q.includes('檢討') || q.includes('lesson') || q.includes('經驗') || q.includes('反思') || q.includes('學習')) {
    let report = `### 💡 【${projName}】歷史歷程經驗檢討 (Lesson Learnt) 總結\n\n`;
    if (lessons.length > 0) {
      report += `#### 📝 團隊已登錄之檢討筆記：\n`;
      lessons.forEach((l, idx) => {
        report += `${idx + 1}. ${l}\n`;
      });
    } else {
      report += `此專案目前待辦事項尚未輸入具體的 Lesson Learnt 備註。\n\n`;
    }

    report += `\n#### 🛡️ 專家建議之系統性防範機制：\n`;
    report += `1. **前期評估防漏**：在 POC 評估階段，即須將硬體連網介面、環境限制與跨廠資安規範納入檢核清單。\n`;
    report += `2. **合約與發票結案限期**：簽呈與發票開立流程應明訂會簽 SLA（例如 3 個工作天內決行），避免完工後卡在驗收行政流程。\n`;
    report += `3. **雙向定期跟催**：對外部配合廠商設定每週固定檢核點，於預計到期日前提前跟催，減少臨時延期次數。`;
    return report;
  }

  // 4. 開會、報告重點
  if (q.includes('開會') || q.includes('報告') || q.includes('會議') || q.includes('主管') || q.includes('客戶')) {
    let report = `### 🤝 【${projName}】進度追蹤會議報告重點與建議架構\n\n`;
    report += `建議您在會議中依以下三段式架構報告：\n\n`;
    report += `#### 1. 當前成果與推進現況\n`;
    report += `- 專案整體進度：總待辦 ${actionItems.length} 項，已完成 **${completedCount} 項**（完成率 ${actionItems.length > 0 ? Math.round((completedCount / actionItems.length) * 100) : 0}%）。\n`;
    report += `- 近期已結案里程碑項目。\n\n`;

    report += `#### 2. 當前關鍵卡關與需協調事項（重點攻堅）\n`;
    if (topBottleneck) {
      report += `- 目前最大卡點：**等候「${topBottleneck.party}」**，已延誤 ${topBottleneck.delayedDays} 天。\n`;
      report += `- 會議需決議事項：明確請主管或相關窗口確認最終決行時間點。\n\n`;
    } else {
      report += `- 目前無重大卡關事項，各項按表操課中。\n\n`;
    }

    report += `#### 3. 下一步行動排程（Next Steps）\n`;
    const inProgressItems = actionItems.filter((i) => i.status !== 'completed').slice(0, 3);
    inProgressItems.forEach((item, idx) => {
      report += `- **${item.title}**（預計完成日: ${item.dueDate || '待確認'}，責任: ${item.owner || '未指定'}）\n`;
    });

    return report;
  }

  // 5. 預設綜合分析
  let report = `### 🤖 【${projName}】專案全方位現況診斷回饋\n\n`;
  report += `針對您的提問「*${question}*」，以下為本專案歷程數據之核心摘要：\n\n`;
  report += `- **專案進度概況**：總待辦 ${actionItems.length} 項，已完成 ${completedCount} 項，執行中 ${pendingCount} 項，卡關 ${blockedCount} 項。\n`;
  report += `- **工期數據**：已完成項目平均施作工期約 **${avgWorkDays > 0 ? `${avgWorkDays} 天` : '統計中'}**，全案累計調整/延期 **${totalRescheduledCount} 次**。\n`;
  if (topBottleneck) {
    report += `- **卡關焦點**：主要卡關對象為「**${topBottleneck.party}**」（累計延遲 ${topBottleneck.delayedDays} 天）。\n`;
  }
  report += `\n您可以繼續點選下方快捷建議問題，或直接提問更深入的特定議題（例如特定待辦項目的歷程、如何向主管爭取資源、下階段驗收注意事項等）！\n\n`;
  report += `> 💡 *小提示：如需享有自由流暢的 LLM 深度對話推理，可點擊彈窗右上角「⚙️ API 設定」填入 Google Gemini API Key（免費申請），系統將自動啟動 Gemini 模型進行回答！*`;

  return report;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { projectId, messages = [], customApiKey, customProvider, customModel } = body;

    const actionItems = await getActionItems(projectId === 'all' ? undefined : projectId);
    const projects = await getFullProjects();
    const targetProject = projectId && projectId !== 'all' ? projects.find((p) => p.id === projectId) : null;

    // 彙整專案與待辦事項完整數據
    const today = new Date();
    let totalDelayedDays = 0;
    let delayedItemsCount = 0;
    let totalWorkDays = 0;
    let completedWithWorkDaysCount = 0;
    let totalRescheduledCount = 0;
    const bottlenecks: Record<string, { count: number; delayedDays: number }> = {};
    const lessons: string[] = [];

    const formattedItems = actionItems.map((item, idx) => {
      if (item.lessonLearnt?.trim()) lessons.push(item.lessonLearnt.trim());

      let workDays: number | null = null;
      if (item.startedAt && item.completedAt) {
        const days = differenceInCalendarDays(new Date(item.completedAt), new Date(item.startedAt));
        if (days >= 0) {
          workDays = days;
          totalWorkDays += days;
          completedWithWorkDaysCount++;
        }
      } else if (item.startedAt) {
        const days = differenceInCalendarDays(today, new Date(item.startedAt));
        if (days >= 0) workDays = days;
      }

      const delayCount = item.dueDateHistory?.length || 0;
      totalRescheduledCount += delayCount;

      let delayDays = 0;
      if (item.dueDate) {
        const due = new Date(item.dueDate);
        const end = item.completedAt ? new Date(item.completedAt) : today;
        const diff = differenceInCalendarDays(end, due);
        if (diff > 0) {
          delayDays = diff;
          totalDelayedDays += diff;
          delayedItemsCount++;
          if (item.waitingOn?.trim()) {
            const key = item.waitingOn.trim();
            if (!bottlenecks[key]) bottlenecks[key] = { count: 0, delayedDays: 0 };
            bottlenecks[key].count++;
            bottlenecks[key].delayedDays += diff;
          }
        }
      }

      return {
        序號: idx + 1,
        標題: item.title,
        所屬專案: item.projectName || targetProject?.name || '未指定',
        專案案號: item.projectCaseNumber || targetProject?.caseNumber || '無',
        階段: item.phase,
        狀態: item.status === 'completed' ? '已完成' : item.status === 'blocked' ? '卡關等候中' : item.status === 'in_progress' ? '處理中' : '待處理',
        等候對象: item.waitingOn || '無',
        責任歸屬: item.owner || '未指定',
        預計完成日: item.dueDate || '未設定',
        初版基準日: item.originalDueDate || '未設定',
        延期次數: delayCount,
        延期歷程: item.dueDateHistory && item.dueDateHistory.length > 0 ? item.dueDateHistory : '無延期紀錄',
        實際開始時間: item.startedAt ? item.startedAt.slice(0, 10) : '未開始',
        實際完成時間: item.completedAt ? item.completedAt.slice(0, 10) : '未完成',
        工期天數: workDays !== null ? `${workDays} 天` : '未記錄',
        逾期天數: delayDays > 0 ? `${delayDays} 天` : '未逾期',
        歷程說明: item.notes || '無',
        經驗檢討: item.lessonLearnt || '無',
      };
    });

    const completedCount = actionItems.filter((i) => i.status === 'completed').length;
    const blockedCount = actionItems.filter((i) => i.status === 'blocked').length;
    const avgWorkDays = completedWithWorkDaysCount > 0 ? Math.round(totalWorkDays / completedWithWorkDaysCount) : 0;

    const projectSummary = targetProject
      ? `專案名稱: ${targetProject.name}
案號代碼: ${targetProject.caseNumber || '無'}
客戶單位: ${targetProject.clientName || '燁輝'}
專案類別: ${targetProject.projectCategory || ((targetProject as any).status === 'poc' ? '評估案' : '已開案')}
專案狀態: ${targetProject.internalStatus || targetProject.status}
專案來源: ${targetProject.sourceType || '燁輝列管專案'}
責任PM/窗口: ${targetProject.responsiblePm || targetProject.tpmOfficeContact || '未指定'}
專案預計結案日: ${targetProject.expectedCompletionDate ? targetProject.expectedCompletionDate.slice(0, 10) : '未設定'}
專案總待辦數: ${actionItems.length} 項
已完成待辦數: ${completedCount} 項
卡關等候中數: ${blockedCount} 項
已完成項目平均施作工期: ${avgWorkDays} 天
時程累計調整/延期次數: ${totalRescheduledCount} 次
累計延誤天數: ${totalDelayedDays} 天
主要卡關對象統計: ${JSON.stringify(bottlenecks)}`
      : `全廠專案綜合盤點
納入診斷專案數: ${projects.length} 個
全廠總待辦事項數: ${actionItems.length} 項
全廠已完成數: ${completedCount} 項
全廠卡關中數: ${blockedCount} 項
主要卡關熱點: ${JSON.stringify(bottlenecks)}`;

    const systemPrompt = `你是一位精通智慧製造、工廠數位轉型與進階專案管理（PMP）的資深 AI 專案顧問。
發問者是專案經理（PM）、主管或工程團隊成員。請依據下方提供的真實「專案背景資訊」與「該專案所有待辦事項及歷史時程數據」，專業、客觀且具體地回答發問者的問題。

【你的分析準則】：
1. 嚴格基於所提供的專案與待辦歷程真實數據作答，切勿無中生有。若提及日期、延誤天數、工期天數、延期次數或等候人名，請直接引用真實數據佐證。
2. 分析角度包含：
   - 時程與落差：初版預計日 vs 實際完成日、延期次數與原因、實際工作天數。
   - 瓶頸與責任：等候對象（waiting_on）卡關多久、責任歸屬是誰、跨單位或外部廠商溝通障礙。
   - 具體行動策略：針對目前卡關或延遲，提供發問者下週或近期開會可採取的談判、跟催、公文或會簽策略。
   - 經驗檢討（Lesson Learnt）：針對歷史發生的問題，歸納避免重蹈覆轍的制度或管理機制。
3. 繁體中文回答，語氣專業、清晰、結構化（善用小標題、條列分點與 Emoji 標註重點）。

---
【當前選定專案之基本資訊與統計數據】：
${projectSummary}

---
【當前專案的所有待辦事項明細資料 (${formattedItems.length} 項)】：
${JSON.stringify(formattedItems, null, 2)}
`;

    // 檢查使用的 API Key 與 Provider
    // 優先順序：前端自訂 Key > 伺服器環境變數
    const customKey = (customApiKey && typeof customApiKey === 'string') ? customApiKey.trim() : '';
    const envOpenAI = process.env.OPENAI_API_KEY?.trim() || '';
    const envGemini = process.env.GEMINI_API_KEY?.trim() || '';

    let apiKey = '';
    let provider: 'openai' | 'gemini' = 'openai';

    if (customKey) {
      apiKey = customKey;
      if (customKey.startsWith('AIza')) {
        provider = 'gemini';
      } else if (customKey.startsWith('sk-')) {
        provider = 'openai';
      } else {
        provider = customProvider === 'gemini' ? 'gemini' : 'openai';
      }
    } else if (envOpenAI) {
      apiKey = envOpenAI;
      provider = 'openai';
    } else if (envGemini) {
      apiKey = envGemini;
      provider = 'gemini';
    }

    // 依據金鑰特徵嚴格校正 Provider（防止 sk- 金鑰誤走 gemini 路由）
    if (apiKey.startsWith('sk-')) {
      provider = 'openai';
    } else if (apiKey.startsWith('AIza')) {
      provider = 'gemini';
    }

    // 模型指定：
    let defaultModel = 'gpt-5.6-luna';
    if (provider === 'openai') {
      defaultModel = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6-luna';
    } else {
      defaultModel = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';
    }

    // 檢查自訂模型是否相符（防止傳入 gemini 模型給 openai，或反之）
    let selectedModel = defaultModel;
    if (customModel && typeof customModel === 'string' && customModel.trim()) {
      const cm = customModel.trim();
      if (provider === 'openai' && cm.toLowerCase().includes('gemini')) {
        selectedModel = defaultModel;
      } else if (provider === 'gemini' && cm.toLowerCase().includes('gpt')) {
        selectedModel = defaultModel;
      } else {
        selectedModel = cm;
      }
    }

    let replyText = '';
    let usedModel = '';
    let apiErrorMessage = '';

    // 1. 若為 OpenAI (或提供 OpenAI API Key)
    if (apiKey && provider === 'openai') {
      try {
        usedModel = selectedModel;
        const openaiMessages = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ];

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: openaiMessages,
            temperature: 0.4,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          replyText = json?.choices?.[0]?.message?.content || '';
        } else {
          const errBody = await res.text();
          console.error(`OpenAI API 回傳錯誤 (${selectedModel}):`, res.status, errBody);
          try {
            const parsed = JSON.parse(errBody);
            apiErrorMessage = parsed?.error?.message || errBody;
          } catch {
            apiErrorMessage = errBody;
          }
        }
      } catch (err: any) {
        console.error('OpenAI API 請求例外:', err);
        apiErrorMessage = err?.message || String(err);
      }
    } else if (apiKey && (provider === 'gemini' || apiKey.startsWith('AIza'))) {
      // 2. 若為 Google Gemini API
      try {
        usedModel = selectedModel;
        const geminiContents = messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: systemPrompt }],
              },
              contents: geminiContents,
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 2048,
              },
            }),
          }
        );

        if (res.ok) {
          const json = await res.json();
          replyText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
          const errBody = await res.text();
          console.error(`Gemini API 回傳錯誤 (${selectedModel}):`, res.status, errBody);
          try {
            const parsed = JSON.parse(errBody);
            apiErrorMessage = parsed?.error?.message || errBody;
          } catch {
            apiErrorMessage = errBody;
          }
        }
      } catch (err: any) {
        console.error('Gemini API 請求例外:', err);
        apiErrorMessage = err?.message || String(err);
      }
    }

    // 3. 若未設定 API Key 或 API 呼叫失敗，啟用內建專家規則推理引擎
    if (!replyText) {
      usedModel = '內建專家規則引擎';
      const lastUserMsg = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
      const expertText = generateExpertResponse(
        lastUserMsg,
        targetProject,
        actionItems,
        formattedItems,
        bottlenecks,
        avgWorkDays,
        totalRescheduledCount,
        totalDelayedDays,
        lessons
      );

      if (apiErrorMessage) {
        replyText = `> ⚠️ **模型調用提示 (${selectedModel})**：${apiErrorMessage}\n>\n> *系統已自動切換至內建專家規則引擎為您提供本專案診斷：*\n\n${expertText}`;
      } else {
        replyText = expertText;
      }
    }

    return NextResponse.json({
      success: true,
      reply: replyText,
      usedModel,
      hasApiKey: !!apiKey,
    });
  } catch (error: any) {
    console.error('AI 對話路由異常:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'AI 對話處理失敗' },
      { status: 500 }
    );
  }
}
