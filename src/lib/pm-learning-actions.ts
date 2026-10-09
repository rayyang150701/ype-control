'use server';

import { revalidatePath } from 'next/cache';
import { createClient as getSupabaseClient } from '@/lib/supabase/server';
import { User, CurrentUser } from '@/types';
import { PMLearningCourse, PMLearningMemberProgress, DEFAULT_PM_CATEGORIES, PMLearningChapterUnit } from '@/types/pm-learning';

const SYSTEM_RECORD_KEY = '__SYSTEM_PM_LEARNING__';

import { isCourseManager, expandChecklistToItems } from '@/lib/pm-learning-utils';

/**
 * 篩選符合條件的億威電子 PMO / PM 部門人員
 */
export async function getPMOMembers(users: User[]): Promise<User[]> {
  return (users || []).filter((u) => {
    const isEmmt = (u.clientName || '').includes('億威');
    const dept = (u.department || '').toLowerCase().trim();
    const isPmoDept =
      dept === 'pm' ||
      dept === 'pmo' ||
      dept.includes('專案') ||
      dept.includes('管理');
    const isAdmin = u.role === 'super_admin' || u.role === 'admin';
    return (isEmmt && (isPmoDept || isAdmin)) || dept === 'pm' || dept === 'pmo';
  });
}

/**
 * 預設精選 PM 實務成長地圖課程
 */
