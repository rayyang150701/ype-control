import type { ProjectActionItem, ActionItemAttachment } from '@/types';

export type KMDocumentCategory =
  | 'training'      // 教育訓練 / 操作手冊 / SOP
  | 'specification' // 設計規格 / 系統架構 / 技術圖面
  | 'quotation'     // 報價評估 / 簽呈核決 / 成本合約
  | 'acceptance'    // 驗收測試 / 出廠報告 / 結案證明
  | 'meeting'       // 會議紀錄 / 專案週報 / 會勘備忘
  | 'other';        // 其他專案資料

export interface KMDocumentCategoryMeta {
  key: KMDocumentCategory;
  label: string;
  shortLabel: string;
  icon: string;
  badgeClass: string;
  borderClass: string;
}

export const KM_CATEGORIES: KMDocumentCategoryMeta[] = [
  {
    key: 'training',
    label: '教育訓練教材',
    shortLabel: '教育訓練',
    icon: '🎓',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    borderClass: 'border-indigo-500',
  },
  {
    key: 'specification',
    label: '設計規格架構',
    shortLabel: '設計規格',
    icon: '📐',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    borderClass: 'border-blue-500',
  },
  {
    key: 'quotation',
    label: '報價簽呈核決',
    shortLabel: '報價簽呈',
    icon: '💰',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
    borderClass: 'border-amber-500',
  },
  {
    key: 'acceptance',
    label: '驗收結案報告',
    shortLabel: '驗收結案',
    icon: '🏆',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    borderClass: 'border-emerald-500',
  },
  {
    key: 'meeting',
    label: '會議紀錄週報',
    shortLabel: '會議週報',
    icon: '📝',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    borderClass: 'border-purple-500',
  },
  {
    key: 'other',
    label: '其他專案文件',
    shortLabel: '其他資料',
    icon: '📎',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    borderClass: 'border-slate-400',
  },
];

export interface KMDocumentItem {
  id: string;              // unique key
  fileId?: string;         // Google Drive ID
  fileName: string;        // 檔名
  fileSize: number;        // 大小 (bytes)
  mimeType: string;        // MIME 類型
  webViewLink: string;     // Google Drive 預覽/開啟連結
  webContentLink?: string; // 直接下載連結
  uploadedAt: string;      // 上傳時間 (ISO)
  // 專案與待辦脈絡
  projectId: string;
  projectName: string;
  projectCaseNumber: string;
  projectCategory?: '評估案' | '已開案';
  actionItemId: string;
  actionItemTitle: string;
  phase: string;
  owner: string;
  notes?: string;
  // 智能推導之分類與副檔名
  category: KMDocumentCategory;
  categoryLabel: string;
  categoryIcon: string;
  categoryBadgeClass: string;
  fileExt: string;
  fileGroup: 'pdf' | 'ppt' | 'excel' | 'word' | 'image' | 'archive' | 'other';
}

/**
 * 智慧推導檔案副檔名與群組
 */
export function getFileGroup(fileName: string, mimeType?: string): {
  ext: string;
  group: 'pdf' | 'ppt' | 'excel' | 'word' | 'image' | 'archive' | 'other';
} {
  const cleanName = (fileName || '').trim().toLowerCase();
  const extMatch = cleanName.match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : '';

  if (ext === 'pdf' || mimeType?.includes('pdf')) {
    return { ext: 'pdf', group: 'pdf' };
  }
  if (['ppt', 'pptx'].includes(ext) || mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) {
    return { ext: ext || 'ppt', group: 'ppt' };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) {
    return { ext: ext || 'xlsx', group: 'excel' };
  }
  if (['doc', 'docx'].includes(ext) || mimeType?.includes('word') || mimeType?.includes('document')) {
    return { ext: ext || 'docx', group: 'word' };
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext) || mimeType?.includes('image')) {
    return { ext: ext || 'img', group: 'image' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimeType?.includes('zip') || mimeType?.includes('compressed')) {
    return { ext: ext || 'zip', group: 'archive' };
  }

  return { ext: ext || 'file', group: 'other' };
}

/**
 * 智慧推導 KM 文件分類
 * 優先依據「專案階段」、「事項主旨」、「檔名」及「備註說明」進行語意規則歸類，
 * 即使歷史資料未事先標記，亦能精確歸納！
 */
