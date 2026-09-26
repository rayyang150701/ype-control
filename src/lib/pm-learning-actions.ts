'use server';

import { revalidatePath } from 'next/cache';
import { createClient as getSupabaseClient } from '@/lib/supabase/server';
import { User, CurrentUser } from '@/types';
import { PMLearningCourse, PMLearningMemberProgress, DEFAULT_PM_CATEGORIES } from '@/types/pm-learning';

const SYSTEM_RECORD_KEY = '__SYSTEM_PM_LEARNING__';

import { isCourseManager } from '@/lib/pm-learning-utils';

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
  ];
}

function toDbPayload(c: PMLearningCourse) {
  return {
    id: c.id,
    title: c.title,
    instructor_or_platform: c.instructorOrPlatform,
    category: c.category || '專案管理與治理',
    description: c.description || '',
    external_url: c.externalUrl || '',
    start_date: c.startDate ? c.startDate.slice(0, 10) : null,
    end_date: c.endDate ? c.endDate.slice(0, 10) : null,
    assigned_user_ids: c.assignedUserIds || [],
    assigned_user_names: c.assignedUserNames || [],
    default_checklist: c.defaultChecklist || [],
    member_progress: c.memberProgress || {},
    created_by: c.createdBy || '',
    created_at: c.createdAt || new Date().toISOString(),
    updated_at: c.updatedAt || new Date().toISOString(),
  };
}

function fromDbRecord(c: any): PMLearningCourse {
  return {
    id: c.id,
    title: c.title || '',
    instructorOrPlatform: c.instructor_or_platform || '',
    category: c.category || '專案管理與治理',
    description: c.description || '',
    externalUrl: c.external_url || '',
    startDate: c.start_date ? String(c.start_date).slice(0, 10) : '',
    endDate: c.end_date ? String(c.end_date).slice(0, 10) : '',
    assignedUserIds: Array.isArray(c.assigned_user_ids) ? c.assigned_user_ids : [],
    assignedUserNames: Array.isArray(c.assigned_user_names) ? c.assigned_user_names : [],
    defaultChecklist: Array.isArray(c.default_checklist) ? c.default_checklist : [],
    memberProgress:
      typeof c.member_progress === 'object' && c.member_progress ? c.member_progress : {},
    createdBy: c.created_by || '',
    createdAt: c.created_at || new Date().toISOString(),
    updatedAt: c.updated_at || new Date().toISOString(),
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
          // 若獨立表已存在但為空，順便回填獨立表
          await syncCoursesToDatabase(parsed);
          return parsed;
        }
      } catch (e) {
        console.error('解析 PM 學習地圖資料失敗:', e);
      }
    }

    // 3. 若為首次啟用，自動初始化種子資料並持久化儲存
    const seedCourses = getDefaultSeedCourses();
    await syncCoursesToDatabase(seedCourses);
    return seedCourses;
  } catch (err) {
    console.error('讀取 PM 學習地圖課程失敗:', err);
    return getDefaultSeedCourses();
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
    await supabase.from('pm_learning_courses').upsert(dbPayload, { onConflict: 'id' });

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
    initialChecklist?: string[];
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

    courseData.assignedUserIds.forEach((uid, idx) => {
      memberProgress[uid] = {
        userId: uid,
        userName: courseData.assignedUserNames[idx] || '成員',
        progressPercent: 0,
        isCompleted: false,
        notes: '',
        checklist: defaultChecklist.map((item, i) => ({
          id: `chk-${Date.now()}-${i}`,
          title: item,
          completed: false,
        })),
        attachments: [],
        updatedAt: nowIso,
      };
    });

    const newCourse: PMLearningCourse = {
      id: newId,
      title: courseData.title.trim(),
      instructorOrPlatform: courseData.instructorOrPlatform.trim(),
      category: courseData.category || '專案管理與治理',
      description: courseData.description?.trim() || '',
      externalUrl: courseData.externalUrl?.trim() || '',
      startDate: courseData.startDate || '',
      endDate: courseData.endDate || '',
      assignedUserIds: courseData.assignedUserIds,
      assignedUserNames: courseData.assignedUserNames,
      defaultChecklist,
      memberProgress,
      createdBy: courseData.createdBy || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 1. 直接插入至 pm_learning_courses 資料表
    const { error: insertError } = await supabase
      .from('pm_learning_courses')
      .insert(toDbPayload(newCourse));

    // 2. 同步更新整體課程備援快取
    const currentList = await getPMLearningCourses();
    const updatedList = [newCourse, ...currentList.filter((c) => c.id !== newCourse.id)];
    await syncCoursesToDatabase(updatedList);

    revalidatePath('/pm-learning');
    return {
      success: true,
      message: '課程已成功建立並完成人員指派！',
      data: newCourse,
    };
  } catch (err: any) {
    console.error('建立 PM 學習課程失敗:', err);
    return { success: false, message: err?.message || '建立課程失敗' };
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
      return { success: false, message: '找不到欲修改的課程紀錄' };
    }

    const updatedMemberProgress = { ...(target.memberProgress || {}) };

    // 如果指派成員有名單增減，同步維護 memberProgress
    if (courseData.assignedUserIds) {
      courseData.assignedUserIds.forEach((uid, idx) => {
        if (!updatedMemberProgress[uid]) {
          const userName = courseData.assignedUserNames
            ? courseData.assignedUserNames[idx]
            : '成員';
          const defaultItems =
            courseData.defaultChecklist || target.defaultChecklist || [];
          updatedMemberProgress[uid] = {
            userId: uid,
            userName: userName,
            progressPercent: 0,
            isCompleted: false,
            notes: '',
            checklist: defaultItems.map((item, i) => ({
              id: `chk-${Date.now()}-${i}`,
              title: item,
              completed: false,
            })),
            attachments: [],
            updatedAt: nowIso,
          };
        }
      });
    }

    const updatedCourse: PMLearningCourse = {
      ...target,
      ...courseData,
      memberProgress: updatedMemberProgress,
      updatedAt: nowIso,
    };

    // 1. 更新至 pm_learning_courses 資料表
    await supabase
      .from('pm_learning_courses')
      .upsert(toDbPayload(updatedCourse), { onConflict: 'id' });

    // 2. 同步更新備援
    const updatedList = currentList.map((c) => (c.id === courseId ? updatedCourse : c));
    await syncCoursesToDatabase(updatedList);

    revalidatePath('/pm-learning');
    return { success: true, message: '課程資訊已成功更新！', data: updatedCourse };
  } catch (err: any) {
    console.error('更新 PM 學習課程失敗:', err);
    return { success: false, message: err?.message || '更新課程失敗' };
  }
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

    const currentProgress = targetCourse.memberProgress[userId] || {
      userId,
      userName: '成員',
      progressPercent: 0,
      isCompleted: false,
      notes: '',
      checklist: (targetCourse.defaultChecklist || []).map((t, idx) => ({
        id: `chk-${Date.now()}-${idx}`,
        title: t,
        completed: false,
      })),
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

    const updatedProgress: PMLearningMemberProgress = {
      ...currentProgress,
      ...progressPatch,
      progressPercent: newProgressPercent,
      isCompleted,
      completedAt: isCompleted ? currentProgress.completedAt || nowIso : undefined,
      updatedAt: nowIso,
    };

    targetCourse.memberProgress[userId] = updatedProgress;
    targetCourse.updatedAt = nowIso;

    // 1. 同步更新 pm_learning_courses 資料表中的 member_progress 欄位
    await supabase
      .from('pm_learning_courses')
      .update({
        member_progress: targetCourse.memberProgress,
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