function getDefaultSeedCourses(): PMLearningCourse[] {
  const now = new Date();
  const formatYMD = (d: Date) => d.toISOString().slice(0, 10);

  const seedStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const seedEndDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  return [
    {
      id: 'course-pmp-change-control',
      title: 'PMP 專案變更控制、四大階段進度追蹤與結案實務',
      instructorOrPlatform: 'PMI 國際專案管理學會 / 業界顧問',
      category: '專案管理與治理',
      description:
        '掌握專案從設計、施工、驗證至驗收四大階段的範圍基線（Baseline）變更控管與進度延誤關鍵預警機制。',
      externalUrl: 'https://www.pmi.org/certifications/project-management-pmp',
      startDate: formatYMD(seedStartDate),
      endDate: formatYMD(seedEndDate),
      assignedUserIds: [
        'de7c5b0d-4a8d-45d7-a7be-03d5d0466192',
        'a3239806-2e0d-4e6d-bff1-6ef5edd7cf7b',
        'bc185aac-97cb-4a8b-961c-2f26b69f2369',
      ],
      assignedUserNames: ['James', 'Winona', 'gary'],
      defaultChecklist: [
        '完成第 1~3 章：專案四大階段基線定義與變更審查流程',
        '研讀燁輝智慧製造實際案例差異分析甘特圖模型',
        '完成章節期末測驗並繳交一份實務專案驗收審查表',
      ],
      memberProgress: {
        'de7c5b0d-4a8d-45d7-a7be-03d5d0466192': {
          userId: 'de7c5b0d-4a8d-45d7-a7be-03d5d0466192',
          userName: 'James',
          userEmail: 'jamesyang@emmt.com.tw',
          progressPercent: 70,
          isCompleted: false,
          notes:
            '### 專案變更控制重點筆記\n- **變更管理原則**：任何超出 1.1~1.4 預定里程碑之工作，需先確認影響範圍與要徑（Critical Path）。\n- **各階段防呆**：驗收階段需備齊教育訓練教材與驗收測試報告。',
          checklist: [
            { id: 'chk-1', title: '完成第 1~3 章：專案四大階段基線定義與變更審查流程', completed: true },
            { id: 'chk-2', title: '研讀燁輝智慧製造實際案例差異分析甘特圖模型', completed: true },
            { id: 'chk-3', title: '完成章節期末測驗並繳交一份實務專案驗收審查表', completed: false },
          ],
          attachments: [
            {
              id: 'att-1',
              title: '專案範疇變更管控流程與標準範本.pdf',
              url: 'https://drive.google.com',
              type: 'drive',
            },
          ],
          updatedAt: new Date().toISOString(),
        },
        'a3239806-2e0d-4e6d-bff1-6ef5edd7cf7b': {
          userId: 'a3239806-2e0d-4e6d-bff1-6ef5edd7cf7b',
          userName: 'Winona',
          userEmail: 'winonalin@emmt.com.tw',
          progressPercent: 100,
          isCompleted: true,
          completedAt: formatYMD(new Date()),
          notes: '已完整修習完畢，並將驗收結案檢核清單落實於專案待辦事項中。',
          checklist: [
            { id: 'chk-1', title: '完成第 1~3 章：專案四大階段基線定義與變更審查流程', completed: true },
            { id: 'chk-2', title: '研讀燁輝智慧製造實際案例差異分析甘特圖模型', completed: true },
            { id: 'chk-3', title: '完成章節期末測驗並繳交一份實務專案驗收審查表', completed: true },
          ],
          attachments: [],
          updatedAt: new Date().toISOString(),
        },
        'bc185aac-97cb-4a8b-961c-2f26b69f2369': {
          userId: 'bc185aac-97cb-4a8b-961c-2f26b69f2369',
          userName: 'gary',
          userEmail: 'garylee@emmt.com.tw',
          progressPercent: 40,
          isCompleted: false,
          notes: '目前研讀進度至第二章甘特圖時程基線維護。',
          checklist: [
            { id: 'chk-1', title: '完成第 1~3 章：專案四大階段基線定義與變更審查流程', completed: true },
            { id: 'chk-2', title: '研讀燁輝智慧製造實際案例差異分析甘特圖模型', completed: false },
            { id: 'chk-3', title: '完成章節期末測驗並繳交一份實務專案驗收審查表', completed: false },
          ],
          attachments: [],
          updatedAt: new Date().toISOString(),
        },
      },
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'course-smart-manufacturing-intro',
      title: '智慧製造執行方案架構與廠區設備數據整合實務',
      instructorOrPlatform: '工研院產業學院 / 智慧機械技術中心',
      category: '智慧製造與技術',
      description:
        '深入解析天車貯存控制、過磅管理、露點監測及 PLC 數據自動化串接架構，強化 PM 與現場工程師對話能力。',
      externalUrl: 'https://college.itri.org.tw/',
      startDate: formatYMD(seedStartDate),
      endDate: formatYMD(seedEndDate),
      assignedUserIds: [
        'de7c5b0d-4a8d-45d7-a7be-03d5d0466192',
        'a3239806-2e0d-4e6d-bff1-6ef5edd7cf7b',
        '998dbd71-b9f0-4459-8b3a-57737acb2f18',
        'cb14b98c-98bc-4aaf-aa52-65d876735992',
      ],
      assignedUserNames: ['James', 'Winona', 'AlbeeHsu', 'bella'],
      defaultChecklist: [
        '觀看模組一：工業物聯網 IIoT 與 PLC 通訊原理',
        '完成現場調校與出差行事曆配合注意事項',
        '完成智慧製造架構測驗及重點筆記整理',
      ],
      memberProgress: {
        'de7c5b0d-4a8d-45d7-a7be-03d5d0466192': {
          userId: 'de7c5b0d-4a8d-45d7-a7be-03d5d0466192',
          userName: 'James',
          userEmail: 'jamesyang@emmt.com.tw',
          progressPercent: 65,
          isCompleted: false,
          notes:
            '已掌握 PLC 數據自動採集與 Edge 端快取機制。現場施工與調校需提早排定行事曆。',
          checklist: [
            { id: 'chk-1', title: '觀看模組一：工業物聯網 IIoT 與 PLC 通訊原理', completed: true },
            { id: 'chk-2', title: '完成現場調校與出差行事曆配合注意事項', completed: true },
            { id: 'chk-3', title: '完成智慧製造架構測驗及重點筆記整理', completed: false },
          ],
          attachments: [
            {
              id: 'att-2',
              title: '廠區設備通訊架構與安全指引.pptx',
              url: 'https://drive.google.com',
              type: 'drive',
            },
          ],
          updatedAt: new Date().toISOString(),
        },
      },
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'course-agile-pm-delivery',
      title: '敏捷專案管理 (Agile & Scrum) 與高效率待辦清單落地',
      instructorOrPlatform: 'Hahow 線上學院 / 敏捷教練實戰營',
      category: '敏捷方法與協同',
      description:
        '學習雙週衝刺迭代、卡關阻礙（Roadblock）快速排除法、日常站會與複盤總結，提升交付節奏。',
      externalUrl: 'https://hahow.in/',
      startDate: formatYMD(seedStartDate),
      endDate: formatYMD(seedEndDate),
      assignedUserIds: [
        'a3239806-2e0d-4e6d-bff1-6ef5edd7cf7b',
        '998dbd71-b9f0-4459-8b3a-57737acb2f18',
        'cb14b98c-98bc-4aaf-aa52-65d876735992',
      ],
      assignedUserNames: ['Winona', 'AlbeeHsu', 'bella'],
      defaultChecklist: [
        '完成第 1~4 單元影音課程',
        '練習拆解待辦事項為 3~5 天可驗證的最小行動單位',
        '試行一次週進度卡關複盤紀錄',
      ],
      memberProgress: {},
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'course-stakeholder-comm',
      title: '跨部門溝通心法、需求訪談與利害關係人期望管理',
      instructorOrPlatform: '天下學習 / 領導與溝通學院',
      category: '跨部門溝通與談判',
      description:
        '掌握客戶 TPM 窗口、現場操作員、工程研發團隊之間的溝通樞紐角色，快速收斂歧見並建立信任。',
      externalUrl: 'https://www.cheers.com.tw/',
      startDate: formatYMD(seedStartDate),
      endDate: formatYMD(seedEndDate),
      assignedUserIds: [
        'de7c5b0d-4a8d-45d7-a7be-03d5d0466192',
        'bc185aac-97cb-4a8b-961c-2f26b69f2369',
      ],
      assignedUserNames: ['James', 'gary'],
      defaultChecklist: [
        '完成利害關係人期望矩陣練習',
        '研讀衝突協商五大策略',
        '產出訪談要點範本',
      ],
      memberProgress: {},
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'article-genai-manufacturing-scheduling',
      type: 'article',
      title: '生成式 AI 在製造業製程排程與異常派工之落地實例',
      instructorOrPlatform: '數位時代付費專欄 · 智慧製造前沿',
      category: 'AI應用與工具',
      source: '數位時代付費專欄',
      issueDate: '2026-10',
      timelinessType: 'time_sensitive',
      description:
        '深度剖析國內鋼鐵與扣件大廠如何運用 LLM 結合 MES 工單紀錄，在突發設備停機時於 3 分鐘內自動推薦替代排程路徑。',
      externalUrl: 'https://www.bnext.com.tw/',
      hours: 0.5,
      startDate: formatYMD(seedStartDate),
      endDate: formatYMD(seedEndDate),
      assignedUserIds: [
        'de7c5b0d-4a8d-45d7-a7be-03d5d0466192',
        'a3239806-2e0d-4e6d-bff1-6ef5edd7cf7b',
      ],
      assignedUserNames: ['James', 'Winona'],
      content: `## 前言：製造現場突發異常的排程痛點

傳統鋼鐵表面處理與冷軋烤漆產線中，當關鍵感測器或冷卻輥輪發生異常停機時，現場生管與工程師往往需要花費 45~90 分鐘翻找舊維修記錄，並重新調整工單優先順序。

> 「在智慧製造 4.0 階段，最昂貴的不是設備硬體，而是產線停等時每一分鐘所耗損的產能機會成本。」

### 一、生成式 AI 結合 MES 的三大整合要點

1. **知識庫向量化檢索 (RAG)**：將過往 3 年產線異常排除報告與點檢表建立向量索引。
2. **多條件約束排程推理**：由 LLM 依據合約交期、鋼種厚度切換成本與當前產線負荷快速提出前 3 名最佳派工建議。
3. **現場人機協同決策**：AI 僅做「決策輔助與風險揭露」，由現場領班一鍵確認後方下發 PLC 排程指令。

### 二、億威與燁輝現行專案之借鏡應用

- **烤三與冷軋出入口警示專案**：可將歷史頻發警報代碼與排除 SOP 整理為標準 Prompt，未來若發生停機，PM 與現場工程師可迅速定位責任方與應變工序。
- **時效性叮嚀**：本文介紹之模型架構為 2026 Q3 最新微調版本，建議於近期評估案中列為技術驗證參考指標。

---
*本文節錄自數位時代專欄，僅供億威電子內部學習研究使用。*`,
      aiAnalysis: {
        summary:
          '本文探討製造業如何透過 LLM + RAG 解決產線設備異常時的排程瓶頸，強調人機協同與即時風險揭露的重要性。',
        keyTakeaways: [
          '產線停機決策時間可由 60 分鐘壓縮至 3 分鐘內。',
          '歷史維修工單必須標準化結構化，方能發揮向量檢索成效。',
          'AI 擔任建議角色，最終執行權仍保留給現場領班，確保生產安全。',
        ],
        actionableInsights: [
          '可將燁輝烤三專案現有異常代碼與排除工時建立簡易知識庫。',
          '評估於週報中加入「AI 派工輔助可行性評估」小結。',
        ],
        analyzedAt: '2026-10-01T10:00:00Z',
        modelName: 'Gemini 2.5 Flash',
      },
      memberProgress: {},
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'video-iiot-modbus-opcua',
      type: 'video',
      title: '工業物聯網現場通訊實務：Modbus TCP、OPC UA 與 MQTT 整合架構',
      instructorOrPlatform: 'YouTube · 智慧製造工控技術研習',
      category: '智慧製造與技術',
      source: 'YouTube 工控技術頻道',
      description:
        '20 分鐘精華解析工廠現場常見通訊協定差異，特別針對現場 Gateway 資料丟包與連線不穩定的排查技巧。',
      externalUrl: 'https://www.youtube.com',
      hours: 0.5,
      startDate: formatYMD(seedStartDate),
      endDate: formatYMD(seedEndDate),
      assignedUserIds: [
        'de7c5b0d-4a8d-45d7-a7be-03d5d0466192',
        'bc185aac-97cb-4a8b-961c-2f26b69f2369',
      ],
      assignedUserNames: ['James', 'gary'],
      videoTimestampNotes: `### 影片重點時間標籤\n- **02:15** Modbus TCP 輪詢頻率過高導致 PLC 緩衝區溢位問題\n- **08:40** OPC UA 認證與端點加密配置重點\n- **14:20** MQTT Broker 在 Edge 端的斷線續傳與 QoS 設定\n- **18:00** 現場除錯必備 Wireshark 封包過濾指令`,
      memberProgress: {},
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'book-radical-candor-pm',
      type: 'book',
      title: '《徹底坦率：一種有話直說的領導風格》PM 溝通反思',
      instructorOrPlatform: '天下文化 / 專案經理經典選讀',
      category: '跨部門溝通與談判',
      source: '天下文化',
      description:
        '探討如何在專案遇到時程延誤時，既能對客戶與協力廠商「當面挑戰」，又能展現「個人關懷」，避免表面和諧導致的專案爛尾。',
      hours: 2,
      startDate: formatYMD(seedStartDate),
      endDate: formatYMD(seedEndDate),
      assignedUserIds: [
        'de7c5b0d-4a8d-45d7-a7be-03d5d0466192',
        'a3239806-2e0d-4e6d-bff1-6ef5edd7cf7b',
      ],
      assignedUserNames: ['James', 'Winona'],
      bookQuotesAndReflections: `### 核心金句\n> 「最有害的領導不是殘酷無情，而是虛情假意的表面和諧。」\n\n### 專案實務反思與落地行動 (Action Items)\n1. **每週會議前置溝通**：若發現有待辦事項可能延期超過 3 天，立即在週報前提早告知利害關係人，不隱瞞壞消息。\n2. **溝通矩陣練習**：針對不同客戶 TPM 窗口的溝通偏好，建立一頁式專案需求確認單。`,
      memberProgress: {},
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

function toSafeDateStringOrNull(val: any): string | null {
  if (!val) return null;
  const s = String(val).trim();
  if (!s || s === 'null' || s === 'undefined' || s === 'Invalid Date') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toDbPayload(c: PMLearningCourse) {
  const mp: Record<string, any> = { ...(c.memberProgress || {}) };
  if (c.hours !== undefined && c.hours !== null) {
    mp._courseHours = Number(c.hours);
  }
  mp._itemMetadata = {
    type: c.type || 'course',
    content: c.content || '',
    source: c.source || '',
    subSource: c.subSource || '',
    issueDate: c.issueDate || '',
    timelinessType: c.timelinessType || 'evergreen',
    aiAnalysis: c.aiAnalysis || null,
    videoTimestampNotes: c.videoTimestampNotes || '',
    bookQuotesAndReflections: c.bookQuotesAndReflections || '',
    isPinned: Boolean(c.isPinned),
  };
  return {
    id: c.id,
    title: c.title || '',
    instructor_or_platform: c.instructorOrPlatform || '',
    category: c.category || '專案管理與治理',
    description: c.description || '',
    external_url: c.externalUrl || '',
    start_date: toSafeDateStringOrNull(c.startDate),
    end_date: toSafeDateStringOrNull(c.endDate),
    assigned_user_ids: Array.isArray(c.assignedUserIds) ? c.assignedUserIds : [],
    assigned_user_names: Array.isArray(c.assignedUserNames) ? c.assignedUserNames : [],
    default_checklist: Array.isArray(c.defaultChecklist) ? c.defaultChecklist : [],
    member_progress: mp,
    created_by: c.createdBy || '',
    created_at: c.createdAt || new Date().toISOString(),
    updated_at: c.updatedAt || new Date().toISOString(),
  };
}

function fromDbRecord(c: any): PMLearningCourse {
  let rawMp = c.member_progress ?? c.memberProgress;
  if (typeof rawMp === 'string') {
    try {
      rawMp = JSON.parse(rawMp);
    } catch {
      rawMp = {};
    }
  }
  const rawObj =
    typeof rawMp === 'object' && rawMp !== null ? { ...rawMp } : {};
  let hours = 0;
  if (c.hours !== undefined && c.hours !== null) {
    hours = Number(c.hours);
  } else if (rawObj._courseHours !== undefined && rawObj._courseHours !== null) {
    hours = Number(rawObj._courseHours);
  }

  const meta = (typeof rawObj._itemMetadata === 'object' && rawObj._itemMetadata) || {};

  const defaultChecklist = Array.isArray(c.default_checklist)
    ? c.default_checklist
    : Array.isArray(c.defaultChecklist)
    ? c.defaultChecklist
    : [];

  const hasChapterInDefault = defaultChecklist.some(
    (item: any) =>
      item &&
      typeof item === 'object' &&
      Array.isArray(item.subUnits) &&
      item.subUnits.length > 0
  );

  // 清除 memberProgress 中的內部持久化特殊 key，只保留實際成員進度，並做屬性陣列防呆
  const cleanMemberProgress: Record<string, PMLearningMemberProgress> = {};
  Object.keys(rawObj).forEach((k) => {
    if (k.startsWith('_')) return;
    const prog = rawObj[k];
    if (prog && typeof prog === 'object') {
      const rawChecklist = Array.isArray(prog.checklist) ? prog.checklist : [];
      let finalChecklist = rawChecklist;

      // 若 defaultChecklist 具備兩階大單元/子單元，但成員進度仍為舊版未包含 chapterTitle 的扁平項目
      const hasChapterInProg = rawChecklist.some((item: any) => Boolean(item?.chapterTitle));
      if (hasChapterInDefault && !hasChapterInProg && defaultChecklist.length > 0) {
        const expanded = expandChecklistToItems(defaultChecklist);
        const completedTitles = new Set(
          rawChecklist
            .filter((chk: any) => chk?.completed)
            .map((chk: any) => (chk?.title || '').trim())
        );
        finalChecklist = expanded.map((item) => ({
          ...item,
          completed: completedTitles.has(item.title.trim()),
        }));
      }

      // 確保個人歷程札記清單存在，若有既有 notes 且無 reflections 則平滑遷移為第一筆歷程
      let reflections = Array.isArray(prog.reflections) ? prog.reflections : [];
      if (reflections.length === 0 && typeof prog.notes === 'string' && prog.notes.trim()) {
        reflections = [
          {
            id: `legacy-${k}`,
            createdAt: prog.updatedAt
              ? String(prog.updatedAt).replace('T', ' ').slice(0, 16)
              : new Date().toISOString().replace('T', ' ').slice(0, 16),
            content: prog.notes.trim(),
            relatedUnit: '課程初期心得',
          },
        ];
      }

      cleanMemberProgress[k] = {
        ...prog,
        progressPercent: typeof prog.progressPercent === 'number' ? prog.progressPercent : 0,
        isCompleted: Boolean(prog.isCompleted),
        isPinned: Boolean(prog.isPinned),
        sortOrder: typeof prog.sortOrder === 'number' ? prog.sortOrder : undefined,
        checklist: finalChecklist,
        attachments: Array.isArray(prog.attachments) ? prog.attachments : [],
        reflections,
      };
    }
  });

  return {
    id: c.id || '',
    type: c.type || meta.type || 'course',
    title: c.title || '',
    instructorOrPlatform: c.instructor_or_platform || c.instructorOrPlatform || '',
    category: c.category || '專案管理與治理',
    description: c.description || '',
    externalUrl: c.external_url || c.externalUrl || '',
    hours: hours || 0,
    startDate: c.start_date ? String(c.start_date).slice(0, 10) : (c.startDate ? String(c.startDate).slice(0, 10) : ''),
    endDate: c.end_date ? String(c.end_date).slice(0, 10) : (c.endDate ? String(c.endDate).slice(0, 10) : ''),
    assignedUserIds: Array.isArray(c.assigned_user_ids)
      ? c.assigned_user_ids
      : Array.isArray(c.assignedUserIds)
      ? c.assignedUserIds
      : [],
    assignedUserNames: Array.isArray(c.assigned_user_names)
      ? c.assigned_user_names
      : Array.isArray(c.assignedUserNames)
      ? c.assignedUserNames
      : [],
    defaultChecklist: Array.isArray(c.default_checklist)
      ? c.default_checklist
      : Array.isArray(c.defaultChecklist)
      ? c.defaultChecklist
      : [],
    memberProgress: cleanMemberProgress,
    isPinned: Boolean(c.is_pinned ?? c.isPinned ?? meta.isPinned ?? false),
    content: c.content || meta.content || '',
    source: c.source || meta.source || '',
    subSource: c.subSource || meta.subSource || '',
    issueDate: c.issueDate || meta.issueDate || '',
    timelinessType: c.timelinessType || meta.timelinessType || 'evergreen',
    aiAnalysis: c.aiAnalysis || meta.aiAnalysis || undefined,
    videoTimestampNotes: c.videoTimestampNotes || meta.videoTimestampNotes || '',
    bookQuotesAndReflections: c.bookQuotesAndReflections || meta.bookQuotesAndReflections || '',
    createdBy: c.created_by || c.createdBy || '',
    createdAt: c.created_at || c.createdAt || new Date().toISOString(),
    updatedAt: c.updated_at || c.updatedAt || new Date().toISOString(),
  };
}

/**
 * 取得所有 PM 學習地圖課程清單
 */
export async function getPMLearningCourses(): Promise<PMLearningCourse[]> {
  const supabase = getSupabaseClient();
  try {
    // 1. 優先嘗試查詢獨立資料表 pm_learning_courses
    const { data: dbCourses, error } = await supabase
      .from('pm_learning_courses')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && dbCourses && dbCourses.length > 0) {
      return dbCourses.map(fromDbRecord);
    }

    // 2. 備援儲存讀取：從 clients 系統紀錄中讀取
    const { data: sysRecord } = await supabase
      .from('clients')
      .select('notes')
      .eq('name', SYSTEM_RECORD_KEY)
      .maybeSingle();

    if (sysRecord && sysRecord.notes) {
      try {
        const parsed = JSON.parse(sysRecord.notes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped = parsed.map(fromDbRecord);
          // 若獨立表已存在但為空，順便回填獨立表
          await syncCoursesToDatabase(mapped);
          return mapped;
        }
      } catch (e) {
        console.error('解析 PM 學習地圖資料失敗:', e);
      }
    }

    // 3. 若為首次啟用，自動初始化種子資料並持久化儲存
    const seedCourses = getDefaultSeedCourses();
    await syncCoursesToDatabase(seedCourses);
    return seedCourses.map(fromDbRecord);
  } catch (err) {
    console.error('讀取 PM 學習地圖課程失敗:', err);
    return getDefaultSeedCourses().map(fromDbRecord);
  }
}

/**
 * 將課程陣列同步至資料庫（同時寫入主資料表 pm_learning_courses 與備援表 clients）
 */
async function syncCoursesToDatabase(courses: PMLearningCourse[]): Promise<boolean> {
  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();
  try {
    // 1. 寫入 pm_learning_courses 主表
    const dbPayload = courses.map(toDbPayload);
    const { error: dbErr } = await supabase.from('pm_learning_courses').upsert(dbPayload, { onConflict: 'id' });
    if (dbErr) {
      console.warn('寫入 pm_learning_courses 主表警告:', dbErr);
    }

    // 2. 寫入 clients 備援
    await supabase.from('clients').upsert(
      {
        name: SYSTEM_RECORD_KEY,
        code: 'PM_LEARN',
        notes: JSON.stringify(courses),
        updated_at: nowIso,
      },
      { onConflict: 'name' }
    );
    return true;
  } catch (e) {
    console.error('儲存 PM 學習地圖失敗:', e);
    return false;
  }
}

/**
 * 建立新課程與指派成員（支援個人自行新增與管理者指派）
 */
export async function createPMLearningCourse(
  courseData: Omit<PMLearningCourse, 'id' | 'createdAt' | 'updatedAt' | 'memberProgress'> & {
    initialChecklist?: (string | PMLearningChapterUnit)[];
  }
) {
  const supabase = getSupabaseClient();
  try {
    const nowIso = new Date().toISOString();
    const newId = `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 為每位指派成員建立初始進度紀錄
    const memberProgress: Record<string, PMLearningMemberProgress> = {};
    const defaultChecklist =
      courseData.initialChecklist || courseData.defaultChecklist || [];

    const assignedIds = Array.isArray(courseData.assignedUserIds) ? courseData.assignedUserIds : [];
    const assignedNames = Array.isArray(courseData.assignedUserNames) ? courseData.assignedUserNames : [];

    assignedIds.forEach((uid, idx) => {
      memberProgress[uid] = {
        userId: uid,
        userName: assignedNames[idx] || '成員',
        progressPercent: 0,
        isCompleted: false,
        notes: '',
        checklist: expandChecklistToItems(defaultChecklist),
        attachments: [],
        updatedAt: nowIso,
      };
    });

    const newCourse: PMLearningCourse = {
      id: newId,
      type: courseData.type || 'course',
      title: courseData.title.trim(),
      instructorOrPlatform: courseData.instructorOrPlatform.trim(),
      category: courseData.category || '專案管理與治理',
      description: courseData.description?.trim() || '',
      externalUrl: courseData.externalUrl?.trim() || '',
      hours: courseData.hours !== undefined ? Number(courseData.hours) : 0,
      startDate: courseData.startDate || '',
      endDate: courseData.endDate || '',
      assignedUserIds: assignedIds,
      assignedUserNames: assignedNames,
      defaultChecklist,
      memberProgress,
      isPinned: Boolean(courseData.isPinned),
      content: courseData.content || '',
      source: courseData.source || '',
      subSource: courseData.subSource || '',
      issueDate: courseData.issueDate || '',
      timelinessType: courseData.timelinessType || 'evergreen',
      aiAnalysis: courseData.aiAnalysis,
      videoTimestampNotes: courseData.videoTimestampNotes || '',
      bookQuotesAndReflections: courseData.bookQuotesAndReflections || '',
      createdBy: courseData.createdBy || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 1. 直接插入至 pm_learning_courses 資料表
    const { error: insertError } = await supabase
      .from('pm_learning_courses')
      .insert(toDbPayload(newCourse));

    if (insertError) {
      console.warn('插入 pm_learning_courses 警告:', insertError);
    }

    // 2. 同步更新整體課程備援快取
    const currentList = await getPMLearningCourses();
    const updatedList = [newCourse, ...currentList.filter((c) => c.id !== newCourse.id)];
    await syncCoursesToDatabase(updatedList);

    revalidatePath('/pm-learning');
    return {
      success: true,
      message: '項目已成功建立並完成指派！',
      data: fromDbRecord(toDbPayload(newCourse)),
    };
  } catch (err: any) {
    console.error('建立 PM 學習項目失敗:', err);
    return { success: false, message: err?.message || '建立項目失敗' };
  }
}

/**
 * 針對知識文章進行 AI 摘要與實務落地分析 (可使用系統 OPENAI_API_KEY 或備用智慧結構化分析)
 */
export async function analyzeArticleContentAction(
  courseId: string,
  customText?: string
): Promise<{ success: boolean; data?: PMLearningCourse; message?: string }> {
  try {
    const list = await getPMLearningCourses();
    const target = list.find((c) => c.id === courseId);
    if (!target) {
      return { success: false, message: '找不到指定文章' };
    }

    let textToAnalyze = (
      customText ||
      target.content ||
      target.bookQuotesAndReflections ||
      target.videoTimestampNotes ||
      target.description ||
      target.title
    ).trim();

    // 若 defaultChecklist 篇目有各自的 content，亦彙整入全文脈絡供 AI 深度分析
    if (!customText && Array.isArray(target.defaultChecklist)) {
      const extraChapterTexts = target.defaultChecklist
        .map((c: any, idx: number) => {
          if (c && typeof c === 'object' && c.content?.trim()) {
            return `### 【第 ${idx + 1} 篇：${c.title || ''}】\n${c.content.trim()}`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n');
      if (extraChapterTexts) {
        textToAnalyze = textToAnalyze ? `${textToAnalyze}\n\n${extraChapterTexts}` : extraChapterTexts;
      }
    }

    if (!textToAnalyze) {
      return { success: false, message: '目前尚無重點內容或內文可供 AI 分析' };
    }

    const typeLabel =
      target.type === 'book'
        ? '個人閱讀書籍'
        : target.type === 'video'
        ? '影音資源'
        : target.type === 'course'
        ? '線上課程'
        : '知識文章';

    const chaptersContext =
      Array.isArray(target.defaultChecklist) && target.defaultChecklist.length > 0
        ? `\n章節單元大綱：\n` +
          target.defaultChecklist
            .map((c: any) =>
              typeof c === 'string'
                ? `- ${c}`
                : `- ${c.title}${Array.isArray(c.subUnits) && c.subUnits.length > 0 ? ` (${c.subUnits.join(', ')})` : ''}`
            )
            .join('\n')
        : '';

    let summary = '';
    let keyTakeaways: string[] = [];
    let actionableInsights: string[] = [];
    let modelName = 'AI 智慧分析引擎';

    const apiKey = process.env.OPENAI_API_KEY;
    const envModel = process.env.OPENAI_MODEL?.trim();
    // 優先採用 gpt-6-luna，若環境變數仍為舊版 gpt-5.6-luna 自動升級為 gpt-6-luna
    const model = (!envModel || envModel === 'gpt-5.6-luna') ? 'gpt-6-luna' : envModel;

    if (apiKey) {
      try {
        const isReasoningOrLuna =
          model.includes('luna') ||
          model.includes('o1') ||
          model.includes('o3') ||
          model.includes('5.6') ||
          model.includes('6');

        const requestPayload: any = {
          model: model,
          messages: [
            {
              role: 'system',
              content:
                '你是一位精通智慧製造（如鋼鐵表面處理、產線自動化、MES）與企業級專案管理 (PMP / Agile) 的資深顧問兼教練。請閱讀使用者提供的內容（包含付費文章、線上課程講義、影音重點筆記或個人閱讀書籍反思），輸出結構化 JSON，格式為：\n{"summary": "200字核心摘要", "keyTakeaways": ["重點觀點1", "重點觀點2", "重點觀點3"], "actionableInsights": ["PM落地實務建議1 (針對現場/協同)", "PM落地實務建議2"]}\n只回傳合法 JSON 字串，不要包含額外文字。',
            },
            {
              role: 'user',
              content: `標題：${target.title}\n載體類型：${typeLabel}\n領域：${target.category}\n出刊/來源：${target.source || target.instructorOrPlatform || ''}${target.subSource ? ` (${target.subSource})` : ''}${target.issueDate ? ` (${target.issueDate})` : ''}${target.externalUrl ? `\n外部來源/Notion網址：${target.externalUrl}` : ''}${Array.isArray(target.attachments) && target.attachments.length > 0 ? `\n相關附件/成果連結：${target.attachments.map((a: any) => `${a.name || a.fileName}: ${a.url || a.webViewLink}`).join('; ')}` : ''}\n${chaptersContext}\n\n重點內容與全文（包含圖表標註與數據說明）：\n${textToAnalyze.slice(0, 10000)}`,
            },
          ],
          response_format: { type: 'json_object' },
        };

        // gpt-6-luna / luna / o1 / o3 等推理模型僅支援預設 temperature (1)，自訂數值會觸發 400 錯誤
        if (!isReasoningOrLuna) {
          requestPayload.temperature = 0.3;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestPayload),
        });

        if (response.ok) {
          const jsonRes = await response.json();
          const rawContent = jsonRes?.choices?.[0]?.message?.content?.trim();
          if (rawContent) {
            const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            summary = parsed.summary || '';
            keyTakeaways = Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [];
            actionableInsights = Array.isArray(parsed.actionableInsights) ? parsed.actionableInsights : [];
            modelName = jsonRes.model || model;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error('[OpenAI 導讀分析異常]:', response.status, errData);
        }
      } catch (aiErr) {
        console.warn('呼叫 OpenAI API 失敗，切換為智慧結構化分析備援:', aiErr);
      }
    }

    // 若 API 未提供或失敗，使用優雅的備援結構化分析
    if (!summary) {
      const paragraphs = textToAnalyze
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p && !p.startsWith('#') && !p.startsWith('!') && !p.startsWith('---'));

      summary =
        paragraphs.slice(0, 2).join(' ') ||
        `本項目深入剖析「${target.title}」之核心架構，歸納在${target.category}領域之實務脈絡與落地重點。`;

      keyTakeaways = [
        `聚焦「${target.category}」的核心思維與前沿架構，建立標準化檢核流程。`,
        paragraphs.length > 2
          ? paragraphs[2].slice(0, 60) + '...'
          : '透過系統化管理與跨部門協同，降低因資訊不對稱帶來的返工風險。',
        '重視數據驅動與即時追蹤機制，確保交付品質與產線安全。',
      ];

      actionableInsights = [
        '可將本內容所提方法，評估導入於當前專案與例行會議之管控檢核表。',
        '建議於週報卡關複盤時，引導成員參考本架構進行根因探討與行動方案。',
      ];
      modelName = '智慧結構化萃取 (內建)';
    }

    const aiAnalysis = {
      summary,
      keyTakeaways,
      actionableInsights,
      analyzedAt: new Date().toISOString(),
      modelName,
    };

    const updateRes = await updatePMLearningCourse(courseId, { aiAnalysis });
    return {
      success: true,
      data: updateRes.data,
      message: 'AI 重點導讀與摘要分析完成！',
    };
  } catch (err: any) {
    console.error('AI 分析文章失敗:', err);
    return { success: false, message: err?.message || '分析失敗' };
  }
}