export function inferKMDocumentCategory(
  fileName: string,
  phase: string,
  actionTitle: string,
  notes?: string
): KMDocumentCategoryMeta {
  const combined = `${fileName} ${phase} ${actionTitle} ${notes || ''}`.toLowerCase();

  // 1. 教育訓練 / 操作手冊 / SOP
  if (
    phase.includes('教育訓練') ||
    phase.startsWith('1.4.1') ||
    combined.includes('教育訓練') ||
    combined.includes('教材') ||
    combined.includes('sop') ||
    combined.includes('操作手冊') ||
    combined.includes('使用手冊') ||
    combined.includes('使用者手冊') ||
    combined.includes('講義') ||
    combined.includes('培訓') ||
    combined.includes('操作說明')
  ) {
    return KM_CATEGORIES[0]; // training
  }

  // 2. 驗收結案 / 測試報告
  if (
    phase.includes('驗收結案') ||
    phase.startsWith('1.4.2') ||
    phase.includes('驗收') ||
    combined.includes('驗收') ||
    combined.includes('結案') ||
    combined.includes('測試報告') ||
    combined.includes('出廠報告') ||
    combined.includes('完工證明') ||
    combined.includes('驗證報告')
  ) {
    return KM_CATEGORIES[3]; // acceptance
  }

  // 3. 報價簽呈 / 成本合約
  if (
    phase.includes('報價') ||
    phase.includes('簽呈') ||
    phase.startsWith('1.1.2') ||
    phase.startsWith('1.1.3') ||
    combined.includes('報價') ||
    combined.includes('估價') ||
    combined.includes('簽呈') ||
    combined.includes('核決') ||
    combined.includes('合約') ||
    combined.includes('採購') ||
    combined.includes('成本')
  ) {
    return KM_CATEGORIES[2]; // quotation
  }

  // 4. 會議紀錄 / 專案週報
  if (
    combined.includes('會議') ||
    combined.includes('週報') ||
    combined.includes('紀錄') ||
    combined.includes('會勘') ||
    combined.includes('備忘錄') ||
    combined.includes('進度匯報')
  ) {
    return KM_CATEGORIES[4]; // meeting
  }

  // 5. 設計規格 / 架構圖面
  if (
    phase.includes('設計') ||
    phase.includes('評估') ||
    phase.startsWith('1.1') ||
    phase.includes('施工') ||
    phase.startsWith('1.2') ||
    combined.includes('規格') ||
    combined.includes('架構') ||
    combined.includes('圖面') ||
    combined.includes('線路') ||
    combined.includes('cad') ||
    combined.includes('dwg') ||
    combined.includes('layout') ||
    combined.includes('系統設計') ||
    combined.includes('技術文件')
  ) {
    return KM_CATEGORIES[1]; // specification
  }

  // 6. 其他專案資料
  return KM_CATEGORIES[5]; // other
}

/**
 * 從專案所有待辦事項中，抽取出全部 KM 文件項目並進行結構化
 */
export function extractKMDocumentsFromActionItems(
  actionItems: ProjectActionItem[]
): KMDocumentItem[] {
  const documents: KMDocumentItem[] = [];

  actionItems.forEach((item) => {
    const attList = item.attachments || [];
    attList.forEach((att, attIndex) => {
      const { ext, group } = getFileGroup(att.name, att.mimeType);
      const catMeta = inferKMDocumentCategory(
        att.name,
        item.phase || '',
        item.title || '',
        item.notes
      );

      documents.push({
        id: `${item.id}-${att.id || att.fileId || attIndex}`,
        fileId: att.fileId || att.id,
        fileName: att.name,
        fileSize: att.size || 0,
        mimeType: att.mimeType || 'application/octet-stream',
        webViewLink: att.webViewLink || '#',
        webContentLink: att.webContentLink,
        uploadedAt: att.uploadedAt || item.createdAt || new Date().toISOString(),
        projectId: item.projectId,
        projectName: item.projectName || '未命名專案',
        projectCaseNumber: item.projectCaseNumber || '未編號',
        projectCategory: item.projectCategory || '已開案',
        actionItemId: item.id,
        actionItemTitle: item.title,
        phase: item.phase || '一般階段',
        owner: item.owner || '',
        notes: item.notes,
        category: catMeta.key,
        categoryLabel: catMeta.label,
        categoryIcon: catMeta.icon,
        categoryBadgeClass: catMeta.badgeClass,
        fileExt: ext,
        fileGroup: group,
      });
    });
  });

  // 預設按上傳時間從最新到最舊排序
  return documents.sort((a, b) => {
    const timeA = new Date(a.uploadedAt).getTime();
    const timeB = new Date(b.uploadedAt).getTime();
    return timeB - timeA;
  });
}
