/**
 * 燁輝 TPM 人員識別與 PM / TPM 區隔工具
 */

// 燁輝 TPM 同仁已知姓名清單（用於嚴格區隔億威內部 PM 與燁輝 TPM 窗口）
export const TPM_PERSONNEL_NAMES: readonly string[] = [
    '陳家姷',
    '陳家炳',
    '陳家炘',
    '徐智宏',
    '賴冠廷',
    '胡春如',
    '許家豪',
    '蔣永政',
    '蘇煥鈞',
    '鄭文芳',
];

// 已知非 TPM 人員清單（億威 PM、工程師、主管等，絕不可出現在 TPM 選項中）
export const NON_TPM_PERSONNEL_NAMES: readonly string[] = [
    'James',
    'Winona',
    'AlbeeHsu',
    'gary',
    'bella',
    'Billy',
    '阿貴',
    'Justin',
    '科男',
    'admin',
];

/**
 * 判定指定人員姓名是否屬於 TPM 同仁
 * 必須符合 TPM 名冊，且絕對排除億威 PM 或非 TPM 成員
 */
export const isTpmPerson = (name?: string | null): boolean => {
    if (!name) return false;
    const n = name.replace(/["'“”]/g, '').trim();
    if (!n) return false;

    // 嚴格排除億威同仁
    if (NON_TPM_PERSONNEL_NAMES.some((non) => n.toLowerCase() === non.toLowerCase())) {
        return false;
    }

    return TPM_PERSONNEL_NAMES.some((t) => n.includes(t)) || (n.toUpperCase().includes('TPM') && !n.includes('億威'));
};

/**
 * 判斷指定使用者是否屬於「燁輝」且部門為「TPM」之同仁
 */
export const isYiehPhuiTpmUser = (user: {
    clientName?: string | null;
    department?: string | null;
    displayName?: string | null;
    username?: string | null;
    email?: string | null;
}): boolean => {
    const comp = (user.clientName || '').trim();
    const dept = (user.department || '').trim().toUpperCase();
    const name = (user.displayName || user.username || user.email || '').replace(/["'“”]/g, '').trim();
    const email = (user.email || '').toLowerCase();

    // 1. 嚴格排除億威同仁、燕巢同仁與非 TPM 姓名
    if (comp.includes('億威') || comp.includes('燕巢') || email.includes('@emmt.com.tw')) {
        return false;
    }
    if (NON_TPM_PERSONNEL_NAMES.some((non) => name.toLowerCase() === non.toLowerCase() || email.startsWith(non.toLowerCase()))) {
        return false;
    }

    // 2. 判定為燁輝且部門為 TPM，或名列已知燁輝 TPM 同仁名單
    const isYiehPhui = comp === '燁輝' || comp === '燁輝企業' || (!comp && email.endsWith('@yiehphui.com.tw'));
    const isTpmDept = dept.includes('TPM');
    const isKnownTpm = TPM_PERSONNEL_NAMES.some((t) => name.includes(t));

    return (isYiehPhui && isTpmDept) || isKnownTpm;
};

/**
 * 取得乾淨的 TPM 同仁姓名（去除多餘外層引號與分機號，例如 "賴冠廷 (7504-6)" -> "賴冠廷"）
 */
export const getCleanTpmName = (rawName?: string | null): string => {
    if (!rawName) return '';
    const clean = rawName.replace(/["'“”]/g, '').trim();
    const matched = TPM_PERSONNEL_NAMES.find((t) => clean.includes(t));
    if (matched) return matched;
    return clean.replace(/\s*[\(（].*?[\)）]/g, '').trim();
};

/**
 * 取得系統中所有屬於「燁輝」且部門為「TPM」的同仁清單（去重、純姓名排序）
 */
export const getYiehPhuiTpmNames = (users: any[]): string[] => {
    const set = new Set<string>();

    if (users && users.length > 0) {
        users.forEach((u) => {
            if (isYiehPhuiTpmUser(u)) {
                const name = (u.displayName || u.username || u.email || '').trim();
                const cleanName = getCleanTpmName(name);
                if (cleanName) set.add(cleanName);
            }
        });
    }

    // 備援：將已知燁輝 TPM 官方名冊加入
    TPM_PERSONNEL_NAMES.forEach((n) => set.add(n));

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
};

/**
 * 嚴格區隔 負責 PM (億威) 與 TPM 窗口 (燁輝)
 */
export const separatePmAndTpm = (
    metaPm?: string | null,
    metaTpm?: string | null,
    docTpm?: string | null,
    docEgiga?: string | null
): { responsiblePm: string; tpmOfficeContact: string } => {
    const rawMetaPm = metaPm?.trim() || '';
    const rawMetaTpm = metaTpm?.trim() || '';
    const rawDocTpm = docTpm?.trim() || '';
    const rawDocEgiga = docEgiga?.trim() || '';

    let tpmOfficeContact = '';
    let responsiblePm = '';

    // TPM 判定：只要包含 TPM 人員關鍵字且非億威人員，一律歸類為 TPM 窗口
    if (isTpmPerson(rawMetaTpm)) {
        tpmOfficeContact = getCleanTpmName(rawMetaTpm);
    } else if (isTpmPerson(rawDocTpm)) {
        tpmOfficeContact = getCleanTpmName(rawDocTpm);
    } else if (isTpmPerson(rawMetaPm)) {
        tpmOfficeContact = getCleanTpmName(rawMetaPm);
    } else if (rawDocTpm && rawDocTpm !== rawDocEgiga && !rawDocTpm.includes('經理') && isTpmPerson(rawDocTpm)) {
        tpmOfficeContact = getCleanTpmName(rawDocTpm);
    }

    // 負責 PM 判定：TPM 人員絕不歸為負責 PM
    if (rawMetaPm && !isTpmPerson(rawMetaPm)) {
        responsiblePm = rawMetaPm;
    } else if (rawDocEgiga && !isTpmPerson(rawDocEgiga) && rawDocEgiga !== '王耀輝經理' && rawDocEgiga !== '尚未填寫') {
        responsiblePm = rawDocEgiga;
    } else if (rawDocTpm && !isTpmPerson(rawDocTpm)) {
        responsiblePm = rawDocTpm;
    }

    return { responsiblePm, tpmOfficeContact };
};