/**
 * 針對指定知識文章，向 AI 進行互動式提問與深入探討 (支援多輪對話歷程，模型採用 gpt-6-luna)
 */
export async function askArticleQuestionAction(
  courseId: string,
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  activeChapterTitle?: string
): Promise<{
  success: boolean;
  answer?: string;
  model?: string;
  message?: string;
}> {
  try {
    const trimmedQ = (question || '').trim();
    if (!trimmedQ) {
      return { success: false, message: '請輸入您想詢問的問題' };
    }

    const list = await getPMLearningCourses();
    const target = list.find((c) => c.id === courseId);
    if (!target) {
      return { success: false, message: '找不到指定文章' };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const envModel = process.env.OPENAI_MODEL?.trim();
    // 優先採用 gpt-6-luna，若環境變數仍為舊版 gpt-5.6-luna 自動升級為 gpt-6-luna
    const model = (!envModel || envModel === 'gpt-5.6-luna') ? 'gpt-6-luna' : envModel;
    const typeLabel =
      target.type === 'book'
        ? '個人閱讀書籍'
        : target.type === 'video'
        ? '影音資源'
        : target.type === 'course'
        ? '線上課程'
        : '知識文章';

    let textToAnalyze = (
      target.content ||
      target.bookQuotesAndReflections ||
      target.videoTimestampNotes ||
      target.description ||
      target.title
    ).trim();

    // 若 defaultChecklist 篇目有各自的 content，亦彙整入全文脈絡
    if (Array.isArray(target.defaultChecklist)) {
      const extraChapterTexts = target.defaultChecklist
        .map((c: any, idx: number) => {
          if (c && typeof c === 'object' && c.content?.trim()) {
            return `### 【第 ${idx + 1} 篇：${c.title || ''}】\n${c.content.trim()}`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n');
      if (extraChapterTexts) {
        textToAnalyze = textToAnalyze ? `${textToAnalyze}\n\n${extraChapterTexts}` : extraChapterTexts;
      }
    }

    const chaptersContext =
      Array.isArray(target.defaultChecklist) && target.defaultChecklist.length > 0
        ? `\n【章節單元大綱清單】\n` +
          target.defaultChecklist
            .map((c: any) =>
              typeof c === 'string'
                ? `- ${c}`
                : `- ${c.title}${Array.isArray(c.subUnits) && c.subUnits.length > 0 ? ` (${c.subUnits.join(', ')})` : ''}`
            )
            .join('\n')
        : '';

    // 彙整項目核心背景與已萃取之 AI 導讀成果作為智庫記憶庫
    const backgroundContext = [
      `【研讀項目基本資訊】`,
      `標題：${target.title}`,
      `型態：${typeLabel}`,
      `領域：${target.category}`,
      `出刊/來源：${target.source || target.instructorOrPlatform || '專案知識庫'}${target.subSource ? ` (${target.subSource})` : ''}`,
      target.issueDate ? `出刊/發布日期：${target.issueDate}` : '',
      target.externalUrl ? `外部來源/Notion/專欄網址：${target.externalUrl}` : '',
      Array.isArray(target.attachments) && target.attachments.length > 0
        ? `相關成果/附件連結：\n${target.attachments.map((a: any) => `- ${a.name || a.fileName}: ${a.url || a.webViewLink}`).join('\n')}`
        : '',
      activeChapterTitle ? `【目前研讀焦點篇目】：${activeChapterTitle}` : '',
      chaptersContext,
      target.aiAnalysis?.summary ? `\n【AI 核心摘要】\n${target.aiAnalysis.summary}` : '',
      target.aiAnalysis?.keyTakeaways?.length ? `\n【核心啟發 (Key Takeaways)】\n${target.aiAnalysis.keyTakeaways.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}` : '',
      target.aiAnalysis?.actionableInsights?.length ? `\n【實務落地建議】\n${target.aiAnalysis.actionableInsights.map((a) => `▸ ${a}`).join('\n')}` : '',
      `\n【重點內容/完整內文（包含圖表標註與數據說明）】\n${textToAnalyze.slice(0, 12000)}`
    ].filter(Boolean).join('\n');

    const systemPrompt = `你是一位精通智慧製造（如鋼鐵表面處理、熱浸鍍鋅、產線自動化、MES系統、產線OT連網）與企業級專案管理 (PMP / Agile / 卡關跟催) 的資深顧問兼智庫教練。
使用者正在研讀${typeLabel}《${target.title}》，並向你深入提問或請教專案落地做法。

【研讀脈絡與背景資訊】
${backgroundContext}

【回答指導原則】
1. 請以親切、專業、條理分明的「繁體中文（台灣）」回答。
2. 緊扣本內容的核心主軸與論述，切中問題要害。
3. 若內文包含圖表標註（如營收佔比、數據走勢、流程圖等）或提及附件：請依據圖表與數據脈絡進行深入解讀與商業/製造業實務意涵分析。
4. 結合智慧製造現場（如燁輝、億威等製造與專案實務）提供「具體且可落地的實務建議或解讀」。
5. 格式請善用清晰的 Markdown（標題、清單列表、重點粗體），使研讀者容易理解消化。
6. 若問題超出本內容範圍，請誠實說明內容未提及，並以資深專案顧問的專業經驗給予補充視角。`;

    if (apiKey) {
      try {
        // 取最近 6 則對話維持上下文連貫性
        const validHistory = (history || []).slice(-6).map((msg) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        }));

        const isReasoningOrLuna =
          model.includes('luna') ||
          model.includes('o1') ||
          model.includes('o3') ||
          model.includes('5.6') ||
          model.includes('6');

        const requestPayload: any = {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...validHistory,
            { role: 'user', content: trimmedQ },
          ],
        };

        // gpt-6-luna / luna / o1 / o3 僅支援預設 temperature (1)，若傳入自訂數值會觸發 400 錯誤
        if (!isReasoningOrLuna) {
          requestPayload.temperature = 0.5;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestPayload),
        });

        if (response.ok) {
          const jsonRes = await response.json();
          const answer = jsonRes?.choices?.[0]?.message?.content?.trim();
          if (answer) {
            return {
              success: true,
              answer,
              model: jsonRes.model || model,
            };
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error('[OpenAI 問答 API 回應異常]:', response.status, errData);
          return {
            success: false,
            message: `OpenAI API 回應異常 (${response.status}): ${errData?.error?.message || '模型暫時無法提供回答'}`,
          };
        }
      } catch (callErr: any) {
        console.error('呼叫問答 API 異常:', callErr);
        return {
          success: false,
          message: `連線 API 異常: ${callErr?.message || '網路連線失敗'}`,
        };
      }
    }

    return {
      success: false,
      message: '系統未設定 OPENAI_API_KEY，請確認環境變數配置',
    };
  } catch (err: any) {
    console.error('執行文章問答失敗:', err);
    return {
      success: false,
      message: err?.message || '提問處理失敗，請稍後再試',
    };
  }
}

