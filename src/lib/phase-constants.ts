import type { ActionItemPhase } from '@/types';

export type MajorPhaseKey = 'design' | 'construction' | 'verification' | 'acceptance';

export interface MajorPhaseConfig {
  key: MajorPhaseKey;
  code: string;
  name: string;
  fullName: string;
  shortName: string;
  subPhases: { code: string; name: string; fullName: string }[];
}

export const MAJOR_PHASES: MajorPhaseConfig[] = [
  {
    key: 'design',
    code: '1.1',
    name: '設計階段',
    fullName: '1.1 設計階段',
    shortName: '設計',
    subPhases: [
      { code: '1.1.1', name: '評估', fullName: '1.1.1 評估' },
      { code: '1.1.2', name: '報價', fullName: '1.1.2 報價' },
      { code: '1.1.3', name: '簽呈', fullName: '1.1.3 簽呈' },
    ],
  },
  {
    key: 'construction',
    code: '1.2',
    name: '施工階段',
    fullName: '1.2 施工階段',
    shortName: '施工',
    subPhases: [],
  },
  {
    key: 'verification',
    code: '1.3',
    name: '驗證階段',
    fullName: '1.3 驗證階段',
    shortName: '驗證',
    subPhases: [],
  },
  {
    key: 'acceptance',
    code: '1.4',
    name: '驗收階段',
    fullName: '1.4 驗收階段',
    shortName: '驗收',
    subPhases: [
      { code: '1.4.1', name: '教育訓練', fullName: '1.4.1 教育訓練' },
      { code: '1.4.2', name: '驗收結案', fullName: '1.4.2 驗收結案' },
    ],
  },
];

/**
 * 待辦事項階段下拉清單選項 (分層清晰表示)
 */
export const ACTION_ITEM_PHASE_OPTIONS: {
  group: string;
  items: { label: string; value: string; isSub?: boolean }[];
}[] = [
  {
    group: '1.1 設計階段',
    items: [
      { label: '1.1 設計階段 (整體)', value: '1.1 設計階段' },
      { label: '　↳ 1.1.1 評估', value: '1.1.1 評估', isSub: true },
      { label: '　↳ 1.1.2 報價', value: '1.1.2 報價', isSub: true },
      { label: '　↳ 1.1.3 簽呈', value: '1.1.3 簽呈', isSub: true },
    ],
  },
  {
    group: '1.2 施工階段',
    items: [
      { label: '1.2 施工階段', value: '1.2 施工階段' },
    ],
  },
  {
    group: '1.3 驗證階段',
    items: [
      { label: '1.3 驗證階段', value: '1.3 驗證階段' },
    ],
  },
  {
    group: '1.4 驗收階段',
    items: [
      { label: '1.4 驗收階段 (整體)', value: '1.4 驗收階段' },
      { label: '　↳ 1.4.1 教育訓練', value: '1.4.1 教育訓練', isSub: true },
      { label: '　↳ 1.4.2 驗收結案', value: '1.4.2 驗收結案', isSub: true },
    ],
  },
];

/**
 * 將任何階段文字（包含舊制：評估階段、報價/設計、簽呈核決、開發/施工、驗證測試、驗收結案）
 * 映射至專案四大主階段 Key: 'design' | 'construction' | 'verification' | 'acceptance'
 */
export function getMajorPhaseKey(phase: string | undefined | null): MajorPhaseKey {
  if (!phase) return 'design';
  const str = String(phase).trim();

  // 1.1 設計階段 (含 1.1.1 評估, 1.1.2 報價, 1.1.3 簽呈 及舊制 評估階段、報價/設計、簽呈核決)
  if (
    str.includes('設計') ||
    str.includes('評估') ||
    str.includes('報價') ||
    str.includes('簽呈') ||
    str.startsWith('1.1')
  ) {
    return 'design';
  }

  // 1.2 施工階段 (含舊制 開發/施工、開發階段)
  if (
    str.includes('施工') ||
    str.includes('開發') ||
    str.startsWith('1.2')
  ) {
    return 'construction';
  }

  // 1.3 驗證階段 (含舊制 驗證測試、測試階段)
  if (
    str.includes('驗證') ||
    str.includes('測試') ||
    str.startsWith('1.3')
  ) {
    return 'verification';
  }

  // 1.4 驗收階段 (含 1.4.1 教育訓練, 1.4.2 驗收結案 及舊制 驗收結案)
  if (
    str.includes('驗收') ||
    str.includes('教育訓練') ||
    str.includes('結案') ||
    str.startsWith('1.4')
  ) {
    return 'acceptance';
  }

  return 'design';
}

/**
 * 取得四大主階段標準中文名稱
 */
export function getMajorPhaseName(phase: string | undefined | null): '設計階段' | '施工階段' | '驗證階段' | '驗收階段' {
  const key = getMajorPhaseKey(phase);
  switch (key) {
    case 'design':
      return '設計階段';
    case 'construction':
      return '施工階段';
    case 'verification':
      return '驗證階段';
    case 'acceptance':
      return '驗收階段';
  }
}


/**
 * 預設第二階 WBS 範本（開案時一鍵套用，可於專案內改名、刪除、新增）。
 * 各專案的二階不盡相同，這份只是起點。
 */
export const DEFAULT_WBS_TEMPLATE: { phaseKey: MajorPhaseKey; code: string; name: string }[] = [
  { phaseKey: 'design', code: '1.1.1', name: '現場勘查與規格確認（立項/簽呈）' },
  { phaseKey: 'design', code: '1.1.2', name: '硬體架構與電控圖面設計' },
  { phaseKey: 'design', code: '1.1.3', name: '軟體/PLC 通訊協定定義' },
  { phaseKey: 'construction', code: '1.2.1', name: '關鍵設備採購與到貨檢驗（備料）' },
  { phaseKey: 'construction', code: '1.2.2', name: '廠內盤體組裝與預先測試' },
  { phaseKey: 'construction', code: '1.2.3', name: '現場硬體架設與佈線施工' },
  { phaseKey: 'verification', code: '1.3.1', name: '單機功能與訊號測試' },
  { phaseKey: 'verification', code: '1.3.2', name: '系統整合對接測試' },
  { phaseKey: 'verification', code: '1.3.3', name: '試運行與異常收斂（故障排除）' },
  { phaseKey: 'acceptance', code: '1.4.1', name: '教育訓練與操作手冊交付' },
  { phaseKey: 'acceptance', code: '1.4.2', name: '驗收測試報告簽認與結案' },
];

export const DELAY_REASON_CATEGORIES = ['客戶端', '廠商/供應商', '內部作業', '需求變更', '外部環境', '其他'] as const;

/** 待辦階段文字 → 預設歸屬的第二階工作包編號（供舊資料自動歸類參考） */
export function defaultWbsCodeForPhase(phase: string | undefined | null): string | null {
  if (!phase) return null;
  const m = String(phase).match(/^(\d\.\d\.\d)/);
  return m ? m[1] : null;
}
