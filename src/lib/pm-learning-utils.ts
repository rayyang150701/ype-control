import { CurrentUser, User } from '@/types';
import { PMLearningChapterUnit, PMLearningChecklistItem } from '@/types/pm-learning';

export { type PMLearningChapterUnit };

/**
 * 將各種格式的 defaultChecklist 正規化為統一的兩階 PMLearningChapterUnit[]
 */
export function normalizeChecklistToChapters(raw: any[]): PMLearningChapterUnit[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // 若已經是 PMLearningChapterUnit[] (有 subUnits 屬性或 title 物件)
  const isObjectList = raw.some(
    (item) => item && typeof item === 'object' && ('subUnits' in item || 'title' in item)
  );

  if (isObjectList) {
    return raw.map((item, idx) => {
      if (typeof item === 'string') {
        return {
          id: `chap-${Date.now()}-${idx}`,
          title: item,
          subUnits: [],
        };
      }
      const title = item.title || `單元 ${idx + 1}`;
      const subUnits = Array.isArray(item.subUnits)
        ? item.subUnits
            .map((s: any) => (typeof s === 'string' ? s : s?.title || ''))
            .filter(Boolean)
        : [];
      return {
        id: item.id || `chap-${Date.now()}-${idx}`,
        title,
        subUnits,
      };
    });
  }

  // 若為純字串陣列 (例如 ['單元1.', '1.1', '1.2', '單元2', '2.1', '2.2'])
  // 透過智慧解析器轉換為兩階章節單元
  const text = raw.filter((s) => typeof s === 'string' && s.trim()).join('\n');
  return parseTextToChecklistChapters(text);
}

/**
 * 智慧解析多行文字為兩階大單元與子單元
 * 支援格式：
 * 單元1.
 * 1.1 需求訪談
 * 1.2 範疇設定
 * 單元2
 * 2.1 現場測試
 * 2.2 結案驗收
 */
export function parseTextToChecklistChapters(text: string): PMLearningChapterUnit[] {
  if (!text || !text.trim()) return [];

  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const chapters: PMLearningChapterUnit[] = [];
  let currentChapter: PMLearningChapterUnit | null = null;

  const isSubUnitLine = (line: string): boolean => {
    // 1.1, 1.2, 2.1 等小數點子編號
    if (/^\d+\.\d+/.test(line)) return true;
    // 條列標記：- , * , + , (1), [1], 1), ① 等
    if (/^([-*+]|\(\d+\)|\[\d+\]|\d+\)|\([一二三四五六七八九十]+\)|[①②③④⑤⑥⑦⑧⑨⑩])\s*/.test(line))
      return true;
    return false;
  };

  const isChapterLine = (line: string): boolean => {
    // 不能為小數點子單元 (如 1.1)
    if (/^\d+\.\d+/.test(line)) return false;
    // 單元1, 單元 1, 單元1., 單元一
    if (/^單元\s*[0-9一二三四五六七八九十]+/i.test(line)) return true;
    // 第1章, 第一章, 第一單元, 第1單元, 第一節
    if (/^第\s*[0-9一二三四五六七八九十]+\s*[章單元節]/i.test(line)) return true;
    // Chapter 1, Section 1, Module 1, Unit 1
    if (/^(Chapter|Module|Section|Unit)\s*\d+/i.test(line)) return true;
    // 1. 或 1、後面接非數字 (例如 1. 專案啟動，但排除 1.1)
    if (/^\d+[\.、]\s*([^\d]|$)/.test(line)) return true;
    return false;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (isChapterLine(line)) {
      currentChapter = {
        id: `chap-${Date.now()}-${chapters.length + 1}`,
        title: line,
        subUnits: [],
      };
      chapters.push(currentChapter);
    } else if (isSubUnitLine(line)) {
      if (!currentChapter) {
        currentChapter = {
          id: `chap-${Date.now()}-1`,
          title: `單元 ${chapters.length + 1}`,
          subUnits: [],
        };
        chapters.push(currentChapter);
      }
      currentChapter.subUnits.push(line);
    } else {
      if (!currentChapter) {
        currentChapter = {
          id: `chap-${Date.now()}-${chapters.length + 1}`,
          title: line,
          subUnits: [],
        };
        chapters.push(currentChapter);
      } else {
        currentChapter.subUnits.push(line);
      }
    }
  }

  return chapters;
}

/**
 * 將 defaultChecklist 展開為每位成員個人的 PMLearningChecklistItem[]
 * 確保保留 chapterTitle 兩階關聯
 */
export function expandChecklistToItems(
  defaultChecklist: (string | PMLearningChapterUnit)[]
): PMLearningChecklistItem[] {
  const items: PMLearningChecklistItem[] = [];
  let counter = 0;

  for (let cIdx = 0; cIdx < (defaultChecklist || []).length; cIdx++) {
    const entry = defaultChecklist[cIdx];
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (trimmed) {
        items.push({
          id: `chk-${Date.now()}-${counter++}`,
          title: trimmed,
          completed: false,
        });
      }
    } else if (entry && typeof entry === 'object') {
      const chapterTitle = entry.title?.trim() || `單元 ${cIdx + 1}`;
      const subUnits = Array.isArray(entry.subUnits) ? entry.subUnits : [];
      if (subUnits.length === 0) {
        items.push({
          id: `chk-${Date.now()}-${counter++}`,
          title: chapterTitle,
          chapterTitle,
          completed: false,
        });
      } else {
        for (let sIdx = 0; sIdx < subUnits.length; sIdx++) {
          const sub = subUnits[sIdx];
          const subTitle = (typeof sub === 'string' ? sub : (sub as any)?.title || '').trim();
          if (subTitle) {
            items.push({
              id: `chk-${Date.now()}-${counter++}`,
              title: subTitle,
              chapterTitle,
              completed: false,
            });
          }
        }
      }
    }
  }
  return items;
}

/**
 * 檢查使用者是否為具備完整課程維護權限之主管理員
 * 條件：
 * 1. 角色為 super_admin 或 admin
 * 2. 帳號、Email 或姓名包含 jamesyang 或 admin
 */
export function isCourseManager(user: CurrentUser | User | null | undefined): boolean {
  if (!user) return false;
  const role = user.role;
  if (role === 'super_admin' || role === 'admin') return true;

  const email = (user.email || '').toLowerCase().trim();
  const username = ((user as any).username || '').toLowerCase().trim();
  const displayName = (user.displayName || '').toLowerCase().trim();

  return (
    email.includes('jamesyang') ||
    username.includes('jamesyang') ||
    displayName.includes('james') ||
    email.includes('admin') ||
    username.includes('admin') ||
    displayName.includes('admin')
  );
}

/**
 * 檢查使用者是否可編輯特定課程（主管理員或該課程建立者）
 */
export function canUserEditCourse(
  currentUser: CurrentUser | User | null | undefined,
  courseCreatedBy?: string
): boolean {
  if (!currentUser) return false;
  if (isCourseManager(currentUser)) return true;
  if (courseCreatedBy && currentUser.uid === courseCreatedBy) return true;
  return false;
}