/**
 * 更新課程基本資訊與指派成員（主管理員 jamesyang, admin 及建立者擁有編輯權限）
 */
export async function updatePMLearningCourse(
  courseId: string,
  courseData: Partial<PMLearningCourse>
) {
  const supabase = getSupabaseClient();
  try {
    const nowIso = new Date().toISOString();
    const currentList = await getPMLearningCourses();
    const target = currentList.find((c) => c.id === courseId);
    if (!target) {
      return { success: false, message: '找不到欲修改的紀錄' };
    }

    const updatedMemberProgress = { ...(target.memberProgress || {}) };

    // 如果指派成員有名單增減，同步維護 memberProgress
    if (courseData.assignedUserIds) {
      const assignedIds = Array.isArray(courseData.assignedUserIds) ? courseData.assignedUserIds : [];
      const assignedNames = Array.isArray(courseData.assignedUserNames) ? courseData.assignedUserNames : [];
      assignedIds.forEach((uid, idx) => {
        if (!updatedMemberProgress[uid]) {
          const userName = assignedNames[idx] || '成員';
          const defaultItems =
            courseData.defaultChecklist || target.defaultChecklist || [];
          updatedMemberProgress[uid] = {
            userId: uid,
            userName: userName,
            progressPercent: 0,
            isCompleted: false,
            notes: '',
            checklist: expandChecklistToItems(defaultItems),
            attachments: [],
            updatedAt: nowIso,
          };
        }
      });
    }

    // 如果有修改 defaultChecklist，同步更新每位已指派成員的 checklist (依新兩階架構展開並保留完成勾選狀態)
    if (courseData.defaultChecklist !== undefined) {
      const newItems = expandChecklistToItems(courseData.defaultChecklist);
      const assignedIds = Array.isArray(courseData.assignedUserIds)
        ? courseData.assignedUserIds
        : Array.isArray(target.assignedUserIds)
        ? target.assignedUserIds
        : Object.keys(updatedMemberProgress);

      assignedIds.forEach((uid) => {
        const existingProg = updatedMemberProgress[uid];
        if (existingProg) {
          const oldChecklist = Array.isArray(existingProg.checklist) ? existingProg.checklist : [];
          const completedTitles = new Set(
            oldChecklist
              .filter((c) => c.completed)
              .map((c) => (c.title || '').trim())
          );
          const updatedChecklist = newItems.map((item) => ({
            ...item,
            completed: completedTitles.has(item.title.trim()),
          }));
          updatedMemberProgress[uid] = {
            ...existingProg,
            checklist: updatedChecklist,
            updatedAt: nowIso,
          };
        }
      });
    }

    // 若有更新 memberProgress 補丁，合併之
    if (courseData.memberProgress) {
      Object.assign(updatedMemberProgress, courseData.memberProgress);
    }

    const updatedCourse: PMLearningCourse = {
      ...target,
      ...courseData,
      memberProgress: updatedMemberProgress,
      updatedAt: nowIso,
    };

    // 1. 更新至 pm_learning_courses 資料表
    const { error: upsertErr } = await supabase
      .from('pm_learning_courses')
      .upsert(toDbPayload(updatedCourse), { onConflict: 'id' });

    if (upsertErr) {
      console.warn('更新 pm_learning_courses 警告:', upsertErr);
    }

    // 2. 同步更新備援
    const updatedList = currentList.map((c) => (c.id === courseId ? updatedCourse : c));
    await syncCoursesToDatabase(updatedList);

    revalidatePath('/pm-learning');
    return { success: true, message: '資訊已成功更新！', data: fromDbRecord(toDbPayload(updatedCourse)) };
  } catch (err: any) {
    console.error('更新 PM 學習紀錄失敗:', err);
    return { success: false, message: err?.message || '更新失敗' };
  }
}

/**
 * 切換課程全域置頂狀態 (Pinned)
 */
export async function togglePMLearningCoursePin(courseId: string) {
  const currentList = await getPMLearningCourses();
  const target = currentList.find((c) => c.id === courseId);
  if (!target) {
    return { success: false, message: '找不到欲置頂的紀錄' };
  }
  const nextPinned = !target.isPinned;
  return updatePMLearningCourse(courseId, { isPinned: nextPinned });
}

/**
 * 刪除課程（主管理員及建立者可刪除）
 */
export async function deletePMLearningCourse(courseId: string) {
  const supabase = getSupabaseClient();
  try {
    // 1. 從 pm_learning_courses 刪除
    await supabase.from('pm_learning_courses').delete().eq('id', courseId);

    // 2. 從備援中移除
    const currentList = await getPMLearningCourses();
    const updatedList = currentList.filter((c) => c.id !== courseId);
    await syncCoursesToDatabase(updatedList);

    revalidatePath('/pm-learning');
    return { success: true, message: '課程已成功刪除！' };
  } catch (err: any) {
    console.error('刪除 PM 學習課程失敗:', err);
    return { success: false, message: err?.message || '刪除課程失敗' };
  }
}

/**
 * 更新特定成員在該課程的個人學習進度（拉%進度、心得筆記、待辦檢核、成果附件）
 */
export async function updatePMMemberProgress(
  courseId: string,
  userId: string,
  progressPatch: Partial<PMLearningMemberProgress>
) {
  const supabase = getSupabaseClient();
  try {
    const nowIso = new Date().toISOString();
    const currentList = await getPMLearningCourses();
    const targetCourse = currentList.find((c) => c.id === courseId);
    if (!targetCourse) {
      return { success: false, message: '找不到對應的學習課程' };
    }

    const targetMemberProgress = { ...(targetCourse.memberProgress || {}) };
    const currentProgress = targetMemberProgress[userId] || {
      userId,
      userName: '成員',
      progressPercent: 0,
      isCompleted: false,
      notes: '',
      reflections: [],
      checklist: expandChecklistToItems(targetCourse.defaultChecklist || []),
      attachments: [],
    };

    const newProgressPercent =
      progressPatch.progressPercent !== undefined
        ? Math.min(100, Math.max(0, Math.round(progressPatch.progressPercent)))
        : currentProgress.progressPercent;

    const isCompleted =
      progressPatch.isCompleted !== undefined
        ? progressPatch.isCompleted
        : newProgressPercent >= 100;

    const updatedHoursSpent =
      progressPatch.hoursSpent !== undefined
        ? progressPatch.hoursSpent
        : (currentProgress.hoursSpent ?? (isCompleted ? targetCourse.hours || 0 : 0));

    const updatedProgress: PMLearningMemberProgress = {
      ...currentProgress,
      ...progressPatch,
      progressPercent: newProgressPercent,
      hoursSpent: updatedHoursSpent,
      isCompleted,
      completedAt: isCompleted ? currentProgress.completedAt || nowIso : undefined,
      updatedAt: nowIso,
    };

    targetMemberProgress[userId] = updatedProgress;
    targetCourse.memberProgress = targetMemberProgress;
    targetCourse.updatedAt = nowIso;

    // 1. 同步更新 pm_learning_courses 資料表中的 member_progress 欄位（以 toDbPayload 確保 _itemMetadata 與 _courseHours 完整保留）
    await supabase
      .from('pm_learning_courses')
      .update({
        member_progress: toDbPayload(targetCourse).member_progress,
        updated_at: nowIso,
      })
      .eq('id', courseId);

    // 2. 同步更新備援快取
    const updatedList = currentList.map((c) => (c.id === courseId ? targetCourse : c));
    await syncCoursesToDatabase(updatedList);

    revalidatePath('/pm-learning');
    return {
      success: true,
      message: '個人學習進度已成功同步更新！',
      data: updatedProgress,
    };
  } catch (err: any) {
    console.error('更新個人進度失敗:', err);
    return { success: false, message: err?.message || '更新個人進度失敗' };
  }
}

/**
 * 儲存特定成員的課程呈現先後排序 (上下移動編輯)
 */
export async function saveUserCourseOrder(userId: string, orderedCourseIds: string[]) {
  try {
    const courses = await getPMLearningCourses();
    const updatedCourses = courses.map((course) => {
      const orderIdx = orderedCourseIds.indexOf(course.id);
      if (orderIdx >= 0) {
        const existingProg = (course.memberProgress || {})[userId] || {
          userId,
          userName: '',
          progressPercent: 0,
          isCompleted: false,
          checklist: [],
          attachments: [],
        };
        return {
          ...course,
          memberProgress: {
            ...(course.memberProgress || {}),
            [userId]: {
              ...existingProg,
              sortOrder: orderIdx,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      }
      return course;
    });

    await syncCoursesToDatabase(updatedCourses);
    revalidatePath('/pm-learning');
    return { success: true, message: '課程呈現順序已成功儲存！' };
  } catch (err: any) {
    console.error('儲存個人課程順序失敗:', err);
    return { success: false, message: err?.message || '儲存順序失敗' };
  }
}

/**
 * 快速更新單堂課程之培訓時數 (小時)
 */
export async function updateCourseHours(courseId: string, hours: number) {
  try {
    const courses = await getPMLearningCourses();
    const target = courses.find((c) => c.id === courseId);
    if (!target) return { success: false, message: '找不到指定課程' };

    const cleanHours = Math.max(0, Number(hours) || 0);
    const updatedCourses = courses.map((c) =>
      c.id === courseId ? { ...c, hours: cleanHours, updatedAt: new Date().toISOString() } : c
    );

    await syncCoursesToDatabase(updatedCourses);
    revalidatePath('/pm-learning');
    return { success: true, message: `已將「${target.title}」時數設定為 ${cleanHours} 小時！` };
  } catch (err: any) {
    console.error('更新課程時數失敗:', err);
    return { success: false, message: err?.message || '更新時數失敗' };
  }
}

// ==============================================================================
// 課程領域類別 (Course Categories / Domains) 自訂維護與編輯
// ==============================================================================

const CATEGORIES_RECORD_KEY = '__SYSTEM_PM_LEARNING_CATEGORIES__';

/**
 * 取得課程領域類別清單
 */
export async function getPMLearningCategories(): Promise<string[]> {
  const supabase = getSupabaseClient();
  try {
    const { data: sysRecord } = await supabase
      .from('clients')
      .select('notes')
      .eq('name', CATEGORIES_RECORD_KEY)
      .maybeSingle();

    if (sysRecord && sysRecord.notes) {
      try {
        const parsed = JSON.parse(sysRecord.notes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('解析課程領域失敗:', e);
      }
    }

    // 若尚未儲存過，整合現有課程中出現的所有 category 與預設值
    const courses = await getPMLearningCourses();
    const existingCats = new Set<string>(DEFAULT_PM_CATEGORIES);
    courses.forEach((c) => {
      if (c.category?.trim()) existingCats.add(c.category.trim());
    });

    return Array.from(existingCats);
  } catch (err) {
    console.error('取得課程領域失敗:', err);
    return DEFAULT_PM_CATEGORIES;
  }
}

/**
 * 儲存課程領域清單
 */
export async function savePMLearningCategories(categories: string[]) {
  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();
  try {
    const cleanList = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
    const { error } = await supabase.from('clients').upsert(
      {
        name: CATEGORIES_RECORD_KEY,
        code: 'PM_CATS',
        notes: JSON.stringify(cleanList),
        updated_at: nowIso,
      },
      { onConflict: 'name' }
    );

    if (error) throw error;
    revalidatePath('/pm-learning');
    return { success: true, message: '課程領域已成功更新儲存！', data: cleanList };
  } catch (err: any) {
    console.error('儲存課程領域失敗:', err);
    return { success: false, message: err?.message || '儲存失敗', data: categories };
  }
}

/**
 * 重新命名特定領域名稱，並同步連動更新所有屬於該領域的課程
 */
export async function renamePMLearningCategory(oldName: string, newName: string) {
  try {
    const oldTrimmed = oldName.trim();
    const newTrimmed = newName.trim();
    if (!newTrimmed) return { success: false, message: '領域名稱不可為空' };
    if (oldTrimmed === newTrimmed) return { success: true, message: '領域名稱未變更' };

    // 1. 更新領域清單
    const categories = await getPMLearningCategories();
    const updatedCats = categories.map((c) => (c === oldTrimmed ? newTrimmed : c));
    if (!updatedCats.includes(newTrimmed)) {
      updatedCats.push(newTrimmed);
    }
    await savePMLearningCategories(updatedCats);

    // 2. 智慧連動更新所有屬於舊領域名稱的課程
    const courses = await getPMLearningCourses();
    let updatedCourseCount = 0;
    const updatedCourses = courses.map((course) => {
      if (course.category === oldTrimmed) {
        updatedCourseCount++;
        return { ...course, category: newTrimmed, updatedAt: new Date().toISOString() };
      }
      return course;
    });

    if (updatedCourseCount > 0) {
      await syncCoursesToDatabase(updatedCourses);
    }

    revalidatePath('/pm-learning');
    return {
      success: true,
      message: `已將「${oldTrimmed}」重新命名為「${newTrimmed}」${
        updatedCourseCount > 0 ? `，並同步更新 ${updatedCourseCount} 門關聯課程` : ''
      }！`,
    };
  } catch (err: any) {
    console.error('重新命名課程領域失敗:', err);
    return { success: false, message: err?.message || '重新命名失敗' };
  }
}

/**
 * 刪除特定領域
 */
export async function deletePMLearningCategory(categoryToDelete: string) {
  try {
    const target = categoryToDelete.trim();
    const categories = await getPMLearningCategories();
    const updatedCats = categories.filter((c) => c !== target);
    await savePMLearningCategories(updatedCats);

    revalidatePath('/pm-learning');
    return { success: true, message: `已移除「${target}」領域類別！` };
  } catch (err: any) {
    console.error('刪除課程領域失敗:', err);
    return { success: false, message: err?.message || '刪除失敗' };
  }
}

